import { describe, expect, it } from "vitest";

import { buildMonthlySchedule } from "./payments";

const dueDates = (input: Parameters<typeof buildMonthlySchedule>[0]) =>
  buildMonthlySchedule(input).map((p) => p.due_date);

describe("buildMonthlySchedule", () => {
  it("genera N pagos mensuales esperados", () => {
    const schedule = buildMonthlySchedule({
      start_date: "2026-11-01",
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

  it("si el día de cobro ya pasó en el mes de inicio, empieza el mes siguiente", () => {
    expect(
      dueDates({ start_date: "2026-10-15", contract_months: 2, monthly_fee_cop: 1, billing_day: 5 }),
    ).toEqual(["2026-11-05", "2026-12-05"]);
  });

  it("día 28 funciona en febrero", () => {
    expect(
      dueDates({ start_date: "2027-01-01", contract_months: 3, monthly_fee_cop: 1, billing_day: 28 }),
    ).toEqual(["2027-01-28", "2027-02-28", "2027-03-28"]);
  });

  it("sin día de cobro usa el día 1", () => {
    expect(
      dueDates({ start_date: "2026-10-01", contract_months: 1, monthly_fee_cop: 1 }),
    ).toEqual(["2026-10-01"]);
  });
});
