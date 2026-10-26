import { formatCOP, formatDate } from "@/lib/format";
import { BILLING_LABELS } from "@/lib/projects/labels";
import type { Tables } from "@/lib/supabase/database.types";

type ProjectFields = Pick<
  Tables<"projects">,
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
>;

export const PROJECT_CHANGE_FIELDS = [
  "name",
  "code_prefix",
  "client",
  "color",
  "drive_folder_url",
  "billing_type",
  "fixed_amount_cop",
  "estimated_total_hours",
  "monthly_fee_cop",
  "expected_hours_per_month",
  "contract_months",
  "billing_day",
  "start_date",
  "end_date",
  "default_sprint_days",
  "support_days",
] as const satisfies readonly (keyof ProjectFields)[];

type Field = (typeof PROJECT_CHANGE_FIELDS)[number];

const LABELS: Record<Field, string> = {
  name: "Nombre",
  code_prefix: "Prefijo",
  client: "Cliente",
  color: "Color",
  drive_folder_url: "Carpeta de Drive",
  billing_type: "Modalidad",
  fixed_amount_cop: "Valor total",
  estimated_total_hours: "Horas estimadas",
  monthly_fee_cop: "Mensualidad",
  expected_hours_per_month: "Horas por mes",
  contract_months: "Meses de contrato",
  billing_day: "Día de cobro",
  start_date: "Inicio",
  end_date: "Fin estimado",
  default_sprint_days: "Duración de sprint (días)",
  support_days: "Días de soporte",
};

const MONEY = new Set<Field>(["fixed_amount_cop", "monthly_fee_cop"]);
const DATES = new Set<Field>(["start_date", "end_date"]);

function display(field: Field, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field === "billing_type") return BILLING_LABELS[value as ProjectFields["billing_type"]] ?? String(value);
  if (MONEY.has(field)) return formatCOP(Number(value));
  if (DATES.has(field)) return formatDate(String(value));
  return String(value);
}

// Comparación normalizada: Postgres puede devolver números como string y vacíos como null.
function normalize(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") return String(value);
  const text = String(value);
  if (/^-?\d+(\.\d+)?$/.test(text)) return String(Number(text));
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : text;
}

export type ProjectChange = { field: Field; label: string; before: string; after: string };

/** Campos que cambian al guardar, listos para mostrar en la confirmación. */
export function describeProjectChanges(
  before: Partial<ProjectFields>,
  after: Partial<ProjectFields>,
): ProjectChange[] {
  return PROJECT_CHANGE_FIELDS.filter((field) => normalize(before[field]) !== normalize(after[field])).map(
    (field) => ({
      field,
      label: LABELS[field],
      before: display(field, before[field]),
      after: display(field, after[field]),
    }),
  );
}
