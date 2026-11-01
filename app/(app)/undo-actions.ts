"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";

// Tablas cuyo borrado (soft delete) se puede deshacer desde el aviso.
const RESTORABLE = [
  "tasks",
  "payments",
  "sprints",
  "tickets",
  "time_entries",
  "recurring_tasks",
  "meeting_notes",
] as const;

const undoSchema = z.object({ table: z.enum(RESTORABLE), id: z.uuid() });

/** "Deshacer" de un borrado: vuelve a dejar deleted_at en null (RLS limita a lo propio). */
export async function restoreDeleted(
  table: (typeof RESTORABLE)[number],
  id: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = undoSchema.safeParse({ table, id });
  if (!parsed.success) return fail("No se puede deshacer.");

  const { data: restored, error } = await supabase
    .from(parsed.data.table)
    .update({ deleted_at: null })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) return fail("No se pudo deshacer.");

  // Una tarea con horas ligadas: se restauran las que se borraron con ella.
  if (restored && parsed.data.table === "tasks") {
    const { data: latest } = await supabase
      .from("time_entries")
      .select("deleted_at")
      .eq("task_id", parsed.data.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.deleted_at) {
      await supabase
        .from("time_entries")
        .update({ deleted_at: null })
        .eq("task_id", parsed.data.id)
        .eq("deleted_at", latest.deleted_at);
    }
  }
  revalidatePath("/", "layout");
  return ok("Restaurado.");
}
