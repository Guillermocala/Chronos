// Integración: tablas de Misiones (ajustes, metas, logros) con RLS.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { asUser, freshDb } from "@/lib/testing/pglite";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

describe("misiones (SQL)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    await db.query("insert into auth.users values ($1, 'a@x.com'), ($2, 'b@x.com')", [U1, U2]);
  });

  it("ajustes: una fila por usuario con valores por defecto y upsert", async () => {
    const [s] = await asUser<{ daily_min_tasks: number; work_days: number[] }>(
      db,
      U1,
      "insert into quest_settings default values returning daily_min_tasks, work_days",
    );
    expect(s).toEqual({ daily_min_tasks: 3, work_days: [1, 2, 3, 4, 5] });
    const [up] = await asUser<{ daily_min_tasks: number }>(
      db,
      U1,
      `insert into quest_settings (daily_min_tasks) values (5)
       on conflict (user_id) do update set daily_min_tasks = excluded.daily_min_tasks
       returning daily_min_tasks`,
    );
    expect(up.daily_min_tasks).toBe(5);
    await expect(
      asUser(db, U1, "update quest_settings set work_days = '{8}'"),
    ).rejects.toThrow(/check/);
  });

  it("metas: empiezan en lunes o día 1 y se reemplazan por período", async () => {
    await asUser(db, U1, "insert into quest_goals (period, target_cop, effective_from) values ('week', 1000000, '2026-11-02')");
    await expect(
      asUser(db, U1, "insert into quest_goals (period, target_cop, effective_from) values ('week', 1000000, '2026-11-03')"),
    ).rejects.toThrow(/quest_goals_period_start/);
    await expect(
      asUser(db, U1, "insert into quest_goals (period, target_cop, effective_from) values ('month', 1000000, '2026-11-02')"),
    ).rejects.toThrow(/quest_goals_period_start/);
    const [g] = await asUser<{ target_cop: string }>(
      db,
      U1,
      `insert into quest_goals (period, target_cop, effective_from) values ('week', 2000000, '2026-11-02')
       on conflict (user_id, period, effective_from) do update set target_cop = excluded.target_cop
       returning target_cop`,
    );
    expect(Number(g.target_cop)).toBe(2_000_000);
  });

  it("logros: se desbloquean una sola vez", async () => {
    const sql = `insert into quest_achievements (code) values ('first-mission')
                 on conflict (user_id, code) do nothing returning code`;
    expect(await asUser(db, U1, sql)).toHaveLength(1);
    expect(await asUser(db, U1, sql)).toHaveLength(0);
  });

  it("RLS: otro usuario no ve ni modifica lo ajeno", async () => {
    expect(await asUser(db, U2, "select * from quest_settings")).toHaveLength(0);
    expect(await asUser(db, U2, "select * from quest_goals")).toHaveLength(0);
    expect(await asUser(db, U2, "select * from quest_achievements")).toHaveLength(0);
    expect(await asUser(db, U2, "update quest_goals set target_cop = 1 returning id")).toHaveLength(0);
    await expect(
      asUser(db, U2, "insert into quest_goals (user_id, period, target_cop, effective_from) values ($1, 'week', 1, '2026-11-02')", [U1]),
    ).rejects.toThrow(/row-level security/);
  });
});
