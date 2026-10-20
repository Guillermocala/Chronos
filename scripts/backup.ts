// Backup de Chronos hacia el repo chronos-backups (lo ejecuta GitHub Actions).
//
//   npx tsx scripts/backup.ts --mode auto|incremental|full --trigger scheduled|manual --out backup-repo
//
// Variables: SUPABASE_DB_URL (conexión Postgres, session pooler) y BACKUP_USER_EMAIL.
// Registra cada ejecución en backup_runs (visible en Ajustes → Backups).

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { parseArgs } from "node:util";

import pg from "pg";

import { findUserId } from "@/lib/backup/export";
import { resolveMode } from "@/lib/backup/plan";
import { runBackup } from "@/lib/backup/run";
import { buildSummary } from "@/lib/backup/summary";
import type { BackupMode, BackupTrigger, Db } from "@/lib/backup/types";
import { todayCO } from "@/lib/dates";

const { values } = parseArgs({
  options: {
    mode: { type: "string", default: "auto" },
    trigger: { type: "string", default: "scheduled" },
    out: { type: "string", default: "backup-repo" },
    "no-push": { type: "boolean", default: false },
  },
});

const mode = values.mode as BackupMode | "auto";
const trigger = values.trigger as BackupTrigger;
if (!["auto", "incremental", "full"].includes(mode)) throw new Error(`Modo inválido: ${mode}`);
if (!["scheduled", "manual"].includes(trigger)) throw new Error(`Disparador inválido: ${trigger}`);

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}.`);
  return value;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

async function main() {
  const client = new pg.Client({
    connectionString: env("SUPABASE_DB_URL"),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const db: Db = { query: (sql, params) => client.query(sql, params) as never };

  const today = todayCO();
  const userId = await findUserId(db, env("BACKUP_USER_EMAIL"));
  const {
    rows: [run],
  } = await client.query<{ id: string }>(
    `insert into public.backup_runs (user_id, trigger, mode, status) values ($1, $2, $3, 'running') returning id`,
    [userId, trigger, resolveMode(mode, today)],
  );

  try {
    const result = await runBackup(db, {
      userId,
      outDir: values.out!,
      schemaDir: join(process.cwd(), "supabase", "migrations"),
      mode,
      trigger,
      today,
    });

    let commitSha: string | null = null;
    if (result.changedFiles.length > 0) {
      git(values.out!, "add", "-A");
      git(
        values.out!,
        "commit",
        "-m",
        `backup ${today} (${result.mode}, ${trigger === "manual" ? "manual" : "automático"}): ${result.exported.length} proyectos`,
      );
      if (!values["no-push"]) git(values.out!, "push");
      commitSha = git(values.out!, "rev-parse", "HEAD");
    }

    await client.query(
      `update public.backup_runs
          set status = 'success', finished_at = now(), mode = $2,
              projects_exported = $3, projects_skipped = $4, summary_md = $5, commit_sha = $6
        where id = $1`,
      [
        run.id,
        result.mode,
        result.exported.length,
        result.skipped.length,
        buildSummary({ ...result.stats, commitSha }),
        commitSha,
      ],
    );
    console.log(
      `Backup ${result.mode}: ${result.exported.length} exportados, ${result.skipped.length} sin cambios, commit ${commitSha ?? "—"}.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.query(
      `update public.backup_runs set status = 'failed', finished_at = now(), error = $2 where id = $1`,
      [run.id, message.slice(0, 2000)],
    );
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
