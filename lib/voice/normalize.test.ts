import { describe, expect, it } from "vitest";

import { interpretSpoken, normalizeSpoken } from "./normalize";
import { VOICE_EXAMPLES } from "./vocabulary";

const projects = [
  { id: "p-web", code_prefix: "WEB", name: "Sitio web" },
  { id: "p-acm", code_prefix: "ACM", name: "Acme Consulting" },
];
const today = "2026-10-23"; // viernes
const ctx = { projects, today };

const summary = (spoken: string, extra: Partial<Parameters<typeof interpretSpoken>[1]> = {}) =>
  interpretSpoken(spoken, { ...ctx, ...extra }).items.map((i) => ({
    type: i.type,
    title: i.title,
    project: i.projectPrefix,
    hours: i.estimated_hours,
    due: i.due_date,
    planned: i.planned_on,
    priority: i.priority,
    waiting: i.waiting_on,
    warnings: i.warnings,
  }));

describe("dictado de Mi día", () => {
  it("separa tareas, detecta proyecto y duraciones, y las pone en Mi día", () => {
    expect(
      summary(
        "para mi día de hoy voy a revisar la propuesta del proyecto web dos horas y luego llamar al contador media hora",
      ),
    ).toEqual([
      { type: "task", title: "Revisar la propuesta", project: "WEB", hours: 2, due: null, planned: today, priority: 2, waiting: null, warnings: [] },
      { type: "task", title: "Llamar al contador", project: null, hours: 0.5, due: null, planned: today, priority: 2, waiting: null, warnings: [] },
    ]);
  });

  it("las duraciones separadas por comas completan la tarea anterior", () => {
    const items = summary("Hoy voy a revisar la propuesta, dos horas, llamar al contador, media hora.");
    expect(items.map((i) => [i.title, i.hours])).toEqual([
      ["Revisar la propuesta", 2],
      ["Llamar al contador", 0.5],
    ]);
  });

  it("mañana voy a… planifica para mañana", () => {
    expect(summary("mañana voy a preparar la demo una hora")[0]).toMatchObject({
      planned: "2026-10-24",
      hours: 1,
      title: "Preparar la demo",
    });
  });
});

describe("duraciones", () => {
  it.each([
    ["revisar código hora y cuarto", 1.25],
    ["revisar código una hora y media", 1.5],
    ["revisar código dos horas y media", 2.5],
    ["revisar código 45 minutos", 0.75],
    ["revisar código cuarenta y cinco minutos", 0.75],
    ["revisar código tres cuartos de hora", 0.75],
    ["revisar código dos horas y treinta minutos", 2.5],
    ["revisar código durante unas tres horas", 3],
  ])("%s → %s h", (spoken, hours) => {
    const [item] = summary(spoken);
    expect(item.hours).toBe(hours);
    expect(item.title).toBe("Revisar código");
  });
});

describe("fechas, prioridad, seguimientos y tickets", () => {
  it("fechas relativas y prioridad", () => {
    expect(summary("enviar la cuenta de cobro para el viernes prioridad alta")[0]).toMatchObject({
      title: "Enviar la cuenta de cobro",
      due: "2026-10-30",
      priority: 1,
    });
    expect(summary("pagar el hosting el 5 de noviembre urgente")[0]).toMatchObject({ due: "2026-11-05", priority: 1 });
    expect(summary("revisar contrato en tres días")[0].due).toBe("2026-10-26");
  });

  it("'en la mañana' no es una fecha", () => {
    expect(summary("hacer ejercicio en la mañana")[0]).toMatchObject({ due: null, title: "Hacer ejercicio" });
  });

  it("esperando a alguien lo vuelve seguimiento", () => {
    expect(summary("respuesta de la cotización esperando a ana para el lunes")[0]).toMatchObject({
      type: "follow_up",
      waiting: "Ana",
      due: "2026-10-26",
      title: "Respuesta de la cotización",
    });
  });

  it("ticket con proyecto y horas", () => {
    expect(summary("ticket para el proyecto web de tres horas: maquetar la página de contacto")[0]).toMatchObject({
      type: "ticket",
      project: "WEB",
      hours: 3,
      title: "Maquetar la página de contacto",
    });
  });

  it("proyecto por nombre parcial o prefijo, y advertencia si no existe", () => {
    expect(summary("preparar informe del proyecto acme")[0].project).toBe("ACM");
    expect(summary("preparar informe para ACM")[0].project).toBe("ACM");
    const [missing] = summary("preparar informe del proyecto zeta");
    expect(missing.project).toBe("ZETA");
    expect(missing.warnings).toContain("El proyecto @ZETA no existe.");
  });

  it("proyecto por defecto (dictado desde un proyecto)", () => {
    expect(summary("revisar pruebas una hora", { defaultProjectId: "p-acm" })[0].project).toBe("ACM");
  });
});

describe("listas dictadas", () => {
  it("primero… segundo… por último…", () => {
    expect(
      summary("primero revisar correos media hora segundo llamar a pedro y por último preparar la factura una hora").map(
        (i) => [i.title, i.hours],
      ),
    ).toEqual([
      ["Revisar correos", 0.5],
      ["Llamar a pedro", null],
      ["Preparar la factura", 1],
    ]);
  });
});

describe("limpieza", () => {
  it("quita muletillas y conectores", () => {
    expect(normalizeSpoken("eh bueno tengo que revisar los correos", ctx).lines).toEqual([
      { text: "Revisar los correos", type: "task" },
    ]);
  });

  it("texto vacío no crea ítems", () => {
    expect(normalizeSpoken("   eh   ", ctx).lines).toEqual([]);
  });
});

describe("sincronía con la guía", () => {
  it("cada ejemplo de voz se interpreta sin advertencias", () => {
    for (const example of VOICE_EXAMPLES) {
      const { items } = interpretSpoken(example.spoken, ctx);
      expect(items.length, example.spoken).toBeGreaterThan(0);
      expect(items.flatMap((i) => i.warnings), example.spoken).toEqual([]);
      expect(items.every((i) => i.title.length > 0), example.spoken).toBe(true);
    }
  });
});
