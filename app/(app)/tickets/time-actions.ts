"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, failIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { isISODate } from "@/lib/dates";
import { elapsedHours, formatDuration, parseDurationInput } from "@/lib/time";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

function refresh() {
  revalidatePath("/", "layout");
}

/** Detiene el cronómetro activo (si hay) y devuelve las horas registradas. */
async function stopRunning(supabase: Supabase): Promise<number | null> {
  const { data: running } = await supabase
    .from("time_entries")
    .select("id, started_at")
    .is("ended_at", null)
    .is("hours", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (!running) return null;

  const now = new Date();
  const hours = Math.min(24, elapsedHours(running.started_at, now));
  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: now.toISOString(), hours })
    .eq("id", running.id);
  if (error) throw error;
  return hours;
}

/** Inicia el cronómetro en un ticket (detiene el anterior). Lo pasa a "en curso". */
export async function startTimer(ticketId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(ticketId).success) return fail("Ticket inválido.");

  await stopRunning(supabase);
  const { error } = await supabase.from("time_entries").insert({ ticket_id: ticketId });
  if (error) return fail("No se pudo iniciar el cronómetro.");

  await supabase
    .from("tickets")
    .update({ status: "in_progress" })
    .eq("id", ticketId)
    .in("status", ["backlog", "todo"]);

  refresh();
  return ok("Cronómetro iniciado.");
}

export async function stopTimer(): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const hours = await stopRunning(supabase);
  refresh();
  return hours === null ? fail("No hay un cronómetro activo.") : ok(`Registrado: ${formatDuration(hours)}.`);
}

const optionalUuid = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());

const logSchema = z.object({
  // Con ticket, o directo al proyecto (sin ticket).
  ticket_id: optionalUuid,
  project_id: optionalUuid,
  date: z.string().refine(isISODate, "Fecha inválida."),
  duration: z.string().transform((v, ctx) => {
    const hours = parseDurationInput(v);
    if (hours === null) {
      ctx.addIssue({ code: "custom", message: "Duración inválida. Ej.: 1:30, 1,5 o 90m (máx. 24 h)." });
      return z.NEVER;
    }
    return hours;
  }),
  note: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(500).nullable()),
});

/** Registro manual: "1:30" el día indicado, a un ticket o directo al proyecto. */
export async function logTime(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = logSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failIssue(parsed.error);
  const { ticket_id, project_id, date, duration, note } = parsed.data;
  if (!ticket_id && !project_id) return fail("Falta el ticket o el proyecto.");

  // Mediodía en Colombia para que la fecha no cambie por zona horaria.
  // Con ticket, el proyecto lo completa la base de datos.
  const at = `${date}T12:00:00-05:00`;
  const { error } = await supabase
    .from("time_entries")
    .insert({ ticket_id, project_id: ticket_id ? null : project_id, started_at: at, ended_at: at, hours: duration, note });
  if (error) return fail("No se pudo registrar el tiempo.");
  refresh();
  return ok(`Registrado: ${formatDuration(duration)}.`);
}

export async function deleteTimeEntry(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Registro inválido.");
  const { error } = await supabase
    .from("time_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo eliminar el registro.");
  refresh();
  return ok("Registro eliminado.");
}
