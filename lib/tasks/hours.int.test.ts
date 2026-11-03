// Integración: horas al completar una tarea (personal → spent_hours; proyecto → time_entries).

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { asUser, freshDb } from "@/lib/testing/pglite";

const U1 = "11111111-1111-1111-1111-111111111111";

describe("horas de tareas (SQL)", () => {
  let db: PGlite;
  let projectId: string;

  beforeAll(async () => {
    db = await freshDb();
    await db.query("insert into auth.users values ($1, 'a@x.com')", [U1]);
    const [p] = await asUser<{ id: string }>(
      db,
      U1,
      `insert into projects (name, code_prefix, billing_type, monthly_fee_cop, expected_hours_per_month)
       values ('Operación', 'OPS', 'hourly_adjusted', 3500000, 160) returning id`,
    );
    projectId = p.id;
  });

  it("personal: spent_hours positivo y con límite", async () => {
    const [t] = await asUser<{ spent_hours: string }>(
      db,
      U1,
      "insert into tasks (title, spent_hours) values ('Organizar cuarto', 1.5) returning spent_hours",
    );
    expect(Number(t.spent_hours)).toBe(1.5);
    await expect(asUser(db, U1, "insert into tasks (title, spent_hours) values ('X', 0)")).rejects.toThrow(
      /tasks_spent_hours_range/,
    );
  });

  it("proyecto: las horas de la tarea suman en las horas directas del proyecto", async () => {
    const [t] = await asUser<{ id: string }>(
      db,
      U1,
      "insert into tasks (title, project_id) values ('Informe', $1) returning id",
      [projectId],
    );
    await asUser(
      db,
      U1,
      `insert into time_entries (project_id, task_id, started_at, ended_at, hours)
       values ($1, $2, now(), now(), 1.5)`,
      [projectId, t.id],
    );
    const [h] = await asUser<{ direct_logged: string }>(
      db,
      U1,
      "select direct_logged from project_hours where project_id = $1",
      [projectId],
    );
    expect(Number(h.direct_logged)).toBe(1.5);
  });
});
