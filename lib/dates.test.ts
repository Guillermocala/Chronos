import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  eachMonthOverlap,
  isISODate,
  parseSpanishDate,
  todayCO,
  weekday,
} from "./dates";

describe("operaciones básicas", () => {
  it("valida fechas ISO reales", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("26-02-01")).toBe(false);
  });

  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("cuenta días entre fechas", () => {
    expect(daysBetween("2026-10-20", "2026-11-03")).toBe(14);
    expect(daysBetween("2026-11-03", "2026-10-20")).toBe(-14);
  });

  it("calcula el día de la semana", () => {
    expect(weekday("2026-10-23")).toBe(5); // viernes
  });

  it("todayCO usa la hora de Bogotá", () => {
    // 2026-10-21 03:00 UTC = 2026-10-20 22:00 en Colombia
    expect(todayCO(new Date("2026-10-21T03:00:00Z"))).toBe("2026-10-20");
  });
});

describe("eachMonthOverlap", () => {
  it("reparte un rango que cruza dos meses", () => {
    expect(eachMonthOverlap("2026-10-25", "2026-11-07")).toEqual([
      { year: 2026, month: 10, days: 7, daysInMonth: 31 },
      { year: 2026, month: 11, days: 7, daysInMonth: 30 },
    ]);
  });

  it("devuelve vacío si el rango está invertido", () => {
    expect(eachMonthOverlap("2026-11-07", "2026-10-25")).toEqual([]);
  });
});

describe("parseSpanishDate", () => {
  const base = "2026-10-23"; // viernes

  it.each([
    ["hoy", "2026-10-23"],
    ["mañana", "2026-10-24"],
    ["Mañana", "2026-10-24"],
    ["pasado-mañana", "2026-10-25"],
    ["pasado mañana", "2026-10-25"],
    ["en-3-dias", "2026-10-26"],
    ["lunes", "2026-10-26"],
    ["miércoles", "2026-10-28"],
    ["miercoles", "2026-10-28"],
    ["viernes", "2026-10-30"], // nunca hoy: el próximo
    ["25/10", "2026-10-25"],
    ["2026-11-15", "2026-11-15"],
    ["5/11/2026", "2026-11-05"],
    ["5/11/27", "2027-11-05"],
  ])("%s → %s", (input, expected) => {
    expect(parseSpanishDate(input, base)).toBe(expected);
  });

  it("una fecha dd/mm ya pasada se mueve al año siguiente", () => {
    expect(parseSpanishDate("5/1", "2026-12-28")).toBe("2027-01-05");
  });

  it("devuelve null para texto o fechas inválidas", () => {
    expect(parseSpanishDate("algún día", base)).toBeNull();
    expect(parseSpanishDate("31/02", base)).toBeNull();
    expect(parseSpanishDate("", base)).toBeNull();
  });
});
