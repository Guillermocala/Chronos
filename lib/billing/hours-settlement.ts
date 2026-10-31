// Horas por período y liquidación de contratos mensuales ajustados por horas (OPS).
//
// Regla OPS: cada cuenta de cobro liquida las horas del día de cobro anterior al
// día antes del cobro (cobro 28-nov → 28-oct a 27-nov). Valor = mensualidad /
// horas pactadas × horas reales, proporcional en ambos sentidos y sin tope.
// Las horas de tickets extra facturables no entran: se cobran aparte.

import { addDays, makeISODate, type ISODate } from "@/lib/dates";
import { dateInBogota } from "@/lib/reports/hours";
import type { Enums } from "@/lib/supabase/database.types";

export type BillingType = Enums<"billing_type">;

/** Contratos con mensualidad (fija u OPS): generan pagos mensuales. */
export const isMonthlyBilling = (type: BillingType) => type === "retainer" || type === "hourly_adjusted";

export type Period = { start: ISODate; end: ISODate };

/** Período de horas que liquida la mensualidad con fecha `dueDate`. */
export function billingPeriod(dueDate: ISODate): Period {
  const [y, m, d] = dueDate.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  // El día de cobro es 1–28, así que siempre existe en el mes anterior.
  const start = makeISODate(prevYear, prevMonth, Math.min(d, 28))!;
  return { start, end: addDays(dueDate, -1) };
}

/** Período calendario del mes (para proyectos que no son OPS). */
export function calendarPeriod(month: string): Period {
  const [y, m] = month.split("-").map(Number);
  const start = makeISODate(y, m, 1)!;
  const nextStart = m === 12 ? makeISODate(y + 1, 1, 1)! : makeISODate(y, m + 1, 1)!;
  return { start, end: addDays(nextStart, -1) };
}

export type Settlement = {
  /** Tarifa por hora: mensualidad / horas pactadas. */
  rate: number;
  /** Valor de la cuenta de cobro (COP, sin decimales). */
  amount: number;
  /** amount − mensualidad (negativo si faltaron horas). */
  difference: number;
  /** Horas reales / pactadas (1 = 100 %). */
  ratio: number;
};

export function settleAmount({
  fee,
  expectedHours,
  hours,
}: {
  fee: number;
  expectedHours: number;
  hours: number;
}): Settlement {
  const rate = fee / expectedHours;
  const amount = Math.round(rate * hours);
  return { rate, amount, difference: amount - fee, ratio: hours / expectedHours };
}

export type HourKind = "scope" | "support" | "extra" | "direct";

export type HourEntry = {
  /** Fecha del registro en Colombia. */
  date: ISODate;
  hours: number;
  kind: HourKind;
  /** Solo para extras: si se cobra aparte. */
  billable?: boolean;
};

