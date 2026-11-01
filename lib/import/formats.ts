// Formatos de "Cargar datos". Para agregar uno nuevo: su lector puro en
// lib/import/<formato>/parse.ts y una entrada aquí.

import { parseLedenReport } from "./leden/parse";
import type { ExternalReport, PdfTextItem } from "./types";

export type ImportFormat = {
  id: "leden";
  label: string;
  description: string;
  accept: string;
  parse: (items: PdfTextItem[]) => ExternalReport;
};

export const IMPORT_FORMATS: ImportFormat[] = [
  {
    id: "leden",
    label: "Leden Company",
    description: "Informe de actividad en PDF (informe-actividad-AAAA-MM-DD-AAAA-MM-DD.pdf).",
    accept: "application/pdf,.pdf",
    parse: parseLedenReport,
  },
];

export type ImportFormatId = ImportFormat["id"];

export function findFormat(id: string | undefined): ImportFormat {
  return IMPORT_FORMATS.find((f) => f.id === id) ?? IMPORT_FORMATS[0];
}
