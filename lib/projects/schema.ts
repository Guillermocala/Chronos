import { z } from "zod";

import { daysBetween } from "@/lib/dates";
import { isDriveFolderUrl, parseDriveUrl } from "@/lib/drive";
import { parseCOP } from "@/lib/format";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { optionalDate, optionalText } from "@/lib/tasks/schema";

const emptyToNull = (v: unknown) =>
  v === undefined || (typeof v === "string" && v.trim() === "") ? null : v;

const money = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? parseCOP(v) : v),
    z.number({ error: `${label} es obligatorio.` }).int().positive(`${label} debe ser mayor que 0.`),
  );

// Campos opcionales: vacíos o ausentes (el formulario no los muestra) → null.
const toNumberOrNull = (parse: (s: string) => number | null) => (v: unknown) => {
  const value = emptyToNull(v);
  return typeof value === "string" ? parse(value) : value;
};

const optionalMoney = z.preprocess(
  toNumberOrNull(parseCOP),
  z.number().int().nonnegative().nullable(),
);

const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    toNumberOrNull((s) => Number(s.replace(",", "."))),
    z.number().min(min).max(max).nullable(),
  );

const optionalInt = (min: number, max: number, message: string) =>
  z.preprocess(
    toNumberOrNull(Number),
    z.number().int().min(min, message).max(max, message).nullable(),
  );

const base = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  client: optionalText,
  code_prefix: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(
      z
        .string()
        .regex(/^[A-Z][A-Z0-9]{1,9}$/, "El prefijo debe tener 2–10 letras o números y empezar con letra."),
    ),
  color: z.preprocess(emptyToNull, z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable()),
  start_date: optionalDate,
  end_date: optionalDate,
  default_sprint_days: z.coerce.number().int().min(1, "Mínimo 1 día.").max(60, "Máximo 60 días."),
  support_days: z.coerce.number().int().min(0).max(90, "Máximo 90 días de soporte."),
  drive_folder_url: z.preprocess(
    emptyToNull,
    z
      .string()
      .refine(isDriveFolderUrl, "Debe ser el enlace de una carpeta de Google Drive.")
      .transform((v) => parseDriveUrl(v)!.url)
      .nullable(),
  ),
});

const fixed = base.extend({
  billing_type: z.literal("fixed"),
  fixed_amount_cop: money("El valor del proyecto"),
  estimated_total_hours: optionalNumber(0.5, 100000),
});

const retainer = base.extend({
  billing_type: z.literal("retainer"),
  monthly_fee_cop: money("La mensualidad"),
  expected_hours_per_month: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z.number({ error: "Las horas por mes son obligatorias." }).positive("Las horas por mes deben ser mayores que 0.").max(744),
  ),
  contract_months: optionalInt(1, 60, "Entre 1 y 60 meses."),
  billing_day: optionalInt(1, 28, "El día de cobro debe estar entre 1 y 28."),
});

export const projectSchema = z
  .discriminatedUnion("billing_type", [fixed, retainer], {
    error: "Elige la modalidad de cobro.",
  })
  .refine(
    (p) => !p.start_date || !p.end_date || daysBetween(p.start_date, p.end_date) >= 0,
    { message: "La fecha de fin debe ser posterior al inicio.", path: ["end_date"] },
  )
  // Una sola forma de fila (los campos de la otra modalidad quedan en null).
  .transform((p): ProjectRow => {
    const common = {
      name: p.name,
      client: p.client,
      code_prefix: p.code_prefix,
      color: p.color,
      start_date: p.start_date,
      end_date: p.end_date,
      default_sprint_days: p.default_sprint_days,
      support_days: p.support_days,
      drive_folder_url: p.drive_folder_url,
    };
    return p.billing_type === "fixed"
      ? {
          ...common,
          billing_type: "fixed",
          fixed_amount_cop: p.fixed_amount_cop,
          estimated_total_hours: p.estimated_total_hours,
          monthly_fee_cop: null,
          expected_hours_per_month: null,
          contract_months: null,
          billing_day: null,
        }
      : {
          ...common,
          billing_type: "retainer",
          fixed_amount_cop: null,
          estimated_total_hours: null,
          monthly_fee_cop: p.monthly_fee_cop,
          expected_hours_per_month: p.expected_hours_per_month,
          contract_months: p.contract_months,
          billing_day: p.billing_day ?? 1,
        };
  });

type ProjectRow = Required<
  Pick<
    TablesInsert<"projects">,
    | "name"
    | "client"
    | "code_prefix"
    | "color"
    | "start_date"
    | "end_date"
    | "default_sprint_days"
    | "support_days"
    | "drive_folder_url"
    | "billing_type"
    | "fixed_amount_cop"
    | "estimated_total_hours"
    | "monthly_fee_cop"
    | "expected_hours_per_month"
    | "contract_months"
    | "billing_day"
  >
>;

export type ProjectInput = z.infer<typeof projectSchema>;

export const paymentSchema = z
  .object({
    id: z.preprocess(emptyToNull, z.uuid().nullable()),
    project_id: z.uuid(),
    kind: z.enum(["advance", "partial", "final", "monthly", "extra"]),
    amount_cop: money("El monto"),
    status: z.enum(["expected", "received"]),
    due_date: optionalDate,
    paid_at: optionalDate,
    note: optionalText,
  })
  .refine((p) => p.status !== "received" || p.paid_at !== null, {
    message: "Indica la fecha en que se recibió el pago.",
    path: ["paid_at"],
  });

export const sprintSchema = z
  .object({
    id: z.preprocess(emptyToNull, z.uuid().nullable()),
    project_id: z.uuid(),
    name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
    goal: optionalText,
    start_date: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha de inicio inválida."),
    end_date: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha de fin inválida."),
    is_support: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    value_cop_override: optionalMoney,
  })
  .refine((s) => daysBetween(s.start_date, s.end_date) >= 0, {
    message: "La fecha de fin debe ser posterior al inicio.",
    path: ["end_date"],
  });

export const deliverySchema = z.object({
  id: z.uuid(),
  delivered_at: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha de entrega inválida."),
  support_days: z.coerce.number().int().min(0).max(90),
  register_final: z.preprocess((v) => v === "on", z.boolean()),
  final_amount: optionalMoney,
  final_status: z.enum(["received", "expected"]).default("received"),
  create_support_sprint: z.preprocess((v) => v === "on", z.boolean()),
});
