// Lector del "Informe de actividad" de Leden Company (PDF).
//
// Página 1: encabezado (persona, período, totales). Páginas siguientes: tabla
// FECHA · PROYECTO · CLIENTE · TIPO · INTERLOC. · FACT. · HORAS · DESCRIPTOR.
// Las columnas salen de la posición x de los encabezados; un registro empieza
// cuando la columna FECHA trae "d mmm aaaa" y los textos partidos en varias
// líneas se unen a su columna hasta el siguiente registro.

import type { ExternalReport, ExternalReportMeta, ExternalRow, PdfTextItem } from "../types";

const MONTHS: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", sept: "09", oct: "10", nov: "11", dic: "12",
};

const DATE_RE = /^(\d{1,2})\s+([a-záé]{3,4})\.?\s+(\d{4})$/i;

const COLUMNS = ["FECHA", "PROYECTO", "CLIENTE", "TIPO", "INTERLOC.", "FACT.", "HORAS", "DESCRIPTOR"] as const;
type Column = (typeof COLUMNS)[number];

/** "1 oct 2026" → "2026-10-01". */
export function parseSpanishDate(text: string): string | null {
  const m = DATE_RE.exec(text.trim());
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

/** "1,50 h" / "80,00" → 1.5 / 80. */
export function parseHours(text: string): number | null {
  // Con coma decimal, el punto es separador de miles ("1.234,50").
  const m = /(\d+(?:[.,]\d+)?)/.exec(text.includes(",") ? text.replace(/\./g, "") : text);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Minúsculas sin tildes ni signos, para comparar textos. */
export function normalizeText(s: string) {
  return clean(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "Producción / Entregable" → "produccion-entregable". */
export function slugTag(s: string) {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== "y" && w !== "de")
    .join("-")
    .slice(0, 40);
}

function readMeta(items: PdfTextItem[]): ExternalReportMeta {
  const first = items.filter((i) => i.page === 1);
  // Valor debajo de una etiqueta (misma columna x, la línea siguiente).
  const below = (label: string) => {
    const l = first.find((i) => clean(i.str).toUpperCase() === label);
    if (!l) return null;
    const v = first
      .filter((i) => Math.abs(i.x - l.x) < 2 && i.y < l.y && l.y - i.y < 40)
      .sort((a, b) => b.y - a.y)[0];
    return v ? clean(v.str) : null;
  };

  const code = first.map((i) => clean(i.str)).find((s) => /^INF-[\w-]+$/.test(s)) ?? null;
  const period = below("PERIODO");
  const [from, to] = period ? period.split(/\s*[–-]\s*(?=\d)/) : [];
  const totalText = below("TOTAL");
  const records = first.map((i) => /^(\d+)\s+registros?$/.exec(clean(i.str))).find(Boolean);

  return {
    code,
    person: below("PERSONA"),
    email: below("CORREO"),
    organization: below("ORGANIZACIÓN"),
    periodStart: from ? parseSpanishDate(from) : null,
    periodEnd: to ? parseSpanishDate(to) : null,
    declaredHours: totalText ? parseHours(totalText) : null,
    declaredRecords: records ? Number(records[1]) : null,
  };
}

type RawRow = Record<Column, string>;

function readTable(items: PdfTextItem[]): { rows: RawRow[]; periodTotal: number | null } {
  const rows: RawRow[] = [];
  let periodTotal: number | null = null;
  let headers: { col: Column; x: number }[] | null = null;
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);

  for (const page of pages) {
    const onPage = items.filter((i) => i.page === page);
    const fecha = onPage.find((i) => clean(i.str) === "FECHA");
    if (fecha) {
      const found = COLUMNS.map((col) => {
        const h = onPage.find((i) => Math.abs(i.y - fecha.y) < 1 && clean(i.str) === col);
        return h ? { col, x: h.x } : null;
      });
      if (found.every(Boolean)) headers = found as { col: Column; x: number }[];
    }
    if (!headers || !fecha) continue;
    const cols = headers;

    // Fin de la tabla: "Total del periodo" (última página).
    const totalRow = onPage.find((i) => /^Total del periodo$/i.test(clean(i.str)));
    if (totalRow) {
      const value = onPage.find((i) => Math.abs(i.y - totalRow.y) < 1 && /\d/.test(i.str));
      periodTotal = value ? parseHours(value.str) : null;
    }
    const bottom = totalRow ? totalRow.y + 1 : 40;

    const body = onPage
      .filter((i) => i.y < fecha.y - 1 && i.y > bottom && !/^Generado el/i.test(i.str))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const columnOf = (x: number): Column => {
      let col: Column = cols[0].col;
      for (const h of cols) if (x >= h.x - 4) col = h.col;
      return col;
    };

    let current: RawRow | null = null;
    for (const item of body) {
      const col = columnOf(item.x);
      const text = clean(item.str);
      if (col === "FECHA" && parseSpanishDate(text)) {
        current = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as RawRow;
        current.FECHA = text;
        rows.push(current);
        continue;
      }
      if (current) current[col] = clean(`${current[col]} ${text}`);
    }
  }

  return { rows, periodTotal };
}

function toRow(raw: RawRow): ExternalRow | string {
  const date = parseSpanishDate(raw.FECHA);
  const hours = parseHours(raw.HORAS);
  if (!date) return `Fecha ilegible: "${raw.FECHA}".`;
  if (hours === null || hours <= 0) return `Horas ilegibles el ${raw.FECHA}: "${raw.HORAS}".`;
  if (!raw.DESCRIPTOR) return `Registro sin descripción el ${raw.FECHA}.`;

  const tags = ["leden"];
  let title = raw.DESCRIPTOR;
  const label = /^\[([^\]]+)\]\s*/.exec(title);
  if (label) {
    tags.push(slugTag(label[1]));
    title = title.slice(label[0].length) || title;
  }
  if (raw.TIPO) tags.push(slugTag(raw.TIPO));
  const billable = !/^no$/i.test(raw["FACT."]);

  const notes = [
    `Leden · ${raw.PROYECTO}`,
    raw.CLIENTE && `Cliente: ${raw.CLIENTE}`,
    raw.TIPO,
    raw["INTERLOC."] && `Interlocutor: ${raw["INTERLOC."]}`,
    billable ? "Facturable" : "No facturable",
    label ? `[${label[1]}]` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    externalId: "",
    date,
    externalProject: raw.PROYECTO,
    hours,
    billable,
    title: title.slice(0, 300),
    notes,
    tags: [...new Set(tags.filter(Boolean))],
    details: { client: raw.CLIENTE, type: raw.TIPO, interlocutor: raw["INTERLOC."] },
  };
}

/**
 * Huella estable: fecha | proyecto | horas | descripción (normalizados). Los
 * registros idénticos del mismo informe se distinguen con "#2", "#3"...
 */
export function assignExternalIds(rows: ExternalRow[], rawDescriptions: string[]) {
  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    const base = ["leden", row.date, normalizeText(row.externalProject), row.hours.toFixed(2), normalizeText(rawDescriptions[i])].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    row.externalId = n === 1 ? base : `${base}#${n}`;
  });
}

