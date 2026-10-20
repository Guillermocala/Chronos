import { createHash } from "node:crypto";

import type { Row } from "./types";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** JSON determinista: filas ordenadas por id y claves ordenadas, con salto final. */
export function stableJson(rows: Row[]): string {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return `${JSON.stringify(sortKeys(sorted), null, 2)}\n`;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Hash de un conjunto de archivos (nombre → contenido), independiente del orden. */
export function bundleHash(files: Record<string, string>): string {
  return sha256(
    Object.keys(files)
      .sort()
      .map((name) => `${name}\n${files[name]}`)
      .join("\n"),
  );
}
