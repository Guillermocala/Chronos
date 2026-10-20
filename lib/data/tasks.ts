import "server-only";

import { requireUser } from "@/lib/auth";
import { addDays, type ISODate } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import { SUPPORT_LOOKAHEAD_DAYS } from "@/lib/tasks/today";

import type { TaskView } from "./task-views";

export type TaskWithProject = Tables<"tasks"> & {
  project: { id: string; name: string; code_prefix: string; color: string | null } | null;
};

const TASK_SELECT = "*, project:projects(id, name, code_prefix, color)";

export { TASK_VIEWS, type TaskView } from "./task-views";

/** Tareas abiertas que pueden aparecer en Hoy (el agrupado fino lo hace groupTodayTasks). */
export async function listTodayCandidates(today: ISODate): Promise<TaskWithProject[]> {
  const { supabase } = await requireUser();
  const horizon = addDays(today, SUPPORT_LOOKAHEAD_DAYS);
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .in("status", ["open", "waiting"])
    .or(`planned_on.lte.${today},due_date.lte.${horizon}`);
  if (error) throw error;
  return data;
}

export type TaskFilters = {
  view: TaskView;
  /** id de proyecto, "personal" (sin proyecto) o undefined (todos). */
  project?: string;
  tag?: string;
};

export async function listTasks(filters: TaskFilters, today: ISODate): Promise<TaskWithProject[]> {
  const { supabase } = await requireUser();
  let query = supabase.from("tasks").select(TASK_SELECT).is("deleted_at", null);

  switch (filters.view) {
    case "upcoming": {
      const from = addDays(today, 1);
      const to = addDays(today, 7);
      query = query
        .in("status", ["open", "waiting"])
        .or(`and(due_date.gte.${from},due_date.lte.${to}),and(planned_on.gte.${from},planned_on.lte.${to})`)
        .order("due_date", { ascending: true, nullsFirst: false });
      break;
    }
    case "waiting":
      query = query
        .eq("kind", "follow_up")
        .in("status", ["open", "waiting"])
        .order("due_date", { ascending: true, nullsFirst: false });
      break;
    case "inbox":
      query = query
        .in("status", ["open", "waiting"])
        .is("due_date", null)
        .is("planned_on", null)
        .order("created_at", { ascending: false });
      break;
    case "done":
      query = query.eq("status", "done").order("completed_at", { ascending: false }).limit(50);
      break;
  }

  if (filters.project === "personal") query = query.is("project_id", null);
  else if (filters.project) query = query.eq("project_id", filters.project);
  if (filters.tag) query = query.contains("tags", [filters.tag]);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listProjectTasks(projectId: string): Promise<TaskWithProject[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .eq("project_id", projectId)
    .in("status", ["open", "waiting"])
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}
