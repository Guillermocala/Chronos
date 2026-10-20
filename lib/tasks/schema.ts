import { z } from "zod";

import { isISODate } from "@/lib/dates";
import { parseDriveUrl } from "@/lib/drive";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const optionalDate = z.preprocess(
  emptyToNull,
  z.string().refine(isISODate, "Fecha inválida.").nullable(),
);

export const optionalText = z.preprocess(
  emptyToNull,
  z.string().trim().max(5000).nullable(),
);

export const optionalUuid = z.preprocess(emptyToNull, z.uuid().nullable());

/** Enlace de Google Docs/Drive opcional → { doc_url, doc_kind }. */
export const driveLink = z.preprocess(
  emptyToNull,
  z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null) return { doc_url: null, doc_kind: null };
      const parsed = parseDriveUrl(value);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: "El enlace debe ser de Google Docs o Drive." });
        return z.NEVER;
      }
      return { doc_url: parsed.url, doc_kind: parsed.kind };
    }),
);

export const taskUpdateSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1, "El título es obligatorio.").max(300),
    notes: optionalText,
    kind: z.enum(["todo", "follow_up"]),
    status: z.enum(["open", "waiting", "done", "dismissed"]),
    priority: z.coerce.number().int().min(1).max(3),
    due_date: optionalDate,
    planned_on: optionalDate,
    waiting_on: optionalText,
    project_id: optionalUuid,
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
  .transform(({ doc, ...task }) => ({
    ...task,
    // Las tareas normales no tienen "esperando a".
    waiting_on: task.kind === "follow_up" ? task.waiting_on : null,
    ...doc,
  }));

export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
