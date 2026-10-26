import { z } from "zod";

import { includesEmail, parseAllowedEmails } from "@/lib/allowed-emails";

// Variables públicas: Next.js las incrusta en el bundle del cliente, por eso
// deben leerse con `process.env.NEXT_PUBLIC_*` literal (no por índice dinámico).
const publicSchema = z.object({
  // Solo el dominio del proyecto: con una ruta (p. ej. ".../rest/v1/") el login falla
  // con "Credenciales inválidas" porque Auth queda en una URL que no existe.
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine(
    (url) => new URL(url).pathname === "/",
    "NEXT_PUBLIC_SUPABASE_URL debe ser solo el dominio (https://<ref>.supabase.co), sin /rest/v1.",
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  CRON_SECRET: z.string().min(16),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

// Solo para código de servidor (proxy, Server Actions, Route Handlers).
export function serverEnv() {
  return {
    ...serverSchema.parse({ CRON_SECRET: process.env.CRON_SECRET }),
    ALLOWED_EMAILS: parseAllowedEmails(process.env.ALLOWED_EMAILS, process.env.ALLOWED_EMAIL),
  };
}

// Opcional: sin token, el botón de backup manual se muestra deshabilitado.
const githubSchema = z.object({
  GITHUB_DISPATCH_TOKEN: z.string().min(1).optional(),
  GITHUB_REPOSITORY: z.string().regex(/^[\w.-]+\/[\w.-]+$/).default("Guillermocala/Chronos"),
});

export function githubEnv() {
  return githubSchema.parse({
    GITHUB_DISPATCH_TOKEN: process.env.GITHUB_DISPATCH_TOKEN || undefined,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || undefined,
  });
}

export function isAllowedEmail(email: string | undefined | null) {
  return includesEmail(serverEnv().ALLOWED_EMAILS, email);
}

/** El dueño (primer correo de la lista) es quien administra los backups. */
export function isOwnerEmail(email: string | undefined | null) {
  return includesEmail(serverEnv().ALLOWED_EMAILS.slice(0, 1), email);
}
