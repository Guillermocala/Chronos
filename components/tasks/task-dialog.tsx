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
import { formatDuration } from "@/lib/time";

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
            <div className="grid gap-4 sm:grid-cols-2">
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
              {status === "done" && (
                <Field>
                  <FieldLabel htmlFor={`add-hours-${task.id}`}>Agregar horas que tomó</FieldLabel>
                  <Input
                    id={`add-hours-${task.id}`}
                    name="add_hours"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="1:30, 2h, 45m"
                  />
                  <FieldDescription>
                    {spent > 0 ? `Ya registradas: ${formatDuration(spent)}.` : "Aún sin horas registradas."}
                    {task.project ? ` Se suman a las horas de ${task.project.code_prefix}.` : ""}
                  </FieldDescription>
                </Field>
              )}
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
