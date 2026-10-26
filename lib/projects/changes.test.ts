import { describe, expect, it } from "vitest";

import { describeProjectChanges } from "./changes";

const plain = (s: string) => s.replace(/\s/g, " ");

describe("describeProjectChanges", () => {
  it("sin cambios devuelve lista vacía aunque los tipos difieran", () => {
    expect(
      describeProjectChanges(
        { name: "Web", monthly_fee_cop: 2_000_000, client: null, color: "#AABBCC" },
        { name: "Web", monthly_fee_cop: "2000000" as unknown as number, client: "" as unknown as null, color: "#aabbcc" },
      ),
    ).toEqual([]);
  });

  it("describe montos, fechas y modalidad en español", () => {
    const changes = describeProjectChanges(
      { billing_type: "fixed", monthly_fee_cop: null, start_date: "2026-10-01" },
      { billing_type: "retainer", monthly_fee_cop: 3_000_000, start_date: "2026-11-01" },
    );
    expect(changes.map((c) => c.label)).toEqual(["Modalidad", "Mensualidad", "Inicio"]);
    expect(changes[0]).toMatchObject({ before: "Pago fijo", after: "Contratación mensual" });
    expect(plain(changes[1].after)).toBe("$ 3.000.000");
    expect(changes[1].before).toBe("—");
  });
});
