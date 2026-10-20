import { describe, expect, it } from "vitest";

import {
  contractValue,
  estimatedHourlyRate,
  paymentTotals,
  projectValuation,
  realHourlyRate,
  sprintValue,
  supportImpact,
  ticketValue,
  type ProjectBilling,
} from "./valuation";

const retainer: ProjectBilling = {
  billing_type: "retainer",
  monthly_fee_cop: 2_000_000,
  expected_hours_per_month: 40,
  contract_months: 6,
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

describe("tarifa estimada", () => {
  it("retainer: mensualidad / horas por mes", () => {
    expect(estimatedHourlyRate(retainer)).toBe(50_000);
  });

  it("fijo: usa horas de tickets si existen, si no las del proyecto", () => {
    expect(estimatedHourlyRate(fixed)).toBe(50_000);
    expect(estimatedHourlyRate(fixed, 125)).toBe(40_000);
  });

  it("null cuando faltan datos", () => {
    expect(estimatedHourlyRate({ ...fixed, estimated_total_hours: null })).toBeNull();
    expect(estimatedHourlyRate({ ...retainer, expected_hours_per_month: null })).toBeNull();
  });
});

describe("valor del contrato", () => {
  it("fijo y retainer", () => {
    expect(contractValue(fixed)).toBe(5_000_000);
    expect(contractValue(retainer)).toBe(12_000_000);
    expect(contractValue({ ...retainer, contract_months: null })).toBeNull();
  });
});

describe("valor del sprint", () => {
  it("retainer dentro de un mes", () => {
    // 15 de 30 días de noviembre
    expect(
      sprintValue(retainer, { start_date: "2026-11-01", end_date: "2026-11-15", value_cop_override: null }),
    ).toEqual({ value: 1_000_000, source: "retainer" });
  });

  it("retainer que cruza dos meses se prorratea por mes", () => {
    // 7/31 de octubre + 7/30 de noviembre
    const expected = Math.round((2_000_000 * 7) / 31 + (2_000_000 * 7) / 30);
    expect(
      sprintValue(retainer, { start_date: "2026-10-25", end_date: "2026-11-07", value_cop_override: null }),
    ).toEqual({ value: expected, source: "retainer" });
  });

  it("override manual tiene prioridad", () => {
    expect(
      sprintValue(fixed, { start_date: "2026-10-01", end_date: "2026-10-14", value_cop_override: 900_000 }),
    ).toEqual({ value: 900_000, source: "override" });
  });

  it("fijo: horas de tickets × tarifa, o pendiente sin tickets", () => {
    const range = { start_date: "2026-10-01", end_date: "2026-10-14", value_cop_override: null };
    expect(sprintValue(fixed, range, 20)).toEqual({ value: 1_000_000, source: "tickets" });
    expect(sprintValue(fixed, range)).toEqual({ value: null, source: "pending" });
  });
});

describe("pagos", () => {
  it("separa cobrado, pendiente y vencido", () => {
    const totals = paymentTotals(
      [
        { amount_cop: 2_500_000, status: "received", due_date: "2026-09-01", paid_at: "2026-09-02" },
        { amount_cop: 1_000_000, status: "expected", due_date: "2026-10-10", paid_at: null },
        { amount_cop: 1_500_000, status: "expected", due_date: "2026-10-20", paid_at: null },
        { amount_cop: 500_000, status: "expected", due_date: null, paid_at: null },
      ],
      "2026-10-20",
    );
    expect(totals).toEqual({
      received: 2_500_000,
      expected: 3_000_000,
      overdue: 1_000_000, // el del 20 vence hoy, todavía no está vencido
      overdueCount: 1,
    });
  });
});

describe("tarifa real y soporte", () => {
  it("las horas de soporte bajan la tarifa real", () => {
    expect(realHourlyRate(5_000_000, 100)).toBe(50_000);
    expect(realHourlyRate(5_000_000, 125)).toBe(40_000);
    expect(realHourlyRate(5_000_000, 0)).toBeNull();
  });

  it("costo de oportunidad del soporte", () => {
    expect(supportImpact(10, 50_000)).toEqual({ hours: 10, opportunityCostCOP: 500_000 });
    expect(supportImpact(10, null)).toEqual({ hours: 10, opportunityCostCOP: null });
  });
});

describe("valor por ticket", () => {
  it("alcance: horas × tarifa; soporte: 0 con costo de oportunidad; extra según facturable", () => {
    // tarifa con 20 h de alcance: 5.000.000 / 20 = 250.000
    expect(ticketValue(fixed, { kind: "scope", billable: true, estimated_hours: 4 }, 20)).toEqual({
      value: 1_000_000,
      opportunityCost: null,
    });
    expect(ticketValue(fixed, { kind: "support", billable: false, estimated_hours: 2 }, 20)).toEqual({
      value: 0,
      opportunityCost: 500_000,
    });
    expect(ticketValue(fixed, { kind: "extra", billable: true, estimated_hours: 2 }, 20).value).toBe(500_000);
    expect(ticketValue(fixed, { kind: "extra", billable: false, estimated_hours: 2 }, 20).value).toBe(0);
  });

  it("sin horas estimadas no hay valor", () => {
    expect(ticketValue(fixed, { kind: "scope", billable: true, estimated_hours: null }, 20).value).toBeNull();
  });
});

describe("projectValuation", () => {
  const hours = { scope_estimated: 100, scope_logged: 100, support_logged: 0, extra_logged: 0 };

  it("sin soporte, la tarifa real coincide con la estimada", () => {
    const v = projectValuation(fixed, hours, 5_000_000);
    expect(v.estimatedRate).toBe(50_000);
    expect(v.realRate).toBe(50_000);
  });

  it("el soporte no cobrado baja la tarifa real y se cuantifica", () => {
    const v = projectValuation(fixed, { ...hours, support_logged: 25 }, 5_000_000);
    expect(v.realRate).toBe(40_000);
    expect(v.support).toEqual({ hours: 25, opportunityCostCOP: 1_250_000 });
  });

  it("los extras no alteran la tarifa real", () => {
    const v = projectValuation(fixed, { ...hours, extra_logged: 10 }, 5_000_000);
    expect(v.realRate).toBe(50_000);
    expect(v.loggedHours).toBe(110);
  });
});
