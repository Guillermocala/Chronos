import { describe, expect, it } from "vitest";

import type { PdfTextItem } from "../types";
import { parseHours, parseLedenReport, parseSpanishDate, slugTag } from "./parse";

// Informe sintético con la misma geometría que el PDF de Leden (el real tiene
// datos personales y el repositorio es público).
const X = { FECHA: 43, PROYECTO: 112, CLIENTE: 210, TIPO: 296, "INTERLOC.": 380, "FACT.": 450, HORAS: 496, DESCRIPTOR: 549 };

type Row = { date: string; project: string[]; client: string; type: string[]; who: string; fact: string; hours: string; desc: string[] };

function header(page: number, y: number): PdfTextItem[] {
  return Object.entries(X).map(([str, x]) => ({ str, x, y, page }));
}

function row(page: number, y: number, r: Row): PdfTextItem[] {
  const lines = (col: number, parts: string[]) => parts.map((str, i) => ({ str, x: col, y: y - 11 * i, page }));
  return [
    { str: r.date, x: X.FECHA, y, page },
    ...lines(X.PROYECTO, r.project),
    { str: r.client, x: X.CLIENTE, y, page },
    ...lines(X.TIPO, r.type),
    { str: r.who, x: X["INTERLOC."], y, page },
    { str: r.fact, x: X["FACT."], y, page },
    { str: r.hours.split(" ")[0], x: 513.8, y, page },
    { str: "h", x: 534.8, y, page },
    ...lines(X.DESCRIPTOR, r.desc),
  ];
}

const PE = ["Proyecto Uno -", "Fase 2"];
const ROWS: Row[] = [
  { date: "1 oct 2026", project: PE, client: "Cliente A", type: ["Gestión y", "coordinación"], who: "Cliente", fact: "Sí", hours: "1,00 h", desc: ["Weekly con el cliente"] },
  { date: "1 oct 2026", project: PE, client: "Cliente A", type: ["Reunión"], who: "Equipo", fact: "Sí", hours: "0,50 h", desc: ["Daily con el equipo"] },
  { date: "1 oct 2026", project: PE, client: "Cliente A", type: ["Reunión"], who: "Equipo", fact: "Sí", hours: "0,50 h", desc: ["Daily con el equipo"] },
  { date: "23 oct 2026", project: ["Interno SAS"], client: "Interno", type: ["Formación"], who: "Equipo", fact: "No", hours: "0,25 h", desc: ["[INICIATIVA ORIÓN] Reunión de vínculo. Revisión", "de accesos"] },
  { date: "30 oct 2026", project: PE, client: "Cliente A", type: ["Producción /", "Entregable"], who: "Individual", fact: "Sí", hours: "2,25 h", desc: ["Seguimiento a solicitud de insumos (portafolios", "y documentos; estos docs se referenciaban en", "los enviados)"] },
];

function report({ rows = ROWS, records = ROWS.length, total = "4,50 h" } = {}): PdfTextItem[] {
  const items: PdfTextItem[] = [
    { str: "Leden Company", x: 86, y: 549, page: 1 },
    { str: "INF-2026-10-01-2026-10-31", x: 560, y: 532, page: 1 },
    { str: "PERSONA", x: 38, y: 500, page: 1 },
    { str: "Persona de Prueba", x: 38, y: 488, page: 1 },
    { str: "CORREO", x: 428, y: 500, page: 1 },
    { str: "persona@example.com", x: 428, y: 488, page: 1 },
    { str: "ORGANIZACIÓN", x: 38, y: 470, page: 1 },
    { str: "Empresa", x: 38, y: 458, page: 1 },
    { str: "PERIODO", x: 428, y: 470, page: 1 },
    { str: "1 oct 2026 – 31 oct 2026", x: 428, y: 458, page: 1 },
    { str: "TOTAL", x: 50, y: 414, page: 1 },
    { str: total, x: 50, y: 386, page: 1 },
    { str: `${records} registros`, x: 50, y: 369, page: 1 },
    { str: "Generado el 01/11/2026, 14:13 (America/Bogota) · Página 1 de 3", x: 38, y: 20, page: 1 },
    // Página 2: tres registros.
    ...header(2, 533),
    ...rows.slice(0, 3).flatMap((r, i) => row(2, 515 - 30 * i, r)),
    { str: "Generado el 01/11/2026 · Página 2 de 3", x: 38, y: 20, page: 2 },
    // Página 3: el resto, total y firma.
    ...header(3, 545),
    ...rows.slice(3).flatMap((r, i) => row(3, 527 - 50 * i, r)),
    { str: "Total del periodo", x: 43, y: 300, page: 3 },
    { str: total, x: 505, y: 300, page: 3 },
    { str: "Firma del trabajador", x: 560, y: 200, page: 3 },
    { str: "Persona de Prueba", x: 560, y: 188, page: 3 },
    { str: "Generado el 01/11/2026 · Página 3 de 3", x: 38, y: 20, page: 3 },
  ];
  // pdf.js no garantiza el orden: se baraja para probar que no depende de él.
  return items.reverse();
}

