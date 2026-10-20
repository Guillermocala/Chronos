import "server-only";

import { requireUser } from "@/lib/auth";
import type { ISODate } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import type { ProjectHours } from "@/lib/valuation";

export type ReportPayment = Pick<
  Tables<"payments">,
  "id" | "amount_cop" | "status" | "due_date" | "paid_at" | "kind" | "note" | "project_id"
> & { project: { name: string; code_prefix: string } };

export type ReportEntry = Pick<Tables<"time_entries">, "id" | "started_at" | "hours" | "deleted_at" | "note"> & {
  ticket: Pick<Tables<"tickets">, "id" | "code" | "title" | "kind" | "project_id"> & {
    project: { name: string; code_prefix: string };
  };
};

export type ReportProject = Tables<"projects"> & { hours: ProjectHours };

/** Pagos no borrados (de proyectos no archivados), opcionalmente de un proyecto. */
export async function listReportPayments(projectId?: string): Promise<ReportPayment[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("payments")
    .select(
      "id, amount_cop, status, due_date, paid_at, kind, note, project_id, project:projects!inner(name, code_prefix, deleted_at)",
    )
    .is("deleted_at", null)
    .is("project.deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ project, ...p }) => ({ ...p, project: { name: project.name, code_prefix: project.code_prefix } }));
}

/** Horas registradas (terminadas) entre dos fechas (inclusive), opcionalmente de un proyecto. */
export async function listReportEntries(from: ISODate, to: ISODate, projectId?: string): Promise<ReportEntry[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("time_entries")
    .select(
      "id, started_at, hours, deleted_at, note, ticket:tickets!inner(id, code, title, kind, project_id, project:projects!inner(name, code_prefix))",
    )
    .is("deleted_at", null)
    .not("hours", "is", null)
    .gte("started_at", `${from}T00:00:00-05:00`)
    .lte("started_at", `${to}T23:59:59-05:00`)
    .order("started_at");
  if (projectId) query = query.eq("ticket.project_id", projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Proyectos no archivados con su resumen de horas (vista project_hours). */
export async function listReportProjects(): Promise<ReportProject[]> {
  const { supabase } = await requireUser();
  const [{ data: projects, error }, { data: hours, error: hoursError }] = await Promise.all([
    supabase.from("projects").select("*").is("deleted_at", null).order("code_prefix"),
    supabase.from("project_hours").select("*"),
  ]);
  if (error) throw error;
  if (hoursError) throw hoursError;
  const byProject = new Map(hours.map((h) => [h.project_id, h]));
  return projects.map((p) => {
    const h = byProject.get(p.id);
    return {
      ...p,
      hours: {
        scope_estimated: Number(h?.scope_estimated ?? 0),
        scope_logged: Number(h?.scope_logged ?? 0),
        support_logged: Number(h?.support_logged ?? 0),
        extra_logged: Number(h?.extra_logged ?? 0),
      },
    };
  });
}
