import { describe, expect, it } from "vitest";

import {
  defaultCompletionHours,
  planCompletionHours,
  planRealHoursEdit,
  realHours,
  type HoursTask,
} from "./hours";

const task = (over: Partial<HoursTask> = {}): HoursTask => ({
  estimated_hours: null,
  spent_hours: null,
  project_id: null,
  logged: [],
  ...over,
});

const entry = (hours: number, deleted_at: string | null = null) => ({ hours, deleted_at });

describe("horas de una tarea", () => {
  it("suma registros no borrados y horas informadas", () => {
    expect(realHours(task({ spent_hours: 0.5, logged: [entry(1), entry(3, "2026-11-01")] }))).toBe(1.5);
  });

  it("omitir al completar registra lo que falte para el estimado", () => {
    expect(defaultCompletionHours(task({ estimated_hours: 2 }))).toBe(2);
    expect(defaultCompletionHours(task({ estimated_hours: 2, logged: [entry(0.5)] }))).toBe(1.5);
    expect(defaultCompletionHours(task({ estimated_hours: 2, spent_hours: 3 }))).toBeNull();
    expect(defaultCompletionHours(task())).toBeNull();
  });

  it("proyecto → registro de horas; personal → horas de la tarea (acumuladas)", () => {
    expect(planCompletionHours(task({ project_id: "p1" }), 1.5)).toEqual({ kind: "entry", project_id: "p1", hours: 1.5 });
    expect(planCompletionHours(task({ spent_hours: 0.5 }), 1)).toEqual({ kind: "spent", hours: 1.5 });
    expect(planCompletionHours(task(), null)).toEqual({ kind: "none" });
  });

  it("corregir el total de horas reales", () => {
    // Sin cambio.
    expect(planRealHoursEdit(task({ spent_hours: 1.5 }), 1.5)).toEqual({ kind: "none" });
    // Personal: spent_hours = total − registros.
    expect(planRealHoursEdit(task({ spent_hours: 1 }), 2.5)).toEqual({ kind: "spent", spent_hours: 2.5 });
    expect(planRealHoursEdit(task({ logged: [entry(1)] }), 3)).toEqual({ kind: "spent", spent_hours: 2 });
    expect(planRealHoursEdit(task({ spent_hours: 1 }), null)).toEqual({ kind: "spent", spent_hours: null });
    // Proyecto: un solo registro con el total, o ninguno.
    expect(planRealHoursEdit(task({ project_id: "p1", logged: [entry(1), entry(2)] }), 2)).toEqual({
      kind: "replace",
      project_id: "p1",
      hours: 2,
    });
    expect(planRealHoursEdit(task({ project_id: "p1", logged: [entry(1)] }), null)).toEqual({
      kind: "replace",
      project_id: "p1",
      hours: null,
    });
  });
});
