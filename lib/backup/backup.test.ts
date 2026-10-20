import { describe, expect, it } from "vitest";

import { planBackup, resolveMode, type ProjectChange } from "./plan";
import { buildRestoreSql, RESTORE_ORDER } from "./restore-sql";
import { bundleHash, stableJson } from "./serialize";
import { buildSummary, type SummaryStats } from "./summary";
import type { Manifest } from "./types";

describe("serialización", () => {
  it("stableJson no depende del orden de filas ni de claves", () => {
    const a = stableJson([{ id: "2", b: 1, a: 2 }, { id: "1", z: { y: 1, x: 2 } }]);
    const b = stableJson([{ id: "1", z: { x: 2, y: 1 } }, { a: 2, id: "2", b: 1 }]);
    expect(a).toBe(b);
  });

  it("bundleHash no depende del orden de archivos", () => {
    expect(bundleHash({ "a.json": "1", "b.json": "2" })).toBe(bundleHash({ "b.json": "2", "a.json": "1" }));
    expect(bundleHash({ "a.json": "1" })).not.toBe(bundleHash({ "a.json": "2" }));
  });
});

describe("plan incremental", () => {
  const change = (id: string, prefix: string, at: string): ProjectChange => ({
    project_id: id,
    code_prefix: prefix,
    name: prefix,
    last_change_at: at,
  });
  const manifest: Manifest = {
    version: 1,
    projects: {
      a: { slug: "web", name: "WEB", last_change_at: "2026-10-01T10:00:00+00:00", hash: "h", backed_up_at: "x" },
      b: { slug: "acm", name: "ACM", last_change_at: "2026-10-05T10:00:00+00:00", hash: "h", backed_up_at: "x" },
    },
  };

  it("omite los proyectos sin cambios y exporta los cambiados o nuevos", () => {
    const plan = planBackup(
      [
        change("a", "WEB", "2026-10-01T10:00:00+00:00"),
        change("b", "ACM", "2026-10-20T08:00:00+00:00"),
        change("c", "NEW", "2026-10-21T08:00:00+00:00"),
      ],
      manifest,
      "incremental",
    );
    expect(plan.exportIds).toEqual(["b", "c"]);
    expect(plan.skipped).toEqual([{ project_id: "a", slug: "web", since: "2026-10-01" }]);
  });

  it("un cambio de prefijo obliga a exportar", () => {
    expect(planBackup([change("a", "SITE", "2026-10-01T10:00:00+00:00")], manifest, "incremental").exportIds).toEqual([
      "a",
    ]);
  });

  it("completo exporta todo; sin manifest también", () => {
    const projects = [change("a", "WEB", "2026-10-01T10:00:00+00:00")];
    expect(planBackup(projects, manifest, "full").exportIds).toEqual(["a"]);
    expect(planBackup(projects, null, "incremental").exportIds).toEqual(["a"]);
  });

  it("el automático del primer domingo del mes es completo", () => {
    expect(resolveMode("auto", "2026-11-01")).toBe("full"); // domingo 1
    expect(resolveMode("auto", "2026-10-25")).toBe("incremental"); // domingo 25
    expect(resolveMode("incremental", "2026-11-01")).toBe("incremental");
  });
});

describe("SQL de restauración", () => {
  it("inserta en orden de dependencias, reasigna user_id y desactiva triggers", () => {
    const sql = buildRestoreSql(
      {
        tasks: [{ id: "t1", user_id: "old", title: "x" }],
        projects: [{ id: "p1", user_id: "old", name: "Web" }],
        tickets: [{ id: "k1", user_id: "old", code: "WEB-1" }],
      },
      { userId: "new-user" },
    );
    expect(sql).toContain("set local session_replication_role = replica;");
    const positions = ["public.projects", "public.tickets", "public.tasks"].map((t) => sql.indexOf(`insert into ${t}`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(sql).not.toContain('"old"');
    expect(sql).toContain('"user_id":"new-user"');
    expect(sql.trim().endsWith("commit;")).toBe(true);
    expect(RESTORE_ORDER[0]).toBe("projects");
  });

  it("el dollar-quote no choca con el contenido", () => {
    const sql = buildRestoreSql({ projects: [{ id: "p", name: "texto con $chronos$ adentro" }] }, { userId: "u" });
    expect(sql).toContain("$chronos_$");
  });
});

describe("resumen.md", () => {
  const stats: SummaryStats = {
    date: "2026-10-25",
    trigger: "scheduled",
    mode: "incremental",
    durationSeconds: 4,
    commitSha: "abcdef1234567",
    exported: [{ slug: "web", name: "Sitio web" }],
    skipped: [{ slug: "acm", since: "2026-10-01" }],
    counts: { projects: 2, tickets: 5 },
    week: { ticketsCreated: 3, ticketsDone: 1, hoursLogged: 6.5, paymentsReceivedCOP: 2_000_000 },
    projects: [
      {
        id: "p",
        name: "Sitio web",
        code_prefix: "WEB",
        phase: "support",
        support_until: "2026-10-27",
        billing_type: "fixed",
        fixed_amount_cop: 5_000_000,
        estimated_total_hours: 100,
        monthly_fee_cop: null,
        expected_hours_per_month: null,
        contract_months: null,
        payments: [
          { amount_cop: 5_000_000, status: "received", due_date: "2026-10-01", paid_at: "2026-10-01", kind: "final" },
          { amount_cop: 300_000, status: "expected", due_date: "2026-10-20", paid_at: null, kind: "extra" },
        ],
        hours: { scope_estimated: 100, scope_logged: 100, support_logged: 25, extra_logged: 0 },
      },
    ],
  };

  it("incluye respaldados, omitidos, semana, tarifa real y alertas", () => {
    const md = buildSummary(stats).replace(/\s/g, " ");
    expect(md).toContain("# Backup de Chronos — 2026-10-25");
    expect(md).toContain("incremental (automático)");
    expect(md).toContain("`abcdef1`");
    expect(md).toContain("**WEB** · Sitio web");
    expect(md).toContain("ACM (desde 2026-10-01)");
    expect(md).toContain("Horas registradas: **6 h 30 min**");
    expect(md).toContain("$ 40.000/h"); // 5.000.000 / (100 + 25)
    expect(md).toMatch(/Soporte de \*\*WEB\*\* termina/);
    expect(md).toMatch(/1 pago\(s\) vencido\(s\)/);
  });

  it("sin commitSha omite la línea (versión dentro del repo)", () => {
    expect(buildSummary({ ...stats, commitSha: undefined })).not.toContain("**Commit:**");
    expect(buildSummary({ ...stats, commitSha: null })).toContain("sin cambios");
  });
});
