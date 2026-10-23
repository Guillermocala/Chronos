"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, firstIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { RUNNING_WINDOW_MS } from "@/lib/data/backups";
import { githubEnv, isOwnerEmail } from "@/lib/env";

/** Lanza el workflow de backup en GitHub Actions (workflow_dispatch). */
export async function dispatchBackup(mode: "incremental" | "full"): Promise<ActionResult> {
  const { supabase, email } = await requireUser();
  if (!isOwnerEmail(email)) return fail("Solo el dueño de Chronos puede lanzar backups.");
  if (mode !== "incremental" && mode !== "full") return fail("Modo inválido.");

  const { GITHUB_DISPATCH_TOKEN: token, GITHUB_REPOSITORY: repo } = githubEnv();
  if (!token) return fail("Falta GITHUB_DISPATCH_TOKEN en Vercel. Revisa docs/setup.md.");

  const { data: running } = await supabase
    .from("backup_runs")
    .select("started_at")
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - RUNNING_WINDOW_MS).toISOString())
    .limit(1);
  if (running && running.length > 0) return fail("Ya hay un backup en curso. Espera a que termine.");

  const response = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/backup.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main", inputs: { mode, trigger: "manual" } }),
    },
  );
  if (response.status !== 204) {
    const detail =
      response.status === 401 || response.status === 403
        ? "el token no tiene permiso (Actions: Read and write sobre el repo)."
        : response.status === 404
          ? "no se encontró el workflow backup.yml o el token no ve el repo."
          : `GitHub respondió ${response.status}.`;
    return fail(`No se pudo lanzar el backup: ${detail}`);
  }

  revalidatePath("/settings/backups");
  return ok(
    mode === "full"
      ? "Backup completo lanzado. Tarda 1–2 minutos; recarga para ver el resultado."
      : "Backup lanzado. Tarda 1–2 minutos; recarga para ver el resultado.",
  );
}

const passwordSchema = z
  .object({
    password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres.").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });

const AUTH_ERRORS: Record<string, string> = {
  same_password: "La nueva contraseña debe ser distinta de la actual.",
  weak_password: "La contraseña es demasiado débil. Usa una más larga o con más variedad.",
  reauthentication_needed: "Por seguridad, cierra sesión, vuelve a entrar y repite el cambio.",
};

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(AUTH_ERRORS[error.code ?? ""] ?? "No se pudo cambiar la contraseña.");
  return ok("Contraseña actualizada.");
}
