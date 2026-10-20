import { addDays, weekday, type ISODate } from "@/lib/dates";

export type TicketKind = "scope" | "support" | "extra";

export type HourEntry = {
  started_at: string;
  hours: number | null;
  deleted_at: string | null;
  kind: TicketKind;
};

export type WeekHours = { week: ISODate; scope: number; support: number; extra: number };

const bogotaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });

/** Fecha (Colombia) de un instante ISO. */
export function dateInBogota(iso: string): ISODate {
  return bogotaDate.format(new Date(iso));
}

/** Lunes de la semana de `date`. */
export function mondayOf(date: ISODate): ISODate {
  return addDays(date, -((weekday(date) + 6) % 7));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Horas por semana (lunes a domingo) de las últimas `weeks` semanas, por tipo de ticket. */
export function weeklyHours(entries: HourEntry[], weeks: number, today: ISODate): WeekHours[] {
  const lastMonday = mondayOf(today);
  const buckets = new Map<ISODate, WeekHours>();
  for (let i = weeks - 1; i >= 0; i--) {
    const week = addDays(lastMonday, -7 * i);
    buckets.set(week, { week, scope: 0, support: 0, extra: 0 });
  }
  for (const e of entries) {
    if (e.deleted_at || e.hours === null) continue;
    const bucket = buckets.get(mondayOf(dateInBogota(e.started_at)));
    if (bucket) bucket[e.kind] = round2(bucket[e.kind] + Number(e.hours));
  }
  return [...buckets.values()];
}

export type ProjectHoursRow = {
  project_id: string;
  code_prefix: string;
  name: string;
  scope_logged: number;
  support_logged: number;
  extra_logged: number;
};

/** Proyectos con horas registradas, de más a menos horas totales. */
export function hoursByProject(rows: ProjectHoursRow[]) {
  return rows
    .map((r) => ({
      project_id: r.project_id,
      label: r.code_prefix,
      name: r.name,
      scope: round2(r.scope_logged),
      support: round2(r.support_logged),
      extra: round2(r.extra_logged),
      total: round2(r.scope_logged + r.support_logged + r.extra_logged),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}
