// Postgres en memoria (PGlite) con las migraciones reales del proyecto, para tests
// de integración. Simula lo mínimo de Supabase: roles, auth.users y auth.uid().

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const SUPABASE_STUBS = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

/** Ejecuta `sql` como el rol authenticated con la sesión de `userId` (RLS activo). */
export async function asUser<T>(db: PGlite, userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await db.query<T>(sql, params);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}
