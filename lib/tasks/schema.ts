import { z } from "zod";

import { isISODate } from "@/lib/dates";
import { parseDriveUrl, type DocKind } from "@/lib/drive";
import { parseDurationInput } from "@/lib/time";

const emptyToNull = (v: unknown) =>
  v === undefined || (typeof v === "string" && v.trim() === "") ? null : v;

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
    .transform((value, ctx): { doc_url: string | null; doc_kind: DocKind | null } => {
      if (value === null) return { doc_url: null, doc_kind: null };
      const parsed = parseDriveUrl(value);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: "El enlace debe ser de Google Docs o Drive." });
        return z.NEVER;
      }
      return { doc_url: parsed.url, doc_kind: parsed.kind };
    }),
);

/** Duración opcional ("1:30", "2h", "90m"); vacío = sin dato. */
export const optionalDuration = z.preprocess(
  emptyToNull,
  z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null) return null;
      const hours = parseDurationInput(value);
      if (hours === null) {
        ctx.addIssue({ code: "custom", message: "Horas inválidas. Ej.: 1:30, 1,5, 2h o 90m (máx. 24 h)." });
        return z.NEVER;
      }
      return hours;
    }),
);

const tags = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(/[,\s]+/)
          .map((t) => t.replace(/^#/, "").trim().toLowerCase())
          .filter(Boolean)
      : [],
  z.array(z.string().max(40)).max(20),
);

/** Campos que comparten crear y editar una tarea. */
const taskFields = {
  title: z.string().trim().min(1, "El título es obligatorio.").max(300),
  notes: optionalText,
  kind: z.enum(["todo", "follow_up"]),
  priority: z.coerce.number().int().min(1).max(3),
  due_date: optionalDate,
  planned_on: optionalDate,
  waiting_on: optionalText,
  project_id: optionalUuid,
  estimated_hours: optionalDuration,
  tags,
  doc: driveLink,
};

export const taskUpdateSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(["open", "waiting", "done", "dismissed"]),
    ...taskFields,
    /** Solo tareas hechas: horas que tomó (se suman a lo registrado). */
    add_hours: optionalDuration.optional(),
  })
  .transform(({ doc, ...task }) => ({
    ...task,
    // Las tareas normales no tienen "esperando a".
    waiting_on: task.kind === "follow_up" ? task.waiting_on : null,
    ...doc,
  }));

export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export const taskCreateSchema = z.object(taskFields).transform(({ doc, ...task }) => ({
  ...task,
  waiting_on: task.kind === "follow_up" ? task.waiting_on : null,
  // Un seguimiento con "esperando a" ya está en espera.
  status: task.kind === "follow_up" && task.waiting_on ? ("waiting" as const) : ("open" as const),
  ...doc,
}));

export type TaskCreate = z.infer<typeof taskCreateSchema>;
