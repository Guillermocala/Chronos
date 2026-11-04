"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import type { ImportPayload } from "@/app/(app)/import/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ParsedItem } from "@/lib/granola/parse";
import { formatCOP } from "@/lib/format";
import { formatDuration, parseDurationInput } from "@/lib/time";

import { ITEM_TYPE_LABELS, ParsedItemBadges } from "./parsed-item-badges";

export type ProjectOption = {
  id: string;
  name: string;
  code_prefix: string;
  /** Tarifa por hora estimada: si viene, la vista previa muestra "≈ $X" por proyecto. */
  rate?: number | null;
};
export type ReviewRow = ParsedItem & { include: boolean };

/**
 * Estado de la vista previa editable: los ítems interpretados más lo que el
 * usuario corrige (por índice). Si llegan ítems nuevos, se descartan las ediciones.
 */
export function useReviewRows(items: ParsedItem[]) {
  const [edits, setEdits] = useState<Record<number, Partial<ReviewRow>>>({});
  const [source, setSource] = useState(items);
  if (source !== items) {
    setSource(items);
    setEdits({});
  }
  const rows: ReviewRow[] = items.map((item, i) => ({ ...item, include: true, ...edits[i] }));
  return {
    rows,
    selected: rows.filter((r) => r.include && r.title.trim()),
    update: (index: number, change: Partial<ReviewRow>) =>
      setEdits((prev) => ({ ...prev, [index]: { ...prev[index], ...change } })),
  };
}

/** Filas seleccionadas → ítems para importDictation. */
export function toImportItems(rows: ReviewRow[]): ImportPayload["items"] {
  return rows.map((r) => ({
    type: r.type,
    title: r.title,
    projectId: r.projectId,
    due_date: r.due_date,
    planned_on: r.planned_on,
    priority: r.priority,
    tags: r.tags,
    waiting_on: r.waiting_on,
    doc_url: r.doc_url,
    estimated_hours: r.estimated_hours,
  }));
}

export type ReviewGroup = {
  key: string;
  label: string;
  /** Prefijo escrito que no existe como proyecto. */
  unknown: boolean;
  entries: { row: ReviewRow; index: number }[];
  /** Ítems incluidos, sus horas estimadas y su valor (null si no hay tarifa). */
  count: number;
  hours: number;
  cop: number | null;
};

/** Agrupa las filas por proyecto, en el orden en que aparecen (bloques del dictado). */
export function groupRowsByProject(rows: ReviewRow[], projects: ProjectOption[]): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  rows.forEach((row, index) => {
    const project = row.projectId ? projects.find((p) => p.id === row.projectId) : undefined;
    const key = project?.id ?? (row.projectPrefix ? `?${row.projectPrefix}` : "personal");
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: project
          ? `${project.code_prefix} · ${project.name}`
          : row.projectPrefix
            ? `@${row.projectPrefix} (no existe)`
            : "Personal",
        unknown: !project && row.projectPrefix !== null,
        entries: [],
        count: 0,
        hours: 0,
        cop: null,
      };
      groups.set(key, group);
    }
    group.entries.push({ row, index });
    if (row.include) {
      group.count += 1;
      group.hours += row.estimated_hours ?? 0;
      const rate = project?.rate;
      if (rate && row.estimated_hours) group.cop = (group.cop ?? 0) + Math.round(rate * row.estimated_hours);
    }
  });
  return [...groups.values()];
}

function groupSummary(group: ReviewGroup): string {
  const parts = [`${group.count} ${group.count === 1 ? "ítem" : "ítems"}`];
  if (group.hours > 0) parts.push(`~${formatDuration(group.hours)}`);
  if (group.cop) parts.push(`≈ ${formatCOP(group.cop)}`);
  return parts.join(" · ");
}

const hoursText =(h: number | null) => (h == null ? "" : String(h).replace(".", ","));

type Props = {
  rows: ReviewRow[];
  projects: ProjectOption[];
  onUpdate: (index: number, change: Partial<ReviewRow>) => void;
};

/**
 * Lista editable de ítems interpretados (dictado de Granola o por voz).
 * Celular: tarjetas apiladas con controles de 44 px. Escritorio: una fila por ítem.
 */
export function DictationReview({ rows, projects, onUpdate }: Props) {
  const groups = groupRowsByProject(rows, projects);
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="flex flex-col gap-2">
          <h4 className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium">
            <span className={group.unknown ? "text-destructive" : undefined}>{group.label}</span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">{groupSummary(group)}</span>
          </h4>
          <ul className="flex flex-col gap-3">
            {group.entries.map(({ row, index }) => (
              // La clave incluye el texto original: si se reinterpreta, los campos no editados se reinician.
              <ReviewItem
                key={`${index}-${row.raw}`}
                row={row}
                projects={projects}
                onUpdate={(change) => onUpdate(index, change)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ReviewItem({
  row,
  projects,
  onUpdate,
}: {
  row: ReviewRow;
  projects: ProjectOption[];
  onUpdate: (change: Partial<ReviewRow>) => void;
}) {
  return (
    <li className="flex gap-3 rounded-lg border p-3">
      <Checkbox
        className="mt-3 sm:mt-2"
        checked={row.include}
        onCheckedChange={(checked) => onUpdate({ include: checked })}
        aria-label={`Incluir “${row.title}”`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Input
          aria-label="Título"
          value={row.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="h-11 sm:h-8"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[9rem_1fr_6rem]">
          <NativeSelect
            aria-label="Tipo"
            value={row.type}
            onChange={(e) => onUpdate({ type: e.target.value as ReviewRow["type"] })}
            className="w-full max-sm:[&>select]:h-11"
          >
            {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Input
            aria-label="Horas estimadas"
            inputMode="decimal"
            placeholder="Horas…"
            defaultValue={hoursText(row.estimated_hours)}
            onBlur={(e) => onUpdate({ estimated_hours: parseDurationInput(e.target.value) })}
            className="h-11 sm:order-last sm:h-8"
          />
          <NativeSelect
            aria-label="Proyecto"
            value={row.projectId ?? ""}
            onChange={(e) => {
              const project = projects.find((p) => p.id === e.target.value);
              onUpdate({
                projectId: project?.id ?? null,
                projectPrefix: project?.code_prefix ?? null,
                warnings: row.warnings.filter((w) => !w.startsWith("El proyecto")),
              });
            }}
            className="col-span-2 w-full sm:col-span-1 max-sm:[&>select]:h-11"
          >
            <NativeSelectOption value="">Personal (sin proyecto)</NativeSelectOption>
            {projects.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.code_prefix} · {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <ParsedItemBadges item={row} />
        {row.warnings.map((w) => (
          <span key={w} className="flex items-center gap-1 text-xs text-destructive">
            <TriangleAlertIcon className="size-3" aria-hidden />
            {w}
          </span>
        ))}
      </div>
    </li>
  );
}
