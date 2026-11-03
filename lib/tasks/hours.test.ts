import { describe, expect, it } from "vitest";

import { needsHoursOnComplete, planCompletionHours, realHours } from "./hours";

const task = (over: Partial<Parameters<typeof needsHoursOnComplete>[0]> = {}) => ({
  estimated_hours: null,
  spent_hours: null,
  project_id: null,
  logged: [],
  ...over,
});

describe("horas de una tarea", () => {
  it("suma registros no borrados y horas informadas", () => {
    expect(
      realHours(task({ spent_hours: 0.5, logged: [{ hours: 1, deleted_at: null }, { hours: 3, deleted_at: "2026-11-01" }] })),
    ).toBe(1.5);
  });

  it("pregunta horas solo si no hay estimado ni horas", () => {
    expect(needsHoursOnComplete(task())).toBe(true);
    expect(needsHoursOnComplete(task({ estimated_hours: 2 }))).toBe(false);
    expect(needsHoursOnComplete(task({ spent_hours: 1 }))).toBe(false);
    expect(needsHoursOnComplete(task({ logged: [{ hours: 1, deleted_at: null }] }))).toBe(false);
  });

  it("proyecto → registro de horas; personal → horas de la tarea (acumuladas)", () => {
    expect(planCompletionHours(task({ project_id: "p1" }), 1.5)).toEqual({ kind: "entry", project_id: "p1", hours: 1.5 });
    expect(planCompletionHours(task({ spent_hours: 0.5 }), 1)).toEqual({ kind: "spent", hours: 1.5 });
    expect(planCompletionHours(task(), null)).toEqual({ kind: "none" });
  });
});
