"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, failIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { isISODate } from "@/lib/dates";
import { parseDriveUrl } from "@/lib/drive";

const date = z.string().refine(isISODate, "Fecha inválida.").nullable();

const itemSchema = z.object({
  type: z.enum(["task", "follow_up", "ticket"]),
  title: z.string().trim().min(1, "Hay un ítem sin título.").max(300),
  projectId: z.uuid().nullable(),
  due_date: date,
  planned_on: date,
  priority: z.number().int().min(1).max(3),
  tags: z.array(z.string().max(40)).max(20),
  waiting_on: z.string().trim().max(200).nullable(),
  doc_url: z.string().nullable(),
  estimated_hours: z.number().min(0).max(999).nullable(),
});

const importSchema = z.object({
  title: z.string().trim().max(300).nullable(),
  date: z.string().refine(isISODate, "Fecha de la nota inválida."),
  markdown: z.string().max(200_000),
  items: z.array(itemSchema).min(1, "Selecciona al menos un ítem.").max(200),
});

export type ImportPayload = z.input<typeof importSchema>;

/**
 * Guarda la nota de Granola y crea las tareas/seguimientos seleccionados.
 * Las líneas de "Tickets" se crean como tareas candidatas a ticket (el módulo
 * de tickets llega en la fase 3).
 */
export async function importDictation(payload: ImportPayload): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return failIssue(parsed.error);
  const { title, date: noteDate, markdown, items } = parsed.data;

  // Proyecto de la nota: el único usado por los ítems, si es uno solo.
  const projectIds = [...new Set(items.map((i) => i.projectId).filter(Boolean))];
  const { data: note, error: noteError } = await supabase
    .from("meeting_notes")
    .insert({
      title: title || `Dictado ${noteDate}`,
      meeting_date: noteDate,
      source: "granola",
      content_md: markdown,
      project_id: projectIds.length === 1 ? projectIds[0] : null,
    })
    .select("id")
    .single();
  if (noteError) return fail("No se pudo guardar la nota.");

  const rows = items.map((item) => {
    const drive = item.doc_url ? parseDriveUrl(item.doc_url) : null;
    const followUp = item.type === "follow_up";
    return {
      title: item.title,
      kind: followUp ? ("follow_up" as const) : ("todo" as const),
      status: followUp && item.waiting_on ? ("waiting" as const) : ("open" as const),
      priority: item.priority,
      due_date: item.due_date,
      planned_on: item.planned_on,
      waiting_on: followUp ? item.waiting_on : null,
      tags: item.tags,
      project_id: item.projectId,
      source_note_id: note.id,
      doc_url: drive?.url ?? null,
      doc_kind: drive?.kind ?? null,
      is_ticket_candidate: item.type === "ticket",
      estimated_hours: item.estimated_hours,
    };
  });

  const { error } = await supabase.from("tasks").insert(rows);
  if (error) return fail("La nota se guardó, pero no se pudieron crear los ítems.");

  revalidatePath("/", "layout");
  const tickets = rows.filter((r) => r.is_ticket_candidate).length;
  return ok(
    `Se crearon ${rows.length} ítems${tickets ? ` (${tickets} candidatos a ticket)` : ""}.`,
  );
}
