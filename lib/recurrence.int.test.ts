// Integración: la regla SQL coincide con lib/recurrence.ts y el generador crea
// las tareas correctas (anticipación, sin duplicados, sin alud, RLS).

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { asUser, freshDb } from "@/lib/testing/pglite";

import { nextOccurrence, planGeneration, type Rule } from "./recurrence";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

describe("tareas recurrentes (SQL)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    await db.query("insert into auth.users values ($1, 'a@x.com'), ($2, 'b@x.com')", [U1, U2]);
  });

  const sqlNext = async (d: string, rule: Rule) =>
    (
      await db.query<{ d: string }>(
        "select public.next_occurrence($1::date, $2::public.recurrence_frequency, $3, $4)::text as d",
        [d, rule.frequency, rule.interval, rule.month_day],
      )
    ).rows[0].d;

  it.each<[string, Rule]>([
    ["2026-12-31", { frequency: "daily", interval: 2, weekday: null, month_day: null }],
    ["2026-10-26", { frequency: "weekly", interval: 2, weekday: 1, month_day: null }],
    ["2028-01-31", { frequency: "monthly", interval: 1, weekday: null, month_day: 31 }],
    ["2026-12-01", { frequency: "monthly", interval: 3, weekday: null, month_day: 1 }],
    ["2027-11-30", { frequency: "monthly", interval: 3, weekday: null, month_day: 30 }],
  ])("next_occurrence(%s) coincide con TypeScript", async (date, rule) => {
    expect(await sqlNext(date, rule)).toBe(nextOccurrence(date, rule));
  });

  const insertRule = async (user: string, fields: string, values: string) =>
    (
      await db.query<{ id: string }>(
        `insert into public.recurring_tasks (user_id, title, ${fields}) values ($1, 'Regla', ${values}) returning id`,
        [user],
      )
    ).rows[0].id;
  const generate = async (today: string, user: string | null = null) =>
    (await db.query<{ n: number }>("select private.generate_recurring_tasks($1, $2::date) as n", [user, today])).rows[0].n;
  const tasksOf = async (ruleId: string) =>
    (
      await db.query<{ due: string }>(
        "select due_date::text as due from public.tasks where recurring_task_id = $1 and deleted_at is null order by due_date",
        [ruleId],
      )
    ).rows.map((r) => r.due);

  it("respeta la anticipación, no duplica y avanza next_due como en TypeScript", async () => {
    const id = await insertRule(U1, "frequency, interval, month_day, next_due, lead_days", "'monthly', 1, 1, '2026-11-01', 3");
    expect(await generate("2026-10-28")).toBe(0);
    expect(await generate("2026-10-29")).toBe(1);
    expect(await tasksOf(id)).toEqual(["2026-11-01"]);
    expect(await generate("2026-10-29")).toBe(0);
    const next = (await db.query<{ d: string }>("select next_due::text as d from public.recurring_tasks where id = $1", [id])).rows[0].d;
    const ts = planGeneration(
      { frequency: "monthly", interval: 1, weekday: null, month_day: 1, next_due: "2026-11-01", lead_days: 3 },
      "2026-10-29",
    );
    expect(next).toBe(ts.next_due);
  });

  it("una regla atrasada no crea un alud y una pausada no genera", async () => {
    const late = await insertRule(U1, "frequency, interval, next_due", "'daily', 1, '2026-09-01'");
    const paused = await insertRule(U1, "frequency, interval, next_due, active", "'daily', 1, '2026-10-01', false");
    await generate("2026-10-22");
    expect(await tasksOf(late)).toEqual(["2026-10-22"]);
    expect(await tasksOf(paused)).toEqual([]);
  });

  it("borrar una ocurrencia no la regenera", async () => {
    const id = await insertRule(U1, "frequency, interval, weekday, next_due", "'weekly', 1, 1, '2026-11-02'");
    await generate("2026-11-02");
    await db.query("update public.tasks set deleted_at = now() where recurring_task_id = $1", [id]);
    await generate("2026-11-02");
    expect(await tasksOf(id)).toEqual([]);
  });

  it("RLS: cada usuario ve y genera solo sus reglas", async () => {
    const other = await insertRule(U2, "frequency, interval, next_due", "'daily', 1, '2026-10-01'");
    const seen = await asUser<{ n: number }>(db, U1, "select count(*)::int as n from public.recurring_tasks where id = $1", [other]);
    expect(seen[0].n).toBe(0);

    // generate_my_recurring_tasks usa la fecha real; la regla de U2 está atrasada, así que crea la de hoy.
    const created = await asUser<{ n: number }>(db, U2, "select public.generate_my_recurring_tasks() as n");
    expect(created[0].n).toBe(1);
    expect(await tasksOf(other)).toHaveLength(1);

    let denied = false;
    try {
      await asUser(db, U1, "select private.generate_recurring_tasks(null)");
    } catch {
      denied = true;
    }
    expect(denied).toBe(true);
  });
});
