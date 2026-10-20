import type { ISODate } from "@/lib/dates";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return copFormatter.format(Math.round(value));
}

/** "$ 1.500.000", "1500000", "1.500.000,50" → 1500000. Vacío o sin dígitos → null. */
export function parseCOP(input: string | null | undefined): number | null {
  if (!input) return null;
  const withoutDecimals = input.trim().replace(/,\d{1,2}$/, "");
  const digits = withoutDecimals.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function isoToDate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(iso: ISODate | null | undefined): string {
  return iso ? dateFormatter.format(isoToDate(iso)) : "—";
}

/** "lun, 20 oct" — para listas de tareas. */
export function formatShortDate(iso: ISODate | null | undefined): string {
  return iso ? shortDateFormatter.format(isoToDate(iso)) : "—";
}

const hoursFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export function formatHours(hours: number | null | undefined): string {
  return hours == null ? "—" : `${hoursFormatter.format(hours)} h`;
}
