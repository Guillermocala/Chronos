import { describe, expect, it } from "vitest";

import { formatCOP, formatDate, formatHours, parseCOP } from "./format";

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

  it("formatea horas", () => {
    expect(formatHours(1.5)).toBe("1,5 h");
    expect(formatHours(null)).toBe("—");
  });
});
