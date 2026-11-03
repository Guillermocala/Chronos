"use client";

import { ChevronRightIcon, CoinsIcon } from "lucide-react";
import { useState } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatCOP } from "@/lib/format";
import { parseDurationInput } from "@/lib/time";

export type ProjectChoice = { id: string; name: string; code_prefix: string; rate?: number | null };

export type TaskFieldDefaults = {
  title: string;
  kind: "todo" | "follow_up";
  priority: number;
  planned_on: string;
  due_date: string;
  project_id: string;
  estimated_hours: string;
  waiting_on: string;
  tags: string;
  doc: string;
  notes: string;
};

export const EMPTY_TASK_FIELDS: TaskFieldDefaults = {
  title: "",
  kind: "todo",
  priority: 2,
  planned_on: "",
  due_date: "",
  project_id: "",
  estimated_hours: "",
  waiting_on: "",
  tags: "",
  doc: "",
  notes: "",
};

/** Horas en decimal → texto editable ("1:30"). */
export function hoursToInput(hours: number | null | undefined): string {
  if (hours == null) return "";
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

type Props = {
  /** Prefijo único para los id de los campos. */
  idPrefix: string;
  defaults: TaskFieldDefaults;
  projects: ProjectChoice[];
  autoFocus?: boolean;
  /** "Más opciones" (etiquetas, Drive, notas) abierto al empezar. */
  extrasOpen?: boolean;
};

/** Campos de una tarea, compartidos por "Nueva tarea" (detallada) y "Editar tarea". */
export function TaskFields({ idPrefix, defaults, projects, autoFocus, extrasOpen }: Props) {
  const [kind, setKind] = useState(defaults.kind);
  const [projectId, setProjectId] = useState(defaults.project_id);
  const [estimate, setEstimate] = useState(defaults.estimated_hours);
  const id = (name: string) => `${idPrefix}-${name}`;

  const project = projects.find((p) => p.id === projectId);
  const hours = parseDurationInput(estimate);
  const hint = !projectId
    ? "Misión personal: no suma pesos, pero cuenta para tu racha."
    : hours == null
      ? estimate.trim()
        ? null
        : "Sin estimado: al completarla te preguntamos cuánto tomó."
      : project?.rate
        ? `≈ Ganas ${formatCOP(Math.round(hours * project.rate))} al terminarla.`
        : project?.rate === null
          ? "Este proyecto no tiene una tarifa calculable."
          : null; // Tarifa no cargada (edición): sin aviso.

  return (
    <>
      <Field>
        <FieldLabel htmlFor={id("title")}>Título</FieldLabel>
        <Input
          id={id("title")}
          name="title"
          defaultValue={defaults.title}
          required
          autoFocus={autoFocus}
          autoComplete="off"
          maxLength={300}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={id("project")}>Proyecto</FieldLabel>
          <NativeSelect
            id={id("project")}
            name="project_id"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <NativeSelectOption value="">Personal (sin proyecto)</NativeSelectOption>
            {projects.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.code_prefix} · {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={id("priority")}>Prioridad</FieldLabel>
          <NativeSelect id={id("priority")} name="priority" defaultValue={String(defaults.priority)}>
            <NativeSelectOption value="1">Alta</NativeSelectOption>
            <NativeSelectOption value="2">Media</NativeSelectOption>
            <NativeSelectOption value="3">Baja</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={id("planned")}>Fecha de inicio (Mi día)</FieldLabel>
          <Input id={id("planned")} name="planned_on" type="date" defaultValue={defaults.planned_on} />
          <FieldDescription>Día en que planeas hacerla.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={id("due")}>Fecha límite</FieldLabel>
          <Input id={id("due")} name="due_date" type="date" defaultValue={defaults.due_date} />
          <FieldDescription>Opcional.</FieldDescription>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={id("kind")}>Tipo</FieldLabel>
          <NativeSelect
            id={id("kind")}
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <NativeSelectOption value="todo">Tarea</NativeSelectOption>
            <NativeSelectOption value="follow_up">Seguimiento (espero a alguien)</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={id("estimate")}>Horas estimadas</FieldLabel>
          <Input
            id={id("estimate")}
            name="estimated_hours"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="Opcional · 1:30, 2h, 45m"
            aria-invalid={estimate.trim() !== "" && hours == null ? true : undefined}
          />
        </Field>
      </div>
      {kind === "follow_up" && (
        <Field>
          <FieldLabel htmlFor={id("waiting")}>Esperando a</FieldLabel>
          <Input id={id("waiting")} name="waiting_on" defaultValue={defaults.waiting_on} placeholder="Ana (cliente)…" />
        </Field>
      )}
      {hint && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
          {projectId && hours != null && project?.rate ? (
            <CoinsIcon className="size-4 shrink-0 text-amber-500" aria-hidden />
          ) : null}
          {hint}
        </p>
      )}
      <details className="group rounded-lg border px-3 py-2" open={extrasOpen}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" aria-hidden />
          Más opciones
          <span className="font-normal text-muted-foreground">· etiquetas, Drive, notas</span>
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={id("tags")}>Etiquetas</FieldLabel>
            <Input id={id("tags")} name="tags" defaultValue={defaults.tags} placeholder="personal, admin…" />
          </Field>
          <Field>
            <FieldLabel htmlFor={id("doc")}>Documento o carpeta de Drive</FieldLabel>
            <Input id={id("doc")} name="doc" type="url" defaultValue={defaults.doc} placeholder="https://docs.google.com/…" />
            <FieldDescription>Si son varios documentos, enlaza la carpeta.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={id("notes")}>Notas</FieldLabel>
            <Textarea id={id("notes")} name="notes" defaultValue={defaults.notes} rows={3} />
          </Field>
        </div>
      </details>
    </>
  );
}
