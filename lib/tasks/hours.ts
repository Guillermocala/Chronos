// Horas reales de una tarea y qué hacer con las horas que se informan al completarla.

import type { ISODate } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
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

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Horas que se registran al completar si no se escribe nada ("Omitir"):
 * lo que falte para llegar al estimado. Null si no hay estimado o ya se cubrió.
 */
export function defaultCompletionHours(task: HoursTask): number | null {
  if (task.estimated_hours == null) return null;
  const missing = round2(Number(task.estimated_hours) - realHours(task));
  return missing > 0 ? missing : null;
}

/** Botones − / + del diálogo: lleva al cuarto de hora y suma o resta 15 min (0,25 h … 24 h). */
export function stepHours(current: number | null, delta: 1 | -1): number {
  const quarters = Math.round((current ?? 0) * 4);
  const next = (quarters + delta) / 4;
  return Math.min(24, Math.max(0.25, next));
}

/** Agrega la nota escrita al completar al final de las notas de la tarea, con la fecha. */
export function appendCompletionNote(
  existing: string | null,
  note: string | null | undefined,
  date: ISODate,
): string | null {
  const text = note?.trim();
  if (!text) return existing;
  const entry = `— Al completar (${formatShortDate(date)}): ${text}`;
  return existing?.trim() ? `${existing.trimEnd()}\n\n${entry}` : entry;
}

export type RealHoursEdit =
  | { kind: "none" }
  /** Personal: nuevo `spent_hours` (null = sin horas). */
  | { kind: "spent"; spent_hours: number | null }
  /** Proyecto: se reemplazan los registros de la tarea por uno con el total (null = sin registro). */
  | { kind: "replace"; project_id: string; hours: number | null };

/** Corregir el total de horas reales desde el editor de la tarea. */
export function planRealHoursEdit(task: HoursTask, total: number | null): RealHoursEdit {
  const target = total != null && total > 0 ? round2(total) : 0;
  if (Math.abs(target - realHours(task)) < 0.005) return { kind: "none" };
  if (task.project_id) return { kind: "replace", project_id: task.project_id, hours: target > 0 ? target : null };
  const logged = realHours({ logged: task.logged, spent_hours: null });
  const spent = round2(target - logged);
  return { kind: "spent", spent_hours: spent > 0 ? spent : null };
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
