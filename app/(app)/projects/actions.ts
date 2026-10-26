"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, failIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { addDays, todayCO } from "@/lib/dates";
import type { Project } from "@/lib/data/projects";
import { buildMonthlySchedule, diffMonthlySchedule } from "@/lib/payments";
import { describeProjectChanges, type ProjectChange } from "@/lib/projects/changes";
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
  if (!parsed.success) return failIssue(parsed.error);
  const input = parsed.data;

  const { data: project, error } = await supabase.from("projects").insert(input).select("id").single();
  if (error) return duplicatePrefix(error, input.code_prefix) ?? fail("No se pudo crear el proyecto.");

  // Contratación mensual: se generan los pagos esperados (y sus seguimientos "Cobrar…").
  const sync = await syncMonthlyPayments(supabase, project.id);
  if (!sync.ok) return fail("El proyecto se creó, pero no se pudieron generar los pagos mensuales.");

  refresh();
  redirect(`/projects/${project.id}`);
}

export type ProjectUpdatePreview = {
  changes: ProjectChange[];
  /** null si el proyecto no tiene ni tendrá mensualidades. */
  payments: {
    sync: boolean;
    unchanged: boolean;
    removed: { due_date: string; amount_cop: number | null }[];
    added: { due_date: string; amount_cop: number; overdue: boolean }[];
    kept: number;
    overdueCount: number;
    receivedKept: number;
  } | null;
};

type Failure = Extract<ActionResult, { ok: false }>;

export type PreviewResult = { ok: true; preview: ProjectUpdatePreview } | Failure;

/** "Recalcular pagos mensuales pendientes": activa salvo que el formulario envíe "0". */
const wantsSync = (formData: FormData) => formData.get("sync_payments") !== "0";

/**
 * Vista previa (sin guardar) de lo que cambiaría al editar el proyecto: campos
 * y mensualidades pendientes, marcando las que quedarían con fecha ya pasada.
 */
export async function previewProjectUpdate(formData: FormData): Promise<PreviewResult> {
  const { supabase } = await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Proyecto inválido." };
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error) as Failure;

  const { data: before, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id.data)
    .is("deleted_at", null)
    .single();
  if (error) return { ok: false, error: "No se encontró el proyecto." };

  const { data: existing, error: paymentsError } = await readMonthlyPayments(supabase, id.data);
  if (paymentsError) return { ok: false, error: "No se pudieron leer los pagos del proyecto." };

  const schedule = scheduleFor(parsed.data);
  const hasMonthly = schedule.length > 0 || existing.some((p) => p.status === "expected");
  const diff = diffMonthlySchedule(existing, schedule, todayCO());

  return {
    ok: true,
    preview: {
      changes: describeProjectChanges(before, parsed.data),
      payments: hasMonthly
        ? {
            sync: wantsSync(formData),
            unchanged: diff.unchanged,
            removed: diff.removed,
            added: diff.toInsert.map((p) => ({
              due_date: p.due_date!,
              amount_cop: p.amount_cop,
              overdue: diff.overdue.includes(p),
            })),
            kept: diff.kept,
            overdueCount: diff.overdue.length,
            receivedKept: diff.receivedKept,
          }
        : null,
    },
  };
}

export async function updateProject(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Proyecto inválido.");
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);

  const { error } = await supabase.from("projects").update(parsed.data).eq("id", id.data);
  if (error) return duplicatePrefix(error, parsed.data.code_prefix) ?? fail("No se pudo guardar el proyecto.");

  // Las mensualidades pendientes se alinean con el contrato (las recibidas no se tocan).
  // Solo se reescriben si el calendario calculado difiere del guardado.
  if (wantsSync(formData)) {
    const sync = await syncMonthlyPayments(supabase, id.data);
    if (!sync.ok) return fail("El proyecto se guardó, pero no se pudieron recalcular los pagos mensuales.");
  }

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

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

type ContractFields = Pick<
  Project,
  "billing_type" | "start_date" | "contract_months" | "monthly_fee_cop" | "billing_day"
>;

/** Calendario de mensualidades del contrato (vacío si no es mensual o le faltan datos). */
function scheduleFor(project: ContractFields) {
  return project.billing_type === "retainer" &&
    project.start_date &&
    project.contract_months &&
    project.monthly_fee_cop
    ? buildMonthlySchedule({
        start_date: project.start_date,
        contract_months: project.contract_months,
        monthly_fee_cop: project.monthly_fee_cop,
        billing_day: project.billing_day,
      })
    : [];
}

function readMonthlyPayments(supabase: Supabase, projectId: string) {
  return supabase
    .from("payments")
    .select("id, status, due_date, amount_cop")
    .eq("project_id", projectId)
    .eq("kind", "monthly")
    .is("deleted_at", null);
}

/**
 * Alinea las mensualidades con el contrato actual del proyecto: reemplaza las
 * pendientes por el calendario vigente y respeta los meses ya cobrados. Si el
 * proyecto ya no es mensual (o le faltan datos), solo retira las pendientes.
 * No hace nada si las pendientes ya coinciden con el contrato.
 * Los seguimientos "Cobrar…" los ajusta el trigger payments_sync_follow_up.
 */
async function syncMonthlyPayments(
  supabase: Supabase,
  projectId: string,
): Promise<{ ok: true; created: number; replaced: number } | { ok: false }> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("billing_type, start_date, contract_months, monthly_fee_cop, billing_day")
    .eq("id", projectId)
    .single();
  if (error) return { ok: false };

  const { data: existing, error: paymentsError } = await readMonthlyPayments(supabase, projectId);
  if (paymentsError) return { ok: false };

  const { toDelete, toInsert } = diffMonthlySchedule(existing, scheduleFor(project), todayCO());

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("payments")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", toDelete);
    if (deleteError) return { ok: false };
  }
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("payments")
      .insert(toInsert.map((p) => ({ ...p, project_id: projectId })));
    if (insertError) return { ok: false };
  }
  return { ok: true, created: toInsert.length, replaced: toDelete.length };
}

/** Botón "Regenerar pagos mensuales" de la pestaña Pagos. */
export async function regenerateMonthlyPayments(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Proyecto inválido.");

  const { data: project, error } = await supabase
    .from("projects")
    .select("billing_type, start_date, contract_months, monthly_fee_cop, billing_day")
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

  const sync = await syncMonthlyPayments(supabase, id);
  if (!sync.ok) return fail("No se pudieron actualizar los pagos.");

  refresh();
  if (sync.created === 0 && sync.replaced === 0) return ok("Los pagos mensuales ya están al día.");
  return ok(`Se generaron ${sync.created} pagos mensuales (${sync.replaced} pendientes reemplazados).`);
}

/** Marca la entrega: abre la ventana de soporte y, opcionalmente, registra el pago final y el sprint de soporte. */
export async function deliverProject(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = deliverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);
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
