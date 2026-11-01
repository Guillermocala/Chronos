import "server-only";

import { requireUser } from "@/lib/auth";

export type ExternalLink = { externalName: string; projectId: string };

/** Mapeos guardados "proyecto externo → proyecto de Chronos" de un formato. */
export async function listExternalLinks(source: string): Promise<ExternalLink[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("external_project_links")
    .select("external_name, project_id, projects!inner(deleted_at)")
    .eq("source", source)
    .is("deleted_at", null)
    .is("projects.deleted_at", null);
  if (error) throw error;
  return data.map((l) => ({ externalName: l.external_name, projectId: l.project_id }));
}
