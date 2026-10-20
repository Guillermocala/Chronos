import { z } from "zod";

import { driveLink, optionalDate, optionalText, optionalUuid } from "@/lib/tasks/schema";

export const TICKET_STATUSES = ["backlog", "todo", "in_progress", "review", "done"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: "Backlog",
  todo: "Por hacer",
  in_progress: "En curso",
  review: "Revisión",
  done: "Hecho",
};

export const TICKET_KIND_LABELS = {
  scope: "Alcance",
  support: "Soporte",
  extra: "Extra",
} as const;

export const TICKET_PRIORITY_LABELS: Record<number, string> = {
  1: "Urgente",
  2: "Alta",
  3: "Media",
  4: "Baja",
};

const optionalHours = z.preprocess(
  (v) =>
    v === undefined || (typeof v === "string" && v.trim() === "")
      ? null
      : typeof v === "string"
        ? Number(v.replace(",", "."))
        : v,
  z.number().min(0, "Las horas no pueden ser negativas.").max(999).nullable(),
);

export const ticketSchema = z
  .object({
    id: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid().nullable()),
    project_id: z.uuid(),
    title: z.string().trim().min(1, "El título es obligatorio.").max(300),
    description: optionalText,
    status: z.enum(TICKET_STATUSES).default("backlog"),
    priority: z.coerce.number().int().min(1).max(4).default(3),
    estimated_hours: optionalHours,
    due_date: optionalDate,
    sprint_id: optionalUuid,
    kind: z.enum(["scope", "support", "extra"]).default("scope"),
    billable: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    tags: z.preprocess(
      (v) =>
        typeof v === "string"
          ? v
              .split(/[,\s]+/)
              .map((t) => t.replace(/^#/, "").trim().toLowerCase())
              .filter(Boolean)
          : [],
      z.array(z.string().max(40)).max(20),
    ),
    doc: driveLink,
  })
  .transform(({ doc, ...ticket }) => ({
    ...ticket,
    // Alcance siempre es facturable; soporte nunca.
    billable: ticket.kind === "scope" ? true : ticket.kind === "support" ? false : ticket.billable,
    ...doc,
  }));

export type TicketInput = z.infer<typeof ticketSchema>;
