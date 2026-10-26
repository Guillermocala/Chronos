// Integración: archivar un proyecto descarta sus seguimientos de cobro y entrega.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { freshDb } from "@/lib/testing/pglite";

const U1 = "11111111-1111-1111-1111-111111111111";

describe("archivar proyecto (SQL)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    await db.query("insert into auth.users values ($1, 'a@x.com')", [U1]);
  });

  const statusOf = async (projectId: string) =>
    (
      await db.query<{ auto_source: string; status: string }>(
        "select auto_source, status from public.tasks where project_id = $1 and deleted_at is null order by auto_source",
        [projectId],
      )
    ).rows;

  it("descarta los cobros pendientes y la tarea de soporte", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.projects (user_id, name, code_prefix, billing_type, monthly_fee_cop, expected_hours_per_month,
                                    delivered_at, phase)
       values ($1, 'Web', 'WEB', 'retainer', 1000, 10, current_date, 'support') returning id`,
      [U1],
    );
    const id = rows[0].id;
    await db.query(
      `insert into public.payments (user_id, project_id, kind, amount_cop, due_date) values ($1, $2, 'monthly', 1000, current_date + 10)`,
      [U1, id],
    );
    expect(await statusOf(id)).toEqual([
      { auto_source: "delivery", status: "open" },
      { auto_source: "payment", status: "open" },
    ]);

    await db.query("update public.projects set deleted_at = now() where id = $1", [id]);

    expect(await statusOf(id)).toEqual([
      { auto_source: "delivery", status: "dismissed" },
      { auto_source: "payment", status: "dismissed" },
    ]);
  });

  it("volver a fase activa solo descarta la de entrega", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.projects (user_id, name, code_prefix, billing_type, monthly_fee_cop, expected_hours_per_month,
                                    delivered_at, phase)
       values ($1, 'App', 'APP', 'retainer', 1000, 10, current_date, 'support') returning id`,
      [U1],
    );
    const id = rows[0].id;
    await db.query(
      `insert into public.payments (user_id, project_id, kind, amount_cop, due_date) values ($1, $2, 'monthly', 1000, current_date + 10)`,
      [U1, id],
    );
    await db.query("update public.projects set phase = 'active', delivered_at = null, support_until = null where id = $1", [id]);
    expect(await statusOf(id)).toEqual([
      { auto_source: "delivery", status: "dismissed" },
      { auto_source: "payment", status: "open" },
    ]);
  });
});
