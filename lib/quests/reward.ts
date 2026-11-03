// Valor en COP de una misión (tarea): cuánto "ganas" al terminarla.
// Sale del contrato del proyecto: horas × tarifa estimada. Las tareas personales
// (sin proyecto) valen $0 pero siguen contando como misión.

import type { Tables } from "@/lib/supabase/database.types";
import {
  estimatedHourlyRate,
  ticketValue,
  type ProjectBilling,
  type TicketLike,
} from "@/lib/valuation";

export type RewardTask = Pick<Tables<"tasks">, "estimated_hours" | "project_id" | "ticket_id"> & {
  /** Sin estado se trata como pendiente (vale el estimado). */
  status?: Tables<"tasks">["status"];
  /** Horas registradas a la tarea (incluye borradas; se filtran aquí). */
  logged?: { hours: number | null; deleted_at: string | null }[];
};

/** Proyecto con su facturación y, en contratos fijos, las horas estimadas de alcance. */
export type RewardProject = ProjectBilling & { scope_estimated?: number | null };

export type RewardSource = "ticket" | "estimate" | "logged" | "none";

export type Reward = {
  /** COP que aporta la tarea (0 si no se puede calcular o es personal). */
  cop: number;
  source: RewardSource;
  /** Horas usadas en el cálculo. */
  hours: number | null;
  /** Tarifa por hora usada en el cálculo. */
  rate: number | null;
  /** Ticket de soporte: lo que costarían esas horas (no se cobra). */
  opportunityCost: number | null;
  /** Sin proyecto: misión personal. */
  personal: boolean;
};

const NONE = (personal: boolean): Reward => ({
  cop: 0,
  source: "none",
  hours: null,
  rate: null,
  opportunityCost: null,
  personal,
});

export function loggedHours(task: RewardTask): number {
  return (task.logged ?? []).reduce(
    (sum, e) => (e.deleted_at || e.hours == null ? sum : sum + Number(e.hours)),
    0,
  );
}

/**
 * Valor de una tarea, en este orden:
 * 1. ticket ligado con estimado → `ticketValue` (soporte = 0 con costo de oportunidad);
 * 2. completada con horas registradas → horas reales × tarifa (como la liquidación OPS);
 * 3. horas estimadas de la tarea × tarifa estimada del proyecto;
 * 4. horas registradas × tarifa (pendiente sin estimado);
 * 5. si no, $0 (personal o sin datos).
 */
export function taskReward(
  task: RewardTask,
  project: RewardProject | null | undefined,
  ticket?: TicketLike | null,
): Reward {
  if (!task.project_id || !project) return NONE(!task.project_id);
  const rate = estimatedHourlyRate(project, project.scope_estimated);
  if (rate == null) return NONE(false);

  if (ticket && ticket.estimated_hours != null) {
    const { value, opportunityCost } = ticketValue(project, ticket, project.scope_estimated);
    return {
      cop: value ?? 0,
      source: "ticket",
      hours: Number(ticket.estimated_hours),
      rate,
      opportunityCost,
      personal: false,
    };
  }
  // Un ticket de soporte o un extra no facturable no suma, aunque la tarea tenga estimado.
  if (ticket && (ticket.kind === "support" || (ticket.kind === "extra" && !ticket.billable))) {
    return { ...NONE(false), rate };
  }

  const logged = loggedHours(task);
  if (task.status === "done" && logged > 0) {
    return { cop: Math.round(logged * rate), source: "logged", hours: logged, rate, opportunityCost: null, personal: false };
  }
  const estimate = task.estimated_hours != null ? Number(task.estimated_hours) : 0;
  if (estimate > 0) {
    return { cop: Math.round(estimate * rate), source: "estimate", hours: estimate, rate, opportunityCost: null, personal: false };
  }
  if (logged > 0) {
    return { cop: Math.round(logged * rate), source: "logged", hours: logged, rate, opportunityCost: null, personal: false };
  }
  return { ...NONE(false), rate };
}

export type MissionLike = Pick<Tables<"tasks">, "kind" | "auto_source">;

/** Solo las tareas propias cuentan como misión: sin seguimientos ni automáticas (cobros, soporte). */
export function isMission(task: MissionLike): boolean {
  return task.kind === "todo" && task.auto_source === null;
}

export type RewardLookup = {
  projects: (RewardProject & { id: string })[];
  tickets: (TicketLike & { id: string })[];
};

/** Calcula el valor de cualquier tarea con los proyectos y tickets ya cargados. */
export function makeRewardResolver({ projects, tickets }: RewardLookup) {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  return (task: RewardTask): Reward =>
    taskReward(
      task,
      task.project_id ? projectById.get(task.project_id) : null,
      task.ticket_id ? ticketById.get(task.ticket_id) : null,
    );
}
