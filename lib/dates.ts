// Fechas como strings "YYYY-MM-DD" (columnas `date` de Postgres), calculadas en
// UTC para evitar desfases por zona horaria. "Hoy" siempre es el de Colombia.

export type ISODate = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUTC(iso: ISODate): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isISODate(value: string): boolean {
  const match = ISO_RE.exec(value);
  if (!match) return false;
  return fromUTC(toUTC(value)) === value;
}

export function makeISODate(year: number, month: number, day: number): ISODate | null {
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isISODate(iso) ? iso : null;
}

export function todayCO(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromUTC(toUTC(iso) + days * DAY_MS);
}

/** Días de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(iso: ISODate): number {
  return new Date(toUTC(iso)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type MonthOverlap = {
  year: number;
  month: number;
  days: number;
  daysInMonth: number;
};

/** Días que el rango [start, end] (inclusivo) ocupa en cada mes que toca. */
export function eachMonthOverlap(start: ISODate, end: ISODate): MonthOverlap[] {
  if (daysBetween(start, end) < 0) return [];
  const result: MonthOverlap[] = [];
  let cursor = start;
  while (daysBetween(cursor, end) >= 0) {
    const [year, month] = cursor.split("-").map(Number);
    const dim = daysInMonth(year, month);
    const monthEnd = makeISODate(year, month, dim)!;
    const segmentEnd = daysBetween(monthEnd, end) >= 0 ? monthEnd : end;
    result.push({
      year,
      month,
      days: daysBetween(cursor, segmentEnd) + 1,
      daysInMonth: dim,
    });
    cursor = addDays(segmentEnd, 1);
  }
  return result;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_]+/g, "-");
}

/**
 * Interpreta fechas dictadas en español respecto a `base` (normalmente hoy):
 * hoy, mañana, pasado-mañana, lunes…domingo (próxima ocurrencia, nunca hoy),
 * en-3-dias, 25/10 (si ya pasó, el año siguiente), 25/10/2026, 2026-10-25.
 */
export function parseSpanishDate(input: string, base: ISODate): ISODate | null {
  const text = normalize(input);
  if (!text) return null;

  if (text === "hoy") return base;
  if (text === "manana") return addDays(base, 1);
  if (text === "pasado-manana" || text === "pasadomanana") return addDays(base, 2);

  const inDays = /^en-?(\d{1,3})-?dias?$/.exec(text);
  if (inDays) return addDays(base, Number(inDays[1]));

  if (text in WEEKDAYS) {
    const diff = (WEEKDAYS[text] - weekday(base) + 7) % 7 || 7;
    return addDays(base, diff);
  }

  if (isISODate(text)) return text;

  const dm = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(text);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    if (dm[3]) {
      const year = dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3]);
      return makeISODate(year, month, day);
    }
    const baseYear = Number(base.slice(0, 4));
    const thisYear = makeISODate(baseYear, month, day);
    if (!thisYear) return null;
    return daysBetween(base, thisYear) >= 0
      ? thisYear
      : makeISODate(baseYear + 1, month, day);
  }

  return null;
}
