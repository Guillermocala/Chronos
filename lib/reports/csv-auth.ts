import "server-only";

import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Sesión válida para un Route Handler de exportación (sin redirigir: devuelve 401). */
export async function isAuthorizedRequest(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return !!data?.claims && isAllowedEmail(data.claims.email as string | undefined);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parámetros comunes de los CSV: ?from=&to=&project= (con valores por defecto seguros). */
export function readRangeParams(url: string, today: string) {
  const params = new URL(url).searchParams;
  const from = params.get("from") ?? `${today.slice(0, 7)}-01`;
  const to = params.get("to") ?? today;
  const project = params.get("project") ?? undefined;
  if (!ISO.test(from) || !ISO.test(to) || (project && !UUID.test(project))) return null;
  return { from, to, project };
}