const fmt = (n: number) => n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function parseLedenReport(items: PdfTextItem[]): ExternalReport {
  const warnings: string[] = [];
  const meta = readMeta(items);
  const { rows: raw, periodTotal } = readTable(items);

  if (raw.length === 0) {
    return {
      meta,
      rows: [],
      warnings: ["No se encontró la tabla de registros. ¿Es un informe de actividad de Leden Company?"],
    };
  }

  const rows: ExternalRow[] = [];
  const descriptions: string[] = [];
  for (const r of raw) {
    const row = toRow(r);
    if (typeof row === "string") warnings.push(row);
    else {
      rows.push(row);
      descriptions.push(r.DESCRIPTOR);
    }
  }
  assignExternalIds(rows, descriptions);

  if (meta.declaredHours === null && periodTotal !== null) meta.declaredHours = periodTotal;
  const total = Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100;
  if (meta.declaredRecords !== null && rows.length !== meta.declaredRecords) {
    warnings.push(`Se leyeron ${rows.length} de ${meta.declaredRecords} registros del informe.`);
  }
  if (meta.declaredHours !== null && Math.abs(total - meta.declaredHours) > 0.001) {
    warnings.push(`Las horas leídas (${fmt(total)} h) no cuadran con el total del informe (${fmt(meta.declaredHours)} h).`);
  }

  return { meta, rows, warnings };
}
