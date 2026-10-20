"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, firstIssue, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { todayCO } from "@/lib/dates";
import { formatCOP, parseCOP } from "@/lib/format";
import { parseLine } from "@/lib/granola/parse";
import { needsRebalance, positionBetween, rebalance } from "@/lib/tickets/ordering";
import { ticketSchema, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/schema";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

function refresh() {
  revalidatePath("/", "layout");
}

/** Posición al final de una columna (estado) del proyecto o sprint. */
async function endOfColumn(
  supabase: Supabase,
  projectId: string,
  status: TicketStatus,
): Promise<number> {
  const { data } = await supabase
    .from("tickets")
    .select("position")
    .eq("project_id", projectId)
    .eq("status", status)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return positionBetween(data?.position ?? null, null);
}

export async function saveTicket(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = ticketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, ...ticket } = parsed.data;

  if (id) {
    const { error } = await supabase.from("tickets").update(ticket).eq("id", id);
    if (error) return fail("No se pudo guardar el ticket.");
    refresh();
    return ok("Ticket guardado.");
  }

  const position = await endOfColumn(supabase, ticket.project_id, ticket.status);
  const { data, error } = await supabase
    .from("tickets")
    .insert({ ...ticket, position })
    .select("code, kind")
    .single();
  if (error) return fail("No se pudo crear el ticket.");
  refresh();
  return ok(`Creado ${data.code}${data.kind === "support" ? " (soporte: el proyecto ya fue entregado)" : ""}.`);
}

const quickSchema = z.object({
  project_id: z.uuid(),
  sprint_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()).optional(),
  text: z.string().trim().min(1, "Escribe el ticket.").max(500),
});

/** Creación rápida en el backlog: "Maquetar contacto ~3h #alta !viernes". */
export async function quickCreateTicket(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const input = quickSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return fail(firstIssue(input.error));

  const item = parseLine(input.data.text, { projects: [], today: todayCO(), defaultType: "ticket" });
  if (!item.title) return fail("El ticket no tiene título.");
  const status: TicketStatus = input.data.sprint_id ? "todo" : "backlog";

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      project_id: input.data.project_id,
      sprint_id: input.data.sprint_id ?? null,
      title: item.title,
      status,
      // Prioridad de tareas (1 alta … 3 baja) → tickets (1 urgente … 4 baja).
      priority: item.priority + 1,
      estimated_hours: item.estimated_hours,
      due_date: item.due_date,
      tags: item.tags,
      doc_url: item.doc_url,
      doc_kind: item.doc_kind,
      position: await endOfColumn(supabase, input.data.project_id, status),
    })
    .select("code, kind")
    .single();
  if (error) return fail("No se pudo crear el ticket.");
  refresh();
  return ok(`Creado ${data.code}${data.kind === "support" ? " (soporte)" : ""}.`);
}

const moveSchema = z.object({
  id: z.uuid(),
  status: z.enum(TICKET_STATUSES),
  beforeId: z.uuid().nullable(),
  afterId: z.uuid().nullable(),
});

/** Mueve un ticket a una columna, entre `beforeId` y `afterId` (null = extremo). */
export async function moveTicket(input: z.input<typeof moveSchema>): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail("Movimiento inválido.");
  const { id, status, beforeId, afterId } = parsed.data;

  const neighborIds = [beforeId, afterId].filter((v): v is string => v !== null);
  const { data: neighbors, error: readError } = neighborIds.length
    ? await supabase.from("tickets").select("id, position, project_id, sprint_id").in("id", neighborIds)
    : { data: [], error: null };
  if (readError) return fail("No se pudo mover el ticket.");

  const before = neighbors.find((n) => n.id === beforeId)?.position ?? null;
  const after = neighbors.find((n) => n.id === afterId)?.position ?? null;
  let position = positionBetween(before, after);

  if (needsRebalance(before, after)) {
    // Renumera la columna destino y recalcula el hueco.
    const { data: ticket } = await supabase.from("tickets").select("project_id, sprint_id").eq("id", id).single();
    let column = supabase
      .from("tickets")
      .select("id")
      .eq("project_id", ticket!.project_id)
      .eq("status", status)
      .is("deleted_at", null)
      .neq("id", id)
      .order("position");
    column = ticket!.sprint_id ? column.eq("sprint_id", ticket!.sprint_id) : column.is("sprint_id", null);
    const { data: ids } = await column;
    const positions = rebalance((ids ?? []).map((r) => r.id));
    await Promise.all(
      [...positions].map(([ticketId, pos]) => supabase.from("tickets").update({ position: pos }).eq("id", ticketId)),
    );
    position = positionBetween(
      beforeId ? (positions.get(beforeId) ?? null) : null,
      afterId ? (positions.get(afterId) ?? null) : null,
    );
  }

  const { error } = await supabase.from("tickets").update({ status, position }).eq("id", id);
  if (error) return fail("No se pudo mover el ticket.");
  refresh();
  return ok();
}

