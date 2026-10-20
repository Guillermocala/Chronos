// CSV para abrir directo en Excel con configuración de Colombia:
// separador ";", decimales con coma y BOM UTF-8 (para tildes).

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

const NEEDS_QUOTES = /[;"\r\n]/;
// Evita "inyección de fórmulas": Excel ejecuta celdas que empiezan con = + - @.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value).replace(".", ",") : "";
  let text = FORMULA_START.test(value) ? `'${value}` : value;
  if (NEEDS_QUOTES.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => cell(c.header)).join(";"),
    ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
