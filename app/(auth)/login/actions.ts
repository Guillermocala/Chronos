"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// `email` vuelve al formulario para no tener que reescribirlo tras un error.
export type LoginState = { error?: string; email?: string } | undefined;

const INVALID = "Credenciales inválidas.";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success || !isAllowedEmail(parsed.data.email)) {
    return { error: INVALID, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: INVALID, email };
  }

  redirect("/today");
}
