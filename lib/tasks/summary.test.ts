import { describe, expect, it } from "vitest";

import type { Reward } from "@/lib/quests/reward";

import { summarizeTasks } from "./summary";

const reward = (cop: number) => ({ cop }) as Reward;

describe("summarizeTasks", () => {
  it("suma valor, horas estimadas y reales", () => {
    const tasks = [
      { id: "a", estimated_hours: 2, spent_hours: null, logged: [{ hours: 2.5, deleted_at: null }] },
      { id: "b", estimated_hours: 1.5, spent_hours: 1, logged: [] },
      { id: "c", estimated_hours: null, spent_hours: null, logged: [{ hours: 3, deleted_at: "2026-11-01" }] },
    ];
    expect(summarizeTasks(tasks, { a: reward(100), b: reward(50) })).toEqual({
      count: 3,
      cop: 150,
      estimated: 3.5,
      real: 3.5,
    });
  });

  it("vacío", () => {
    expect(summarizeTasks([])).toEqual({ count: 0, cop: 0, estimated: 0, real: 0 });
  });
});
