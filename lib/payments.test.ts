import { describe, expect, it } from "vitest";

import { buildMonthlySchedule, diffMonthlySchedule, planMonthlySync } from "./payments";

const dueDates = (input: Parameters<typeof buildMonthlySchedule>[0]) =>
  buildMonthlySchedule(input).map((p) => p.due_date);

describe("buildMonthlySchedule", () => {
  it("genera N pagos mensuales esperados", () => {
    const schedule = buildMonthlySchedule({
      start_date: "2026-10-20",
      contract_months: 6,
      monthly_fee_cop: 2_000_000,
      billing_day: 5,
    });
    expect(schedule).toHaveLength(6);
    expect(schedule.every((p) => p.kind === "monthly" && p.status === "expected")).toBe(true);
    expect(schedule.every((p) => p.amount_cop === 2_000_000)).toBe(true);
    expect(schedule.map((p) => p.due_date)).toEqual([
      "2026-11-05",
      "2026-12-05",
      "2027-01-05",
      "2027-02-05",
      "2027-03-05",
      "2027-04-05",
    ]);
  });

  it("el primer cobro es el mes siguiente aunque el día de cobro no haya pasado", () => {
    expect(
      dueDates({ start_date: "2026-10-01", contract_months: 2, monthly_fee_cop: 1, billing_day: 5 }),
    ).toEqual(["2026-11-05", "2026-12-05"]);
  });

  it("si el día de cobro ya pasó en el mes de inicio, también empieza el mes siguiente", () => {
    expect(
      dueDates({ start_date: "2026-10-15", contract_months: 2, monthly_fee_cop: 1, billing_day: 5 }),
    ).toEqual(["2026-11-05", "2026-12-05"]);
  });

  it("nunca cobra el mismo día del inicio", () => {
    expect(
      dueDates({ start_date: "2026-10-26", contract_months: 2, monthly_fee_cop: 1, billing_day: 26 }),
    ).toEqual(["2026-11-26", "2026-12-26"]);
  });

  it("inicio en diciembre pasa al año siguiente", () => {
    expect(
      dueDates({ start_date: "2026-12-10", contract_months: 2, monthly_fee_cop: 1, billing_day: 10 }),
    ).toEqual(["2027-01-10", "2027-02-10"]);
  });

  it("día 28 funciona en febrero", () => {
    expect(
      dueDates({ start_date: "2027-01-01", contract_months: 3, monthly_fee_cop: 1, billing_day: 28 }),
    ).toEqual(["2027-02-28", "2027-03-28", "2027-04-28"]);
  });

  it("sin día de cobro usa el día 1 del mes siguiente", () => {
    expect(
      dueDates({ start_date: "2026-10-01", contract_months: 1, monthly_fee_cop: 1 }),
    ).toEqual(["2026-11-01"]);
  });
});

describe("planMonthlySync", () => {
  const schedule = (start_date: string, contract_months: number) =>
    buildMonthlySchedule({ start_date, contract_months, monthly_fee_cop: 3_500_000, billing_day: 28 });

  it("corregir la fecha de inicio reemplaza todas las pendientes", () => {
    // Caso real: se creó desde septiembre (3 meses) y se corrigió a diciembre (1 mes).
    const existing = [
      { id: "a", status: "expected" as const, due_date: "2026-09-28" },
      { id: "b", status: "expected" as const, due_date: "2026-10-28" },
      { id: "c", status: "expected" as const, due_date: "2026-11-28" },
    ];
    const plan = planMonthlySync(existing, schedule("2026-11-28", 1));
    expect(plan.toDelete).toEqual(["a", "b", "c"]);
    expect(plan.toInsert.map((p) => p.due_date)).toEqual(["2026-12-28"]);
  });

  it("no toca ni duplica los meses ya cobrados", () => {
    const existing = [
      { id: "paid", status: "received" as const, due_date: "2026-10-28" },
      { id: "pending", status: "expected" as const, due_date: "2026-11-28" },
    ];
    const plan = planMonthlySync(existing, schedule("2026-09-01", 3));
    expect(plan.toDelete).toEqual(["pending"]);
    expect(plan.toInsert.map((p) => p.due_date)).toEqual(["2026-11-28", "2026-12-28"]);
  });

  it("sin pagos previos inserta todo el calendario", () => {
    const plan = planMonthlySync([], schedule("2026-10-01", 2));
    expect(plan.toDelete).toEqual([]);
    expect(plan.toInsert).toHaveLength(2);
  });

  it("calendario vacío (ya no es mensual) solo borra pendientes", () => {
    const plan = planMonthlySync(
      [
        { id: "x", status: "expected" as const, due_date: "2026-11-28" },
        { id: "y", status: "received" as const, due_date: "2026-10-28" },
      ],
      [],
    );
    expect(plan).toEqual({ toDelete: ["x"], toInsert: [] });
  });
});

