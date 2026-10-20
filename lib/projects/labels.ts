import { daysBetween, type ISODate } from "@/lib/dates";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export const BILLING_LABELS: Record<Enums<"billing_type">, string> = {
  fixed: "Pago fijo",
  retainer: "Contratación mensual",
};

export const PAYMENT_KIND_LABELS: Record<Enums<"payment_kind">, string> = {
  advance: "Anticipo",
  partial: "Pago parcial",
  final: "Pago final",
  monthly: "Mensualidad",
  extra: "Extra",
};

export type PhaseInfo = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  /** Días restantes de soporte (negativo si ya venció). */
  supportDaysLeft: number | null;
};

export function phaseInfo(
  project: Pick<Tables<"projects">, "phase" | "support_until">,
  today: ISODate,
): PhaseInfo {
  switch (project.phase) {
    case "active":
      return { label: "Activo", variant: "default", supportDaysLeft: null };
    case "delivered":
      return { label: "Entregado", variant: "secondary", supportDaysLeft: null };
    case "closed":
      return { label: "Cerrado", variant: "outline", supportDaysLeft: null };
    case "support": {
      if (!project.support_until) {
        return { label: "En soporte", variant: "secondary", supportDaysLeft: null };
      }
      const left = daysBetween(today, project.support_until);
      if (left < 0) {
        return { label: `Soporte vencido hace ${-left} d`, variant: "destructive", supportDaysLeft: left };
      }
      return {
        label: left === 0 ? "Soporte vence hoy" : `En soporte · ${left} d`,
        variant: left <= 3 ? "destructive" : "secondary",
        supportDaysLeft: left,
      };
    }
  }
}
