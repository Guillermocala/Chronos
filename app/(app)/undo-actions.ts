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

  const { error } = await supabase.from(parsed.data.table).update({ deleted_at: null }).eq("id", parsed.data.id);
  if (error) return fail("No se pudo deshacer.");
  revalidatePath("/", "layout");
  return ok("Restaurado.");
}
