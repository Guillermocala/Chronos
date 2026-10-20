import type { Row } from "./types";

/** Orden de inserción que respeta las relaciones entre tablas. */
export const RESTORE_ORDER = [
  "projects",
  "sprints",
  "meeting_notes",
  "tickets",
  "payments",
  "time_entries",
  "note_action_items",
  "tasks",
] as const;
export type RestoreTable = (typeof RESTORE_ORDER)[number];

export type RestoreData = Partial<Record<RestoreTable, Row[]>>;

function dollarQuote(text: string): string {
  let tag = "chronos";
  while (text.includes(`$${tag}$`)) tag += "_";
  return `$${tag}$${text}$${tag}$`;
}

/**
 * SQL de restauración idempotente:
 * - session_replication_role = replica desactiva triggers (no se renumeran
 *   códigos de ticket ni se reclasifican tickets como soporte, no se duplican
 *   seguimientos automáticos);
 * - upsert por id con jsonb_populate_recordset (Postgres convierte los tipos);
 * - user_id se reasigna al usuario destino.
 */
export function buildRestoreSql(data: RestoreData, { userId }: { userId: string }): string {
  const statements = ["begin;", "set local session_replication_role = replica;"];

  for (const table of RESTORE_ORDER) {
    const rows = (data[table] ?? []).map((row) => ({ ...row, user_id: userId }));
    if (rows.length === 0) continue;
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => c !== "id").sort();
    statements.push(
      [
        `insert into public.${table}`,
        `select * from jsonb_populate_recordset(null::public.${table}, ${dollarQuote(JSON.stringify(rows))}::jsonb)`,
        `on conflict (id) do update set ${columns.map((c) => `${c} = excluded.${c}`).join(", ")};`,
      ].join("\n"),
    );
  }

  statements.push("commit;");
  return `${statements.join("\n\n")}\n`;
}
