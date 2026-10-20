import { describe, expect, it } from "vitest";

import { ticketSchema } from "./schema";

const base = {
  id: "",
  project_id: "8f1c2c1e-6f0a-4d3b-9a77-2b2a0f6d1e11",
  title: "Maquetar contacto",
  description: "",
  estimated_hours: "2,5",
  due_date: "",
  sprint_id: "",
  tags: "#front, ux",
  doc: "",
};

describe("ticketSchema", () => {
  it("normaliza horas, etiquetas y opcionales", () => {
    expect(ticketSchema.parse({ ...base, kind: "scope" })).toMatchObject({
      id: null,
      estimated_hours: 2.5,
      tags: ["front", "ux"],
      sprint_id: null,
      status: "backlog",
      priority: 3,
      billable: true,
      doc_url: null,
    });
  });

  it("soporte nunca es facturable; extra respeta la casilla", () => {
    expect(ticketSchema.parse({ ...base, kind: "support", billable: "on" }).billable).toBe(false);
    expect(ticketSchema.parse({ ...base, kind: "extra", billable: "on" }).billable).toBe(true);
    expect(ticketSchema.parse({ ...base, kind: "extra" }).billable).toBe(false);
  });

  it("rechaza enlaces que no son de Drive", () => {
    expect(ticketSchema.safeParse({ ...base, doc: "https://example.com" }).success).toBe(false);
  });
});