describe("utilidades", () => {
  it("lee fechas en español", () => {
    expect(parseSpanishDate("1 oct 2026")).toBe("2026-10-01");
    expect(parseSpanishDate("28 dic 2026")).toBe("2026-12-28");
    expect(parseSpanishDate("3 sept 2026")).toBe("2026-09-03");
    expect(parseSpanishDate("Total")).toBeNull();
  });

  it("lee horas con coma decimal", () => {
    expect(parseHours("1,50 h")).toBe(1.5);
    expect(parseHours("80,00")).toBe(80);
    expect(parseHours("1.234,50 h")).toBe(1234.5);
    expect(parseHours("h")).toBeNull();
  });

  it("convierte el tipo en etiqueta", () => {
    expect(slugTag("Producción / Entregable")).toBe("produccion-entregable");
    expect(slugTag("Gestión y coordinación")).toBe("gestion-coordinacion");
    expect(slugTag("INICIATIVA ORIÓN")).toBe("iniciativa-orion");
  });
});

describe("parseLedenReport", () => {
  const r = parseLedenReport(report());

  it("lee el encabezado", () => {
    expect(r.meta).toEqual({
      code: "INF-2026-10-01-2026-10-31",
      person: "Persona de Prueba",
      email: "persona@example.com",
      organization: "Empresa",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      declaredHours: 4.5,
      declaredRecords: 5,
    });
    expect(r.warnings).toEqual([]);
  });

  it("lee todas las filas a través de las páginas", () => {
    expect(r.rows).toHaveLength(5);
    expect(r.rows.map((x) => x.date)).toEqual(["2026-10-01", "2026-10-01", "2026-10-01", "2026-10-23", "2026-10-30"]);
    expect(r.rows.reduce((s, x) => s + x.hours, 0)).toBe(4.5);
  });

  it("une textos partidos en varias líneas", () => {
    expect(r.rows[0].externalProject).toBe("Proyecto Uno - Fase 2");
    expect(r.rows[0].details.type).toBe("Gestión y coordinación");
    expect(r.rows[4].title).toBe(
      "Seguimiento a solicitud de insumos (portafolios y documentos; estos docs se referenciaban en los enviados)",
    );
  });

  it("separa la etiqueta entre corchetes y marca los no facturables", () => {
    const orion = r.rows[3];
    expect(orion.title).toBe("Reunión de vínculo. Revisión de accesos");
    expect(orion.tags).toEqual(["leden", "iniciativa-orion", "formacion"]);
    expect(orion.billable).toBe(false);
    expect(orion.notes).toContain("No facturable");
    expect(r.rows[0].notes).toBe(
      "Leden · Proyecto Uno - Fase 2 · Cliente: Cliente A · Gestión y coordinación · Interlocutor: Cliente · Facturable",
    );
  });

  it("da huellas únicas y estables", () => {
    const ids = r.rows.map((x) => x.externalId);
    expect(new Set(ids).size).toBe(5);
    expect(ids[1]).toBe("leden|2026-10-01|proyecto uno - fase 2|0.50|daily con el equipo");
    expect(ids[2]).toBe(`${ids[1]}#2`);
    expect(parseLedenReport(report()).rows.map((x) => x.externalId)).toEqual(ids);
  });

  it("avisa cuando no cuadra con el informe", () => {
    const missing = parseLedenReport(report({ records: 6, total: "5,00 h" }));
    expect(missing.warnings).toEqual([
      "Se leyeron 5 de 6 registros del informe.",
      "Las horas leídas (4,50 h) no cuadran con el total del informe (5,00 h).",
    ]);
  });

  it("rechaza un PDF que no es el informe", () => {
    const other = parseLedenReport([{ str: "Factura", x: 10, y: 10, page: 1 }]);
    expect(other.rows).toEqual([]);
    expect(other.warnings[0]).toMatch(/No se encontró la tabla/);
  });
});
