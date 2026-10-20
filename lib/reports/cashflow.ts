import { daysBetween, type ISODate } from "@/lib/dates";
import type { PaymentLike } from "@/lib/valuation";

export type YearMonth = string; // "YYYY-MM"

export type CashflowMonth = {
  month: YearMonth;
  received: number;
  pending: number;
  overdue: number;
};

export function shiftMonth(month: YearMonth, delta: number): YearMonth {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Meses de `from` a `to`, ambos incluidos. */
export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  const months: YearMonth[] = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) months.push(m);
  return months;
}

/**
 * Flujo de caja por mes: lo recibido cuenta en el mes de pago; lo esperado en el
 * mes en que vence (vencido si esa fecha ya pasó). Lo esperado sin fecha no tiene
 * mes y se omite.
 */
export function monthlyCashflow(
  payments: PaymentLike[],
  from: YearMonth,
  to: YearMonth,
  today: ISODate,
): CashflowMonth[] {
  const months = new Map(
    monthsBetween(from, to).map((month) => [month, { month, received: 0, pending: 0, overdue: 0 }]),
  );
  for (const p of payments) {
    if (p.status === "received") {
      const bucket = p.paid_at ? months.get(p.paid_at.slice(0, 7)) : undefined;
      if (bucket) bucket.received += p.amount_cop;
    } else if (p.due_date) {
      const bucket = months.get(p.due_date.slice(0, 7));
      if (!bucket) continue;
      if (daysBetween(p.due_date, today) > 0) bucket.overdue += p.amount_cop;
      else bucket.pending += p.amount_cop;
    }
  }
  return [...months.values()];
}

const monthFormatter = new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" });

/** "2026-10" → "oct 26". */
export function formatMonth(month: YearMonth): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`)).replace(".", "");
}

/** Rangos (meses hacia atrás) disponibles en /reports; 6 por defecto. */
export const REPORT_RANGE_MONTHS = [3, 6, 12] as const;
