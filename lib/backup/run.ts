// Ejecuta un backup sobre un directorio (el clon de chronos-backups). No hace git:
// el script decide si hay commit según los archivos que cambiaron.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { addDays, type ISODate } from "@/lib/dates";

import { collectGlobal, collectProject, listProjectChanges } from "./export";
import { planBackup, projectSlug, resolveMode } from "./plan";
import { BACKUP_README } from "./readme";
import { bundleHash, stableJson } from "./serialize";
import { buildSummary, type SummaryProject, type SummaryStats } from "./summary";
import type { BackupMode, BackupTrigger, Db, Manifest, Row } from "./types";

export type RunOptions = {
  userId: string;
  outDir: string;
  /** Carpeta con las migraciones (se copia a schema/). */
  schemaDir: string;
  mode: BackupMode | "auto";
  trigger: BackupTrigger;
  today: ISODate;
  now?: () => Date;
};

export type RunResult = {
  mode: BackupMode;
  exported: { project_id: string; slug: string; name: string }[];
  skipped: { project_id: string; slug: string; since: string }[];
  /** Archivos de datos que cambiaron (si está vacío, no hace falta commit). */
  changedFiles: string[];
  stats: SummaryStats;
};

/** Escribe solo si el contenido cambió. Devuelve true si escribió. */
function writeIfChanged(path: string, content: string): boolean {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}

function readManifest(outDir: string): Manifest | null {
  const path = join(outDir, "manifest.json");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Manifest) : null;
}

