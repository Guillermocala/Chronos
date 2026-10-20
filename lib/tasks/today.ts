import { addDays, daysBetween, type ISODate } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";

export type TodayTask = Pick<
  Tables<"tasks">,
  "id" | "kind" | "status" | "due_date" | "planned_on" | "auto_source" | "priority"
>;

export type TodayGroupKey =
  | "overdue"
  | "myDay"
  | "dueToday"
  | "followUps"
  | "payments"
  | "support";

export const TODAY_GROUPS: { key: TodayGroupKey; title: string; description: string }[] = [
  { key: "overdue", title: "Vencido", description: "Tareas con fecha límite pasada" },
  { key: "myDay", title: "Mi día", description: "Lo que planeaste hacer hoy" },
  { key: "dueToday", title: "Vence hoy", description: "Fecha límite hoy" },
  { key: "followUps", title: "Seguimientos para revisar", description: "Cosas que esperas de otras personas" },
  { key: "payments", title: "Cobros", description: "Pagos esperados vencidos o de hoy" },
  { key: "support", title: "Soporte por cerrar", description: "Ventanas de soporte que terminan en ≤ 3 días" },
];

/** Días de anticipación para mostrar el cierre de soporte en Hoy. */
export const SUPPORT_LOOKAHEAD_DAYS = 3;

const isOpen = (t: TodayTask) => t.status === "open" || t.status === "waiting";
const onOrBefore = (date: ISODate | null, limit: ISODate) =>
  date !== null && daysBetween(date, limit) >= 0;

/**
 * Clasifica las tareas abiertas en un único grupo de la vista Hoy (o ninguno).
 * Orden de precedencia: automáticas (cobros, soporte) → seguimientos → vencido →
 * Mi día → vence hoy. Dentro de cada grupo, por prioridad y fecha.
 */
export function groupTodayTasks<T extends TodayTask>(
  tasks: T[],
  today: ISODate,
): Record<TodayGroupKey, T[]> {
  const groups: Record<TodayGroupKey, T[]> = {
    overdue: [],
    myDay: [],
    dueToday: [],
    followUps: [],
    payments: [],
    support: [],
  };

  for (const task of tasks) {
    if (!isOpen(task)) continue;
    const due = task.due_date;

    if (task.auto_source === "payment") {
      if (onOrBefore(due, today)) groups.payments.push(task);
    } else if (task.auto_source === "delivery") {
      if (onOrBefore(due, addDays(today, SUPPORT_LOOKAHEAD_DAYS))) groups.support.push(task);
    } else if (task.kind === "follow_up" && (onOrBefore(due, today) || onOrBefore(task.planned_on, today))) {
      groups.followUps.push(task);
    } else if (due !== null && daysBetween(due, today) > 0) {
      groups.overdue.push(task);
    } else if (onOrBefore(task.planned_on, today)) {
      groups.myDay.push(task);
    } else if (due === today) {
      groups.dueToday.push(task);
    }
  }

  const byPriorityThenDate = (a: T, b: T) =>
    a.priority - b.priority || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  for (const key of Object.keys(groups) as TodayGroupKey[]) {
    groups[key].sort(byPriorityThenDate);
  }
  return groups;
}
