import type { Enums } from "@/lib/supabase/database.types";

export type DocKind = Enums<"doc_kind">;

const KIND_BY_PATH: [RegExp, DocKind][] = [
  [/^\/document\/d\//, "doc"],
  [/^\/spreadsheets\/d\//, "sheet"],
  [/^\/presentation\/d\//, "slides"],
  [/^\/drive\/(u\/\d+\/)?folders\//, "folder"],
  [/^\/file\/d\//, "file"],
];

/**
 * Valida un enlace de Google Docs/Drive y deduce su tipo. Quita parámetros de
 * rastreo (`usp`, etc.). Devuelve null si no es un enlace de Google reconocido.
 */
export function parseDriveUrl(input: string): { url: string; kind: DocKind } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "docs.google.com" && url.hostname !== "drive.google.com") {
    return null;
  }
  const match = KIND_BY_PATH.find(([re]) => re.test(url.pathname));
  if (!match) return null;
  url.search = "";
  url.hash = "";
  return { url: url.toString(), kind: match[1] };
}

export function isDriveFolderUrl(input: string): boolean {
  return parseDriveUrl(input)?.kind === "folder";
}
