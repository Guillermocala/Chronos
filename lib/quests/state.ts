// Estado completo del juego a partir del historial de misiones completadas.
// Puro: la capa de datos (lib/data/quests.ts) solo trae filas y calcula el valor de cada una.

import { addDays, daysBetween, type ISODate } from "@/lib/dates";
import { dateInBogota, mondayOf } from "@/lib/reports/hours";

import type { QuestStats } from "./achievements";
import { weeklyBoss, type WeeklyBoss } from "./boss";
import {
  activeGoal,
  countWorkDays,
  goalProgress,
  periodRange,
  type GoalProgress,
  type QuestGoal,
} from "./goals";
import { computeStreak, isWorkDay, type QuestSettings, type Streak } from "./streak";

export type DoneMission = {
  completed_at: string;
  cop: number;
  personal: boolean;
};

export type DayTotals = { count: number; earned: number };

export type WeekHistory = {
  week: ISODate;
  earned: number;
  target: number | null;
  defeated: boolean;
};

export type MonthPoint = { date: ISODate; earned: number | null; expected: number | null };

export type QuestState = {
  today: ISODate;
  todayTotals: DayTotals & { goalMet: boolean; min: number };
  streak: Streak;
  week: GoalProgress | null;
  month: GoalProgress | null;
  boss: WeeklyBoss;
  weeks: WeekHistory[];
  monthDaily: MonthPoint[];
  stats: QuestStats;
};

export const HISTORY_WEEKS = 8;

function sumRange(byDay: Map<ISODate, DayTotals>, start: ISODate, end: ISODate): DayTotals {
  const total = { count: 0, earned: 0 };
  for (let d = start; daysBetween(d, end) >= 0; d = addDays(d, 1)) {
    const t = byDay.get(d);
    if (t) {
      total.count += t.count;
      total.earned += t.earned;
    }
  }
  return total;
}

export function groupByDay(done: DoneMission[]): Map<ISODate, DayTotals> {
  const byDay = new Map<ISODate, DayTotals>();
  for (const m of done) {
    const day = dateInBogota(m.completed_at);
    const t = byDay.get(day) ?? { count: 0, earned: 0 };
    t.count += 1;
    t.earned += m.cop;
    byDay.set(day, t);
  }
  return byDay;
}

export function buildQuestState(input: {
  done: DoneMission[];
  today: ISODate;
  settings: QuestSettings;
  goals: QuestGoal[];
}): QuestState {
  const { done, today, settings, goals } = input;
  const byDay = groupByDay(done);
  const min = Math.max(settings.daily_min_tasks, 1);
  const completedDays = new Set([...byDay].filter(([, t]) => t.count >= min).map(([d]) => d));
  const streak = computeStreak(completedDays, today, settings);
  const todayTotals = byDay.get(today) ?? { count: 0, earned: 0 };

  // Semana y mes en curso.
  const progressOf = (period: "week" | "month") => {
    const range = periodRange(period, today);
    const goal = activeGoal(goals, period, range.start);
    if (!goal) return null;
    const totals = sumRange(byDay, range.start, range.end);
    return goalProgress({
      range,
      target: goal.target_cop,
      earned: totals.earned,
      tasksDone: totals.count,
      targetTasks: goal.target_tasks,
      today,
      settings,
    });
  };
  const week = progressOf("week");
  const month = progressOf("month");
  const thisMonday = mondayOf(today);
  const boss = weeklyBoss(thisMonday, week?.target ?? null, sumRange(byDay, thisMonday, addDays(thisMonday, 6)).earned);

  // Historial de semanas desde la primera con datos (para logros) y las últimas N (para la gráfica).
  const days = [...byDay.keys()].sort();
  const firstMonday = days.length ? mondayOf(days[0]) : thisMonday;
  const chartStart = addDays(thisMonday, -7 * (HISTORY_WEEKS - 1));
  const historyStart = daysBetween(firstMonday, chartStart) > 0 ? firstMonday : chartStart;
  const allWeeks: (WeekHistory & { perfect: boolean })[] = [];
  for (let w = historyStart; daysBetween(w, thisMonday) >= 0; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    const earned = sumRange(byDay, w, end).earned;
    const target = activeGoal(goals, "week", w)?.target_cop ?? null;
    const workDays: ISODate[] = [];
    for (let d = w; daysBetween(d, end) >= 0; d = addDays(d, 1)) if (isWorkDay(d, settings)) workDays.push(d);
    const isPast = daysBetween(end, today) > 0;
    allWeeks.push({
      week: w,
      earned,
      target,
      defeated: target != null && earned >= target,
      perfect: isPast && workDays.length > 0 && workDays.every((d) => completedDays.has(d)),
    });
  }

  let bossesDefeated = 0;
  let run = 0;
  let maxConsecutiveBosses = 0;
  for (const w of allWeeks) {
    if (w.defeated) {
      bossesDefeated += 1;
      run += 1;
      maxConsecutiveBosses = Math.max(maxConsecutiveBosses, run);
    } else if (w.week !== thisMonday) {
      run = 0;
    }
  }

  // Meses cumplidos (desde el primero con datos).
  let monthsCompleted = 0;
  if (days.length) {
    let cursor = periodRange("month", days[0]).start;
    while (daysBetween(cursor, today) >= 0) {
      const range = periodRange("month", cursor);
      const goal = activeGoal(goals, "month", range.start);
      if (goal && sumRange(byDay, range.start, range.end).earned >= goal.target_cop) monthsCompleted += 1;
      cursor = addDays(range.end, 1);
    }
  }

  // Avance acumulado del mes contra el ritmo esperado.
  const monthRange = periodRange("month", today);
  const monthTotalWork = Math.max(countWorkDays(monthRange.start, monthRange.end, settings), 1);
  const monthDaily: MonthPoint[] = [];
  let cumulative = 0;
  for (let d = monthRange.start; daysBetween(d, monthRange.end) >= 0; d = addDays(d, 1)) {
    const isFuture = daysBetween(today, d) > 0;
    if (!isFuture) cumulative += byDay.get(d)?.earned ?? 0;
    monthDaily.push({
      date: d,
      earned: isFuture ? null : cumulative,
      expected: month ? Math.round((month.target * countWorkDays(monthRange.start, d, settings)) / monthTotalWork) : null,
    });
  }

  return {
    today,
    todayTotals: { ...todayTotals, goalMet: todayTotals.count >= min, min },
    streak,
    week,
    month,
    boss,
    weeks: allWeeks.slice(-HISTORY_WEEKS).map(({ week: w, earned, target, defeated }) => ({ week: w, earned, target, defeated })),
    monthDaily,
    stats: {
      totalMissions: done.length,
      personalMissions: done.filter((m) => m.personal).length,
      totalEarned: done.reduce((s, m) => s + m.cop, 0),
      bestStreak: streak.best,
      bossesDefeated,
      maxConsecutiveBosses,
      monthsCompleted,
      perfectWeeks: allWeeks.filter((w) => w.perfect).length,
    },
  };
}
