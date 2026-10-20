"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string } | undefined;

const INVALID = "Credenciales inválidas.";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success || !isAllowedEmail(parsed.data.email)) {
    return { error: INVALID };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: INVALID };
  }

  redirect("/today");
}
