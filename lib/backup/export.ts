// Lectura de datos para el backup. Usa to_jsonb para que las filas salgan igual
// con pg (producción) y PGlite (tests). Incluye filas con soft delete: el backup
// es un espejo fiel de la base.

import type { ProjectChange } from "./plan";
import type { Db, GlobalBundle, ProjectBundle, Row } from "./types";

async function rows(db: Db, sql: string, params: unknown[]): Promise<Row[]> {
  const result = await db.query<{ row: Row }>(sql, params);
  return result.rows.map((r) => (typeof r.row === "string" ? JSON.parse(r.row) : r.row));
}

export async function findUserId(db: Db, email: string): Promise<string> {
  const { rows: found } = await db.query<{ id: string }>(
    "select id from auth.users where lower(email) = lower($1)",
    [email],
  );
  if (!found[0]) throw new Error(`No existe un usuario con el email ${email}.`);
  return found[0].id;
}

export async function listProjectChanges(db: Db, userId: string): Promise<ProjectChange[]> {
  const { rows: changes } = await db.query<ProjectChange & { last_change_at: unknown }>(
    `select project_id, code_prefix, name, to_jsonb(last_change_at) #>> '{}' as last_change_at
       from public.project_last_change
      where user_id = $1
      order by code_prefix`,
    [userId],
  );
  return changes.map((c) => ({ ...c, last_change_at: String(c.last_change_at) }));
}

export async function collectProject(db: Db, projectId: string): Promise<ProjectBundle> {
  const by = (table: string, column = "project_id") =>
    rows(db, `select to_jsonb(t) as row from public.${table} t where t.${column} = $1`, [projectId]);

  const [project, payments, sprints, tickets, tasks, notes] = await Promise.all([
    by("projects", "id"),
    by("payments"),
    by("sprints"),
    by("tickets"),
    by("tasks"),
    by("meeting_notes"),
  ]);
  const [time_entries, action_items] = await Promise.all([
    rows(
      db,
      `select to_jsonb(e) as row from public.time_entries e
         join public.tickets t on t.id = e.ticket_id where t.project_id = $1`,
      [projectId],
    ),
    rows(
      db,
      `select to_jsonb(a) as row from public.note_action_items a
         join public.meeting_notes n on n.id = a.note_id where n.project_id = $1`,
      [projectId],
    ),
  ]);
  return { project, payments, sprints, tickets, time_entries, tasks, notes, action_items };
}

/** Tareas y notas sin proyecto (siempre se exportan: son pocas). */
export async function collectGlobal(db: Db, userId: string): Promise<GlobalBundle> {
  const [tasks, notes, action_items] = await Promise.all([
    rows(db, "select to_jsonb(t) as row from public.tasks t where t.user_id = $1 and t.project_id is null", [userId]),
    rows(
      db,
      "select to_jsonb(n) as row from public.meeting_notes n where n.user_id = $1 and n.project_id is null",
      [userId],
    ),
    rows(
      db,
      `select to_jsonb(a) as row from public.note_action_items a
         join public.meeting_notes n on n.id = a.note_id
        where n.user_id = $1 and n.project_id is null`,
      [userId],
    ),
  ]);
  return { tasks, notes, action_items };
}