/** Cambio de estado sin arrastre (celular / accesibilidad): va al final de la columna. */
export async function setTicketStatus(id: string, status: TicketStatus): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success || !TICKET_STATUSES.includes(status)) return fail("Datos inválidos.");
  const { data: ticket, error: readError } = await supabase.from("tickets").select("project_id").eq("id", id).single();
  if (readError) return fail("No se encontró el ticket.");
  const position = await endOfColumn(supabase, ticket.project_id, status);
  const { error } = await supabase.from("tickets").update({ status, position }).eq("id", id);
  if (error) return fail("No se pudo actualizar el ticket.");
  refresh();
  return ok();
}

export async function deleteTicket(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(id).success) return fail("Ticket inválido.");
  const { error } = await supabase
    .from("tickets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo eliminar el ticket.");
  refresh();
  return ok("Ticket eliminado.");
}

/** Tarea "Convertir a ticket" (dictado de Granola) → ticket real del proyecto. */
export async function convertTaskToTicket(taskId: string, projectId?: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(taskId).success) return fail("Tarea inválida.");
  const { data: task, error: readError } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (readError) return fail("No se encontró la tarea.");

  const project = task.project_id ?? projectId;
  if (!project) return fail("Asigna un proyecto a la tarea antes de convertirla en ticket.");

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      project_id: project,
      title: task.title,
      description: task.notes,
      priority: task.priority + 1,
      estimated_hours: task.estimated_hours,
      due_date: task.due_date,
      tags: task.tags,
      doc_url: task.doc_url,
      doc_kind: task.doc_kind,
      source_note_id: task.source_note_id,
      position: await endOfColumn(supabase, project, "backlog"),
    })
    .select("id, code")
    .single();
  if (error) return fail("No se pudo crear el ticket.");

  const { error: taskError } = await supabase
    .from("tasks")
    .update({ status: "done", ticket_id: ticket.id, is_ticket_candidate: false })
    .eq("id", taskId);
  if (taskError) return fail(`Se creó ${ticket.code}, pero no se pudo cerrar la tarea.`);

  refresh();
  return ok(`Convertida en ${ticket.code}.`);
}

const extraSchema = z.object({
  ticket_id: z.uuid(),
  amount: z.preprocess((v) => (typeof v === "string" ? parseCOP(v) : v), z.number().int().positive("Indica el monto a cobrar.")),
});

/** Ticket fuera de alcance que se cobra aparte: lo marca extra y crea el pago esperado. */
export async function markExtraBillable(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = extraSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { ticket_id, amount } = parsed.data;

  const { data: ticket, error } = await supabase
    .from("tickets")
    .update({ kind: "extra", billable: true })
    .eq("id", ticket_id)
    .select("project_id, code")
    .single();
  if (error) return fail("No se pudo actualizar el ticket.");

  const { error: paymentError } = await supabase.from("payments").insert({
    project_id: ticket.project_id,
    ticket_id,
    kind: "extra",
    amount_cop: amount,
    status: "expected",
    due_date: todayCO(),
    note: `Extra ${ticket.code}`,
  });
  if (paymentError) return fail(`${ticket.code} quedó como extra, pero no se pudo crear el pago.`);

  refresh();
  return ok(`${ticket.code} es extra facturable: pago esperado de ${formatCOP(amount)}.`);
}
