import { describe, expect, it } from "vitest";

import { recurringSchema } from "./recurring-schema";

const base = {
  id: "",
  title: "Enviar cuenta de cobro",
  notes: "",
  kind: "todo",
  priority: "1",
  waiting_on: "Ana",
  project_id: "",
  tags: "admin, #cobros",
  doc: "",
  interval: "1",
  lead_days: "3",
};

describe("recurringSchema", () => {
  it("mensual: alinea la primera fecha y limpia campos de otras frecuencias", () => {
    const rule = recurringSchema.parse({ ...base, frequency: "monthly", month_day: "1", weekday: "3", start: "2026-10-22" });
    expect(rule).toMatchObject({
      frequency: "monthly",
      month_day: 1,
      weekday: null,
      next_due: "2026-11-01",
      lead_days: 3,
      tags: ["admin", "cobros"],
      waiting_on: null, // solo para seguimientos
      project_id: null,
      doc_url: null,
    });
  });

  it("semanal exige día de la semana y alinea al próximo", () => {
    expect(recurringSchema.safeParse({ ...base, frequency: "weekly", weekday: "", start: "2026-10-22" }).success).toBe(false);
    expect(recurringSchema.parse({ ...base, frequency: "weekly", weekday: "1", start: "2026-10-22" }).next_due).toBe("2026-10-26");
  });

  it("valida rangos", () => {
    expect(recurringSchema.safeParse({ ...base, frequency: "daily", interval: "13", start: "2026-10-22" }).success).toBe(false);
    expect(recurringSchema.safeParse({ ...base, frequency: "daily", lead_days: "20", start: "2026-10-22" }).success).toBe(false);
    expect(recurringSchema.safeParse({ ...base, frequency: "daily", start: "" }).success).toBe(false);
  });
});
