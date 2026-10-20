// Restaura un backup de chronos-backups.
//
//   npx tsx scripts/restore.ts --from ../chronos-backups --user-id <uuid> [--project web] [--out restore.sql] [--apply]
//
// Sin --apply solo genera el SQL (revisarlo y ejecutarlo en el SQL Editor de Supabase).
// Con --apply lo ejecuta contra SUPABASE_DB_URL. Ver README.md del repo de backups.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import pg from "pg";

import { buildRestoreSql } from "@/lib/backup/restore-sql";
import { readBackupDir } from "@/lib/backup/run";

const { values } = parseArgs({
  options: {
    from: { type: "string" },
    "user-id": { type: "string" },
    project: { type: "string" },
    out: { type: "string", default: "restore.sql" },
    apply: { type: "boolean", default: false },
  },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  if (!values.from) throw new Error("Indica la carpeta del backup con --from.");
  if (!values["user-id"] || !UUID.test(values["user-id"])) {
    throw new Error("Indica el UUID del usuario destino con --user-id (Supabase → Authentication → Users).");
  }

  const data = readBackupDir(values.from, values.project);
  const sql = buildRestoreSql(data, { userId: values["user-id"] });
  writeFileSync(values.out!, sql);
  const summary = Object.entries(data)
    .map(([table, rows]) => `${table}: ${rows.length}`)
    .join(", ");
  console.log(`SQL escrito en ${values.out} (${summary}).`);

  if (values.apply) {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) throw new Error("Falta SUPABASE_DB_URL para --apply.");
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      await client.query(sql);
      console.log("Restauración aplicada.");
    } finally {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
