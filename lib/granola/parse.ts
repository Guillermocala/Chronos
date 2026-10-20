// Interpreta dictados de Granola (Markdown) según lib/granola/conventions.ts.
// Es puro (sin acceso a DB): se usa en el servidor para importar y en el
// navegador para el probador de la guía.

import type { List, ListItem, PhrasingContent, Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { isISODate, makeISODate, parseSpanishDate, type ISODate } from "@/lib/dates";
import { parseDriveUrl, type DocKind } from "@/lib/drive";

import {
  MY_DAY_TITLES,
  PRIORITY_WORDS,
  SECTION_ALIASES,
  type SectionType,
} from "./conventions";

export type ItemType = "task" | "follow_up" | "ticket";

export type ProjectRef = { id: string; code_prefix: string };

export type ParsedItem = {
  type: ItemType;
  title: string;
  projectId: string | null;
  projectPrefix: string | null;
  due_date: ISODate | null;
  planned_on: ISODate | null;
  priority: 1 | 2 | 3;
  tags: string[];
  waiting_on: string | null;
  estimated_hours: number | null;
  doc_url: string | null;
  doc_kind: DocKind | null;
  warnings: string[];
  raw: string;
};

export type ParsedDictation = {
  title: string | null;
  date: ISODate;
  isMyDay: boolean;
  items: ParsedItem[];
  skippedDone: number;
};

type LineContext = {
  projects: ProjectRef[];
  today: ISODate;
  defaultType?: ItemType;
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[:.]+$/, "")
    .trim();
}

const WAITING_RE = /\((?:esperando|espera|waiting(?:\s+on)?)\s*:\s*([^)]+)\)/i;
const URL_RE = /https?:\/\/\S+/g;
const PROJECT_RE = /(^|\s)@([A-Za-z][A-Za-z0-9]{1,9})(?=$|[\s.,;:])/g;
const DATE_RE = /(^|\s)!([^\s!]+)/g;
const TAG_RE = /(^|\s)#([\p{L}\p{N}_-]+)/gu;
const HOURS_RE = /(^|\s)~(\d+(?:[.,]\d+)?)\s?h(?=$|\s)/i;

/** Interpreta una línea con marcadores (también usada por "+ Tarea"). */
export function parseLine(text: string, ctx: LineContext): ParsedItem {
  const warnings: string[] = [];
  let rest = ` ${text.replace(/\s+/g, " ").trim()} `;

  let waiting_on: string | null = null;
  const waiting = WAITING_RE.exec(rest);
  if (waiting) {
    waiting_on = waiting[1].trim();
    rest = rest.replace(waiting[0], " ");
  }

  let doc_url: string | null = null;
  let doc_kind: DocKind | null = null;
  for (const url of rest.match(URL_RE) ?? []) {
    const drive = parseDriveUrl(url.replace(/[).,;]+$/, ""));
    if (drive && !doc_url) {
      doc_url = drive.url;
      doc_kind = drive.kind;
      rest = rest.replace(url, " ");
    }
  }

  let projectId: string | null = null;
  let projectPrefix: string | null = null;
  rest = rest.replace(PROJECT_RE, (_m, lead: string, prefix: string) => {
    const upper = prefix.toUpperCase();
    const project = ctx.projects.find((p) => p.code_prefix === upper);
    if (projectPrefix) {
      warnings.push(`Se ignoró @${upper}: solo se usa un proyecto por línea.`);
    } else if (project) {
      projectId = project.id;
      projectPrefix = upper;
    } else {
      projectPrefix = upper;
      warnings.push(`El proyecto @${upper} no existe.`);
    }
    return lead;
  });

  let due_date: ISODate | null = null;
  rest = rest.replace(DATE_RE, (_m, lead: string, token: string) => {
    const parsed = parseSpanishDate(token, ctx.today);
    if (parsed && !due_date) due_date = parsed;
    else if (!parsed) warnings.push(`No entendí la fecha "!${token}".`);
    return lead;
  });

  let priority: 1 | 2 | 3 = 2;
  const tags: string[] = [];
  rest = rest.replace(TAG_RE, (_m, lead: string, word: string) => {
    const key = normalize(word);
    if (key in PRIORITY_WORDS) priority = PRIORITY_WORDS[key];
    else if (!tags.includes(key)) tags.push(key);
    return lead;
  });

  let estimated_hours: number | null = null;
  const hours = HOURS_RE.exec(rest);
  if (hours) {
    estimated_hours = Number(hours[2].replace(",", "."));
    rest = rest.replace(hours[0], hours[1]);
  }

  const title = rest
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s:–—,-]+|[\s:–—,-]+$/g, "");
  if (!title) warnings.push("La línea no tiene título.");

  return {
    type: waiting_on ? "follow_up" : (ctx.defaultType ?? "task"),
    title,
    projectId,
    projectPrefix,
    due_date,
    planned_on: null,
    priority,
    tags,
    waiting_on,
    estimated_hours,
    doc_url,
    doc_kind,
    warnings,
    raw: text.trim(),
  };
}

