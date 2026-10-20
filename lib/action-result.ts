// Resultado uniforme de las Server Actions, para mostrar avisos en el cliente.

export type ActionResult =
  | { ok: true; message?: string; warnings?: string[] }
  | { ok: false; error: string };

export function ok(message?: string, warnings?: string[]): ActionResult {
  return { ok: true, message, warnings };
}

export function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Primer mensaje de error de un ZodError, en español si el esquema lo define. */
export function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}
