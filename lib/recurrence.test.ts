import { describe, expect, it } from "vitest";

import { alignFirst, describeRule, nextOccurrence, planGeneration, upcoming, type Rule } from "./recurrence";

const daily: Rule = { frequency: "daily", interval: 1, weekday: null, month_day: null };
const biweeklyMonday: Rule = { frequency: "weekly", interval: 2, weekday: 1, month_day: null };
const monthly31: Rule = { frequency: "monthly", interval: 1, weekday: null, month_day: 31 };
const monthly1: Rule = { frequency: "monthly", interval: 1, weekday: null, month_day: 1 };

describe("ocurrencias", () => {
  it("diaria", () => {
    expect(nextOccurrence("2026-12-31", { ...daily, interval: 2 })).toBe("2027-01-02");
  });

  it("semanal cada 2 semanas, los lunes", () => {
    expect(alignFirst("2026-10-22", biweeklyMonday)).toBe("2026-10-26"); // jueves → lunes siguiente
    expect(alignFirst("2026-10-26", biweeklyMonday)).toBe("2026-10-26");
    expect(nextOccurrence("2026-10-26", biweeklyMonday)).toBe("2026-11-09");
  });

  it("mensual día 31 usa el último día de cada mes, también en febrero bisiesto", () => {
    expect(upcoming(monthly31, "2027-12-15", 4)).toEqual(["2027-12-31", "2028-01-31", "2028-02-29", "2028-03-31"]);
  });

  it("mensual: si el día ya pasó este mes, empieza el siguiente", () => {
    expect(alignFirst("2026-10-22", monthly1)).toBe("2026-11-01");
    expect(nextOccurrence("2026-12-01", { ...monthly1, interval: 3 })).toBe("2027-03-01");
  });
});

describe("planGeneration", () => {
  it("crea la ocurrencia cuando llega su anticipación", () => {
    const rule = { ...monthly1, next_due: "2026-11-01", lead_days: 3 };
    expect(planGeneration(rule, "2026-10-28")).toEqual({ create: [], next_due: "2026-11-01" });
    expect(planGeneration(rule, "2026-10-29")).toEqual({ create: ["2026-11-01"], next_due: "2026-12-01" });
  });

  it("una regla atrasada no crea un alud: salta a la primera desde hoy", () => {
    const rule = { ...daily, next_due: "2026-09-01", lead_days: 0 };
    expect(planGeneration(rule, "2026-10-22")).toEqual({ create: ["2026-10-22"], next_due: "2026-10-23" });
  });

  it("diaria con anticipación crea las fechas dentro de la ventana", () => {
    const rule = { ...daily, next_due: "2026-10-22", lead_days: 2 };
    expect(planGeneration(rule, "2026-10-22").create).toEqual(["2026-10-22", "2026-10-23", "2026-10-24"]);
  });
});

describe("describeRule", () => {
  it.each([
    [daily, "Cada día"],
    [{ ...daily, interval: 3 }, "Cada 3 días"],
    [biweeklyMonday, "Cada 2 semanas, los lunes"],
    [{ ...biweeklyMonday, interval: 1, weekday: 5 }, "Cada semana, los viernes"],
    [monthly1, "Cada mes, el día 1"],
    [{ ...monthly31, interval: 3 }, "Cada 3 meses, el último día"],
  ])("%j → %s", (rule, text) => {
    expect(describeRule(rule as Rule)).toBe(text);
  });
});