export async function runBackup(db: Db, opts: RunOptions): Promise<RunResult> {
  const now = opts.now ?? (() => new Date());
  const startedAt = now();
  const mode = resolveMode(opts.mode, opts.today);
  const previous = readManifest(opts.outDir);
  const manifest: Manifest = previous ?? { version: 1, projects: {} };
  const changedFiles: string[] = [];
  const write = (relative: string, content: string) => {
    if (writeIfChanged(join(opts.outDir, relative), content)) changedFiles.push(relative);
  };

  const changes = await listProjectChanges(db, opts.userId);
  const plan = planBackup(changes, previous, mode);
  const exported: RunResult["exported"] = [];

  for (const id of plan.exportIds) {
    const change = changes.find((c) => c.project_id === id)!;
    const slug = projectSlug(change.code_prefix);
    const bundle = await collectProject(db, id);
    const files = Object.fromEntries(
      Object.entries(bundle).map(([name, rows]) => [`${name}.json`, stableJson(rows as Row[])]),
    );

    // Si cambió el prefijo, se elimina la carpeta anterior.
    const old = manifest.projects[id];
    if (old && old.slug !== slug) {
      rmSync(join(opts.outDir, "projects", old.slug), { recursive: true, force: true });
      changedFiles.push(`projects/${old.slug}/`);
    }
    for (const [name, content] of Object.entries(files)) write(`projects/${slug}/${name}`, content);

    manifest.projects[id] = {
      slug,
      name: change.name,
      last_change_at: change.last_change_at,
      hash: bundleHash(files),
      backed_up_at: startedAt.toISOString(),
    };
    exported.push({ project_id: id, slug, name: change.name });
  }

  const global = await collectGlobal(db, opts.userId);
  const globalFiles = Object.fromEntries(
    Object.entries(global).map(([name, rows]) => [`${name}.json`, stableJson(rows as Row[])]),
  );
  for (const [name, content] of Object.entries(globalFiles)) write(`global/${name}`, content);
  manifest.global = { hash: bundleHash(globalFiles), backed_up_at: startedAt.toISOString() };

  // Esquema: copia de las migraciones (fuente de verdad de la estructura).
  for (const file of readdirSync(opts.schemaDir).filter((f) => f.endsWith(".sql")).sort()) {
    write(`schema/${file}`, readFileSync(join(opts.schemaDir, file), "utf8"));
  }
  write("README.md", BACKUP_README);

  const stats: SummaryStats = {
    date: opts.today,
    trigger: opts.trigger,
    mode,
    durationSeconds: 0,
    commitSha: null,
    exported: exported.map(({ slug, name }) => ({ slug, name })),
    skipped: plan.skipped.map(({ slug, since }) => ({ slug, since })),
    counts: await countRows(db, opts.userId),
    week: await weekStats(db, opts.userId, opts.today),
    projects: await summaryProjects(db, opts.userId),
  };

  // Solo si cambiaron datos se escriben manifest y resumen (si no, no hay commit).
  if (changedFiles.length > 0) {
    write("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
    stats.durationSeconds = Math.max(1, Math.round((now().getTime() - startedAt.getTime()) / 1000));
    write(`summaries/${opts.today}-resumen.md`, buildSummary({ ...stats, commitSha: undefined }));
  }
  stats.durationSeconds = Math.max(1, Math.round((now().getTime() - startedAt.getTime()) / 1000));

  return { mode, exported, skipped: plan.skipped, changedFiles, stats };
}

const COUNTED_TABLES = [
  "projects",
  "payments",
  "sprints",
  "tickets",
  "time_entries",
  "tasks",
  "meeting_notes",
] as const;

async function countRows(db: Db, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of COUNTED_TABLES) {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.${table} where user_id = $1 and deleted_at is null`,
      [userId],
    );
    counts[table] = Number(rows[0].n);
  }
  return counts;
}

async function weekStats(db: Db, userId: string, today: ISODate): Promise<SummaryStats["week"]> {
  const since = addDays(today, -7);
  const { rows } = await db.query<Record<string, number>>(
    `select
       (select count(*)::int from public.tickets where user_id = $1 and deleted_at is null and created_at >= $2::date) as created,
       (select count(*)::int from public.tickets where user_id = $1 and deleted_at is null and done_at >= $2::date) as done,
       (select coalesce(sum(hours), 0)::float from public.time_entries where user_id = $1 and deleted_at is null and started_at >= $2::date) as hours,
       (select coalesce(sum(amount_cop), 0)::float from public.payments where user_id = $1 and deleted_at is null and status = 'received' and paid_at >= $2::date) as received`,
    [userId, since],
  );
  const r = rows[0];
  return {
    ticketsCreated: Number(r.created),
    ticketsDone: Number(r.done),
    hoursLogged: Number(r.hours),
    paymentsReceivedCOP: Number(r.received),
  };
}

async function summaryProjects(db: Db, userId: string): Promise<SummaryProject[]> {
  const { rows } = await db.query<{ row: SummaryProject }>(
    `select jsonb_build_object(
        'id', p.id, 'name', p.name, 'code_prefix', p.code_prefix, 'phase', p.phase,
        'support_until', p.support_until, 'billing_type', p.billing_type,
        'fixed_amount_cop', p.fixed_amount_cop, 'estimated_total_hours', p.estimated_total_hours,
        'monthly_fee_cop', p.monthly_fee_cop, 'expected_hours_per_month', p.expected_hours_per_month,
        'contract_months', p.contract_months,
        'payments', coalesce((
          select jsonb_agg(jsonb_build_object('amount_cop', x.amount_cop, 'status', x.status,
                 'due_date', x.due_date, 'paid_at', x.paid_at, 'kind', x.kind))
            from public.payments x where x.project_id = p.id and x.deleted_at is null), '[]'::jsonb),
        'hours', jsonb_build_object(
          'scope_estimated', coalesce(h.scope_estimated, 0), 'scope_logged', coalesce(h.scope_logged, 0),
          'support_logged', coalesce(h.support_logged, 0), 'extra_logged', coalesce(h.extra_logged, 0))
      ) as row
     from public.projects p
     left join public.project_hours h on h.project_id = p.id
     where p.user_id = $1 and p.deleted_at is null
     order by p.code_prefix`,
    [userId],
  );
  return rows.map((r) => {
    const p = typeof r.row === "string" ? JSON.parse(r.row) : r.row;
    return {
      ...p,
      hours: {
        scope_estimated: Number(p.hours.scope_estimated),
        scope_logged: Number(p.hours.scope_logged),
        support_logged: Number(p.hours.support_logged),
        extra_logged: Number(p.hours.extra_logged),
      },
    };
  });
}

/** Une todos los JSON de un backup en datos por tabla (para restaurar). */
export function readBackupDir(dir: string, projectSlugFilter?: string) {
  const data: Record<string, Row[]> = {};
  const add = (table: string, rows: Row[]) => {
    data[table] = [...(data[table] ?? []), ...rows];
  };
  const fileTable: Record<string, string> = {
    "project.json": "projects",
    "payments.json": "payments",
    "sprints.json": "sprints",
    "tickets.json": "tickets",
    "time_entries.json": "time_entries",
    "tasks.json": "tasks",
    "notes.json": "meeting_notes",
    "action_items.json": "note_action_items",
  };
  const readFolder = (folder: string) => {
    if (!existsSync(folder)) return;
    for (const file of readdirSync(folder)) {
      const table = fileTable[file];
      if (table) add(table, JSON.parse(readFileSync(join(folder, file), "utf8")));
    }
  };

  const projectsDir = join(dir, "projects");
  const slugs = existsSync(projectsDir) ? readdirSync(projectsDir) : [];
  if (projectSlugFilter && !slugs.includes(projectSlugFilter)) {
    throw new Error(`No hay un proyecto "${projectSlugFilter}" en el backup (${slugs.join(", ") || "vacío"}).`);
  }
  for (const slug of slugs) {
    if (!projectSlugFilter || slug === projectSlugFilter) readFolder(join(projectsDir, slug));
  }
  // Las notas globales pueden ser origen de tareas/tickets del proyecto: se incluyen siempre.
  readFolder(join(dir, "global"));
  return data;
}


