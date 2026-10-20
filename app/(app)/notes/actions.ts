"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";

/** Archiva la nota (soft delete). Sus tareas y tickets se conservan. */
export async function archiveNote(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Nota inválida.");
  const { error } = await supabase
    .from("meeting_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo archivar la nota.");
  revalidatePath("/notes");
  redirect("/notes");
}
