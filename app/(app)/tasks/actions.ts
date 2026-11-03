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
import { planCompletionHours } from "@/lib/tasks/hours";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/tasks/schema";
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

/**
 * Registra las horas que tomó una tarea: de proyecto → horas directas al
 * proyecto (cuentan en Horas y OPS); personal → `spent_hours` de la tarea.
 */
async function recordTaskHours(supabase: Supabase, taskId: string, hours: number | null): Promise<boolean> {
  if (hours == null) return true;
  const { data: task, error } = await supabase
    .from("tasks")
    .select("project_id, spent_hours, estimated_hours")
    .eq("id", taskId)
    .single();
  if (error) return false;
  const plan = planCompletionHours(task, hours);
  if (plan.kind === "entry") {
    // Mediodía en Colombia para que la fecha no cambie por zona horaria (como logTime).
    const at = `${todayCO()}T12:00:00-05:00`;
    const { error: entryError } = await supabase.from("time_entries").insert({
      project_id: plan.project_id,
      task_id: taskId,
      started_at: at,
      ended_at: at,
      hours: plan.hours,
    });
    return !entryError;
  }
  if (plan.kind === "spent") {
    const { error: spentError } = await supabase.from("tasks").update({ spent_hours: plan.hours }).eq("id", taskId);
    return !spentError;
  }
  return true;
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

  const { id, add_hours, ...changes } = parsed.data;
  const { error } = await supabase.from("tasks").update(changes).eq("id", id);
  if (error) return fail("No se pudo guardar la tarea.");
  if (changes.status === "done" && add_hours != null && !(await recordTaskHours(supabase, id, add_hours))) {
    refresh();
    return fail("La tarea se guardó, pero no se pudieron registrar las horas.");
  }

  refresh();
  return ok("Tarea guardada.", undefined, add_hours != null ? `Horas registradas: ${formatDuration(add_hours)}.` : undefined);
}

const idSchema = z.uuid();
const completionHours = z.number().positive().max(24).nullable();

/** Completa una tarea registrando antes las horas que tomó (opcional). */
export async function completeTask(id: string, hours: number | null): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Tarea inválida.");
  if (!completionHours.safeParse(hours).success) return fail("Horas inválidas (máx. 24 h).");

  // Primero las horas: así el valor ganado ya usa las horas reales.
  if (!(await recordTaskHours(supabase, id, hours))) return fail("No se pudieron registrar las horas.");
  const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", id);
  if (error) return fail("No se pudo completar la tarea.");
  refresh();

  const event = await evaluateQuestProgress(supabase, id, todayCO());
  const result = questMessage(event);
  const hoursNote = hours != null ? `⏱️ ${formatDuration(hours)} registradas.` : null;
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
