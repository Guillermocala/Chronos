// resumen.md de cada backup: qué se respaldó y un estado rápido del negocio.

import { addDays, daysBetween, type ISODate } from "@/lib/dates";
import { formatCOP, formatDate } from "@/lib/format";
import { BILLING_LABELS } from "@/lib/projects/labels";
import { formatDuration } from "@/lib/time";
import {
  contractValue,
  paymentTotals,
  projectValuation,
  type PaymentLike,
  type ProjectBilling,
  type ProjectHours,
} from "@/lib/valuation";

import type { BackupMode, BackupTrigger } from "./types";

export type SummaryProject = ProjectBilling & {
  id: string;
  name: string;
  code_prefix: string;
  phase: "active" | "delivered" | "support" | "closed";
  support_until: string | null;
  payments: (PaymentLike & { kind: string })[];
  hours: ProjectHours;
};

export type SummaryStats = {
  date: ISODate;
  trigger: BackupTrigger;
  mode: BackupMode;
  durationSeconds: number;
  /** undefined = se omite (el archivo dentro del repo no conoce su propio commit). */
  commitSha?: string | null;
  exported: { slug: string; name: string }[];
  skipped: { slug: string; since: string }[];
  counts: Record<string, number>;
  week: {
    ticketsCreated: number;
    ticketsDone: number;
    hoursLogged: number;
    paymentsReceivedCOP: number;
  };
  projects: SummaryProject[];
};

const TRIGGER_LABEL: Record<BackupTrigger, string> = { scheduled: "automático", manual: "manual" };
const MODE_LABEL: Record<BackupMode, string> = { incremental: "incremental", full: "completo" };

// Intl usa espacios no separables en "$ 1.000": en Markdown se ven raros en tablas.
const cop = (n: number | null) => formatCOP(n).replace(/\s/g, " ");

export function buildSummary(s: SummaryStats): string {
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(
    `# Backup de Chronos — ${s.date}`,
    "",
    `- **Tipo:** ${MODE_LABEL[s.mode]} (${TRIGGER_LABEL[s.trigger]})`,
    `- **Duración:** ${s.durationSeconds} s`,
    ...(s.commitSha === undefined
      ? []
      : [`- **Commit:** ${s.commitSha ? `\`${s.commitSha.slice(0, 7)}\`` : "sin cambios (no se creó commit)"}`]),
    "",
    "## Proyectos respaldados",
    "",
  );
  if (s.exported.length === 0) push("_Ningún proyecto cambió desde el último backup._");
  for (const p of s.exported) push(`- ✅ **${p.slug.toUpperCase()}** · ${p.name}`);
  if (s.skipped.length > 0) {
    push("", `**Omitidos (sin cambios):** ${s.skipped.map((p) => `${p.slug.toUpperCase()} (desde ${p.since})`).join(", ")}`);
  }

  push("", "## Registros en la base", "", "| Tabla | Filas |", "|---|---:|");
  for (const [table, n] of Object.entries(s.counts)) push(`| ${table} | ${n} |`);

  push(
    "",
    "## Últimos 7 días",
    "",
    `- Tickets creados: **${s.week.ticketsCreated}** · cerrados: **${s.week.ticketsDone}**`,
    `- Horas registradas: **${formatDuration(s.week.hoursLogged)}**`,
    `- Pagos recibidos: **${cop(s.week.paymentsReceivedCOP)}**`,
  );

  const open = s.projects.filter((p) => p.phase !== "closed");
  if (open.length > 0) {
    push(
      "",
      "## Proyectos abiertos",
      "",
      "| Proyecto | Modalidad | Valor | Cobrado | Pendiente | Tarifa real |",
      "|---|---|---:|---:|---:|---:|",
    );
    for (const p of open) {
      const totals = paymentTotals(p.payments, s.date);
      const receivedContract = p.payments
        .filter((x) => x.status === "received" && x.kind !== "extra")
        .reduce((sum, x) => sum + x.amount_cop, 0);
      const v = projectValuation(p, p.hours, receivedContract);
      push(
        `| ${p.code_prefix} · ${p.name} | ${BILLING_LABELS[p.billing_type]} | ${cop(contractValue(p))} | ${cop(totals.received)} | ${cop(totals.expected)} | ${v.realRate !== null ? `${cop(v.realRate)}/h` : "—"} |`,
      );
    }
  }

  const alerts: string[] = [];
  for (const p of s.projects) {
    if (p.phase === "support" && p.support_until) {
      const left = daysBetween(s.date, p.support_until);
      if (left < 0) alerts.push(`⚠️ Soporte de **${p.code_prefix}** venció el ${formatDate(p.support_until)}: ¿cerrar el proyecto?`);
      else if (left <= 3) alerts.push(`⏳ Soporte de **${p.code_prefix}** termina el ${formatDate(p.support_until)}.`);
    }
    const overdue = paymentTotals(p.payments, s.date);
    if (p.phase !== "closed" && overdue.overdueCount > 0) {
      alerts.push(`💸 **${p.code_prefix}** tiene ${overdue.overdueCount} pago(s) vencido(s) por ${cop(overdue.overdue)}.`);
    }
  }
  const support = s.projects.filter(
    (p) => p.phase === "support" && p.support_until && daysBetween(s.date, p.support_until) > 3,
  );
  for (const p of support) alerts.push(`🛟 **${p.code_prefix}** en soporte hasta el ${formatDate(p.support_until)}.`);

  push("", "## Alertas", "");
  push(...(alerts.length > 0 ? alerts.map((a) => `- ${a}`) : ["_Sin alertas._"]));

  push(
    "",
    "---",
    `Restaurar: ver [README.md](../README.md). Próximo backup automático: domingo ${formatDate(nextSunday(s.date))}, 10 p. m.`,
    "",
  );
  return lines.join("\n");
}

function nextSunday(date: ISODate): ISODate {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, (7 - day) % 7 || 7);
}
