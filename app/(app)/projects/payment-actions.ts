"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, failIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { hoursInPeriod, paymentPeriod, settleAmount, toHourEntries } from "@/lib/billing/hours-settlement";
import { addDays, todayCO } from "@/lib/dates";
import { formatCOP } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import { paymentSchema } from "@/lib/projects/schema";

function refresh() {
  revalidatePath("/", "layout");
}

/** Crea o edita un pago. Los seguimientos "Cobrar…" los mantiene la base de datos. */
export async function savePayment(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);
  const { id, ...payment } = parsed.data;
  const row = { ...payment, paid_at: payment.status === "received" ? payment.paid_at : null };

  const { error } = id
    ? await supabase.from("payments").update(row).eq("id", id)
    : await supabase.from("payments").insert(row);
  if (error) return fail("No se pudo guardar el pago.");

  refresh();
  return ok(id ? "Pago actualizado." : "Pago agregado.");
}

export async function markPaymentReceived(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Pago inválido.");
  const { error } = await supabase
    .from("payments")
    .update({ status: "received", paid_at: todayCO() })
    .eq("id", id);
  if (error) return fail("No se pudo marcar el pago.");
  refresh();
  return ok("Pago marcado como recibido.");
}

/**
 * Liquida una mensualidad de un proyecto OPS con las horas reales de su período:
 * valor = mensualidad / horas pactadas × horas (sin extras facturables). Se puede
 * repetir mientras el pago no esté recibido. El seguimiento "Cobrar…" se ajusta
 * solo (trigger payments_sync_follow_up).
 */
export async function settleMonthlyPayment(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Pago inválido.");

  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id, kind, status, due_date, period_start, period_end, project:projects!inner(id, billing_type, monthly_fee_cop, expected_hours_per_month)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) return fail("No se encontró el pago.");
  const { project } = payment;
  if (project.billing_type !== "hourly_adjusted" || payment.kind !== "monthly") {
    return fail("Solo se liquidan por horas las mensualidades de proyectos OPS.");
  }
  if (payment.status === "received") return fail("El pago ya se recibió; no se puede volver a liquidar.");
  const period = paymentPeriod(payment);
  if (!period) return fail("La mensualidad no tiene fecha de cobro.");
  if (!project.monthly_fee_cop || !project.expected_hours_per_month) {
    return fail("Completa la mensualidad y las horas por mes del proyecto.");
  }

  // Margen de un día a cada lado: el filtro exacto se hace con la fecha de Colombia.
  const { data: entries, error: entriesError } = await supabase
    .from("time_entries")
    .select("started_at, hours, ticket:tickets(kind, billable)")
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .not("hours", "is", null)
    .gte("started_at", `${addDays(period.start, -1)}T00:00:00Z`)
    .lte("started_at", `${addDays(period.end, 1)}T23:59:59Z`);
  if (entriesError) return fail("No se pudieron leer las horas del período.");

  const hours = hoursInPeriod(toHourEntries(entries), period).settleable;
  const settlement = settleAmount({
    fee: project.monthly_fee_cop,
    expectedHours: Number(project.expected_hours_per_month),
    hours,
  });
  if (settlement.amount <= 0) {
    return fail("No hay horas registradas en el período: no se puede liquidar en $0.");
  }

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      amount_cop: settlement.amount,
      period_start: period.start,
      period_end: period.end,
      settled_hours: hours,
      settled_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) return fail("No se pudo liquidar la mensualidad.");

  refresh();
  return ok(`Mensualidad liquidada: ${formatDuration(hours)} → ${formatCOP(settlement.amount)}.`);
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Pago inválido.");
  const { error } = await supabase
    .from("payments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo eliminar el pago.");
  refresh();
  return ok("Pago eliminado.");
}
