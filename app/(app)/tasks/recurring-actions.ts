"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, failIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { recurringSchema } from "@/lib/tasks/recurring-schema";

function refresh() {
  revalidatePath("/", "layout");
}

/** Crea o edita una regla y genera de inmediato la ocurrencia si ya toca. */
export async function saveRecurring(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = recurringSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);
  const { id, ...rule } = parsed.data;

  const { error } = id
    ? await supabase.from("recurring_tasks").update(rule).eq("id", id)
    : await supabase.from("recurring_tasks").insert(rule);
  if (error) return fail("No se pudo guardar la tarea recurrente.");

  const { data: created } = await supabase.rpc("generate_my_recurring_tasks");
  refresh();
  return ok(
    created
      ? `Guardada. Se creó la tarea del ${formatShortDate(rule.next_due)}.`
      : `Guardada. Próxima: ${formatShortDate(rule.next_due)}.`,
  );
}

export async function toggleRecurring(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Regla inválida.");
  const { error } = await supabase.from("recurring_tasks").update({ active }).eq("id", id);
  if (error) return fail("No se pudo actualizar la regla.");
  if (active) await supabase.rpc("generate_my_recurring_tasks");
  refresh();
  return ok(active ? "Reanudada." : "Pausada.");
}

/** Elimina la regla (soft delete). Las tareas ya creadas se conservan. */
export async function deleteRecurring(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Regla inválida.");
  const { error } = await supabase
    .from("recurring_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo eliminar la regla.");
  refresh();
  return ok("Regla eliminada. Las tareas ya creadas se mantienen.");
}
