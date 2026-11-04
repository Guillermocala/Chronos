// Convierte lo dicho en voz natural a la sintaxis de marcadores del dictado
// (@PREFIJO, !fecha, #prioridad, ~Nh, (esperando: X)) y la interpreta con
// parseLine. Es puro: corre en el navegador sin servidor.

import { addDays, type ISODate } from "@/lib/dates";
import { parseLine, type ItemType, type ParsedItem } from "@/lib/granola/parse";

import { FILLERS, ITEM_SEPARATORS, MONTHS, NUMBER_WORDS } from "./vocabulary";

export type VoiceProject = { id: string; code_prefix: string; name: string };

export type SpokenLine = {
  text: string;
  type: ItemType;
  /** Dicha dentro de un bloque "personal": no hereda el proyecto por defecto. */
  personal?: boolean;
};

export type NormalizedSpeech = {
  lines: SpokenLine[];
  /** Día planificado ("para mi día de hoy", "mañana voy a…"), si se dijo. */
  plannedOn: ISODate | null;
};

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Números: dígitos o palabras (las compuestas primero para que ganen).
const NUM_WORDS = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length);
const NUM = `(\\d+(?:[.,]\\d+)?|${NUM_WORDS.map(escape).join("|")})`;

function toNumber(token: string): number {
  const key = strip(token.trim());
  return key in NUMBER_WORDS ? NUMBER_WORDS[key] : Number(key.replace(",", "."));
}

const FRACTION: Record<string, number> = { media: 0.5, cuarto: 0.25 };

/** Palabras que pueden anteceder a una duración y se descartan con ella. */
const DURATION_LEAD = "(?:(?:de|durante|por|unas?|aprox(?:imadamente)?|como|estimad[oa]s?(?:\\s+en)?|en)\\s+)*";

type Rule = { re: RegExp; hours: (m: RegExpExecArray) => number };

// Orden: de lo más específico a lo más general.
const DURATION_RULES: Rule[] = [
  { re: new RegExp(`${NUM}\\s+horas?\\s+y\\s+(media|cuarto)`, "i"), hours: (m) => toNumber(m[1]) + FRACTION[strip(m[2])] },
  { re: new RegExp(`${NUM}\\s+horas?\\s+y\\s+${NUM}\\s*(?:minutos?|min)?`, "i"), hours: (m) => toNumber(m[1]) + toNumber(m[2]) / 60 },
  { re: new RegExp(`${NUM}\\s+horas?\\s+${NUM}\\s*(?:minutos?|min)?`, "i"), hours: (m) => toNumber(m[1]) + toNumber(m[2]) / 60 },
  { re: /(?:una\s+)?hora\s+y\s+(media|cuarto)/i, hours: (m) => 1 + FRACTION[strip(m[1])] },
  { re: /tres\s+cuartos\s+de\s+hora/i, hours: () => 0.75 },
  { re: /media\s+hora/i, hours: () => 0.5 },
  { re: /(?:un\s+)?cuarto\s+de\s+hora/i, hours: () => 0.25 },
  { re: new RegExp(`${NUM}\\s+horas?`, "i"), hours: (m) => toNumber(m[1]) },
  { re: new RegExp(`${NUM}\\s*(?:minutos?|min)\\b`, "i"), hours: (m) => toNumber(m[1]) / 60 },
];

/** Reemplaza la primera duración dicha por ~Nh. */
function extractDuration(text: string): { text: string; hours: number | null } {
  for (const rule of DURATION_RULES) {
    const re = new RegExp(`(^|[\\s,:])${DURATION_LEAD}${rule.re.source}(?=$|[\\s,.;:])`, "i");
    const m = re.exec(text);
    if (!m) continue;
    // Los grupos de la regla empiezan después del separador inicial.
    const inner = rule.re.exec(m[0]);
    if (!inner) continue;
    const hours = Math.round(rule.hours(inner) * 100) / 100;
    if (!(hours > 0 && hours <= 24)) continue;
    return { text: `${text.slice(0, m.index)}${m[1]} ${text.slice(m.index + m[0].length)}`, hours };
  }
  return { text, hours: null };
}

const WEEKDAYS = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo";
const MONTH_NAMES = Object.keys(MONTHS).join("|");

