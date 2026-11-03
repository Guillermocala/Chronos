import { describe, expect, it } from "vitest";

import type { ProjectBilling } from "@/lib/valuation";

import { ACHIEVEMENTS, newlyUnlocked, type QuestStats } from "./achievements";
import { bossOf, weeklyBoss } from "./boss";
import { activeGoal, countWorkDays, goalProgress, periodRange, type QuestGoal } from "./goals";
import { isMission, taskReward } from "./reward";
import { buildQuestState } from "./state";
import { computeStreak, DEFAULT_QUEST_SETTINGS as S } from "./streak";

const ops: ProjectBilling = {
  billing_type: "hourly_adjusted",
  monthly_fee_cop: 3_500_000,
  expected_hours_per_month: 160,
  contract_months: null,
  fixed_amount_cop: null,
  estimated_total_hours: null,
};
const fixed: ProjectBilling = {
  billing_type: "fixed",
  fixed_amount_cop: 5_000_000,
  estimated_total_hours: 100,
  monthly_fee_cop: null,
  expected_hours_per_month: null,
  contract_months: null,
};
const task = (over: Partial<Parameters<typeof taskReward>[0]> = {}) => ({
  estimated_hours: null,
  project_id: "p1",
  ticket_id: null,
  ...over,
});

describe("valor de una misión", () => {
  it("OPS: horas estimadas × mensualidad ÷ horas pactadas", () => {
    const r = taskReward(task({ estimated_hours: 2 }), ops);
    expect(r).toMatchObject({ cop: 43_750, source: "estimate", hours: 2, rate: 21_875, personal: false });
  });

  it("fijo: usa las horas de alcance de los tickets si se conocen", () => {
    expect(taskReward(task({ estimated_hours: 1 }), fixed).cop).toBe(50_000);
    expect(taskReward(task({ estimated_hours: 1 }), { ...fixed, scope_estimated: 125 }).cop).toBe(40_000);
  });

  it("personal (sin proyecto) vale 0 y se marca como personal", () => {
    expect(taskReward(task({ project_id: null, estimated_hours: 3 }), null)).toMatchObject({ cop: 0, personal: true, source: "none" });
  });

  it("sin estimado usa las horas registradas no borradas", () => {
    const r = taskReward(
      task({ logged: [{ hours: 1.5, deleted_at: null }, { hours: 4, deleted_at: "2026-11-01" }] }),
      ops,
    );
    expect(r).toMatchObject({ cop: 32_813, source: "logged", hours: 1.5 });
  });

  it("ticket de alcance con estimado manda; soporte vale 0 con costo de oportunidad", () => {
    expect(taskReward(task({ estimated_hours: 1 }), ops, { kind: "scope", billable: true, estimated_hours: 4 }).cop).toBe(87_500);
    const support = taskReward(task({ estimated_hours: 1 }), ops, { kind: "support", billable: false, estimated_hours: 2 });
    expect(support).toMatchObject({ cop: 0, opportunityCost: 43_750, source: "ticket" });
    expect(taskReward(task({ estimated_hours: 1 }), ops, { kind: "support", billable: false, estimated_hours: null }).cop).toBe(0);
  });

  it("proyecto sin tarifa calculable vale 0 pero no es personal", () => {
    expect(taskReward(task({ estimated_hours: 2 }), { ...ops, monthly_fee_cop: null })).toMatchObject({ cop: 0, personal: false });
  });

  it("solo las tareas propias son misiones", () => {
    expect(isMission({ kind: "todo", auto_source: null })).toBe(true);
    expect(isMission({ kind: "follow_up", auto_source: null })).toBe(false);
    expect(isMission({ kind: "todo", auto_source: "payment" })).toBe(false);
  });
});

