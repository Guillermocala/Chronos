// Integración: horas directas al proyecto y tipo de cobro OPS (hourly_adjusted).

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { asUser, freshDb } from "@/lib/testing/pglite";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

describe("horas por proyecto y OPS (SQL)", () => {
  let db: PGlite;
  let opsId: string;
  let ticketId: string;

  beforeAll(async () => {
    db = await freshDb();
    await db.query("insert into auth.users values ($1, 'a@x.com'), ($2, 'b@x.com')", [U1, U2]);
    const [p] = await asUser<{ id: string }>(
      db,
      U1,
      `insert into projects (name, code_prefix, billing_type, monthly_fee_cop, expected_hours_per_month)
       values ('Operación', 'OPS', 'hourly_adjusted', 3500000, 160) returning id`,
    );
    opsId = p.id;
    const [t] = await asUser<{ id: string }>(
      db,
      U1,
      "insert into tickets (project_id, title) values ($1, 'Deploy') returning id",
      [opsId],
    );
    ticketId = t.id;
  });

  it("OPS exige mensualidad y horas por mes", async () => {
    await expect(
      asUser(db, U1, "insert into projects (name, code_prefix, billing_type) values ('X', 'XOPS', 'hourly_adjusted')"),
    ).rejects.toThrow(/projects_retainer_requires_fee/);
  });

  it("registra horas directas y completa el proyecto desde el ticket", async () => {
    await asUser(
      db,
      U1,
      `insert into time_entries (project_id, started_at, ended_at, hours) values ($1, now(), now(), 2)`,
      [opsId],
    );
    const [fromTicket] = await asUser<{ project_id: string }>(
      db,
      U1,
      "insert into time_entries (ticket_id, started_at, ended_at, hours) values ($1, now(), now(), 3) returning project_id",
      [ticketId],
    );
    expect(fromTicket.project_id).toBe(opsId);

    const [hours] = await asUser<{ scope_logged: string; direct_logged: string }>(
      db,
      U1,
      "select scope_logged, direct_logged from project_hours where project_id = $1",
      [opsId],
    );
    expect(Number(hours.scope_logged)).toBe(3);
    expect(Number(hours.direct_logged)).toBe(2);
  });

  it("rechaza registros sin ticket ni proyecto", async () => {
    await expect(
      asUser(db, U1, "insert into time_entries (started_at, ended_at, hours) values (now(), now(), 1)"),
    ).rejects.toThrow();
  });

  it("no deja cargar horas al proyecto de otro usuario y RLS las aísla", async () => {
    await expect(
      asUser(db, U2, "insert into time_entries (project_id, started_at, ended_at, hours) values ($1, now(), now(), 1)", [
        opsId,
      ]),
    ).rejects.toThrow(/Proyecto no encontrado/);
    expect(await asUser(db, U2, "select * from project_hours")).toEqual([]);
    expect(await asUser(db, U2, "select * from time_entries")).toEqual([]);
  });

  it("guarda la liquidación en el pago", async () => {
    const [pay] = await asUser<{ settled_hours: string }>(
      db,
      U1,
      `insert into payments (project_id, kind, amount_cop, due_date, period_start, period_end, settled_hours, settled_at)
       values ($1, 'monthly', 2625000, '2026-11-28', '2026-10-28', '2026-11-27', 120, now()) returning settled_hours`,
      [opsId],
    );
    expect(Number(pay.settled_hours)).toBe(120);
  });
});