/** Reemplaza la primera fecha dicha por !token (la interpreta parseSpanishDate). */
function extractDate(text: string): { text: string; token: string | null } {
  // "en la mañana" / "por la mañana" es momento del día, no fecha.
  const cleaned = text.replace(/\b(?:en|por|de)\s+la\s+mañana\b/gi, " ");
  const rules: [RegExp, (m: RegExpExecArray) => string][] = [
    [new RegExp(`\\b(?:para\\s+)?(?:el\\s+)?${NUM}\\s+de\\s+(${MONTH_NAMES})\\b`, "i"), (m) => `${toNumber(m[1])}/${MONTHS[strip(m[2])]}`],
    [/\b(?:para\s+)?pasado\s+mañana\b/i, () => "pasado-mañana"],
    [/\b(?:para\s+)?mañana\b/i, () => "mañana"],
    [/\bpara\s+hoy\b/i, () => "hoy"],
    [new RegExp(`\\ben\\s+${NUM}\\s+d[ií]as?\\b`, "i"), (m) => `en-${toNumber(m[1])}-dias`],
    [new RegExp(`\\b(?:para\\s+)?(?:el\\s+)?(?:pr[oó]ximo\\s+)?(${WEEKDAYS})\\b`, "i"), (m) => strip(m[1])],
  ];
  for (const [re, token] of rules) {
    const m = re.exec(cleaned);
    if (m) return { text: cleaned.slice(0, m.index) + " " + cleaned.slice(m.index + m[0].length), token: token(m) };
  }
  return { text: cleaned, token: null };
}

function extractPriority(text: string): { text: string; tag: string | null } {
  const rules: [RegExp, string][] = [
    [/\b(?:con\s+)?prioridad\s+(alta|media|baja)\b/i, ""],
    [/\b(?:es\s+)?(urgente|important[ea]|prioritari[oa])\b/i, "alta"],
  ];
  for (const [re, fixed] of rules) {
    const m = re.exec(text);
    if (m) return { text: text.replace(m[0], " "), tag: fixed || strip(m[1]) };
  }
  return { text, tag: null };
}

/** Busca el proyecto por prefijo o nombre a partir de las palabras dichas. */
function matchProject(words: string[], projects: VoiceProject[]): { prefix: string; used: number } | null {
  for (let n = Math.min(4, words.length); n >= 1; n--) {
    const phrase = strip(words.slice(0, n).join(" ")).replace(/[^\p{L}\p{N} ]/gu, "").trim();
    if (!phrase) continue;
    const exact = projects.find((p) => strip(p.code_prefix) === phrase || strip(p.name) === phrase);
    if (exact) return { prefix: exact.code_prefix, used: n };
    if (phrase.length >= 3) {
      const partial = projects.filter((p) => strip(p.name).startsWith(phrase));
      if (partial.length === 1) return { prefix: partial[0].code_prefix, used: n };
    }
  }
  return null;
}

function extractProject(text: string, projects: VoiceProject[]): { text: string; marker: string | null } {
  // "para el proyecto X", "del proyecto X", "en el proyecto X", o "para WEB" con un prefijo exacto.
  const withWord = /\b(?:para|de|del|en)\s+(?:el\s+)?proyecto\s+(.+)$/i.exec(text);
  if (withWord) {
    const words = withWord[1].split(/\s+/);
    const found = matchProject(words, projects);
    const used = found?.used ?? 1;
    const rest = words.slice(used).join(" ");
    const marker = `@${found?.prefix ?? strip(words[0]).replace(/[^a-z0-9]/g, "").slice(0, 10).toUpperCase()}`;
    return { text: `${text.slice(0, withWord.index)} ${rest}`, marker };
  }
  for (const p of projects) {
    const re = new RegExp(`\\b(?:para|de|del|en)\\s+${escape(p.code_prefix)}\\b`, "i");
    const m = re.exec(text);
    if (m) return { text: text.replace(m[0], " "), marker: `@${p.code_prefix}` };
  }
  return { text, marker: null };
}

export type ProjectHeader = { prefix: string | null; rest: string };

const HEADER_RESET_RE =
  /^(?:(?:tareas?|misiones?)\s+)?(?:personal(?:es)?|sin\s+proyecto|ning[uú]n\s+proyecto|proyecto\s+personal)$/i;
