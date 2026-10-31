import { describe, expect, it } from "vitest";

import {
  billingPeriod,
  calendarPeriod,
  hoursInPeriod,
  isMonthlyBilling,
  projectHourPeriods,
  toHourEntries,
  type PaymentForHours,
  settleAmount,
  settlementText,
  type HourEntry,
} from "./hours-settlement";

describe("billingPeriod", () => {
  it("cobro 28-nov liquida del 28-oct al 27-nov", () => {
    expect(billingPeriod("2026-11-28")).toEqual({ start: "2026-10-28", end: "2026-11-27" });
  });
  it("cruza el año", () => {
    expect(billingPeriod("2027-01-05")).toEqual({ start: "2026-12-05", end: "2027-01-04" });
  });
  it("cobro el 1 → mes anterior completo", () => {
    expect(billingPeriod("2026-03-01")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("calendarPeriod", () => {
  it("febrero y diciembre", () => {
    expect(calendarPeriod("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(calendarPeriod("2026-12")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});

describe("settleAmount", () => {
  const base = { fee: 3_500_000, expectedHours: 160 };
  it("160 h = mensualidad completa", () => {
    expect(settleAmount({ ...base, hours: 160 })).toMatchObject({ amount: 3_500_000, difference: 0, ratio: 1 });
  });
  it("menos horas descuenta", () => {
    expect(settleAmount({ ...base, hours: 120 })).toMatchObject({ amount: 2_625_000, difference: -875_000 });
  });
  it("más horas suma, sin tope", () => {
    expect(settleAmount({ ...base, hours: 180 })).toMatchObject({ amount: 3_937_500, difference: 437_500 });
  });
  it("0 h = 0 y tarifa por hora", () => {
    const s = settleAmount({ ...base, hours: 0 });
    expect(s.amount).toBe(0);
    expect(s.rate).toBe(21_875);
  });
  it("redondea a pesos", () => {
    expect(settleAmount({ fee: 1_000_000, expectedHours: 3, hours: 1 }).amount).toBe(333_333);
  });
});

describe("hoursInPeriod", () => {
  const entries: HourEntry[] = [
    { date: "2026-10-27", hours: 5, kind: "direct" }, // fuera
    { date: "2026-10-28", hours: 2, kind: "scope" },
    { date: "2026-11-10", hours: 1.5, kind: "support" },
    { date: "2026-11-11", hours: 3, kind: "direct" },
    { date: "2026-11-12", hours: 4, kind: "extra", billable: true },
    { date: "2026-11-13", hours: 1, kind: "extra", billable: false },
    { date: "2026-11-27", hours: 0.25, kind: "direct" },
    { date: "2026-11-28", hours: 8, kind: "direct" }, // fuera
  ];
  it("suma por tipo y excluye extras facturables de la liquidación", () => {
    expect(hoursInPeriod(entries, billingPeriod("2026-11-28"))).toEqual({
      scope: 2,
      support: 1.5,
      direct: 3.25,
      extra: 5,
      total: 11.75,
      settleable: 7.75,
    });
  });
});

describe("isMonthlyBilling", () => {
  it("mensual fija y OPS sí; fijo no", () => {
    expect(isMonthlyBilling("retainer")).toBe(true);
    expect(isMonthlyBilling("hourly_adjusted")).toBe(true);
    expect(isMonthlyBilling("fixed")).toBe(false);
  });
});

describe("settlementText", () => {
  it("arma el detalle para la cuenta de cobro", () => {
    const text = settlementText({
      projectName: "MIT",
      period: { start: "2026-10-28", end: "2026-11-27" },
      hours: 120.5,
      expectedHours: 160,
      settlement: settleAmount({ fee: 3_500_000, expectedHours: 160, hours: 120.5 }),
      formatMoney: (n) => `$${n}`,
      formatDate: (d) => d,
    });
    expect(text).toContain("Horas trabajadas: 120,5 de 160 pactadas");
    expect(text).toContain("Valor hora: $21875");
    expect(text).toContain("Total a cobrar: $2635938");
  });
});

describe("projectHourPeriods", () => {
  const ops = {
    billing_type: "hourly_adjusted" as const,
    monthly_fee_cop: 3_500_000,
    expected_hours_per_month: 160,
    start_date: "2026-09-28",
  };
  const payment = (id: string, due_date: string, extra: Partial<PaymentForHours> = {}): PaymentForHours => ({
    id,
    kind: "monthly",
    status: "expected",
    amount_cop: 3_500_000,
    due_date,
    period_start: null,
    period_end: null,
    settled_hours: null,
    settled_at: null,
    ...extra,
  });
  const entries = toHourEntries([
    { started_at: "2026-10-01T17:00:00Z", hours: 100, ticket: null },
    { started_at: "2026-10-20T17:00:00Z", hours: 20, ticket: { kind: "scope", billable: true } },
    { started_at: "2026-10-29T17:00:00Z", hours: 10, ticket: { kind: "extra", billable: true } },
    { started_at: "2026-10-30T17:00:00Z", hours: 5, ticket: null },
    { started_at: "2026-10-30T17:00:00Z", hours: null, ticket: null },
  ]);

  it("OPS: un período por mensualidad, con el valor calculado", () => {
    const rows = projectHourPeriods({
      project: ops,
      payments: [payment("oct", "2026-10-28"), payment("nov", "2026-11-28"), { ...payment("x", "2026-11-01"), kind: "extra" }],
      entries,
      today: "2026-10-31",
    });
    expect(rows.map((r) => [r.payment?.id, r.start, r.end, r.hours.settleable, r.current])).toEqual([
      ["nov", "2026-10-28", "2026-11-27", 5, true],
      ["oct", "2026-09-28", "2026-10-27", 120, false],
    ]);
    expect(rows[1].settlement?.amount).toBe(2_625_000);
  });

  it("OPS: respeta el período guardado al liquidar", () => {
    const [row] = projectHourPeriods({
      project: ops,
      payments: [payment("oct", "2026-10-28", { period_start: "2026-10-01", period_end: "2026-10-20" })],
      entries,
      today: "2026-10-31",
    });
    expect([row.start, row.end, row.hours.total]).toEqual(["2026-10-01", "2026-10-20", 120]);
  });

  it("otros tipos: meses calendario desde el inicio hasta hoy", () => {
    const rows = projectHourPeriods({
      project: { billing_type: "fixed", monthly_fee_cop: null, expected_hours_per_month: null, start_date: "2026-09-15" },
      payments: [],
      entries,
      today: "2026-10-31",
    });
    expect(rows.map((r) => [r.start, r.hours.total, r.expected])).toEqual([
      ["2026-10-01", 135, null],
      ["2026-09-01", 0, null],
    ]);
  });
});
