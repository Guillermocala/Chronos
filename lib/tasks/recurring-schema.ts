import { z } from "zod";

import { isISODate } from "@/lib/dates";
import { alignFirst, type Rule } from "@/lib/recurrence";

import { driveLink, optionalText, optionalUuid } from "./schema";

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );

export const recurringSchema = z
  .object({
    id: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid().nullable()),
    title: z.string().trim().min(1, "El título es obligatorio.").max(300),
    notes: optionalText,
    kind: z.enum(["todo", "follow_up"]),
    priority: z.coerce.number().int().min(1).max(3),
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
    frequency: z.enum(["daily", "weekly", "monthly"], { error: "Elige la frecuencia." }),
    interval: z.coerce.number().int().min(1, "Mínimo cada 1.").max(12, "Máximo cada 12."),
    weekday: optionalInt(0, 6),
    month_day: optionalInt(1, 31),
    start: z.string().refine(isISODate, "Indica la primera fecha."),
    lead_days: z.coerce.number().int().min(0).max(14, "Máximo 14 días de anticipación."),
  })
  .refine((v) => v.frequency !== "weekly" || v.weekday !== null, {
    message: "Elige el día de la semana.",
    path: ["weekday"],
  })
  .refine((v) => v.frequency !== "monthly" || v.month_day !== null, {
    message: "Elige el día del mes.",
    path: ["month_day"],
  })
  .transform(({ doc, start, ...v }) => {
    const rule: Rule = {
      frequency: v.frequency,
      interval: v.interval,
      weekday: v.frequency === "weekly" ? v.weekday : null,
      month_day: v.frequency === "monthly" ? v.month_day : null,
    };
    return {
      ...v,
      ...rule,
      // La primera ocurrencia en o después de la fecha indicada.
      next_due: alignFirst(start, rule),
      waiting_on: v.kind === "follow_up" ? v.waiting_on : null,
      ...doc,
    };
  });

export type RecurringInput = z.infer<typeof recurringSchema>;