const HEADER_PROJECT_RE = /^(?:(?:y|ahora|bueno)\s+)*(?:(?:para|en|de)\s+(?:el\s+)?|del\s+)?proyecto\s+(.+)$/i;

/**
 * Un segmento que solo nombra un proyecto ("proyecto web", "@WEB", "WEB:",
 * "personal") abre un bloque: las tareas siguientes van a ese proyecto hasta
 * que se nombre otro. Con dos puntos puede traer la primera tarea detrás
 * ("WEB: ajustar el menú"). Devuelve null si el segmento es una tarea normal.
 */
export function detectProjectHeader(segment: string, projects: VoiceProject[]): ProjectHeader | null {
  const colon = segment.indexOf(":");
  const head = (colon >= 0 ? segment.slice(0, colon) : segment).replace(/[\s.,;–—-]+$/g, "").trim();
  const rest = colon >= 0 ? segment.slice(colon + 1).trim() : "";
  if (!head) return null;

  if (HEADER_RESET_RE.test(strip(head))) return { prefix: null, rest };

  const at = /^@([A-Za-z][A-Za-z0-9]{1,9})$/.exec(head);
  if (at) return { prefix: at[1].toUpperCase(), rest };

  const named = HEADER_PROJECT_RE.exec(head);
  if (named) {
    const words = named[1].trim().split(/\s+/);
    const found = matchProject(words, projects);
    if (found && found.used === words.length) return { prefix: found.prefix, rest };
    // Proyecto desconocido de una palabra: se marca igual para que la vista previa avise.
    if (!found && words.length === 1) {
      const prefix = strip(words[0]).replace(/[^a-z0-9]/g, "").slice(0, 10).toUpperCase();
      if (/^[A-Z][A-Z0-9]{1,9}$/.test(prefix)) return { prefix, rest };
    }
    return null;
  }

  // "WEB:" o "Sitio web:" (sin la palabra proyecto) solo con dos puntos.
  if (colon >= 0) {
    const words = head.split(/\s+/);
    const found = matchProject(words, projects);
    if (found && found.used === words.length) return { prefix: found.prefix, rest };
  }
  return null;
}

function extractWaiting(text: string): { text: string; marker: string | null } {
  const m = /\b(?:esperando|espero)\s+(?:la\s+)?(?:respuesta\s+)?(?:a|de|que)\s+([\p{L}]+)/iu.exec(text);
  if (!m) return { text, marker: null };
  const name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return { text: text.replace(m[0], " "), marker: `(esperando: ${name})` };
}

const FILLER_RE = new RegExp(`(^|[\\s,])(?:${FILLERS.map(escape).join("|")})(?=[\\s,.;]|$)`, "gi");
const LEADING_RE =
  /^(?:(?:y|que|a|de|para|entonces)\s+)*(?:voy\s+a\s+(?:hacer|realizar|trabajar\s+en)\s+(?:las\s+tareas\s+)?|tengo\s+que\s+|debo\s+|las\s+tareas\s+(?:de\s+hoy\s+)?son\s*:?\s*|necesito\s+)?/i;

function tidyTitle(text: string): string {
  const t = text
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:;–—-]+|[\s,.:;–—-]+$/g, "")
    .replace(LEADING_RE, "")
    .replace(/\s+(?:y|de|para|en|a)$/i, "")
    .trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

/** Un segmento que solo trae datos (duración, fecha, prioridad) completa al anterior. */
function isModifierOnly(segment: string): boolean {
  const { text: a } = extractDuration(` ${segment} `);
  const { text: b } = extractDate(a);
  const { text: c } = extractPriority(b);
  return tidyTitle(c).length === 0 && strip(segment).trim().length > 0;
}

function splitSegments(text: string): string[] {
  const separators = ITEM_SEPARATORS.map(escape).sort((a, b) => b.length - a.length).join("|");
  const raw = text.split(new RegExp(`[;.\\n]|,|\\b(?:${separators})\\b`, "i"));
  const merged: string[] = [];
  for (const part of raw.map((s) => s?.trim() ?? "").filter(Boolean)) {
    if (merged.length > 0 && isModifierOnly(part)) merged[merged.length - 1] += ` ${part}`;
    else merged.push(part);
  }
  return merged;
}

