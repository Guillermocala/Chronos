// Totales de un grupo de tareas para los encabezados: valor, horas estimadas y reales.

import type { Reward } from "@/lib/quests/reward";

import { realHours, type HoursTask } from "./hours";

export type GroupSummary = { count: number; cop: number; estimated: number; real: number };

type SummaryTask = { id: string } & Pick<HoursTask, "estimated_hours" | "spent_hours" | "logged">;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeTasks(tasks: SummaryTask[], rewards: Record<string, Reward | undefined> = {}): GroupSummary {
  let cop = 0;
  let estimated = 0;
  let real = 0;
  for (const t of tasks) {
    cop += rewards[t.id]?.cop ?? 0;
    estimated += Number(t.estimated_hours ?? 0);
    real += realHours(t);
  }
  return { count: tasks.length, cop, estimated: round2(estimated), real: round2(real) };
}
