"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, failIssue, firstIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { listProjectRates, type ProjectRate } from "@/lib/data/projects";
import { evaluateQuestProgress } from "@/lib/data/quests";
import { questMessage } from "@/lib/quests/messages";
import { addDays, todayCO } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
import { parseLine } from "@/lib/granola/parse";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import {
  appendCompletionNote,
  defaultCompletionHours,
  planCompletionHours,
  planRealHoursEdit,
} from "@/lib/tasks/hours";
import { driveLink, taskCreateSchema, taskUpdateSchema } from "@/lib/tasks/schema";
import { rebalance } from "@/lib/tickets/ordering";
import { formatDuration } from "@/lib/time";

// Las tareas aparecen en Hoy, Tareas y el detalle de proyecto: se refresca todo.
function refresh() {
  revalidatePath("/", "layout");
}

const quickAddSchema = z.object({
  text: z.string().trim().min(1, "Escribe la tarea.").max(500),
  project_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()).optional(),
  my_day: z.preprocess((v) => v === "on" || v === "true", z.boolean()).optional(),
});

/** "+ Tarea": acepta los mismos marcadores que el dictado (@WEB !mañana #alta …). */
export async function quickAddTask(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const input = quickAddSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return fail(firstIssue(input.error));

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, code_prefix")
    .is("deleted_at", null);
  if (projectsError) return fail("No se pudieron cargar los proyectos.");

  const today = todayCO();
  const item = parseLine(input.data.text, { projects, today });
  if (!item.title) return fail("La tarea no tiene título.");

  const { error } = await supabase.from("tasks").insert({
    title: item.title,
    kind: item.type === "follow_up" ? "follow_up" : "todo",
    status: item.type === "follow_up" && item.waiting_on ? "waiting" : "open",
    priority: item.priority,
    due_date: item.due_date,
    planned_on: input.data.my_day ? today : null,
    waiting_on: item.waiting_on,
    tags: item.tags,
    project_id: item.projectId ?? input.data.project_id ?? null,
    doc_url: item.doc_url,
    doc_kind: item.doc_kind,
    estimated_hours: item.estimated_hours,
  });
  if (error) return fail("No se pudo crear la tarea.");

  refresh();
  const details = [
    item.projectPrefix && item.projectId ? `@${item.projectPrefix}` : null,
    item.due_date ? `vence ${formatShortDate(item.due_date)}` : null,
    input.data.my_day ? "en Mi día" : null,
  ].filter(Boolean);
  return ok(
    `Creada: ${item.title}${details.length ? ` (${details.join(", ")})` : ""}`,
    item.warnings,
  );
}

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

const HOURS_SELECT = "project_id, spent_hours, estimated_hours, logged:time_entries(id, hours, started_at, deleted_at)";

async function loadHoursTask(supabase: Supabase, taskId: string) {
  const { data, error } = await supabase.from("tasks").select(HOURS_SELECT).eq("id", taskId).single();
  return error ? null : data;
}

// Mediodía en Colombia para que la fecha no cambie por zona horaria (como logTime).
const noonCO = () => `${todayCO()}T12:00:00-05:00`;

/**
 * Registra las horas que tomó una tarea: de proyecto → horas directas al
 * proyecto (cuentan en Horas y OPS); personal → `spent_hours` de la tarea.
 * Sin horas escritas y con `useEstimate`, registra lo que falte para el estimado.
 * Devuelve las horas registradas (0 si ninguna) o null si falló.
 */
async function recordTaskHours(
  supabase: Supabase,
  taskId: string,
  hours: number | null,
  { useEstimate = false, note = null }: { useEstimate?: boolean; note?: string | null } = {},
): Promise<number | null> {
  if (hours == null && !useEstimate) return 0;
  const task = await loadHoursTask(supabase, taskId);
  if (!task) return null;
  const toRecord = hours ?? defaultCompletionHours(task);
  const plan = planCompletionHours(task, toRecord);
  if (plan.kind === "entry") {
    const at = noonCO();
    const { error: entryError } = await supabase.from("time_entries").insert({
      project_id: plan.project_id,
      task_id: taskId,
      started_at: at,
      ended_at: at,
      hours: plan.hours,
      note,
    });
    return entryError ? null : plan.hours;
  }
  if (plan.kind === "spent") {
    const { error: spentError } = await supabase.from("tasks").update({ spent_hours: plan.hours }).eq("id", taskId);
    return spentError ? null : toRecord;
  }
  return 0;
}

