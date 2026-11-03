import { describe, expect, it } from "vitest";

import { taskCreateSchema, taskUpdateSchema } from "./schema";

const base = { title: "Revisar contrato", kind: "todo", priority: "2" };

describe("crear tarea", () => {
  it("estimado vacío = null y duración escrita a mano", () => {
    expect(taskCreateSchema.parse({ ...base, estimated_hours: "" }).estimated_hours).toBeNull();
    expect(taskCreateSchema.parse({ ...base, estimated_hours: "1:30" }).estimated_hours).toBe(1.5);
    expect(taskCreateSchema.parse({ ...base, estimated_hours: "90m" }).estimated_hours).toBe(1.5);
    expect(taskCreateSchema.safeParse({ ...base, estimated_hours: "mucho" }).success).toBe(false);
  });

  it("fechas, proyecto y etiquetas", () => {
    const t = taskCreateSchema.parse({ ...base, planned_on: "2026-11-04", due_date: "", project_id: "", tags: "#Admin, web" });
    expect(t).toMatchObject({ planned_on: "2026-11-04", due_date: null, project_id: null, tags: ["admin", "web"], status: "open" });
  });

  it("seguimiento con 'esperando a' queda en espera; una tarea normal no guarda 'esperando a'", () => {
    expect(taskCreateSchema.parse({ ...base, kind: "follow_up", waiting_on: "Ana" }).status).toBe("waiting");
    expect(taskCreateSchema.parse({ ...base, waiting_on: "Ana" }).waiting_on).toBeNull();
  });
});

describe("editar tarea", () => {
  it("acepta horas estimadas y horas que tomó", () => {
    const t = taskUpdateSchema.parse({
      ...base,
      id: "11111111-1111-4111-8111-111111111111",
      status: "done",
      estimated_hours: "2h",
      add_hours: "45m",
    });
    expect(t.estimated_hours).toBe(2);
    expect(t.add_hours).toBe(0.75);
  });
});
