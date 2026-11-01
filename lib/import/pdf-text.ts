// Extrae los textos de un PDF con su posición, en el navegador (el archivo no
// sale del equipo). pdf.js se carga solo cuando se usa.

import type { PdfTextItem } from "./types";

let workerPort: Worker | null = null;

export async function extractPdfText(file: File): Promise<PdfTextItem[]> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerPort) {
    workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    pdfjs.GlobalWorkerOptions.workerPort = workerPort;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const doc = await task.promise;
    const items: PdfTextItem[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        items.push({
          str: it.str,
          x: Math.round(it.transform[4] * 10) / 10,
          y: Math.round(it.transform[5] * 10) / 10,
          page,
        });
      }
    }
    return items;
  } finally {
    await task.destroy();
  }
}
