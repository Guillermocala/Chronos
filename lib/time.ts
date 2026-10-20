// Duraciones del registro de horas. Se guardan en horas decimales (numeric 6,2).

const MAX_HOURS = 24;

/** Horas entre dos instantes, redondeadas a 0,01 (mínimo 0,01 para no guardar 0). */
export function elapsedHours(start: string | Date, end: string | Date): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0.01, Math.round((ms / 3_600_000) * 100) / 100);
}

/** 1.42 → "1 h 25 min"; 0.75 → "45 min". */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Cronómetro en curso: milisegundos → "1:05" (horas:minutos). */
export function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

/**
 * Duración escrita a mano → horas decimales.
 * "1:30", "1,5", "1.5", "90m", "90 min", "2h", "2h30", "2 h 30 min".
 * Devuelve null si no se entiende, es 0 o supera 24 h.
 */
export function parseDurationInput(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;

  let hours: number | null = null;
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(text);
  const hm = /^(\d+(?:[.,]\d+)?)h(?:(\d{1,2})(?:m|min)?)?$/.exec(text);
  const minutes = /^(\d+)(?:m|min|mins|minutos?)$/.exec(text);
  const decimal = /^\d+(?:[.,]\d+)?$/.exec(text);

  if (clock) hours = Number(clock[1]) + Number(clock[2]) / 60;
  else if (hm) hours = Number(hm[1].replace(",", ".")) + (hm[2] ? Number(hm[2]) / 60 : 0);
  else if (minutes) hours = Number(minutes[1]) / 60;
  else if (decimal) hours = Number(text.replace(",", "."));

  if (hours === null || !Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS) return null;
  return Math.round(hours * 100) / 100;
}