describe("diffMonthlySchedule", () => {
  const schedule = (start_date: string, contract_months: number, fee = 1_000_000) =>
    buildMonthlySchedule({ start_date, contract_months, monthly_fee_cop: fee, billing_day: 10 });

  it("sin cambios cuando las pendientes ya coinciden", () => {
    const existing = [
      { id: "a", status: "received" as const, due_date: "2026-11-10", amount_cop: 1_000_000 },
      { id: "b", status: "expected" as const, due_date: "2026-12-10", amount_cop: 1_000_000 },
    ];
    const diff = diffMonthlySchedule(existing, schedule("2026-10-01", 2), "2026-11-20");
    expect(diff.unchanged).toBe(true);
    expect(diff.toDelete).toEqual([]);
    expect(diff.toInsert).toEqual([]);
    expect(diff.receivedKept).toBe(1);
  });

  it("cambio mínimo: conserva las que coinciden (caso MIT1, regla vieja)", () => {
    const existing = [
      { id: "sep", status: "expected" as const, due_date: "2026-09-28", amount_cop: 3_500_000 },
      { id: "oct", status: "expected" as const, due_date: "2026-10-28", amount_cop: 3_500_000 },
      { id: "nov", status: "expected" as const, due_date: "2026-11-28", amount_cop: 3_500_000 },
    ];
    const schedule = buildMonthlySchedule({
      start_date: "2026-09-28",
      contract_months: 3,
      monthly_fee_cop: 3_500_000,
      billing_day: 28,
    });
    const diff = diffMonthlySchedule(existing, schedule, "2026-10-26");
    expect(diff.unchanged).toBe(false);
    expect(diff.toDelete).toEqual(["sep"]);
    expect(diff.toInsert.map((p) => p.due_date)).toEqual(["2026-12-28"]);
    expect(diff.removed).toEqual([{ due_date: "2026-09-28", amount_cop: 3_500_000 }]);
    expect(diff.kept).toBe(2);
    expect(diff.overdue).toEqual([]);
  });

  it("montos que llegan como texto desde la base se comparan como números", () => {
    const existing = [{ id: "a", status: "expected" as const, due_date: "2026-11-10", amount_cop: "1000000" as unknown as number }];
    const diff = diffMonthlySchedule(existing, schedule("2026-10-01", 1), "2026-10-01");
    expect(diff.unchanged).toBe(true);
  });

  it("pendientes duplicadas: se conserva una y se retira la otra", () => {
    const existing = [
      { id: "a", status: "expected" as const, due_date: "2026-11-10", amount_cop: 1_000_000 },
      { id: "b", status: "expected" as const, due_date: "2026-11-10", amount_cop: 1_000_000 },
    ];
    const diff = diffMonthlySchedule(existing, schedule("2026-10-01", 1), "2026-10-01");
    expect(diff.toDelete).toEqual(["b"]);
    expect(diff.toInsert).toEqual([]);
    expect(diff.kept).toBe(1);
  });

  it("cambiar la mensualidad también cuenta como cambio", () => {
    const existing = [{ id: "a", status: "expected" as const, due_date: "2026-11-10", amount_cop: 1_000_000 }];
    const diff = diffMonthlySchedule(existing, schedule("2026-10-01", 1, 2_000_000), "2026-10-01");
    expect(diff.unchanged).toBe(false);
  });

  it("marca como vencidos los nuevos pendientes anteriores a hoy", () => {
    const diff = diffMonthlySchedule([], schedule("2026-07-01", 4), "2026-10-26");
    expect(diff.overdue.map((p) => p.due_date)).toEqual(["2026-08-10", "2026-09-10", "2026-10-10"]);
  });
});
