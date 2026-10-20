import "server-only";

import { requireUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";

type ProjectRef = { id: string; name: string; code_prefix: string; color: string | null };

export type NoteListItem = Pick<Tables<"meeting_notes">, "id" | "title" | "meeting_date" | "source" | "created_at"> & {
  project: ProjectRef | null;
  items: number;
};

export async function listNotes({ projectId, q }: { projectId?: string; q?: string }): Promise<NoteListItem[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("meeting_notes")
    .select(
      "id, title, meeting_date, source, created_at, project:projects(id, name, code_prefix, color), tasks(count), tickets(count)",
    )
    .is("deleted_at", null)
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (projectId === "personal") query = query.is("project_id", null);
  else if (projectId) query = query.eq("project_id", projectId);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "\\$&")}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ tasks, tickets, ...note }) => ({
    ...note,
    items: (tasks[0]?.count ?? 0) + (tickets[0]?.count ?? 0),
  }));
}

export type NoteDetail = Tables<"meeting_notes"> & {
  project: ProjectRef | null;
  tasks: Pick<Tables<"tasks">, "id" | "title" | "kind" | "status" | "is_ticket_candidate" | "deleted_at">[];
  tickets: Pick<Tables<"tickets">, "id" | "code" | "title" | "status" | "deleted_at">[];
};

export async function getNote(id: string): Promise<NoteDetail | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("meeting_notes")
    .select(
      "*, project:projects(id, name, code_prefix, color), tasks(id, title, kind, status, is_ticket_candidate, deleted_at), tickets(id, code, title, status, deleted_at)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    tasks: data.tasks.filter((t) => !t.deleted_at),
    tickets: data.tickets.filter((t) => !t.deleted_at),
  };
}
