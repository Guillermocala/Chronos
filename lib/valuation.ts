// Cálculo de valor en COP. Funciones puras: reciben solo los campos que necesitan
// para poder probarse sin base de datos y reutilizarse en la fase de tickets/horas.

import { daysBetween, eachMonthOverlap, type ISODate } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";

export type ProjectBilling = Pick<
  Tables<"projects">,
  | "billing_type"
  | "fixed_amount_cop"
  | "estimated_total_hours"
  | "monthly_fee_cop"
  | "expected_hours_per_month"
  | "contract_months"
>;

export type SprintRange = Pick<
  Tables<"sprints">,
  "start_date" | "end_date" | "value_cop_override"
>;

export type PaymentLike = Pick<
  Tables<"payments">,
  "amount_cop" | "status" | "due_date" | "paid_at"
>;

/**
 * Tarifa por hora estimada.
 * - retainer: mensualidad / horas esperadas por mes.
 * - fijo: monto / horas estimadas de alcance (de los tickets si se conocen; si no,
 *   `estimated_total_hours` del proyecto).
 */
export function estimatedHourlyRate(
  project: ProjectBilling,
  scopeEstimatedHours?: number | null,
): number | null {
  if (project.billing_type === "retainer") {
    const { monthly_fee_cop: fee, expected_hours_per_month: hours } = project;
    return fee != null && hours ? fee / hours : null;
  }
  const hours =
    scopeEstimatedHours && scopeEstimatedHours > 0
      ? scopeEstimatedHours
      : project.estimated_total_hours;
  return project.fixed_amount_cop != null && hours ? project.fixed_amount_cop / hours : null;
}

/** Valor total del contrato: monto fijo, o mensualidad × meses. */
export function contractValue(project: ProjectBilling): number | null {
  if (project.billing_type === "fixed") return project.fixed_amount_cop;
  const { monthly_fee_cop: fee, contract_months: months } = project;
  return fee != null && months ? fee * months : null;
}

export type SprintValue = {
  value: number | null;
  source: "override" | "retainer" | "tickets" | "pending";
};

/**
 * Valor de un sprint.
 * - Override manual si existe.
 * - retainer: mensualidad prorrateada por los días del sprint en cada mes que cruza.
 * - fijo: horas estimadas de sus tickets × tarifa estimada ("pending" sin tickets).
 */
export function sprintValue(
  project: ProjectBilling,
  sprint: SprintRange,
  ticketsEstimatedHours?: number | null,
  scopeEstimatedHours?: number | null,
): SprintValue {
  if (sprint.value_cop_override != null) {
    return { value: sprint.value_cop_override, source: "override" };
  }
  if (project.billing_type === "retainer") {
    const fee = project.monthly_fee_cop;
    if (fee == null) return { value: null, source: "pending" };
    const total = eachMonthOverlap(sprint.start_date, sprint.end_date).reduce(
      (sum, m) => sum + (fee * m.days) / m.daysInMonth,
      0,
    );
    return { value: Math.round(total), source: "retainer" };
  }
  const rate = estimatedHourlyRate(project, scopeEstimatedHours);
  if (rate == null || !ticketsEstimatedHours) return { value: null, source: "pending" };
  return { value: Math.round(rate * ticketsEstimatedHours), source: "tickets" };
}

export type PaymentTotals = {
  received: number;
  expected: number;
  overdue: number;
  overdueCount: number;
};

/** Cobrado, pendiente y vencido (esperado con fecha anterior a hoy). */
export function paymentTotals(payments: PaymentLike[], today: ISODate): PaymentTotals {
  return payments.reduce<PaymentTotals>(
    (acc, p) => {
      if (p.status === "received") {
        acc.received += p.amount_cop;
      } else {
        acc.expected += p.amount_cop;
        if (p.due_date && daysBetween(p.due_date, today) > 0) {
          acc.overdue += p.amount_cop;
          acc.overdueCount += 1;
        }
      }
      return acc;
    },
    { received: 0, expected: 0, overdue: 0, overdueCount: 0 },
  );
}

/** Tarifa real: lo cobrado dividido entre todas las horas trabajadas (alcance + soporte). */
export function realHourlyRate(receivedCOP: number, loggedHours: number): number | null {
  return loggedHours > 0 ? receivedCOP / loggedHours : null;
}

/** Costo de oportunidad de las horas de soporte no facturadas. */
export function supportImpact(supportHours: number, estimatedRate: number | null) {
  return {
    hours: supportHours,
    opportunityCostCOP: estimatedRate == null ? null : Math.round(supportHours * estimatedRate),
  };
}

export type TicketLike = Pick<Tables<"tickets">, "kind" | "billable" | "estimated_hours">;

export type TicketValue = {
  /** Valor que aporta al contrato (soporte = 0). */
  value: number | null;
  /** Solo soporte: lo que costarían esas horas a la tarifa estimada. */
  opportunityCost: number | null;
};

/**
 * Valor de un ticket a partir de sus horas estimadas y la tarifa estimada.
 * - alcance: horas × tarifa.
 * - soporte: 0 (no se cobra); el costo de oportunidad va aparte.
 * - extra: horas × tarifa si es facturable (sugerencia de cobro), si no 0.
 */
export function ticketValue(
  project: ProjectBilling,
  ticket: TicketLike,
  scopeEstimatedHours?: number | null,
): TicketValue {
  const rate = estimatedHourlyRate(project, scopeEstimatedHours);
  const hours = ticket.estimated_hours;
  const priced = rate !== null && hours != null ? Math.round(rate * hours) : null;

  switch (ticket.kind) {
    case "scope":
      return { value: priced, opportunityCost: null };
    case "support":
      return { value: 0, opportunityCost: priced };
    case "extra":
      return { value: ticket.billable ? priced : 0, opportunityCost: null };
  }
}

export type ProjectHours = {
  scope_estimated: number;
  scope_logged: number;
  support_logged: number;
  extra_logged: number;
};

/**
 * Tarifa estimada vs real del alcance contratado.
 * La real = cobrado del contrato / (horas de alcance + soporte): el soporte no
 * cobrado la baja. Los extras se cobran aparte, así que ni sus horas ni sus
 * pagos entran (`receivedContractCOP` debe excluir pagos extra).
 */
export function projectValuation(
  project: ProjectBilling,
  hours: ProjectHours,
  receivedContractCOP: number,
) {
  const estimatedRate = estimatedHourlyRate(project, hours.scope_estimated);
  return {
    estimatedRate,
    realRate: realHourlyRate(receivedContractCOP, hours.scope_logged + hours.support_logged),
    support: supportImpact(hours.support_logged, estimatedRate),
    loggedHours: hours.scope_logged + hours.support_logged + hours.extra_logged,
  };
}
