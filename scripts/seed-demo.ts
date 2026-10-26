// Datos de prueba "[DEMO]" para revisar la app con un usuario existente.
//
//   npm run db:seed-demo -- --email persona@correo.com [--out seed-demo.sql] [--apply]
//   npm run db:seed-demo -- --email persona@correo.com --reset [--apply]
//
// Sin --apply solo genera el SQL (revisarlo o ejecutarlo en el SQL Editor de Supabase).
// Con --apply lo ejecuta contra SUPABASE_DB_URL (se lee de .env.local o .env si existen).
// --reset retira los datos [DEMO] con soft delete.

import { existsSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import pg from "pg";

import { todayCO } from "@/lib/dates";
import { buildDemoResetSql, buildDemoSeedSql } from "@/lib/demo/seed-sql";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    out: { type: "string" },
    apply: { type: "boolean", default: false },
    reset: { type: "boolean", default: false },
  },
});

async function main() {
  const email = values.email?.trim();
  if (!email || !email.includes("@")) throw new Error("Indica el usuario con --email.");

  const sql = values.reset ? buildDemoResetSql({ email }) : buildDemoSeedSql({ email, today: todayCO() });
  const out = values.out ?? (values.reset ? "seed-demo-reset.sql" : "seed-demo.sql");
  writeFileSync(out, sql);
  console.log(`SQL escrito en ${out}.`);

  if (!values.apply) {
    console.log("Revísalo y vuelve a ejecutar con --apply para aplicarlo.");
    return;
  }

  for (const file of [".env.local", ".env"]) {
    if (!process.env.SUPABASE_DB_URL && existsSync(file)) process.loadEnvFile(file);
  }
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Falta SUPABASE_DB_URL (Supabase → Connect → Session pooler) para --apply.");

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  client.on("notice", (notice) => console.log(notice.message));
  await client.connect();
  try {
    await client.query(sql);
    console.log(values.reset ? "Datos [DEMO] retirados." : `Datos [DEMO] creados para ${email}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