/** Fija el total de horas reales de una tarea (editor). Devuelve false si falló. */
async function setTaskRealHours(supabase: Supabase, taskId: string, total: number | null): Promise<boolean> {
  const task = await loadHoursTask(supabase, taskId);
  if (!task) return false;
  const plan = planRealHoursEdit(task, total);
  if (plan.kind === "none") return true;
  if (plan.kind === "spent") {
    const { error } = await supabase.from("tasks").update({ spent_hours: plan.spent_hours }).eq("id", taskId);
    return !error;
  }
  // Proyecto: soft delete de los registros vivos y uno nuevo con el total, en la fecha del primero.
  const live = (task.logged ?? []).filter((e) => !e.deleted_at);
  const at = live.map((e) => e.started_at).sort()[0] ?? noonCO();
  if (live.length > 0) {
    const { error } = await supabase
      .from("time_entries")
      .update({ deleted_at: new Date().toISOString() })
      .in(
        "id",
        live.map((e) => e.id),
      );
    if (error) return false;
  }
  const { error: spentError } = await supabase.from("tasks").update({ spent_hours: null }).eq("id", taskId);
  if (spentError) return false;
  if (plan.hours == null) return true;
  const { error } = await supabase.from("time_entries").insert({
    project_id: plan.project_id,
    task_id: taskId,
    started_at: at,
    ended_at: at,
    hours: plan.hours,
  });
  return !error;
}

/** "Nueva tarea" detallada: todos los campos, con fecha de inicio (Mi día) hoy por defecto en el formulario. */
export async function createTask(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = taskCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);
  const task = parsed.data;

  const { error } = await supabase.from("tasks").insert(task);
  if (error) return fail("No se pudo crear la tarea.");
  refresh();

  const today = todayCO();
  const details = [
    task.planned_on === today ? "en Mi día" : task.planned_on ? `inicia ${formatShortDate(task.planned_on)}` : null,
    task.due_date ? `vence ${formatShortDate(task.due_date)}` : null,
    task.estimated_hours != null ? `~${formatDuration(task.estimated_hours)}` : "horas al completarla",
  ].filter(Boolean);
  return ok(`Creada: ${task.title}`, undefined, details.join(" · "));
}

export async function updateTask(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = taskUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);

  const { id, real_hours, ...changes } = parsed.data;
  const { error } = await supabase.from("tasks").update(changes).eq("id", id);
  if (error) return fail("No se pudo guardar la tarea.");
  // Las horas van después: si cambió el proyecto, el registro queda en el proyecto nuevo.
  if (real_hours !== undefined && !(await setTaskRealHours(supabase, id, real_hours))) {
    refresh();
    return fail("La tarea se guardó, pero no se pudieron actualizar las horas reales.");
  }

  refresh();
  return ok("Tarea guardada.");
}

const idSchema = z.uuid();
const completionHours = z.number().positive().max(24).nullable();

const completionExtras = z
  .object({
    notes: z.string().trim().max(5000).optional(),
    /** Ausente = no se toca el documento; vacío = se quita. */
    doc: driveLink.optional(),
  })
  .optional();

export type CompletionExtras = { notes?: string; doc?: string };

/**
 * Completa una tarea registrando antes las horas que tomó. Sin horas
 * ("Omitir"), registra las estimadas que falten. Las notas se agregan a las de
 * la tarea (y al registro de horas si es de proyecto); el documento la reemplaza.
 */
export async function completeTask(
  id: string,
  hours: number | null,
  extras?: CompletionExtras,
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Tarea inválida.");
  if (!completionHours.safeParse(hours).success) return fail("Horas inválidas (máx. 24 h).");
  const parsedExtras = completionExtras.safeParse(extras);
  if (!parsedExtras.success) return fail(firstIssue(parsedExtras.error));
  const note = parsedExtras.data?.notes || null;
  const doc = parsedExtras.data?.doc;

  // Primero las horas: así el valor ganado ya usa las horas reales.
  const recorded = await recordTaskHours(supabase, id, hours, { useEstimate: true, note });
  if (recorded === null) return fail("No se pudieron registrar las horas.");

  const changes: TablesUpdate<"tasks"> = { status: "done" };
  if (note) {
    const { data: current, error: notesError } = await supabase.from("tasks").select("notes").eq("id", id).single();
    if (notesError) return fail("No se pudo completar la tarea.");
    changes.notes = appendCompletionNote(current.notes, note, todayCO());
  }
  if (doc) Object.assign(changes, doc);
  const { error } = await supabase.from("tasks").update(changes).eq("id", id);
  if (error) return fail("No se pudo completar la tarea.");
  refresh();

  const event = await evaluateQuestProgress(supabase, id, todayCO());
  const result = questMessage(event);
  const hoursNote =
    recorded > 0 ? `⏱️ ${formatDuration(recorded)} registradas${hours == null ? " (estimado)" : ""}.` : null;
  return {
    ok: true,
    ...result,
    description: [hoursNote, result.description].filter(Boolean).join(" ") || undefined,
  };
}

