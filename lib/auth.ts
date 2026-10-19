import "server-only";

import { redirect } from "next/navigation";

import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Verificación real de la sesión (el proxy solo hace un chequeo optimista).
// Usar en layouts protegidos y al inicio de cada Server Action.
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const email = claims?.email as string | undefined;

  if (!claims || !isAllowedEmail(email)) {
    redirect("/login");
  }

  return { supabase, userId: claims.sub, email: email! };
}