export type PeriodHours = Record<HourKind, number> & {
  total: number;
  /** Horas que cuentan para la liquidación OPS (todo menos extras facturables). */
  settleable: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function hoursInPeriod(entries: HourEntry[], { start, end }: Period): PeriodHours {
  const acc: PeriodHours = { scope: 0, support: 0, extra: 0, direct: 0, total: 0, settleable: 0 };
  for (const e of entries) {
    if (e.date < start || e.date > end) continue;
    acc[e.kind] += e.hours;
    acc.total += e.hours;
    if (!(e.kind === "extra" && e.billable)) acc.settleable += e.hours;
  }
  for (const key of Object.keys(acc) as (keyof PeriodHours)[]) acc[key] = round2(acc[key]);
  return acc;
}

/** Texto para la cuenta de cobro (copiar y pegar). */
export function settlementText({
  projectName,
  period,
  hours,
  expectedHours,
  settlement,
  formatMoney,
  formatDate,
}: {
  projectName: string;
  period: Period;
  hours: number;
  expectedHours: number;
  settlement: Settlement;
  formatMoney: (n: number) => string;
  formatDate: (d: ISODate) => string;
}): string {
  const hoursText = (n: number) => String(round2(n)).replace(".", ",");
  return [
    `Cuenta de cobro · ${projectName}`,
    `Período: ${formatDate(period.start)} al ${formatDate(period.end)}`,
    `Horas trabajadas: ${hoursText(hours)} de ${hoursText(expectedHours)} pactadas`,
    `Valor hora: ${formatMoney(Math.round(settlement.rate))}`,
    `Total a cobrar: ${formatMoney(settlement.amount)}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Horas por período de un proyecto (pestaña Horas y liquidación)

/** Registro de horas terminado, con su ticket (o sin ticket = directa). */
export type TimeEntryLike = {
  started_at: string;
  hours: number | null;
  ticket: { kind: "scope" | "support" | "extra"; billable: boolean } | null;
};

export function toHourEntries(entries: TimeEntryLike[]): HourEntry[] {
  return entries
    .filter((e) => e.hours != null)
    .map((e) => ({
      date: dateInBogota(e.started_at),
      hours: Number(e.hours),
      kind: e.ticket?.kind ?? "direct",
      billable: e.ticket?.billable,
    }));
}

export type ProjectForHours = {
  billing_type: BillingType;
  monthly_fee_cop: number | null;
  expected_hours_per_month: number | null;
  start_date: ISODate | null;
};

export type PaymentForHours = {
  id: string;
  kind: string;
  status: "expected" | "received";
  amount_cop: number;
  due_date: ISODate | null;
  period_start: ISODate | null;
  period_end: ISODate | null;
  settled_hours: number | null;
  settled_at: string | null;
};

export type PeriodRow = Period & {
  hours: PeriodHours;
  /** Horas pactadas del período (mensual fijo u OPS). */
  expected: number | null;
  current: boolean;
  /** Solo OPS: la mensualidad que liquida este período y el valor calculado con las horas actuales. */
  payment?: PaymentForHours;
  settlement?: Settlement;
};

/** Período de horas de una mensualidad: el guardado al liquidar o el calculado por la fecha de cobro. */
export function paymentPeriod(p: Pick<PaymentForHours, "due_date" | "period_start" | "period_end">): Period | null {
  if (p.period_start && p.period_end) return { start: p.period_start, end: p.period_end };
  return p.due_date ? billingPeriod(p.due_date) : null;
}

const MAX_MONTHS = 12;

/**
 * Filas de la pestaña Horas, de la más reciente a la más antigua.
 * - OPS: un período por mensualidad (del día de cobro anterior al día antes del cobro).
 * - Otros: meses calendario desde el inicio (o el primer registro) hasta hoy, máx. 12.
 */
export function projectHourPeriods({
  project,
  payments,
  entries,
  today,
}: {
  project: ProjectForHours;
  payments: PaymentForHours[];
  entries: HourEntry[];
  today: ISODate;
}): PeriodRow[] {
  const expected = isMonthlyBilling(project.billing_type) ? Number(project.expected_hours_per_month) || null : null;
  const fee = project.monthly_fee_cop;
  const isCurrent = (p: Period) => p.start <= today && today <= p.end;

  if (project.billing_type === "hourly_adjusted") {
    const rows = payments
      .filter((p) => p.kind === "monthly")
      .flatMap((payment) => {
        const period = paymentPeriod(payment);
        if (!period) return [];
        const hours = hoursInPeriod(entries, period);
        const settlement =
          fee != null && expected ? settleAmount({ fee, expectedHours: expected, hours: hours.settleable }) : undefined;
        return [{ ...period, hours, expected, current: isCurrent(period), payment, settlement }];
      });
    return rows.sort((a, b) => b.start.localeCompare(a.start));
  }

  const firstEntry = entries.reduce<ISODate | null>((min, e) => (min === null || e.date < min ? e.date : min), null);
  const candidates = [project.start_date, firstEntry].filter((d): d is ISODate => d !== null && d <= today);
  const from = (candidates.sort()[0] ?? today).slice(0, 7);
  const months: string[] = [];
  for (let month = today.slice(0, 7); month >= from && months.length < MAX_MONTHS; ) {
    months.push(month);
    const [y, m] = month.split("-").map(Number);
    month = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }
  return months.map((month) => {
    const period = calendarPeriod(month);
    return { ...period, hours: hoursInPeriod(entries, period), expected, current: isCurrent(period) };
  });
}
