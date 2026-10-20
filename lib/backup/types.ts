// Tipos compartidos del backup. Las filas son JSON tal como las devuelve
// Postgres (to_jsonb), así el backup no depende de cómo el driver tipa columnas.

export type Row = Record<string, unknown> & { id: string };

/** Conexión mínima: la cumplen `pg.Client` y PGlite (tests). */
export type Db = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

export const PROJECT_FILES = [
  "project",
  "payments",
  "sprints",
  "tickets",
  "time_entries",
  "tasks",
  "notes",
  "action_items",
  "recurring",
] as const;
export type ProjectFile = (typeof PROJECT_FILES)[number];

export type ProjectBundle = Record<ProjectFile, Row[]>;

export const GLOBAL_FILES = ["tasks", "notes", "action_items", "recurring"] as const;
export type GlobalFile = (typeof GLOBAL_FILES)[number];
export type GlobalBundle = Record<GlobalFile, Row[]>;

/** Archivo → tabla de Postgres (para restaurar). */
export const FILE_TABLE: Record<ProjectFile, string> = {
  project: "projects",
  payments: "payments",
  sprints: "sprints",
  tickets: "tickets",
  time_entries: "time_entries",
  tasks: "tasks",
  notes: "meeting_notes",
  action_items: "note_action_items",
  recurring: "recurring_tasks",
};

export type ManifestEntry = {
  slug: string;
  name: string;
  last_change_at: string;
  hash: string;
  backed_up_at: string;
};

export type Manifest = {
  version: 1;
  projects: Record<string, ManifestEntry>;
  global?: { hash: string; backed_up_at: string };
};

export type BackupMode = "incremental" | "full";
export type BackupTrigger = "scheduled" | "manual";
