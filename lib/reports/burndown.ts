import { addDays, daysBetween, type ISODate } from "@/lib/dates";

import { dateInBogota } from "./hours";

export type BurndownTicket = { estimated_hours: number | string | null; done_at: string | null };

export type BurndownPoint = {
  date: ISODate;
  /** Horas estimadas pendientes al final del día; null en días futuros. */
  remaining: number | null;
  ideal: number;
};

/**
 * Burndown por horas estimadas: cada día resta lo estimado de los tickets cerrados
 * hasta ese día. La línea ideal baja de forma lineal de total a 0.
 */
export function sprintBurndown(
  sprint: { start_date: ISODate; end_date: ISODate },
  tickets: BurndownTicket[],
  today: ISODate,
): BurndownPoint[] {
  const days = daysBetween(sprint.start_date, sprint.end_date) + 1;
  if (days <= 0) return [];
  const total = tickets.reduce((sum, t) => sum + Number(t.estimated_hours ?? 0), 0);
  const closed = tickets
    .filter((t) => t.done_at)
    .map((t) => ({ date: dateInBogota(t.done_at!), hours: Number(t.estimated_hours ?? 0) }));

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(sprint.start_date, i);
    const done = closed.filter((c) => daysBetween(c.date, date) >= 0).reduce((sum, c) => sum + c.hours, 0);
    return {
      date,
      remaining: daysBetween(date, today) >= 0 ? Math.round((total - done) * 100) / 100 : null,
      ideal: Math.round(total * (1 - (days === 1 ? 1 : i / (days - 1))) * 100) / 100,
    };
  });
}
