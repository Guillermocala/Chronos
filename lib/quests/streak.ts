// Rachas: días laborables cumplidos seguidos. Se derivan del historial, sin tabla.

import { addDays, daysBetween, weekday, type ISODate } from "@/lib/dates";
import { mondayOf } from "@/lib/reports/hours";

export type QuestSettings = {
  /** Misiones mínimas para que un día cuente como cumplido. */
  daily_min_tasks: number;
  /** Días laborables (0 = domingo … 6 = sábado). */
  work_days: number[];
};

export const DEFAULT_QUEST_SETTINGS: QuestSettings = {
  daily_min_tasks: 3,
  work_days: [1, 2, 3, 4, 5],
};

export const isWorkDay = (date: ISODate, settings: QuestSettings) =>
  settings.work_days.includes(weekday(date));

export type Streak = {
  current: number;
  best: number;
  /** El comodín de esta semana (lunes a domingo) sigue sin usarse. */
  freezeAvailable: boolean;
  /** Días en que se gastó un comodín (para marcarlos en la UI). */
  frozenDays: ISODate[];
};

/**
 * Recorre los días desde el primero cumplido hasta hoy:
 * - día cumplido (laborable o no) → suma 1;
 * - día no laborable sin cumplir → no rompe ni suma;
 * - día laborable sin cumplir → usa el comodín de su semana (1 por semana) si hay
 *   racha que proteger; si no queda comodín, la racha vuelve a 0;
 * - hoy sin cumplir todavía no rompe nada (el día sigue en juego).
 */
export function computeStreak(
  completedDays: ReadonlySet<ISODate>,
  today: ISODate,
  settings: QuestSettings,
): Streak {
  const usedFreezeWeeks = new Set<ISODate>();
  const frozenDays: ISODate[] = [];
  const first = [...completedDays].sort()[0];
  let current = 0;
  let best = 0;

  if (first && daysBetween(first, today) >= 0) {
    for (let day = first; daysBetween(day, today) >= 0; day = addDays(day, 1)) {
      if (completedDays.has(day)) {
        current += 1;
        best = Math.max(best, current);
        continue;
      }
      if (day === today || !isWorkDay(day, settings) || current === 0) continue;
      const week = mondayOf(day);
      if (!usedFreezeWeeks.has(week)) {
        usedFreezeWeeks.add(week);
        frozenDays.push(day);
      } else {
        current = 0;
      }
    }
  }

  return {
    current,
    best,
    freezeAvailable: !usedFreezeWeeks.has(mondayOf(today)),
    frozenDays,
  };
}
