"use client";

import { ChevronRightIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { completeTask, type CompletionExtras } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action-toast";
import { formatCOP } from "@/lib/format";
import { stepHours } from "@/lib/tasks/hours";
import { formatDuration, parseDurationInput } from "@/lib/time";

import { hoursToInput } from "./task-fields";

const PRESETS = [
  { label: "15 min", hours: 0.25 },
  { label: "30 min", hours: 0.5 },
  { label: "1 h", hours: 1 },
  { label: "2 h", hours: 2 },
  { label: "4 h", hours: 4 },
];

type Props = {
  taskId: string;
  title: string;
  /** Prefijo del proyecto (las horas se suman a ese proyecto). */
  projectCode?: string | null;
  /** Tarifa por hora del proyecto, si se conoce (para mostrar cuánto ganas). */
  rate?: number | null;
  /** Lo que se registra si no se escribe nada: lo que falta para el estimado. */
  fallbackHours: number | null;
  /** Documento actual de la tarea (se puede cambiar o quitar en "Más opciones"). */
  currentDoc?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Al completar: "¿Cuánto te tomó?" es opcional. Vacío, "Omitir", Esc o clic
 * afuera completan igual y registran las horas estimadas (si hay estimado).
 * "Más opciones" agrega notas del trabajo y el enlace a la documentación.
 */
export function CompleteTaskDialog({
  taskId,
  title,
  projectCode,
  rate,
  fallbackHours,
  currentDoc,
  open,
  onOpenChange,
}: Props) {
  const { pending, run } = useAction();
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [doc, setDoc] = useState(currentDoc ?? "");
  const hours = parseDurationInput(value);
  const empty = value.trim() === "";
  const invalid = !empty && hours === null;
  const shown = hours ?? (empty ? fallbackHours : null);
  const id = (name: string) => `complete-${taskId}-${name}`;

  // Al abrir de nuevo se parte de cero (el documento, del que tenga la tarea).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue("");
      setNotes("");
      setDoc(currentDoc ?? "");
    }
  }

  const step = (delta: 1 | -1) => setValue(hoursToInput(stepHours(hours ?? (empty ? fallbackHours : null), delta)));

  const extras = (): CompletionExtras => ({
    notes: notes.trim() || undefined,
    // Solo se envía si cambió: vacío quita el documento.
    doc: doc.trim() !== (currentDoc ?? "") ? doc.trim() : undefined,
  });

  const finish = (h: number | null, withExtras: boolean) =>
    run(
      () => completeTask(taskId, h, withExtras ? extras() : undefined),
      () => onOpenChange(false),
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        // Cerrar sin responder también completa, con lo estimado (sin notas: no se revisaron).
        if (!next) finish(null, false);
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            finish(hours, true);
          }}
        >
          <DialogHeader>
            <DialogTitle>¿Cuánto te tomó?</DialogTitle>
            <DialogDescription className="break-words">{title}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor={id("hours")}>Tiempo real (opcional)</FieldLabel>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 sm:size-9"
                aria-label="Restar 15 minutos"
                disabled={pending || (hours !== null && hours <= 0.25)}
                onClick={() => step(-1)}
              >
                <MinusIcon />
              </Button>
              <Input
                id={id("hours")}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder={fallbackHours != null ? `~${hoursToInput(fallbackHours)}` : "1:30, 2h, 45m"}
                aria-invalid={invalid || undefined}
                className="h-11 text-center text-base tabular-nums sm:h-9 sm:text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 sm:size-9"
                aria-label="Sumar 15 minutos"
                disabled={pending || (hours !== null && hours >= 24)}
                onClick={() => step(1)}
              >
                <PlusIcon />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  size="sm"
                  variant={hours === p.hours ? "default" : "outline"}
                  onClick={() => setValue(hoursToInput(p.hours))}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {invalid ? (
              <FieldError>Escribe una duración como 1:30, 1,5, 2h o 90m (máx. 24 h).</FieldError>
            ) : (
              <FieldDescription>
                {fallbackHours != null
                  ? `Si lo dejas vacío se usan las ~${formatDuration(fallbackHours)} estimadas.`
                  : "Sin estimado: si lo dejas vacío se completa sin horas."}{" "}
                {projectCode ? `Se suman a las horas de ${projectCode}.` : "Tarea personal: queda como registro."}
                {shown !== null && rate ? ` Ganas ${formatCOP(Math.round(shown * rate))}.` : ""}
              </FieldDescription>
            )}
          </Field>

          <details className="group rounded-lg border px-3 py-2" open={Boolean(currentDoc) || undefined}>
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" aria-hidden />
              Más opciones
              <span className="font-normal text-muted-foreground">· notas y documento</span>
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor={id("notes")}>Notas</FieldLabel>
                <Textarea
                  id={id("notes")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder="Qué hiciste, decisiones, pendientes…"
                />
                <FieldDescription>
                  Se agregan a las notas de la tarea con la fecha
                  {projectCode ? ` y al registro de horas de ${projectCode}` : ""}.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={id("doc")}>Documento o carpeta de Drive</FieldLabel>
                <Input
                  id={id("doc")}
                  type="url"
                  value={doc}
                  onChange={(e) => setDoc(e.target.value)}
                  placeholder="https://docs.google.com/…"
                />
                <FieldDescription>
                  {currentDoc ? "Reemplaza el enlace actual de la tarea; vacío lo quita." : "Si son varios documentos, enlaza la carpeta."}
                </FieldDescription>
              </Field>
            </div>
          </details>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => finish(null, true)}>
              Omitir
            </Button>
            <Button type="submit" disabled={pending || invalid}>
              {pending && <Spinner data-icon="inline-start" />}
              {shown !== null ? `Completar · ${formatDuration(shown)}` : "Completar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
