"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, failIssue, firstIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { addDays, todayCO } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
import { parseLine } from "@/lib/granola/parse";
import { taskUpdateSchema } from "@/lib/tasks/schema";

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

export async function updateTask(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = taskUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);

  const { id, ...changes } = parsed.data;
  const { error } = await supabase.from("tasks").update(changes).eq("id", id);
  if (error) return fail("No se pudo guardar la tarea.");

  refresh();
  return ok("Tarea guardada.");
}

const idSchema = z.uuid();

export async function setTaskStatus(
  id: string,
  status: "open" | "waiting" | "done" | "dismissed",
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("Tarea inválida.");
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return fail("No se pudo actualizar la tarea.");
  refresh();
  return ok(status === "done" ? "¡Hecho!" : undefined);
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
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo eliminar la tarea.");
  refresh();
  return ok("Tarea eliminada.");
}
