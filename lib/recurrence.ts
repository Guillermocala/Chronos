// Reglas de tareas recurrentes. La misma lógica vive en SQL
// (public.next_occurrence / private.generate_recurring_tasks); un test de
// integración verifica que ambas coincidan.

import { addDays, daysBetween, daysInMonth, makeISODate, weekday, type ISODate } from "@/lib/dates";

export type Frequency = "daily" | "weekly" | "monthly";

export type Rule = {
  frequency: Frequency;
  interval: number;
  /** 0 = domingo … 6 = sábado (semanal). */
  weekday: number | null;
  /** 1–31 (mensual); si el mes es más corto se usa el último día. */
  month_day: number | null;
};

/** Día `day` del mes, o el último día si el mes es más corto. */
export function clampMonthDay(year: number, month: number, day: number): ISODate {
  return makeISODate(year, month, Math.min(day, daysInMonth(year, month)))!;
}

function monthParts(date: ISODate): [number, number] {
  const [y, m] = date.split("-").map(Number);
  return [y, m];
}

function addMonthsClamped(date: ISODate, months: number, day: number): ISODate {
  const [y, m] = monthParts(date);
  const index = y * 12 + (m - 1) + months;
  return clampMonthDay(Math.floor(index / 12), (index % 12) + 1, day);
}

/** Primera ocurrencia en o después de `start`. */
export function alignFirst(start: ISODate, rule: Rule): ISODate {
  switch (rule.frequency) {
    case "daily":
      return start;
    case "weekly":
      return addDays(start, ((rule.weekday ?? weekday(start)) - weekday(start) + 7) % 7);
    case "monthly": {
      const day = rule.month_day ?? Number(start.slice(8, 10));
      const [y, m] = monthParts(start);
      const candidate = clampMonthDay(y, m, day);
      return daysBetween(start, candidate) >= 0 ? candidate : addMonthsClamped(start, 1, day);
    }
  }
}

/** Ocurrencia siguiente a `date` (que ya es una ocurrencia). */
export function nextOccurrence(date: ISODate, rule: Rule): ISODate {
  switch (rule.frequency) {
    case "daily":
      return addDays(date, rule.interval);
    case "weekly":
      return addDays(date, 7 * rule.interval);
    case "monthly":
      return addMonthsClamped(date, rule.interval, rule.month_day ?? Number(date.slice(8, 10)));
  }
}

/** Próximas `count` fechas desde `from` (vista previa). */
export function upcoming(rule: Rule, from: ISODate, count: number): ISODate[] {
  const dates = [alignFirst(from, rule)];
  while (dates.length < count) dates.push(nextOccurrence(dates[dates.length - 1], rule));
  return dates;
}

/**
 * Qué crea el generador hoy (mismo algoritmo que el SQL):
 * 1. si `next_due` quedó en el pasado, salta a la primera ocurrencia desde hoy
 *    (no crea un alud de tareas atrasadas);
 * 2. crea cada ocurrencia cuya fecha menos `lead_days` ya llegó.
 */
export function planGeneration(
  rule: Rule & { next_due: ISODate; lead_days: number },
  today: ISODate,
): { create: ISODate[]; next_due: ISODate } {
  let next = rule.next_due;
  for (let guard = 0; daysBetween(next, today) > 0 && guard < 1000; guard++) next = nextOccurrence(next, rule);
  const create: ISODate[] = [];
  for (let guard = 0; daysBetween(addDays(next, -rule.lead_days), today) >= 0 && guard < 60; guard++) {
    create.push(next);
    next = nextOccurrence(next, rule);
  }
  return { create, next_due: next };
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "Cada día", "Cada 2 semanas, los lunes", "Cada mes, el día 1", "Cada 3 meses, el último día". */
export function describeRule(rule: Rule): string {
  const every = (singular: string, plural: string) =>
    rule.interval === 1 ? `Cada ${singular}` : `Cada ${rule.interval} ${plural}`;
  switch (rule.frequency) {
    case "daily":
      return every("día", "días");
    case "weekly":
      return `${every("semana", "semanas")}, los ${WEEKDAYS[rule.weekday ?? 1]}`;
    case "monthly":
      return `${every("mes", "meses")}, ${rule.month_day && rule.month_day >= 31 ? "el último día" : `el día ${rule.month_day ?? 1}`}`;
  }
}

export { WEEKDAYS };
