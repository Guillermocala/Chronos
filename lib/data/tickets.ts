import "server-only";

import { requireUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
import type { ProjectHours } from "@/lib/valuation";

export type Ticket = Tables<"tickets">;
export type TicketWithHours = Ticket & { logged_hours: number };
export type TimeEntry = Tables<"time_entries">;

async function withLoggedHours(tickets: Ticket[]): Promise<TicketWithHours[]> {
  if (tickets.length === 0) return [];
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("ticket_hours")
    .select("ticket_id, logged_hours")
    .in(
      "ticket_id",
      tickets.map((t) => t.id),
    );
  if (error) throw error;
  const hours = new Map(data.map((h) => [h.ticket_id, Number(h.logged_hours ?? 0)]));
  return tickets.map((t) => ({ ...t, logged_hours: hours.get(t.id) ?? 0 }));
}

export async function listProjectTickets(projectId: string): Promise<TicketWithHours[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position");
  if (error) throw error;
  return withLoggedHours(data);
}

export async function listSprintTickets(sprintId: string): Promise<TicketWithHours[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("sprint_id", sprintId)
    .is("deleted_at", null)
    .order("position");
  if (error) throw error;
  return withLoggedHours(data);
}

export type TicketInProgress = Ticket & {
  project: { id: string; name: string; code_prefix: string; color: string | null } | null;
};

/** Tickets "en curso" de todos los proyectos (para Hoy). */
export async function listTicketsInProgress(): Promise<TicketInProgress[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tickets")
    .select("*, project:projects!inner(id, name, code_prefix, color, deleted_at)")
    .eq("status", "in_progress")
    .is("deleted_at", null)
    .is("project.deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(({ project, ...t }) => ({
    ...t,
    project: project
      ? { id: project.id, name: project.name, code_prefix: project.code_prefix, color: project.color }
      : null,
  }));
}

export type TicketDetail = Ticket & {
  project: Tables<"projects">;
  sprint: Pick<Tables<"sprints">, "id" | "name"> | null;
  source_note: Pick<Tables<"meeting_notes">, "id" | "title" | "meeting_date"> | null;
  time_entries: TimeEntry[];
};

export async function getTicket(id: string): Promise<TicketDetail | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "*, project:projects!inner(*), sprint:sprints(id, name), source_note:meeting_notes(id, title, meeting_date), time_entries(*)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .is("time_entries.deleted_at", null)
    .order("started_at", { referencedTable: "time_entries", ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type RunningTimer = Pick<TimeEntry, "id" | "started_at"> & {
  ticket: Pick<Ticket, "id" | "code" | "title" | "project_id">;
};

export async function getRunningTimer(): Promise<RunningTimer | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("time_entries")
    .select("id, started_at, ticket:tickets!inner(id, code, title, project_id)")
    .is("ended_at", null)
    .is("hours", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const EMPTY_HOURS: ProjectHours = {
  scope_estimated: 0,
  scope_logged: 0,
  support_logged: 0,
  extra_logged: 0,
};

export async function getProjectHours(projectId: string): Promise<ProjectHours> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("project_hours")
    .select("scope_estimated, scope_logged, support_logged, extra_logged")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_HOURS;
  return {
    scope_estimated: Number(data.scope_estimated ?? 0),
    scope_logged: Number(data.scope_logged ?? 0),
    support_logged: Number(data.support_logged ?? 0),
    extra_logged: Number(data.extra_logged ?? 0),
  };
}

export async function getSprint(id: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("sprints")
    .select("*, project:projects!inner(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}
