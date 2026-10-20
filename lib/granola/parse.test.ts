import { describe, expect, it } from "vitest";

import {
  DICTATION_EXAMPLES,
  EXAMPLE_PREFIX,
  meetingTemplate,
  myDayTemplate,
} from "./conventions";
import { parseDictation, parseLine } from "./parse";

const projects = [
  { id: "p-web", code_prefix: EXAMPLE_PREFIX },
  { id: "p-acm", code_prefix: "ACM" },
];
const today = "2026-10-23"; // viernes
const ctx = { projects, today };

describe("parseLine", () => {
  it("interpreta todos los marcadores", () => {
    const item = parseLine(
      "Ajustar formulario @web !mañana #alta #cliente ~2,5h https://docs.google.com/document/d/abc/edit?usp=sharing",
      { ...ctx, defaultType: "ticket" },
    );
    expect(item).toMatchObject({
      type: "ticket",
      title: "Ajustar formulario",
      projectId: "p-web",
      projectPrefix: "WEB",
      due_date: "2026-10-24",
      priority: 1,
      tags: ["cliente"],
      estimated_hours: 2.5,
      doc_url: "https://docs.google.com/document/d/abc/edit",
      doc_kind: "doc",
      warnings: [],
    });
  });

  it("(esperando: X) lo convierte en seguimiento", () => {
    const item = parseLine("Respuesta de la cotización (esperando: Ana María) !viernes", ctx);
    expect(item).toMatchObject({
      type: "follow_up",
      waiting_on: "Ana María",
      title: "Respuesta de la cotización",
      due_date: "2026-10-30",
    });
  });

  it("sin marcadores queda como tarea de prioridad media", () => {
    expect(parseLine("Llamar al contador", ctx)).toMatchObject({
      type: "task",
      title: "Llamar al contador",
      priority: 2,
      projectId: null,
      due_date: null,
      tags: [],
    });
  });

  it("advierte prefijos y fechas desconocidos sin fallar", () => {
    const item = parseLine("Revisar algo @XYZ !algundia", ctx);
    expect(item.title).toBe("Revisar algo");
    expect(item.projectId).toBeNull();
    expect(item.warnings).toEqual([
      "El proyecto @XYZ no existe.",
      'No entendí la fecha "!algundia".',
    ]);
  });

  it("no confunde correos, signos ni enlaces normales con marcadores", () => {
    const item = parseLine("Escribir a ana@correo.com ¡urgente! ver https://example.com", ctx);
    expect(item.title).toBe("Escribir a ana@correo.com ¡urgente! ver https://example.com");
    expect(item.warnings).toEqual([]);
  });

  it("advierte una línea sin título", () => {
    expect(parseLine("@WEB !hoy", ctx).warnings).toContain("La línea no tiene título.");
  });
});

describe("parseDictation", () => {
  it("dictado de Mi día: secciones, tipos y planned_on", () => {
    const result = parseDictation(
      [
        "# Mi día — 2026-10-23",
        "## Tareas",
        "- [ ] Llamar al contador !hoy #personal",
        "- [x] Ya hecho",
        "- Revisar correo",
        "## Seguimientos",
        "- [ ] Aprobación del logo @ACM",
        "## Tickets",
        "- [ ] Maquetar servicios @WEB ~3h",
        "## Notas",
        "- [ ] Esto no crea nada",
      ].join("\n"),
      ctx,
    );
    expect(result.isMyDay).toBe(true);
    expect(result.date).toBe("2026-10-23");
    expect(result.skippedDone).toBe(1);
    expect(result.items.map((i) => [i.type, i.title, i.planned_on])).toEqual([
      ["task", "Llamar al contador", "2026-10-23"],
      ["task", "Revisar correo", "2026-10-23"],
      ["follow_up", "Aprobación del logo", "2026-10-23"],
      ["ticket", "Maquetar servicios", null],
    ]);
  });

  it("nota de reunión: fecha del front-matter, sin planned_on y fechas relativas a la reunión", () => {
    const result = parseDictation(
      ["---", "date: 2026-10-20", "---", "# Reunión semanal", "## Action items", "- [ ] Enviar acta !mañana"].join("\n"),
      ctx,
    );
    expect(result).toMatchObject({ title: "Reunión semanal", date: "2026-10-20", isMyDay: false });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ planned_on: null, due_date: "2026-10-21" });
  });

  it("sin secciones solo toma casillas", () => {
    const result = parseDictation(
      ["Notas sueltas", "- una idea", "- [ ] Una tarea real", "1. [ ] Otra numerada"].join("\n"),
      ctx,
    );
    expect(result.items.map((i) => i.title)).toEqual(["Una tarea real", "Otra numerada"]);
    expect(result.date).toBe(today);
  });

  it("conserva los enlaces de Drive escritos como link Markdown", () => {
    const result = parseDictation(
      "## Tareas\n- [ ] Revisar [el brief](https://drive.google.com/drive/folders/xyz?usp=sharing) @WEB",
      ctx,
    );
    expect(result.items[0]).toMatchObject({
      title: "Revisar el brief",
      doc_url: "https://drive.google.com/drive/folders/xyz",
      doc_kind: "folder",
    });
  });
});

describe("sincronía con la guía", () => {
  it("cada ejemplo de dictado se interpreta sin advertencias", () => {
    for (const example of DICTATION_EXAMPLES) {
      const item = parseLine(example.line.replace(/^- \[ \] /, ""), {
        ...ctx,
        defaultType: example.section === "notes" ? "task" : example.section,
      });
      expect(item.warnings, example.line).toEqual([]);
      expect(item.type, example.line).toBe(example.section);
    }
  });

  it("las plantillas producen ítems válidos", () => {
    for (const template of [myDayTemplate(today), meetingTemplate(today)]) {
      const result = parseDictation(template, ctx);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.flatMap((i) => i.warnings)).toEqual([]);
    }
  });
});