describe("rachas", () => {
  // 2026-11-02 es lunes.
  const set = (...d: string[]) => new Set(d);

  it("cuenta días seguidos; hoy sin cumplir no rompe", () => {
    const s = computeStreak(set("2026-11-02", "2026-11-03", "2026-11-04"), "2026-11-05", S);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
    expect(s.freezeAvailable).toBe(true);
  });

  it("el fin de semana sin cumplir no rompe y cumplido suma", () => {
    expect(computeStreak(set("2026-11-06", "2026-11-09"), "2026-11-09", S).current).toBe(2);
    expect(computeStreak(set("2026-11-06", "2026-11-07", "2026-11-09"), "2026-11-09", S).current).toBe(3);
  });

  it("un día laborable fallado gasta el comodín de la semana; el segundo rompe", () => {
    const one = computeStreak(set("2026-11-02", "2026-11-04"), "2026-11-04", S);
    expect(one).toMatchObject({ current: 2, freezeAvailable: false, frozenDays: ["2026-11-03"] });
    const two = computeStreak(set("2026-11-02", "2026-11-04", "2026-11-06"), "2026-11-06", S);
    expect(two.current).toBe(1);
    expect(two.best).toBe(2);
  });

  it("el comodín se renueva cada semana", () => {
    const s = computeStreak(set("2026-11-02", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09", "2026-11-11"), "2026-11-11", S);
    expect(s.current).toBe(6);
    expect(s.frozenDays).toEqual(["2026-11-03", "2026-11-10"]);
  });
});

describe("metas", () => {
  const goals: QuestGoal[] = [
    { period: "week", target_cop: 1_000_000, target_tasks: null, effective_from: "2026-10-26" },
    { period: "week", target_cop: 2_000_000, target_tasks: 10, effective_from: "2026-11-09" },
    { period: "month", target_cop: 8_000_000, target_tasks: null, effective_from: "2026-11-01" },
  ];

  it("rangos de semana (lunes) y mes", () => {
    expect(periodRange("week", "2026-11-05")).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(periodRange("month", "2026-11-05")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("la meta vigente es la más reciente que ya aplicaba al empezar el período", () => {
    expect(activeGoal(goals, "week", "2026-11-02")?.target_cop).toBe(1_000_000);
    expect(activeGoal(goals, "week", "2026-11-09")?.target_cop).toBe(2_000_000);
    expect(activeGoal(goals, "week", "2026-10-19")).toBeNull();
  });

  it("ritmo esperado, diferencia, proyección y lo que falta por día", () => {
    expect(countWorkDays("2026-11-02", "2026-11-08", S)).toBe(5);
    // Jueves: pasaron 3 días laborables de 5.
    const p = goalProgress({
      range: periodRange("week", "2026-11-05"),
      target: 1_000_000,
      earned: 400_000,
      tasksDone: 4,
      targetTasks: null,
      today: "2026-11-05",
      settings: S,
    });
    expect(p.expected).toBe(600_000);
    expect(p.diff).toBe(-200_000);
    expect(p.projection).toBe(500_000); // 400k en 4 días → 100k/día × 5
    expect(p.workDaysLeft).toBe(2);
    expect(p.perDayNeeded).toBe(300_000);
    expect(p.ratio).toBeCloseTo(0.4);
  });
});

describe("jefe semanal", () => {
  it("rota de forma estable y cambia de estado según el daño", () => {
    expect(bossOf("2026-11-02")).toEqual(bossOf("2026-11-02"));
    expect(bossOf("2026-11-02")).not.toEqual(bossOf("2026-11-09"));
    expect(weeklyBoss("2026-11-02", null, 10).state).toBe("none");
    expect(weeklyBoss("2026-11-02", 100, 20).state).toBe("alive");
    expect(weeklyBoss("2026-11-02", 100, 60)).toMatchObject({ state: "wounded", hp: 40, pct: 60 });
    expect(weeklyBoss("2026-11-02", 100, 150)).toMatchObject({ state: "defeated", hp: 0, pct: 100 });
  });
});

describe("estado completo", () => {
  // Mediodía en Colombia = 17:00 UTC.
  const at = (date: string, cop = 100_000, personal = false) => ({ completed_at: `${date}T17:00:00Z`, cop, personal });
  const day = (date: string, n = 3, cop = 100_000) => Array.from({ length: n }, () => at(date, cop));

  it("arma racha, semana, jefe, mes y estadísticas", () => {
    const done = [
      ...day("2026-10-26"), ...day("2026-10-27"), ...day("2026-10-28"), ...day("2026-10-29"), ...day("2026-10-30"),
      ...day("2026-11-02"), at("2026-11-03", 0, true),
    ];
    const state = buildQuestState({
      done,
      today: "2026-11-03",
      settings: S,
      goals: [
        { period: "week", target_cop: 1_000_000, target_tasks: null, effective_from: "2026-10-26" },
        { period: "month", target_cop: 4_000_000, target_tasks: null, effective_from: "2026-11-01" },
      ],
    });
    expect(state.todayTotals).toMatchObject({ count: 1, earned: 0, goalMet: false, min: 3 });
    expect(state.streak.current).toBe(6);
    expect(state.week?.earned).toBe(300_000);
    expect(state.boss.state).toBe("alive");
    expect(state.weeks.at(-2)).toMatchObject({ week: "2026-10-26", earned: 1_500_000, defeated: true });
    expect(state.month?.earned).toBe(300_000);
    expect(state.monthDaily.find((p) => p.date === "2026-11-04")?.earned).toBeNull();
    expect(state.stats).toMatchObject({
      totalMissions: 19,
      personalMissions: 1,
      totalEarned: 1_800_000,
      bossesDefeated: 1,
      perfectWeeks: 1,
      monthsCompleted: 0,
    });
  });

  it("logros nuevos: solo los cumplidos y no desbloqueados", () => {
    const stats: QuestStats = {
      totalMissions: 1, personalMissions: 0, totalEarned: 1_200_000, bestStreak: 5,
      bossesDefeated: 0, maxConsecutiveBosses: 0, monthsCompleted: 0, perfectWeeks: 0,
    };
    expect(newlyUnlocked(stats, new Set(["first-mission"]))).toEqual(["streak-5", "cop-1m"]);
    expect(new Set(ACHIEVEMENTS.map((a) => a.code)).size).toBe(ACHIEVEMENTS.length);
  });
});
