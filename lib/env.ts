import { z } from "zod";

// Variables públicas: Next.js las incrusta en el bundle del cliente, por eso
// deben leerse con `process.env.NEXT_PUBLIC_*` literal (no por índice dinámico).
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  ALLOWED_EMAIL: z.email(),
  CRON_SECRET: z.string().min(16),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

// Solo para código de servidor (proxy, Server Actions, Route Handlers).
export function serverEnv() {
  return serverSchema.parse({
    ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
    CRON_SECRET: process.env.CRON_SECRET,
  });
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
  return (
    !!email &&
    email.trim().toLowerCase() === serverEnv().ALLOWED_EMAIL.trim().toLowerCase()
  );
}
