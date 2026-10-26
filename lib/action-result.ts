// Resultado uniforme de las Server Actions, para mostrar avisos en el cliente.

export type ActionResult =
  | { ok: true; message?: string; warnings?: string[] }
  | { ok: false; error: string; field?: string };

export function ok(message?: string, warnings?: string[]): ActionResult {
  return { ok: true, message, warnings };
}

/** `field` es el `name` del campo con el error, para marcarlo en el formulario. */
export function fail(error: string, field?: string): ActionResult {
  return field ? { ok: false, error, field } : { ok: false, error };
}

type IssueList = { issues: { message: string; path?: PropertyKey[] }[] };

/** Primer mensaje de error de un ZodError, en español si el esquema lo define. */
export function firstIssue(error: IssueList): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

/** Falla con el primer issue de Zod y el campo al que corresponde. */
export function failIssue(error: IssueList): ActionResult {
  const key = error.issues[0]?.path?.[0];
  return fail(firstIssue(error), typeof key === "string" ? key : undefined);
}
