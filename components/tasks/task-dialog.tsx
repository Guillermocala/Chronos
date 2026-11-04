"use client";

import { useState } from "react";

import { updateTask } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";
import type { TaskWithProject } from "@/lib/data/tasks";
import { realHours } from "@/lib/tasks/hours";
import { formatDuration, parseDurationInput } from "@/lib/time";

import { hoursToInput, TaskFields, type ProjectChoice } from "./task-fields";

export type { ProjectChoice } from "./task-fields";

type Props = {
  task: TaskWithProject;
  projects: ProjectChoice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TaskDialog({ task, projects, open, onOpenChange }: Props) {
  const { pending, submit } = useAction();
  const [status, setStatus] = useState(task.status);
  const spent = realHours(task);
  const [real, setReal] = useState(spent > 0 ? hoursToInput(spent) : "");
  const [realDirty, setRealDirty] = useState(false);
  // Al abrir de nuevo, las horas reales parten de lo guardado (pudieron cambiar al completar).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReal(spent > 0 ? hoursToInput(spent) : "");
      setRealDirty(false);
    }
  }
  const realValue = parseDurationInput(real);
  const realInvalid = real.trim() !== "" && realValue === null;
  const realDiff =
    realValue !== null && task.estimated_hours != null
      ? Math.round((realValue - Number(task.estimated_hours)) * 100) / 100
      : null;

  // El proyecto actual puede estar cerrado y no venir en la lista: se agrega.
  const choices =
    task.project && !projects.some((p) => p.id === task.project!.id)
      ? [...projects, task.project]
      : projects;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={submit(updateTask, () => onOpenChange(false))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Editar tarea</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="id" value={task.id} />
          <FieldGroup>
            <TaskFields
              idPrefix={`task-${task.id}`}
              projects={choices}
              extrasOpen={Boolean(task.tags.length || task.doc_url || task.notes)}
              defaults={{
                title: task.title,
                kind: task.kind,
                priority: task.priority,
                planned_on: task.planned_on ?? "",
                due_date: task.due_date ?? "",
                project_id: task.project_id ?? "",
                estimated_hours: hoursToInput(task.estimated_hours),
                waiting_on: task.waiting_on ?? "",
                tags: task.tags.join(", "),
                doc: task.doc_url ?? "",
                notes: task.notes ?? "",
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <Field>
                <FieldLabel htmlFor={`status-${task.id}`}>Estado</FieldLabel>
                <NativeSelect
                  id={`status-${task.id}`}
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <NativeSelectOption value="open">Abierta</NativeSelectOption>
                  <NativeSelectOption value="waiting">Esperando</NativeSelectOption>
                  <NativeSelectOption value="done">Hecha</NativeSelectOption>
                  <NativeSelectOption value="dismissed">Descartada</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field data-invalid={realInvalid || undefined}>
                <FieldLabel htmlFor={`real-hours-${task.id}`}>Horas reales</FieldLabel>
                <Input
                  id={`real-hours-${task.id}`}
                  // Solo se envía si se cambió: así guardar otros campos no reescribe los registros.
                  name={realDirty ? "real_hours" : undefined}
                  value={real}
                  onChange={(e) => {
                    setReal(e.target.value);
                    setRealDirty(true);
                  }}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={task.estimated_hours != null ? `~${formatDuration(task.estimated_hours)} estimadas` : "1:30, 2h, 45m"}
                  aria-invalid={realInvalid || undefined}
                />
                <FieldDescription>
                  {realDiff !== null && realDiff !== 0
                    ? `${realDiff > 0 ? "+" : "−"}${formatDuration(Math.abs(realDiff))} frente al estimado. `
                    : ""}
                  {task.project ? `Cuentan en las horas de ${task.project.code_prefix}.` : "Tarea personal: solo como registro."}
                </FieldDescription>
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
