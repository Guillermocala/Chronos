import { daysBetween, makeISODate, type ISODate } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import type { TablesInsert } from "@/lib/supabase/database.types";

export type MonthlyScheduleInput = {
  start_date: ISODate;
  contract_months: number;
  monthly_fee_cop: number;
  billing_day?: number | null;
};

export type ScheduledPayment = Pick<
  TablesInsert<"payments">,
  "kind" | "status" | "amount_cop" | "due_date"
>;

/**
 * Pagos mensuales esperados de un contrato por tiempo: uno por mes, el día de
 * cobro (1–28). El primer cobro es siempre el mes siguiente al inicio (mes
 * vencido): inicio 26-oct con día 5 → 5-nov, 5-dic…
 */
export function buildMonthlySchedule({
  start_date,
  contract_months,
  monthly_fee_cop,
  billing_day,
}: MonthlyScheduleInput): ScheduledPayment[] {
  const day = Math.min(Math.max(billing_day ?? 1, 1), 28);
  const [year, startMonth] = start_date.split("-").map(Number);

  return Array.from({ length: contract_months }, (_, i) => {
    // startMonth es 1–12; el primer cobro es el mes siguiente (índice 0-based = startMonth).
    const m = startMonth + i;
    return {
      kind: "monthly" as const,
      status: "expected" as const,
      amount_cop: monthly_fee_cop,
      due_date: makeISODate(year + Math.floor(m / 12), (m % 12) + 1, day)!,
    };
  });
}

export type ExistingMonthlyPayment = Pick<Tables<"payments">, "id" | "status" | "due_date"> & {
  amount_cop?: number | null;
};

/**
 * Qué hacer con las mensualidades al (re)calcular el contrato: se reemplazan
 * todas las pendientes y se respetan los meses que ya tienen una mensualidad
 * recibida.
 */
export function planMonthlySync(
  existing: ExistingMonthlyPayment[],
  schedule: ScheduledPayment[],
): { toDelete: string[]; toInsert: ScheduledPayment[] } {
  const paidMonths = new Set(
    existing
      .filter((p) => p.status === "received" && p.due_date)
      .map((p) => p.due_date!.slice(0, 7)),
  );
  return {
    toDelete: existing.filter((p) => p.status === "expected").map((p) => p.id),
    toInsert: schedule.filter((p) => !paidMonths.has(p.due_date!.slice(0, 7))),
  };
}

export type MonthlyDiff = {
  /** Las mensualidades pendientes ya coinciden con el contrato: no hay nada que hacer. */
  unchanged: boolean;
  /** Pendientes que sobran (se retiran). */
  toDelete: string[];
  /** Mensualidades que faltan (se crean). */
  toInsert: ScheduledPayment[];
  /** Fecha y monto de las pendientes que se retiran. */
  removed: { due_date: ISODate; amount_cop: number | null }[];
  /** Pendientes que ya coinciden y se conservan tal cual. */
  kept: number;
  /** Nuevos pendientes con fecha anterior a hoy. */
  overdue: ScheduledPayment[];
  /** Meses ya cobrados que se respetan. */
  receivedKept: number;
};

const pendingKey = (p: { due_date?: string | null; amount_cop?: number | null }) =>
  `${p.due_date ?? ""}|${p.amount_cop == null ? "" : Number(p.amount_cop)}`;

/**
 * Compara las mensualidades actuales con el calendario del contrato y propone
 * el cambio mínimo: conserva las pendientes que ya coinciden (misma fecha y
 * monto), retira las que sobran y crea las que faltan. Los meses ya cobrados
 * se respetan. Sirve para la vista previa antes de guardar y para sincronizar.
 */
export function diffMonthlySchedule(
  existing: ExistingMonthlyPayment[],
  schedule: ScheduledPayment[],
  today: ISODate,
): MonthlyDiff {
  const { toInsert: wanted } = planMonthlySync(existing, schedule);
  const pending = existing.filter((p) => p.status === "expected");

  // Emparejamiento uno a uno por fecha + monto.
  const available = new Map<string, ExistingMonthlyPayment[]>();
  for (const p of pending) {
    const key = pendingKey(p);
    available.set(key, [...(available.get(key) ?? []), p]);
  }
  const toInsert: ScheduledPayment[] = [];
  let kept = 0;
  for (const p of wanted) {
    const match = available.get(pendingKey(p))?.shift();
    if (match) kept += 1;
    else toInsert.push(p);
  }
  const leftovers = [...available.values()].flat();

  return {
    unchanged: toInsert.length === 0 && leftovers.length === 0,
    toDelete: leftovers.map((p) => p.id),
    toInsert,
    removed: leftovers
      .filter((p) => p.due_date)
      .map((p) => ({ due_date: p.due_date!, amount_cop: p.amount_cop ?? null }))
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    kept,
    overdue: toInsert.filter((p) => daysBetween(today, p.due_date!) < 0),
    receivedKept: existing.filter((p) => p.status === "received").length,
  };
}