// Texto de un nodo inline conservando la URL de los enlaces de Google.
function phrasingText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "inlineCode":
          return node.value;
        case "link": {
          const label = phrasingText(node.children);
          return parseDriveUrl(node.url) ? `${label} ${node.url}` : label;
        }
        case "break":
          return " ";
        default:
          return "children" in node ? phrasingText(node.children as PhrasingContent[]) : "";
      }
    })
    .join("");
}

function listItemText(item: ListItem): string {
  const paragraph = item.children.find((c) => c.type === "paragraph");
  return paragraph && paragraph.type === "paragraph" ? phrasingText(paragraph.children) : "";
}

function sectionOf(heading: string): SectionType | "other" {
  const key = normalize(heading);
  for (const [type, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(key)) return type as SectionType;
  }
  return "other";
}

function extractFrontMatter(markdown: string): { body: string; date: string | null } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!match) return { body: markdown, date: null };
  const date = /^date:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(match[1]);
  return { body: markdown.slice(match[0].length), date: date ? date[1] : null };
}

function dateInText(text: string, today: ISODate): ISODate | null {
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
  if (iso && isISODate(iso[1])) return iso[1];
  const dm = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/.exec(text);
  if (dm) {
    return dm[3]
      ? makeISODate(Number(dm[3]), Number(dm[2]), Number(dm[1]))
      : parseSpanishDate(`${dm[1]}/${dm[2]}`, today);
  }
  return null;
}

/** Interpreta una nota completa de Granola. */
export function parseDictation(
  markdown: string,
  ctx: { projects: ProjectRef[]; today: ISODate },
): ParsedDictation {
  const { body, date: frontDate } = extractFrontMatter(markdown);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Root;

  let title: string | null = null;
  let section: SectionType | "other" | null = null;
  let skippedDone = 0;
  const lines: { text: string; type: ItemType }[] = [];

  const handleList = (list: List) => {
    for (const item of list.children) {
      if (item.checked === true) {
        skippedDone += 1;
        continue;
      }
      const inItemSection = section === "task" || section === "follow_up" || section === "ticket";
      // Fuera de las secciones reconocidas solo cuentan las casillas "- [ ]".
      if (section === "notes" || (!inItemSection && item.checked !== false)) continue;
      const text = listItemText(item);
      if (!text.trim()) continue;
      lines.push({ text, type: inItemSection ? (section as ItemType) : "task" });
    }
  };

  for (const node of tree.children as RootContent[]) {
    if (node.type === "heading") {
      const text = phrasingText(node.children);
      if (node.depth === 1 && title === null) title = text.trim();
      else section = sectionOf(text);
    } else if (node.type === "list") {
      handleList(node);
    }
  }

  const isMyDay = title !== null && MY_DAY_TITLES.some((t) => normalize(title!).includes(t));
  const date = frontDate ?? (title ? dateInText(title, ctx.today) : null) ?? ctx.today;

  // Las fechas relativas (!mañana, !viernes) se cuentan desde la fecha de la nota,
  // no desde el día en que se importa.
  const items = lines.map(({ text, type }) => {
    const item = parseLine(text, { ...ctx, today: date, defaultType: type });
    if (isMyDay && item.type !== "ticket") item.planned_on = date;
    return item;
  });

  return { title, date, isMyDay, items, skippedDone };
}
