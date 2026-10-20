import { daysBetween, makeISODate, type ISODate } from "@/lib/dates";
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
 * cobro (1–28), empezando en la primera fecha de cobro igual o posterior al inicio.
 */
export function buildMonthlySchedule({
  start_date,
  contract_months,
  monthly_fee_cop,
  billing_day,
}: MonthlyScheduleInput): ScheduledPayment[] {
  const day = Math.min(Math.max(billing_day ?? 1, 1), 28);
  const [year, startMonth] = start_date.split("-").map(Number);
  // Si el día de cobro ya pasó en el mes de inicio, empieza el mes siguiente.
  const month =
    daysBetween(start_date, makeISODate(year, startMonth, day)!) < 0
      ? startMonth + 1
      : startMonth;

  return Array.from({ length: contract_months }, (_, i) => {
    const m = month - 1 + i;
    return {
      kind: "monthly" as const,
      status: "expected" as const,
      amount_cop: monthly_fee_cop,
      due_date: makeISODate(year + Math.floor(m / 12), (m % 12) + 1, day)!,
    };
  });
}
