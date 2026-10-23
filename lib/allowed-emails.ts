import { z } from "zod";

/**
 * Lista de correos con acceso: ALLOWED_EMAILS ("a@x.com, b@y.com") o, por
 * compatibilidad, ALLOWED_EMAIL (uno solo). El primero es el dueño (backups).
 * Cada usuario ve solo sus propios datos (RLS por user_id).
 */
export function parseAllowedEmails(list: string | undefined, single: string | undefined): string[] {
  const raw = list?.trim() ? list : (single ?? "");
  const emails = [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  for (const email of emails) {
    if (!z.email().safeParse(email).success) throw new Error(`Correo inválido en ALLOWED_EMAILS: ${email}`);
  }
  if (emails.length === 0) throw new Error("Configura ALLOWED_EMAILS (o ALLOWED_EMAIL).");
  return emails;
}

export function includesEmail(allowed: string[], email: string | undefined | null): boolean {
  return !!email && allowed.includes(email.trim().toLowerCase());
}
