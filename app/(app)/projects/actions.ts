"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, firstIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { buildMonthlySchedule } from "@/lib/payments";
import { deliverySchema, projectSchema } from "@/lib/projects/schema";

function refresh() {
  revalidatePath("/", "layout");
}

function duplicatePrefix(error: { code?: string } | null, prefix: string): ActionResult | null {
  return error?.code === "23505" ? fail(`Ya existe un proyecto con el prefijo ${prefix}.`) : null;
}

export async function createProject(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const input = parsed.data;

  const { data: project, error } = await supabase.from("projects").insert(input).select("id").single();
  if (error) return duplicatePrefix(error, input.code_prefix) ?? fail("No se pudo crear el proyecto.");

  // Contratación mensual: se generan los pagos esperados (y sus seguimientos "Cobrar…").
  if (input.billing_type === "retainer" && input.start_date && input.contract_months) {
    const schedule = buildMonthlySchedule({
      start_date: input.start_date,
      contract_months: input.contract_months,
      monthly_fee_cop: input.monthly_fee_cop!,
      billing_day: input.billing_day,
    }).map((p) => ({ ...p, project_id: project.id }));
    const { error: scheduleError } = await supabase.from("payments").insert(schedule);
    if (scheduleError) return fail("El proyecto se creó, pero no se pudieron generar los pagos mensuales.");
  }

  refresh();
  redirect(`/projects/${project.id}`);
}

export async function updateProject(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Proyecto inválido.");
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { error } = await supabase.from("projects").update(parsed.data).eq("id", id.data);
  if (error) return duplicatePrefix(error, parsed.data.code_prefix) ?? fail("No se pudo guardar el proyecto.");

  refresh();
  redirect(`/projects/${id.data}`);
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Proyecto inválido.");
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo archivar el proyecto.");
  refresh();
  redirect("/projects");
}

/**
 * Rehace los pagos mensuales pendientes según el contrato actual. Los meses que
 * ya tienen una mensualidad recibida se respetan.
 */
export async function regenerateMonthlyPayments(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Proyecto inválido.");

  const { data: project, error } = await supabase
    .from("projects")
    .select("billing_type, start_date, contract_months, monthly_fee_cop, billing_day, payments(kind, status, due_date, deleted_at)")
    .eq("id", id)
    .single();
  if (error) return fail("No se encontró el proyecto.");
  if (
    project.billing_type !== "retainer" ||
    !project.start_date ||
    !project.contract_months ||
    !project.monthly_fee_cop
  ) {
    return fail("Completa inicio, meses y mensualidad del contrato para generar los pagos.");
  }

  const paidMonths = new Set(
    project.payments
      .filter((p) => !p.deleted_at && p.kind === "monthly" && p.status === "received" && p.due_date)
      .map((p) => p.due_date!.slice(0, 7)),
  );

  const { error: deleteError } = await supabase
    .from("payments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("project_id", id)
    .eq("kind", "monthly")
    .eq("status", "expected")
    .is("deleted_at", null);
  if (deleteError) return fail("No se pudieron actualizar los pagos.");

  const schedule = buildMonthlySchedule({
    start_date: project.start_date,
    contract_months: project.contract_months,
    monthly_fee_cop: project.monthly_fee_cop,
    billing_day: project.billing_day,
  })
    .filter((p) => !paidMonths.has(p.due_date!.slice(0, 7)))
    .map((p) => ({ ...p, project_id: id }));

  if (schedule.length > 0) {
    const { error: insertError } = await supabase.from("payments").insert(schedule);
    if (insertError) return fail("No se pudieron generar los pagos.");
  }

  refresh();
  return ok(`Se generaron ${schedule.length} pagos mensuales.`);
}

/** Marca la entrega: abre la ventana de soporte y, opcionalmente, registra el pago final y el sprint de soporte. */
export async function deliverProject(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = deliverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const input = parsed.data;
  const supportUntil = input.support_days > 0 ? addDays(input.delivered_at, input.support_days) : null;

  const { error } = await supabase
    .from("projects")
    .update({
      delivered_at: input.delivered_at,
      support_days: input.support_days,
      support_until: supportUntil,
      phase: supportUntil ? "support" : "delivered",
    })
    .eq("id", input.id);
  if (error) return fail("No se pudo marcar la entrega.");

  if (input.register_final && input.final_amount) {
    const received = input.final_status === "received";
    const { error: paymentError } = await supabase.from("payments").insert({
      project_id: input.id,
      kind: "final",
      amount_cop: input.final_amount,
      status: input.final_status,
      due_date: input.delivered_at,
      paid_at: received ? input.delivered_at : null,
    });
    if (paymentError) return fail("Se marcó la entrega, pero no se pudo registrar el pago final.");
  }

  if (input.create_support_sprint && supportUntil) {
    const { error: sprintError } = await supabase.from("sprints").insert({
      project_id: input.id,
      name: "Soporte post-entrega",
      start_date: input.delivered_at,
      end_date: supportUntil,
      is_support: true,
    });
    if (sprintError) return fail("Se marcó la entrega, pero no se pudo crear el sprint de soporte.");
  }

  refresh();
  return ok(supportUntil ? "Entregado. La ventana de soporte está abierta." : "Proyecto entregado.");
}

export async function closeProject(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Proyecto inválido.");
  const { error } = await supabase.from("projects").update({ phase: "closed" }).eq("id", id);
  if (error) return fail("No se pudo cerrar el proyecto.");
  refresh();
  return ok("Proyecto cerrado.");
}

/** Vuelve a activo y borra la entrega (descarta el seguimiento de cierre de soporte). */
export async function reopenProject(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Proyecto inválido.");
  const { error } = await supabase
    .from("projects")
    .update({ phase: "active", delivered_at: null, support_until: null })
    .eq("id", id);
  if (error) return fail("No se pudo reabrir el proyecto.");
  refresh();
  return ok("Proyecto reabierto.");
}