/** Texto dictado → líneas con marcadores y día planificado. */
export function normalizeSpoken(
  spoken: string,
  { projects, today }: { projects: VoiceProject[]; today: ISODate },
): NormalizedSpeech {
  // Los saltos de línea se conservan: separan tareas cuando se escribe a mano.
  let text = ` ${spoken.replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n")} `.replace(FILLER_RE, "$1");

  let plannedOn: ISODate | null = null;
  const dayContext =
    /\b(?:para\s+(?:mi\s+d[ií]a(?:\s+de\s+hoy)?|hoy)\s+(?:voy\s+a|tengo\s+que)?|(?:en\s+)?mi\s+d[ií]a(?:\s+de\s+hoy)?|hoy\s+(?:voy\s+a|tengo\s+que)|(?:para\s+)?mañana\s+(?:voy\s+a|tengo\s+que))/i.exec(
      text,
    );
  if (dayContext && dayContext.index < 40) {
    plannedOn = /mañana/i.test(dayContext[0]) ? addDays(today, 1) : today;
    text = text.slice(0, dayContext.index) + " " + text.slice(dayContext.index + dayContext[0].length);
  }

  const lines: SpokenLine[] = [];
  // Bloque activo: undefined = no se ha nombrado; null = "personal"; string = prefijo.
  let block: string | null | undefined;
  for (const raw of splitSegments(text)) {
    let segment = raw;
    const header = detectProjectHeader(segment, projects);
    if (header) {
      block = header.prefix;
      if (!header.rest) continue;
      segment = header.rest;
    }
    let rest = ` ${segment} `;
    let type: ItemType = "task";

    const ticket = /^\s*(?:un\s+)?ticket\b\s*:?/i.exec(rest);
    if (ticket) {
      type = "ticket";
      rest = rest.slice(ticket[0].length);
    }
    const followUp = /^\s*seguimiento\b\s*:?/i.exec(rest);
    if (followUp) {
      type = "follow_up";
      rest = rest.slice(followUp[0].length);
    }

    const markers: string[] = [];
    const waiting = extractWaiting(rest);
    rest = waiting.text;
    if (waiting.marker) {
      markers.push(waiting.marker);
      if (type === "task") type = "follow_up";
    }
    const duration = extractDuration(rest);
    rest = duration.text;
    if (duration.hours !== null) markers.push(`~${duration.hours}h`);
    const date = extractDate(rest);
    rest = date.text;
    if (date.token) markers.push(`!${date.token}`);
    const priority = extractPriority(rest);
    rest = priority.text;
    if (priority.tag) markers.push(`#${priority.tag}`);
    const project = extractProject(rest, projects);
    rest = project.text;
    if (project.marker) markers.push(project.marker);
    // El proyecto dicho (o escrito como @X) en la propia línea manda sobre el bloque.
    const ownProject = project.marker !== null || /(^|\s)@[A-Za-z]/.test(rest);
    if (!ownProject && block) markers.push(`@${block}`);

    const title = tidyTitle(rest);
    if (!title && markers.length === 0) continue;
    const line: SpokenLine = { text: [title, ...markers].join(" ").trim(), type };
    if (!ownProject && block === null) line.personal = true;
    lines.push(line);
  }

  return { lines, plannedOn };
}

/** Dictado → ítems listos para la vista previa (mismo formato que Granola). */
export function interpretSpoken(
  spoken: string,
  ctx: { projects: VoiceProject[]; today: ISODate; defaultProjectId?: string | null; myDay?: boolean },
): { items: ParsedItem[]; plannedOn: ISODate | null } {
  const { lines, plannedOn } = normalizeSpoken(spoken, ctx);
  const day = plannedOn ?? (ctx.myDay ? ctx.today : null);
  const defaultProject = ctx.projects.find((p) => p.id === ctx.defaultProjectId) ?? null;

  const items = lines.map(({ text, type, personal }) => {
    const item = parseLine(text, { projects: ctx.projects, today: ctx.today, defaultType: type });
    if (!item.projectId && !item.projectPrefix && defaultProject && !personal) {
      item.projectId = defaultProject.id;
      item.projectPrefix = defaultProject.code_prefix;
    }
    if (day && item.type !== "ticket") item.planned_on = day;
    item.raw = text;
    return item;
  });
  return { items, plannedOn: day };
}
