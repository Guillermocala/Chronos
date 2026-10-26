// Integración: el SQL de datos de prueba corre sobre las migraciones reales,
// respeta los triggers y se puede retirar y volver a sembrar.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { asUser, freshDb } from "@/lib/testing/pglite";

import { buildDemoResetSql, buildDemoSeedSql } from "./seed-sql";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
const EMAIL = "Demo@Example.com";
const TODAY = "2026-10-26";

const count = async (db: PGlite, sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

describe("datos de prueba [DEMO]", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    await db.query("insert into auth.users values ($1, 'demo@example.com'), ($2, 'otra@example.com')", [U1, U2]);
    await db.exec(buildDemoSeedSql({ email: EMAIL, today: TODAY }));
  });

  it("crea los cinco proyectos solo para ese usuario (RLS)", async () => {
    const mine = await asUser<{ code_prefix: string }>(db, U1, "select code_prefix from public.projects order by code_prefix");
    expect(mine.map((p) => p.code_prefix)).toEqual(["DMFIX", "DMNEW", "DMOLD", "DMRET", "DMSOP"]);
    expect(await asUser(db, U2, "select id from public.projects")).toEqual([]);
  });

  it("el retainer nuevo cobra por primera vez el mes siguiente", async () => {
    const rows = await db.query<{ d: string }>(`
      select pay.due_date::text as d from public.payments pay
        join public.projects p on p.id = pay.project_id
       where p.code_prefix = 'DMNEW' order by pay.due_date limit 1`);
    expect(rows.rows[0].d).toBe("2026-11-26");
  });

  it("los triggers crean seguimientos, códigos y tickets de soporte", async () => {
    expect(await count(db, "select count(*)::int as n from public.tasks where auto_source = 'payment'")).toBeGreaterThan(0);
    expect(await count(db, "select count(*)::int as n from public.tasks where auto_source = 'delivery'")).toBe(1);
    expect(await count(db, "select count(*)::int as n from public.tasks where recurring_task_id is not null")).toBe(1);
    expect(await count(db, "select count(*)::int as n from public.tickets where code = 'DMFIX-1'")).toBe(1);
    expect(
      await count(db, `select count(*)::int as n from public.tickets t join public.projects p on p.id = t.project_id
                        where p.code_prefix = 'DMSOP' and t.kind = 'support' and not t.billable`),
    ).toBe(2);
  });

  it("no siembra dos veces", async () => {
    await expect(db.exec(buildDemoSeedSql({ email: EMAIL, today: TODAY }))).rejects.toThrow(/--reset/);
    await db.exec("rollback");
  });

  it("--reset retira todo con soft delete y permite volver a sembrar", async () => {
    await db.exec(buildDemoResetSql({ email: EMAIL }));
    for (const table of ["projects", "payments", "sprints", "tickets", "time_entries", "meeting_notes", "note_action_items", "recurring_tasks"]) {
      expect(await count(db, `select count(*)::int as n from public.${table} where deleted_at is null`), table).toBe(0);
    }
    expect(
      await count(db, "select count(*)::int as n from public.tasks where deleted_at is null and status in ('open', 'waiting')"),
    ).toBe(0);

    await db.exec(buildDemoSeedSql({ email: EMAIL, today: TODAY }));
    expect(await count(db, "select count(*)::int as n from public.projects where deleted_at is null")).toBe(5);
  });

  it("falla con un email que no existe", async () => {
    await expect(db.exec(buildDemoSeedSql({ email: "nadie@example.com", today: TODAY }))).rejects.toThrow(/No existe/);
    await db.exec("rollback");
  });
});
