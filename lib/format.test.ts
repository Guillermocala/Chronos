import { describe, expect, it } from "vitest";

import { formatCOP, formatDate, formatHours, parseCOP, plural, relativeDay } from "./format";

// Intl usa espacios no separables; se normalizan para comparar.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("COP", () => {
  it("formatea sin decimales con separador de miles", () => {
    expect(plain(formatCOP(1500000))).toBe("$ 1.500.000");
    expect(plain(formatCOP(1234.6))).toBe("$ 1.235");
    expect(formatCOP(null)).toBe("—");
  });

  it.each([
    ["$ 1.500.000", 1500000],
    ["1500000", 1500000],
    ["1.500.000,50", 1500000],
    ["  2.000  ", 2000],
    ["", null],
    ["abc", null],
  ])("parseCOP(%j) → %j", (input, expected) => {
    expect(parseCOP(input)).toBe(expected);
  });

  it("ida y vuelta", () => {
    expect(parseCOP(formatCOP(2750000))).toBe(2750000);
  });
});

describe("fechas y horas", () => {
  it("formatea fechas en español sin desfase de zona horaria", () => {
    expect(plain(formatDate("2026-10-01"))).toMatch(/^1 .*oct.* 2026$/);
  });

  it.each([
    ["2026-10-20", "Hoy"],
    ["2026-10-21", "Mañana"],
    ["2026-10-19", "Ayer"],
    ["2026-10-23", "En 3 días"],
    ["2026-10-15", "Hace 5 días"],
  ])("relativeDay(%s) → %s", (iso, expected) => {
    expect(relativeDay(iso, "2026-10-20")).toBe(expected);
  });

  it("relativeDay usa fecha corta a más de una semana", () => {
    expect(plain(relativeDay("2026-11-30", "2026-10-20"))).toMatch(/30/);
  });

  it("formatea horas", () => {
    expect(formatHours(1.5)).toBe("1,5 h");
    expect(formatHours(null)).toBe("—");
  });
});

describe("plural", () => {
  it("usa singular solo para 1", () => {
    expect(plural(1, "pago", "pagos")).toBe("1 pago");
    expect(plural(0, "pago", "pagos")).toBe("0 pagos");
    expect(plural(3, "pago", "pagos")).toBe("3 pagos");
  });
});
