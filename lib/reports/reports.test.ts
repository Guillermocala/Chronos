import { describe, expect, it } from "vitest";

import { sprintBurndown } from "./burndown";
import { formatMonth, monthlyCashflow, monthsBetween, shiftMonth } from "./cashflow";
import { toCsv } from "./csv";
import { hoursByProject, mondayOf, weeklyHours } from "./hours";

describe("meses", () => {
  it("shiftMonth y monthsBetween cruzan años", () => {
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("formatMonth en español", () => {
    expect(formatMonth("2026-10")).toMatch(/^oct/);
  });
});

describe("monthlyCashflow", () => {
  it("recibido por fecha de pago, esperado por vencimiento y vencido si ya pasó", () => {
    const flow = monthlyCashflow(
      [
        { amount_cop: 1000, status: "received", due_date: "2026-09-28", paid_at: "2026-10-02" },
        { amount_cop: 500, status: "expected", due_date: "2026-10-05", paid_at: null },
        { amount_cop: 700, status: "expected", due_date: "2026-11-05", paid_at: null },
        { amount_cop: 300, status: "expected", due_date: null, paid_at: null },
        { amount_cop: 900, status: "expected", due_date: "2027-06-01", paid_at: null },
      ],
      "2026-10",
      "2026-11",
      "2026-10-20",
    );
    expect(flow).toEqual([
      { month: "2026-10", received: 1000, pending: 0, overdue: 500 },
      { month: "2026-11", received: 0, pending: 700, overdue: 0 },
    ]);
  });
});

describe("horas", () => {
  it("mondayOf", () => {
    expect(mondayOf("2026-10-25")).toBe("2026-10-19"); // domingo → lunes anterior
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
  });

  it("weeklyHours agrupa por semana y tipo, en hora de Colombia, sin borradas", () => {
    const weeks = weeklyHours(
      [
        { started_at: "2026-10-20T15:00:00Z", hours: 2, deleted_at: null, kind: "scope" },
        { started_at: "2026-10-21T15:00:00Z", hours: 1.5, deleted_at: null, kind: "support" },
        // 2026-10-19 02:00 UTC = domingo 18 en Colombia → semana anterior
        { started_at: "2026-10-19T02:00:00Z", hours: 3, deleted_at: null, kind: "scope" },
        { started_at: "2026-10-21T15:00:00Z", hours: 9, deleted_at: "2026-10-22T00:00:00Z", kind: "scope" },
        { started_at: "2026-10-21T15:00:00Z", hours: null, deleted_at: null, kind: "scope" },
      ],
      2,
      "2026-10-22",
    );
    expect(weeks).toEqual([
      { week: "2026-10-12", scope: 3, support: 0, extra: 0 },
      { week: "2026-10-19", scope: 2, support: 1.5, extra: 0 },
    ]);
  });

  it("hoursByProject ordena por total y omite proyectos sin horas", () => {
    const rows = hoursByProject([
      { project_id: "a", code_prefix: "A", name: "A", scope_logged: 1, support_logged: 0, extra_logged: 0 },
      { project_id: "b", code_prefix: "B", name: "B", scope_logged: 3, support_logged: 2, extra_logged: 1 },
      { project_id: "c", code_prefix: "C", name: "C", scope_logged: 0, support_logged: 0, extra_logged: 0 },
    ]);
    expect(rows.map((r) => [r.label, r.total])).toEqual([
      ["B", 6],
      ["A", 1],
    ]);
  });
});

describe("sprintBurndown", () => {
  const sprint = { start_date: "2026-10-19", end_date: "2026-10-23" };
  const tickets = [
    { estimated_hours: 4, done_at: "2026-10-20T20:00:00Z" },
    { estimated_hours: "6", done_at: null },
    { estimated_hours: null, done_at: "2026-10-19T20:00:00Z" },
  ];

  it("resta lo cerrado por día, deja null el futuro y traza la ideal", () => {
    expect(sprintBurndown(sprint, tickets, "2026-10-21")).toEqual([
      { date: "2026-10-19", remaining: 10, ideal: 10 },
      { date: "2026-10-20", remaining: 6, ideal: 7.5 },
      { date: "2026-10-21", remaining: 6, ideal: 5 },
      { date: "2026-10-22", remaining: null, ideal: 2.5 },
      { date: "2026-10-23", remaining: null, ideal: 0 },
    ]);
  });

  it("sprint sin estimados queda en 0", () => {
    expect(sprintBurndown(sprint, [{ estimated_hours: null, done_at: null }], "2026-10-23").every((p) => p.remaining === 0)).toBe(true);
  });
});

describe("toCsv", () => {
  const columns = [
    { header: "Ticket", value: (r: { code: string; title: string; hours: number | null }) => r.code },
    { header: "Título", value: (r: { code: string; title: string; hours: number | null }) => r.title },
    { header: "Horas", value: (r: { code: string; title: string; hours: number | null }) => r.hours },
  ];

  it("separador ;, coma decimal, BOM y CRLF", () => {
    expect(toCsv([{ code: "WEB-1", title: "Home", hours: 1.5 }], columns)).toBe(
      "﻿Ticket;Título;Horas\r\nWEB-1;Home;1,5\r\n",
    );
  });

  it("escapa ; comillas y saltos de línea, y neutraliza fórmulas", () => {
    const csv = toCsv(
      [
        { code: "WEB-2", title: 'Dice "hola"; adiós\nfin', hours: null },
        { code: "WEB-3", title: "=HYPERLINK(1)", hours: 2 },
      ],
      columns,
    );
    expect(csv).toContain('WEB-2;"Dice ""hola""; adiós\nfin";\r\n');
    expect(csv).toContain("WEB-3;'=HYPERLINK(1);2");
  });
});