/** Proyectos abiertos con su tarifa estimada, para el formulario de nueva tarea. */
export async function getTaskFormOptions(): Promise<ProjectRate[]> {
  return listProjectRates();
}

export async function setTaskStatus(
  id: string,
  status: "open" | "waiting" | "done" | "dismissed",
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Tarea inválida.");
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return fail("No se pudo actualizar la tarea.");
  refresh();
  if (status !== "done") return ok();
  // Misiones: valor ganado, día cumplido, jefe derrotado y logros nuevos.
  const event = await evaluateQuestProgress(supabase, id, todayCO());
  return { ok: true, ...questMessage(event) };
}

const reorderSchema = z.array(z.uuid()).min(1).max(200);

/**
 * Orden manual de Mi día: recibe la lista completa en el nuevo orden y deja
 * posiciones limpias (1000, 2000…). Solo escribe las que cambian.
 */
export async function reorderMyDay(orderedIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = reorderSchema.safeParse(orderedIds);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return fail("Orden inválido.");

  const { data: current, error: readError } = await supabase
    .from("tasks")
    .select("id, day_position")
    .in("id", parsed.data);
  if (readError) return fail("No se pudo cambiar el orden.");
  const before = new Map(current.map((t) => [t.id, t.day_position]));

  const positions = [...rebalance(parsed.data)].filter(([id, pos]) => before.has(id) && before.get(id) !== pos);
  const results = await Promise.all(
    positions.map(([id, day_position]) => supabase.from("tasks").update({ day_position }).eq("id", id)),
  );
  if (results.some((r) => r.error)) return fail("No se pudo guardar el orden.");
  if (positions.length) refresh();
  return ok();
}

/** Agrega a Mi día (hoy) o la quita (null). */
export async function planTask(id: string, myDay: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Tarea inválida.");
  const { error } = await supabase
    .from("tasks")
    .update({ planned_on: myDay ? todayCO() : null })
    .eq("id", id);
  if (error) return fail("No se pudo actualizar la tarea.");
  refresh();
  return ok(myDay ? "Agregada a Mi día." : "Quitada de Mi día.");
}

/** Pospone N días desde hoy: mueve la fecha límite y, si estaba en Mi día, también el plan. */
export async function snoozeTask(id: string, days: number): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(id).success || !Number.isInteger(days) || days < 1 || days > 60) {
    return fail("Datos inválidos.");
  }
  const { data: task, error: readError } = await supabase
    .from("tasks")
    .select("due_date, planned_on")
    .eq("id", id)
    .single();
  if (readError) return fail("No se encontró la tarea.");

  const target = addDays(todayCO(), days);
  const changes: { due_date?: string; planned_on?: string } = {};
  if (task.due_date || !task.planned_on) changes.due_date = target;
  if (task.planned_on) changes.planned_on = target;

  const { error } = await supabase.from("tasks").update(changes).eq("id", id);
  if (error) return fail("No se pudo posponer la tarea.");
  refresh();
  return ok(`Pospuesta para ${formatShortDate(target)}.`);
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Tarea inválida.");
  const deletedAt = new Date().toISOString();
  const { error } = await supabase.from("tasks").update({ deleted_at: deletedAt }).eq("id", id);
  if (error) return fail("No se pudo eliminar la tarea.");
  // Las horas ligadas (actividades cargadas) se van con la tarea; mismo instante
  // para que "Deshacer" las restaure juntas.
  await supabase
    .from("time_entries")
    .update({ deleted_at: deletedAt })
    .eq("task_id", id)
    .is("deleted_at", null);
  refresh();
  return ok("Tarea eliminada.");
}
