import "server-only";

import { requireUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";

export type Project = Tables<"projects">;
export type Payment = Tables<"payments">;
export type Sprint = Tables<"sprints">;

export type ProjectOption = Pick<Project, "id" | "name" | "code_prefix" | "color">;

export type ProjectWithPayments = Project & { payments: Payment[] };

export type ProjectDetail = Project & { payments: Payment[]; sprints: Sprint[] };

/** Proyectos para selects y para interpretar @PREFIJO (excluye cerrados si se pide). */
export async function listProjectOptions({ includeClosed = false } = {}): Promise<ProjectOption[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("projects")
    .select("id, name, code_prefix, color")
    .is("deleted_at", null)
    .order("name");
  if (!includeClosed) query = query.neq("phase", "closed");
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listProjects(): Promise<ProjectWithPayments[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*, payments(*)")
    .is("deleted_at", null)
    .is("payments.deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*, payments(*), sprints(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .is("payments.deleted_at", null)
    .is("sprints.deleted_at", null)
    .order("due_date", { referencedTable: "payments", ascending: true, nullsFirst: false })
    .order("start_date", { referencedTable: "sprints", ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Solo los campos del proyecto (para el formulario de edición). */
export async function getProjectFields(id: string): Promise<Project | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Pagos no borrados de todos los proyectos no archivados (para el resumen de Hoy). */
export async function listAllPayments(): Promise<(Payment & { project: { name: string } | null })[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("payments")
    .select("*, project:projects!inner(name, deleted_at)")
    .is("deleted_at", null)
    .is("project.deleted_at", null);
  if (error) throw error;
  return data.map(({ project, ...p }) => ({ ...p, project: project ? { name: project.name } : null }));
}
