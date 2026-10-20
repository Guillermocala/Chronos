// Fuente única de las reglas de dictado. La usan el parser (lib/granola/parse.ts),
// la Guía de dictado (/guide) y sus plantillas, así que cambiar algo aquí lo
// cambia en todas partes. Un test verifica que todos los ejemplos se interpreten
// sin advertencias.

export type SectionType = "task" | "follow_up" | "ticket" | "notes";

/** Encabezados `##` reconocidos (sin tildes ni mayúsculas). */
export const SECTION_ALIASES: Record<SectionType, string[]> = {
  task: ["tareas", "tarea", "pendientes", "to-do", "todo", "to do", "acciones", "action items", "tasks"],
  follow_up: ["seguimientos", "seguimiento", "follow-ups", "follow ups", "followups", "esperando", "waiting"],
  ticket: ["tickets", "ticket", "trabajo", "desarrollo"],
  notes: ["notas", "nota", "notes", "resumen", "contexto", "summary"],
};

export const SECTION_LABELS: Record<SectionType, string> = {
  task: "## Tareas",
  follow_up: "## Seguimientos",
  ticket: "## Tickets",
  notes: "## Notas",
};

/** Títulos de nota que la marcan como dictado de "Mi día" (planned_on = fecha de la nota). */
export const MY_DAY_TITLES = ["mi dia", "my day"];

export const PRIORITY_WORDS: Record<string, 1 | 2 | 3> = {
  alta: 1,
  urgente: 1,
  high: 1,
  media: 2,
  medium: 2,
  baja: 3,
  low: 3,
};

export const DATE_WORDS = [
  "hoy",
  "mañana",
  "pasado-mañana",
  "lunes … domingo (el próximo)",
  "en-3-dias",
  "25/10",
  "25/10/2026",
  "2026-10-25",
];

export type Marker = { marker: string; meaning: string; example: string };

export const MARKERS: Marker[] = [
  { marker: "@PREFIJO", meaning: "Proyecto, por su prefijo de tickets", example: "@WEB" },
  { marker: "!fecha", meaning: "Fecha límite (sin espacios: usa guiones)", example: "!mañana · !viernes · !25/10" },
  { marker: "#alta / #media / #baja", meaning: "Prioridad (por defecto media)", example: "#alta" },
  { marker: "#etiqueta", meaning: "Cualquier otra etiqueta libre", example: "#personal #admin" },
  { marker: "(esperando: Nombre)", meaning: "Lo convierte en seguimiento: esperas algo de esa persona", example: "(esperando: Ana)" },
  { marker: "~3h", meaning: "Horas estimadas (para tickets)", example: "~2.5h" },
  { marker: "Enlace de Google Docs/Drive", meaning: "Se guarda como documento de la tarea", example: "https://docs.google.com/document/d/…" },
];

export type DictationExample = { spoken: string; line: string; section: SectionType };

/** Frases en voz natural y la línea que Granola debería escribir. */
export const DICTATION_EXAMPLES: DictationExample[] = [
  {
    spoken: "Tarea para el proyecto WEB, prioridad alta, para mañana: ajustar el formulario de contacto.",
    line: "- [ ] Ajustar el formulario de contacto @WEB !mañana #alta",
    section: "task",
  },
  {
    spoken: "Tarea personal para hoy: llamar al contador.",
    line: "- [ ] Llamar al contador !hoy #personal",
    section: "task",
  },
  {
    spoken: "Seguimiento: espero la respuesta de Ana sobre la cotización de WEB, revisar el viernes.",
    line: "- [ ] Respuesta sobre la cotización @WEB !viernes (esperando: Ana)",
    section: "follow_up",
  },
  {
    spoken: "Ticket para WEB de tres horas: maquetar la página de servicios.",
    line: "- [ ] Maquetar la página de servicios @WEB ~3h",
    section: "ticket",
  },
];

/** Prefijo de ejemplo usado en plantillas y ejemplos. */
export const EXAMPLE_PREFIX = "WEB";

function sectionBlock(type: SectionType, lines: string[]): string {
  return [SECTION_LABELS[type], ...lines].join("\n");
}

function examplesFor(type: SectionType): string[] {
  return DICTATION_EXAMPLES.filter((e) => e.section === type).map((e) => e.line);
}

export function myDayTemplate(date: string): string {
  return [
    `# Mi día — ${date}`,
    "",
    sectionBlock("task", examplesFor("task")),
    "",
    sectionBlock("follow_up", examplesFor("follow_up")),
    "",
    sectionBlock("ticket", examplesFor("ticket")),
    "",
    sectionBlock("notes", ["Contexto libre; esta sección no crea ítems."]),
    "",
  ].join("\n");
}

export function meetingTemplate(date: string): string {
  return [
    "---",
    `date: ${date}`,
    "---",
    `# Reunión con cliente @${EXAMPLE_PREFIX}`,
    "",
    sectionBlock("notes", ["- Puntos discutidos…"]),
    "",
    sectionBlock("task", ["- [ ] Enviar propuesta actualizada @WEB !viernes #alta"]),
    "",
    sectionBlock("follow_up", ["- [ ] Aprobación del diseño @WEB !en-3-dias (esperando: Ana)"]),
    "",
    sectionBlock("ticket", ["- [ ] Ajustar el menú en móvil @WEB ~2h"]),
    "",
  ].join("\n");
}

/** Texto para pegar como instrucciones de plantilla en Granola. */
export const GRANOLA_INSTRUCTIONS = `Escribe la nota en español y en Markdown con esta estructura exacta:

1. Un título "# Mi día — AAAA-MM-DD" si estoy planificando mi día, o "# <tema de la reunión>" si es una reunión. Para reuniones, agrega al inicio un bloque:
---
date: AAAA-MM-DD
---

2. Estas secciones, solo si tienen contenido y con estos nombres exactos:
## Tareas        → cosas que yo debo hacer
## Seguimientos  → cosas que espero de otra persona
## Tickets       → trabajo de desarrollo para un proyecto
## Notas         → resumen y contexto (no crea pendientes)

3. En Tareas, Seguimientos y Tickets, cada ítem es una línea "- [ ] " con un título corto que empiece con un verbo, seguido de estos marcadores cuando los mencione:
- @PREFIJO del proyecto en mayúsculas (por ejemplo @WEB).
- !fecha sin espacios: !hoy, !mañana, !pasado-mañana, !viernes, !en-3-dias, !25/10.
- #alta, #media o #baja para la prioridad; #etiqueta para otras categorías (#personal, #admin).
- (esperando: Nombre) cuando espero algo de alguien.
- ~3h cuando mencione horas estimadas.
- Los enlaces de Google Docs o Drive completos, tal cual.

No inventes fechas, proyectos ni prioridades que no haya dicho. No agregues texto fuera de las secciones.`;
