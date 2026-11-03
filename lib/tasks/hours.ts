// Horas reales de una tarea y qué hacer con las horas que se informan al completarla.

import type { Tables } from "@/lib/supabase/database.types";

export type HoursTask = Pick<Tables<"tasks">, "estimated_hours" | "spent_hours" | "project_id"> & {
  /** Horas registradas a la tarea (incluye borradas; se filtran aquí). */
  logged?: { hours: number | null; deleted_at: string | null }[];
};

/** Horas registradas (time_entries) + horas informadas en tareas personales. */
export function realHours(task: Omit<HoursTask, "estimated_hours" | "project_id">): number {
  const logged = (task.logged ?? []).reduce(
    (sum, e) => (e.deleted_at || e.hours == null ? sum : sum + Number(e.hours)),
    0,
  );
  return Math.round((logged + Number(task.spent_hours ?? 0)) * 100) / 100;
}

/** Sin estimado ni horas: al completarla se pregunta cuánto tomó. */
export function needsHoursOnComplete(task: HoursTask): boolean {
  return task.estimated_hours == null && realHours(task) === 0;
}

export type CompletionHours =
  | { kind: "none" }
  | { kind: "entry"; project_id: string; hours: number }
  | { kind: "spent"; hours: number };

/**
 * Dónde van las horas informadas:
 * - tarea de proyecto → un registro de horas directo al proyecto (cuenta en Horas y OPS);
 * - tarea personal → `spent_hours` de la tarea (se suma a lo que ya tenía).
 */
export function planCompletionHours(task: HoursTask, hours: number | null): CompletionHours {
  if (hours == null || hours <= 0) return { kind: "none" };
  if (task.project_id) return { kind: "entry", project_id: task.project_id, hours };
  return { kind: "spent", hours: Math.round((Number(task.spent_hours ?? 0) + hours) * 100) / 100 };
}
