// Metas semanal y mensual en COP: cuánto llevas, a qué ritmo deberías ir y la proyección.

import { addDays, daysBetween, daysInMonth, makeISODate, type ISODate } from "@/lib/dates";
import { mondayOf } from "@/lib/reports/hours";

import { isWorkDay, type QuestSettings } from "./streak";

export type GoalPeriod = "week" | "month";

export type QuestGoal = {
  period: GoalPeriod;
  target_cop: number;
  target_tasks: number | null;
  effective_from: ISODate;
};

export type PeriodRange = { start: ISODate; end: ISODate };

export function periodRange(period: GoalPeriod, date: ISODate): PeriodRange {
  if (period === "week") {
    const start = mondayOf(date);
    return { start, end: addDays(start, 6) };
  }
  const [y, m] = date.split("-").map(Number);
  return { start: makeISODate(y, m, 1)!, end: makeISODate(y, m, daysInMonth(y, m))! };
}

/** Meta vigente de un período: la de `effective_from` más reciente que ya aplicaba al empezar el período. */
export function activeGoal(
  goals: QuestGoal[],
  period: GoalPeriod,
  periodStart: ISODate,
): QuestGoal | null {
  let found: QuestGoal | null = null;
  for (const g of goals) {
    if (g.period !== period || daysBetween(g.effective_from, periodStart) < 0) continue;
    if (!found || g.effective_from > found.effective_from) found = g;
  }
  return found;
}

/** Días laborables en [from, to], ambos incluidos (0 si `to` es anterior). */
export function countWorkDays(from: ISODate, to: ISODate, settings: QuestSettings): number {
  let n = 0;
  for (let d = from; daysBetween(d, to) >= 0; d = addDays(d, 1)) {
    if (isWorkDay(d, settings)) n += 1;
  }
  return n;
}

export type GoalProgress = {
  range: PeriodRange;
  target: number;
  earned: number;
  /** 0..∞ (1 = meta cumplida). */
  ratio: number;
  /** Lo que deberías llevar al empezar hoy, según los días laborables ya pasados. */
  expected: number;
  /** earned − expected: positivo = adelante. */
  diff: number;
  /** Cierre estimado si sigues al ritmo actual. */
  projection: number;
  remaining: number;
  /** Días laborables que quedan, contando hoy. */
  workDaysLeft: number;
  /** Lo que falta repartido entre los días laborables que quedan. */
  perDayNeeded: number;
  tasksDone: number;
  targetTasks: number | null;
};

export function goalProgress(input: {
  range: PeriodRange;
  target: number;
  earned: number;
  tasksDone: number;
  targetTasks: number | null;
  today: ISODate;
  settings: QuestSettings;
}): GoalProgress {
  const { range, target, earned, today, settings } = input;
  const total = Math.max(countWorkDays(range.start, range.end, settings), 1);
  const clamp = (d: ISODate) =>
    daysBetween(d, range.start) > 0 ? addDays(range.start, -1) : daysBetween(range.end, d) > 0 ? range.end : d;
  const elapsedBefore = countWorkDays(range.start, clamp(addDays(today, -1)), settings);
  const elapsedThrough = countWorkDays(range.start, clamp(today), settings);

  const expected = Math.round((target * elapsedBefore) / total);
  const projection = elapsedThrough > 0 ? Math.round((earned / elapsedThrough) * total) : earned;
  const remaining = Math.max(target - earned, 0);
  const workDaysLeft = total - elapsedBefore;

  return {
    range,
    target,
    earned,
    ratio: target > 0 ? earned / target : 0,
    expected,
    diff: earned - expected,
    projection: Math.max(projection, earned),
    remaining,
    workDaysLeft: Math.max(workDaysLeft, 0),
    perDayNeeded: workDaysLeft > 0 ? Math.round(remaining / workDaysLeft) : remaining,
    tasksDone: input.tasksDone,
    targetTasks: input.targetTasks,
  };
}
