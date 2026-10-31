"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import type { ImportPayload } from "@/app/(app)/import/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ParsedItem } from "@/lib/granola/parse";
import { parseDurationInput } from "@/lib/time";

import { ITEM_TYPE_LABELS, ParsedItemBadges } from "./parsed-item-badges";

export type ProjectOption = { id: string; name: string; code_prefix: string };
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

const hoursText = (h: number | null) => (h == null ? "" : String(h).replace(".", ","));

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
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, i) => (
        // La clave incluye el texto original: si se reinterpreta, los campos no editados se reinician.
        <li key={`${i}-${row.raw}`} className="flex gap-3 rounded-lg border p-3">
          <Checkbox
            className="mt-3 sm:mt-2"
            checked={row.include}
            onCheckedChange={(checked) => onUpdate(i, { include: checked })}
            aria-label={`Incluir “${row.title}”`}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input
              aria-label="Título"
              value={row.title}
              onChange={(e) => onUpdate(i, { title: e.target.value })}
              className="h-11 sm:h-8"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[9rem_1fr_6rem]">
              <NativeSelect
                aria-label="Tipo"
                value={row.type}
                onChange={(e) => onUpdate(i, { type: e.target.value as ReviewRow["type"] })}
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
                onBlur={(e) => onUpdate(i, { estimated_hours: parseDurationInput(e.target.value) })}
                className="h-11 sm:order-last sm:h-8"
              />
              <NativeSelect
                aria-label="Proyecto"
                value={row.projectId ?? ""}
                onChange={(e) => {
                  const project = projects.find((p) => p.id === e.target.value);
                  onUpdate(i, {
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
      ))}
    </ul>
  );
}
