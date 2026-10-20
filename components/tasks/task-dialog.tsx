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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action-toast";
import type { TaskWithProject } from "@/lib/data/tasks";

export type ProjectChoice = { id: string; name: string; code_prefix: string };

type Props = {
  task: TaskWithProject;
  projects: ProjectChoice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TaskDialog({ task, projects, open, onOpenChange }: Props) {
  const { pending, run } = useAction();
  const [kind, setKind] = useState(task.kind);

  // El proyecto actual puede estar cerrado y no venir en la lista: se agrega.
  const choices =
    task.project && !projects.some((p) => p.id === task.project!.id)
      ? [...projects, task.project]
      : projects;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-lg">
        <form
          action={(formData) => run(() => updateTask(formData), () => onOpenChange(false))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Editar tarea</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="id" value={task.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`title-${task.id}`}>Título</FieldLabel>
              <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`kind-${task.id}`}>Tipo</FieldLabel>
                <NativeSelect
                  id={`kind-${task.id}`}
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  <NativeSelectOption value="todo">Tarea</NativeSelectOption>
                  <NativeSelectOption value="follow_up">Seguimiento</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`status-${task.id}`}>Estado</FieldLabel>
                <NativeSelect id={`status-${task.id}`} name="status" defaultValue={task.status}>
                  <NativeSelectOption value="open">Abierta</NativeSelectOption>
                  <NativeSelectOption value="waiting">Esperando</NativeSelectOption>
                  <NativeSelectOption value="done">Hecha</NativeSelectOption>
                  <NativeSelectOption value="dismissed">Descartada</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            {kind === "follow_up" && (
              <Field>
                <FieldLabel htmlFor={`waiting-${task.id}`}>Esperando a</FieldLabel>
                <Input
                  id={`waiting-${task.id}`}
                  name="waiting_on"
                  defaultValue={task.waiting_on ?? ""}
                  placeholder="Ana (cliente)…"
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`due-${task.id}`}>Fecha límite</FieldLabel>
                <Input id={`due-${task.id}`} name="due_date" type="date" defaultValue={task.due_date ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`planned-${task.id}`}>Mi día</FieldLabel>
                <Input
                  id={`planned-${task.id}`}
                  name="planned_on"
                  type="date"
                  defaultValue={task.planned_on ?? ""}
                />
                <FieldDescription>Día en que planeas hacerla.</FieldDescription>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`project-${task.id}`}>Proyecto</FieldLabel>
                <NativeSelect id={`project-${task.id}`} name="project_id" defaultValue={task.project_id ?? ""}>
                  <NativeSelectOption value="">Personal (sin proyecto)</NativeSelectOption>
                  {choices.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.code_prefix} · {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`priority-${task.id}`}>Prioridad</FieldLabel>
                <NativeSelect id={`priority-${task.id}`} name="priority" defaultValue={String(task.priority)}>
                  <NativeSelectOption value="1">Alta</NativeSelectOption>
                  <NativeSelectOption value="2">Media</NativeSelectOption>
                  <NativeSelectOption value="3">Baja</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`tags-${task.id}`}>Etiquetas</FieldLabel>
              <Input
                id={`tags-${task.id}`}
                name="tags"
                defaultValue={task.tags.join(", ")}
                placeholder="personal, admin…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`doc-${task.id}`}>Documento o carpeta de Drive</FieldLabel>
              <Input
                id={`doc-${task.id}`}
                name="doc"
                type="url"
                defaultValue={task.doc_url ?? ""}
                placeholder="https://docs.google.com/…"
              />
              <FieldDescription>Si son varios documentos, enlaza la carpeta.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`notes-${task.id}`}>Notas</FieldLabel>
              <Textarea id={`notes-${task.id}`} name="notes" defaultValue={task.notes ?? ""} rows={3} />
            </Field>
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
