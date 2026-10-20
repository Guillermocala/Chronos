"use client";

import { useState, type ReactElement, type ReactNode } from "react";

import { saveSprint } from "@/app/(app)/projects/sprint-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action-toast";
import { addDays, isISODate, type ISODate } from "@/lib/dates";
import type { Sprint } from "@/lib/data/projects";

import { MoneyInput } from "./money-input";

type Props = {
  projectId: string;
  defaultSprintDays: number;
  /** Inicio sugerido para un sprint nuevo (día siguiente al último sprint, o hoy). */
  suggestedStart: ISODate;
  nextNumber: number;
  sprint?: Sprint;
  trigger: ReactElement;
  triggerLabel: ReactNode;
};

export function SprintDialog({
  projectId,
  defaultSprintDays,
  suggestedStart,
  nextNumber,
  sprint,
  trigger,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(sprint?.start_date ?? suggestedStart);
  const [end, setEnd] = useState(sprint?.end_date ?? addDays(suggestedStart, defaultSprintDays - 1));
  const { pending, run } = useAction();
  const prefix = sprint?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <form
          action={(formData) => run(() => saveSprint(formData), () => setOpen(false))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{sprint ? "Editar sprint" : "Nuevo sprint"}</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="id" value={sprint?.id ?? ""} />
          <input type="hidden" name="project_id" value={projectId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${prefix}-name`}>Nombre</FieldLabel>
              <Input id={`${prefix}-name`} name="name" required defaultValue={sprint?.name ?? `Sprint ${nextNumber}`} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${prefix}-start`}>Inicio</FieldLabel>
                <Input
                  id={`${prefix}-start`}
                  name="start_date"
                  type="date"
                  required
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    // Al crear, el fin sigue al inicio según la duración del proyecto.
                    if (!sprint && isISODate(e.target.value)) {
                      setEnd(addDays(e.target.value, defaultSprintDays - 1));
                    }
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-end`}>Fin</FieldLabel>
                <Input
                  id={`${prefix}-end`}
                  name="end_date"
                  type="date"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`${prefix}-goal`}>Objetivo</FieldLabel>
              <Textarea id={`${prefix}-goal`} name="goal" rows={2} defaultValue={sprint?.goal ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${prefix}-override`}>Valor manual (opcional)</FieldLabel>
              <MoneyInput id={`${prefix}-override`} name="value_cop_override" defaultValue={sprint?.value_cop_override} />
              <FieldDescription>Si lo dejas vacío, se calcula automáticamente.</FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id={`${prefix}-support`} name="is_support" defaultChecked={sprint?.is_support ?? false} />
              <FieldLabel htmlFor={`${prefix}-support`}>Sprint de soporte</FieldLabel>
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
