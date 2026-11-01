// Integración: carga atómica de actividades externas (Leden Company).

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { asUser, freshDb } from "@/lib/testing/pglite";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

const NOTE = { title: "Informe Leden INF-X", meeting_date: "2026-10-31", content_md: "| x |" };

function rows(projectA: string, projectB: string) {
  return [
    { external_id: "a", date: "2026-10-02", title: "Daily con el equipo", notes: "Leden", tags: ["leden", "reunion"], hours: 0.5, project_id: projectA },
    { external_id: "b", date: "2026-10-05", title: "Investigación Odoo", notes: null, tags: ["leden"], hours: 3, project_id: projectA },
    { external_id: "c", date: "2026-10-23", title: "Daily Orión", notes: null, tags: ["leden"], hours: 0.75, project_id: projectB },
  ];
}

describe("import_external_activities (SQL)", () => {
  let db: PGlite;
  let pA: string;
  let pB: string;

  const call = (user: string, data: unknown[], links: unknown[] = []) =>
    asUser<{ r: { created: number; skipped: number; hours: number; note_id: string | null } }>(
      db,
      user,
      "select public.import_external_activities('leden', $1, $2, $3) as r",
      [JSON.stringify(NOTE), JSON.stringify(links), JSON.stringify(data)],
    ).then(([row]) => row.r);

  beforeAll(async () => {
    db = await freshDb();
    await db.query("insert into auth.users values ($1, 'a@x.com'), ($2, 'b@x.com')", [U1, U2]);
    const [a] = await asUser<{ id: string }>(
      db,
      U1,
      `insert into projects (name, code_prefix, billing_type, monthly_fee_cop, expected_hours_per_month)
       values ('MIT', 'MIT', 'hourly_adjusted', 3500000, 160) returning id`,
    );
    const [b] = await asUser<{ id: string }>(
      db,
      U1,
      `insert into projects (name, code_prefix, billing_type, monthly_fee_cop, expected_hours_per_month)
       values ('Interno', 'INT', 'retainer', 1000, 10) returning id`,
    );
    pA = a.id;
    pB = b.id;
  });

  it("crea tareas hechas con su fecha y horas ligadas", async () => {
    const r = await call(U1, rows(pA, pB), [{ external_name: "Parque Explora - Transición 2", project_id: pA }]);
    expect(r.created).toBe(3);
    expect(r.skipped).toBe(0);
    expect(Number(r.hours)).toBe(4.25);

    const tasks = await asUser<{ status: string; day: string; source_note_id: string; tags: string[] }>(
      db,
      U1,
      `select status, (completed_at at time zone 'America/Bogota')::date::text as day, source_note_id, tags
         from tasks where external_source = 'leden' order by completed_at`,
    );
    expect(tasks.map((t) => t.day)).toEqual(["2026-10-02", "2026-10-05", "2026-10-23"]);
    expect(tasks.every((t) => t.status === "done" && t.source_note_id === r.note_id)).toBe(true);
    expect(tasks[0].tags).toEqual(["leden", "reunion"]);

    const entries = await asUser<{ n: number }>(
      db,
      U1,
      "select count(*)::int as n from time_entries e join tasks t on t.id = e.task_id where t.external_source = 'leden'",
    );
    expect(entries[0].n).toBe(3);

    const [hours] = await asUser<{ direct_logged: string }>(
      db,
      U1,
      "select direct_logged from project_hours where project_id = $1",
      [pA],
    );
    expect(Number(hours.direct_logged)).toBe(3.5);

    const [note] = await asUser<{ source: string; project_id: string | null }>(
      db,
      U1,
      "select source::text, project_id from meeting_notes where id = $1",
      [r.note_id],
    );
    expect(note).toEqual({ source: "leden", project_id: null });
  });

  it("una segunda carga omite lo ya cargado y no crea nota", async () => {
    const r = await call(U1, rows(pA, pB));
    expect(r).toEqual({ created: 0, skipped: 3, hours: 0, note_id: null });
  });

  it("carga solo los registros nuevos de un informe cruzado", async () => {
    const more = [...rows(pA, pB), { external_id: "d", date: "2026-10-30", title: "Demo", notes: null, tags: [], hours: 1.25, project_id: pA }];
    const r = await call(U1, more);
    expect(r.created).toBe(1);
    expect(r.skipped).toBe(3);
  });

  it("una tarea borrada se puede volver a cargar", async () => {
    await asUser(db, U1, "update tasks set deleted_at = now() where external_id = 'd'");
    const r = await call(U1, [{ external_id: "d", date: "2026-10-30", title: "Demo", notes: null, tags: [], hours: 1.25, project_id: pA }]);
    expect(r.created).toBe(1);
  });

  it("guarda y actualiza el mapeo de proyectos", async () => {
    await call(U1, [], [{ external_name: "parque explora - transición 2", project_id: pB }]);
    const links = await asUser<{ external_name: string; project_id: string }>(
      db,
      U1,
      "select external_name, project_id from external_project_links where deleted_at is null",
    );
    expect(links).toHaveLength(1);
    expect(links[0].project_id).toBe(pB);
  });

  it("no deja cargar al proyecto de otro usuario y RLS aísla", async () => {
    await expect(call(U2, [{ ...rows(pA, pB)[0], external_id: "z" }])).rejects.toThrow(/Proyecto no encontrado/);
    expect(await asUser(db, U2, "select * from tasks")).toEqual([]);
    expect(await asUser(db, U2, "select * from external_project_links")).toEqual([]);
  });

  it("al completar una tarea normal sigue usando la hora actual", async () => {
    const [t] = await asUser<{ ok: boolean }>(
      db,
      U1,
      "insert into tasks (title, status, completed_at) values ('x', 'done', '2000-01-01') returning completed_at = '2000-01-01'::timestamptz as ok",
    );
    expect(t.ok).toBe(true);
    const [y] = await asUser<{ id: string }>(db, U1, "insert into tasks (title) values ('y') returning id");
    const [u] = await asUser<{ recent: boolean }>(
      db,
      U1,
      "update tasks set status = 'done', completed_at = '2000-01-01' where id = $1 returning completed_at > now() - interval '1 minute' as recent",
      [y.id],
    );
    expect(u.recent).toBe(true);
  });
});
