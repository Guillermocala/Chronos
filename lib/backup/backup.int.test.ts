// Integración: backup incremental y restauración contra Postgres real (PGlite)
// con las migraciones del proyecto.

import type { PGlite } from "@electric-sql/pglite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { freshDb, MIGRATIONS_DIR } from "@/lib/testing/pglite";

import { findUserId } from "./export";
import { buildRestoreSql } from "./restore-sql";
import { readBackupDir, runBackup } from "./run";
import type { Db } from "./types";

const USER = "11111111-1111-1111-1111-111111111111";

const asDb = (pg: PGlite): Db => ({ query: (sql, params) => pg.query(sql, params) as never });

describe("backup incremental + restauración", () => {
  let pg: PGlite;
  let db: Db;
  let out: string;
  let projectA: string;
  let projectB: string;
  const run = (mode: "incremental" | "full" = "incremental") =>
    runBackup(db, {
      userId: USER,
      outDir: out,
      schemaDir: MIGRATIONS_DIR,
      mode,
      trigger: "manual",
      today: "2026-10-22",
    });

  beforeAll(async () => {
    pg = await freshDb();
    db = asDb(pg);
    out = mkdtempSync(join(tmpdir(), "chronos-backup-"));
    await pg.query(`insert into auth.users values ($1, 'yo@example.com')`, [USER]);

    const ins = async (sql: string, params: unknown[] = []) => (await pg.query<{ id: string }>(sql, params)).rows[0]?.id;
    projectA = (await ins(
      `insert into projects (user_id, name, code_prefix, billing_type, fixed_amount_cop, estimated_total_hours)
       values ($1, 'Sitio web', 'WEB', 'fixed', 5000000, 100) returning id`,
      [USER],
    ))!;
    projectB = (await ins(
      `insert into projects (user_id, name, code_prefix, billing_type, monthly_fee_cop, expected_hours_per_month)
       values ($1, 'Acme', 'ACM', 'retainer', 2000000, 40) returning id`,
      [USER],
    ))!;
    const ticket = await ins(
      `insert into tickets (user_id, project_id, title, estimated_hours) values ($1, $2, 'Home', 4) returning id`,
      [USER, projectA],
    );
    await pg.query(`insert into time_entries (user_id, ticket_id, started_at, ended_at, hours) values ($1, $2, now(), now(), 3)`, [USER, ticket]);
    // Entrega después del ticket: el ticket histórico sigue siendo "scope".
    await pg.query(`update projects set phase = 'support', delivered_at = '2026-10-15' where id = $1`, [projectA]);
    await pg.query(
      `insert into payments (user_id, project_id, kind, amount_cop, due_date) values ($1, $2, 'monthly', 2000000, '2026-11-05')`,
      [USER, projectB],
    );
    const note = await ins(
      `insert into meeting_notes (user_id, title, content_md) values ($1, 'Mi día', '# Mi día') returning id`,
      [USER],
    );
    await pg.query(`insert into tasks (user_id, title, source_note_id) values ($1, 'Llamar al contador', $2)`, [USER, note]);
  });

  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it("encuentra al usuario por email", async () => {
    expect(await findUserId(db, "YO@example.com")).toBe(USER);
  });

  it("primer backup exporta todos los proyectos y lo global", async () => {
    const result = await run();
    expect(result.exported.map((p) => p.slug).sort()).toEqual(["acm", "web"]);
    expect(result.changedFiles).toContain("projects/web/tickets.json");
    expect(result.changedFiles).toContain("global/tasks.json");
    expect(result.changedFiles).toContain("manifest.json");
    expect(result.changedFiles.some((f) => f.startsWith("summaries/"))).toBe(true);
    expect(result.changedFiles.some((f) => f.startsWith("schema/"))).toBe(true);
  });

  it("segundo backup sin cambios no exporta ni modifica archivos", async () => {
    const result = await run();
    expect(result.exported).toEqual([]);
    expect(result.skipped.map((s) => s.slug).sort()).toEqual(["acm", "web"]);
    expect(result.changedFiles).toEqual([]);
  });

  it("editar un ticket solo reexporta su proyecto", async () => {
    await pg.query(`update tickets set title = 'Home v2' where project_id = $1`, [projectA]);
    const result = await run();
    expect(result.exported.map((p) => p.slug)).toEqual(["web"]);
    expect(result.changedFiles).toContain("projects/web/tickets.json");
    expect(result.changedFiles).not.toContain("projects/acm/payments.json");
  });

  it("un soft delete también cuenta como cambio", async () => {
    await pg.query(`update payments set deleted_at = now() where project_id = $1`, [projectB]);
    const result = await run();
    expect(result.exported.map((p) => p.slug)).toEqual(["acm"]);
    const payments = JSON.parse(readFileSync(join(out, "projects/acm/payments.json"), "utf8"));
    expect(payments[0].deleted_at).not.toBeNull();
  });

  it("el modo completo exporta todo aunque no haya cambios", async () => {
    const result = await run("full");
    expect(result.exported).toHaveLength(2);
  });

  it("restaurar en una base limpia reproduce los datos sin pasar por los triggers", async () => {
    const target = await freshDb();
    const newUser = "22222222-2222-2222-2222-222222222222";
    await target.query(`insert into auth.users values ($1, 'yo@example.com')`, [newUser]);

    await target.exec(buildRestoreSql(readBackupDir(out), { userId: newUser }));

    const count = async (g: PGlite, table: string) =>
      (await g.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;
    for (const table of ["projects", "tickets", "time_entries", "payments", "tasks", "meeting_notes"]) {
      expect(await count(target, table), table).toBe(await count(pg, table));
    }
    const ticket = (await target.query<{ code: string; kind: string; user_id: string }>(
      "select code, kind, user_id from tickets",
    )).rows[0];
    expect(ticket).toEqual({ code: "WEB-1", kind: "scope", user_id: newUser });

    // Idempotente: restaurar dos veces no duplica.
    await target.exec(buildRestoreSql(readBackupDir(out), { userId: newUser }));
    expect(await count(target, "tickets")).toBe(1);
  });

  it("restaurar un solo proyecto", async () => {
    const target = await freshDb();
    await target.exec(buildRestoreSql(readBackupDir(out, "acm"), { userId: USER }));
    const names = (await target.query<{ code_prefix: string }>("select code_prefix from projects")).rows;
    expect(names).toEqual([{ code_prefix: "ACM" }]);
    expect(() => readBackupDir(out, "nope")).toThrow(/No hay un proyecto/);
  });
});
