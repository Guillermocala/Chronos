"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, firstIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { todayCO } from "@/lib/dates";
import { paymentSchema } from "@/lib/projects/schema";

function refresh() {
  revalidatePath("/", "layout");
}

/** Crea o edita un pago. Los seguimientos "Cobrar…" los mantiene la base de datos. */
export async function savePayment(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
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
