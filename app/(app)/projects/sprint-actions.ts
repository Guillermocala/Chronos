"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, firstIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { sprintSchema } from "@/lib/projects/schema";

export async function saveSprint(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = sprintSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, ...sprint } = parsed.data;

  const { error } = id
    ? await supabase.from("sprints").update(sprint).eq("id", id)
    : await supabase.from("sprints").insert(sprint);
  if (error) return fail("No se pudo guardar el sprint.");

  revalidatePath(`/projects/${sprint.project_id}`);
  return ok(id ? "Sprint actualizado." : "Sprint creado.");
}

export async function deleteSprint(id: string, projectId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Sprint inválido.");
  const { error } = await supabase
    .from("sprints")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo eliminar el sprint.");
  revalidatePath(`/projects/${projectId}`);
  return ok("Sprint eliminado.");
}
