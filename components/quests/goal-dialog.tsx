"use client";

import { TargetIcon } from "lucide-react";
import { useState } from "react";

import { saveGoal } from "@/app/(app)/quests/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";

type Props = {
  period: "week" | "month";
  current: { target_cop: number; target_tasks: number | null } | null;
  /** Sugerencia para la primera vez (p. ej. la mensual ÷ 4,3). */
  suggestion?: number | null;
};

const plain = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function GoalDialog({ period, current, suggestion }: Props) {
  const [open, setOpen] = useState(false);
  const { pending, submit } = useAction();
  const noun = period === "week" ? "semanal" : "mensual";
  const id = `goal-${period}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={current ? "ghost" : "default"} />}>
        <TargetIcon data-icon="inline-start" />
        {current ? "Cambiar meta" : `Definir meta ${noun}`}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit(saveGoal, () => setOpen(false))} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Meta {noun}</DialogTitle>
            <DialogDescription>
              Aplica desde {period === "week" ? "el lunes de esta semana" : "el día 1 de este mes"}. Los períodos
              anteriores conservan su meta.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="period" value={period} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-cop`}>Meta en pesos</FieldLabel>
              <Input
                id={`${id}-cop`}
                name="target_cop"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                required
                defaultValue={current ? plain.format(current.target_cop) : suggestion ? plain.format(suggestion) : ""}
                placeholder={period === "week" ? "800.000" : "3.500.000"}
              />
              <FieldDescription>
                Lo que quieres producir terminando misiones de proyectos (horas × tarifa).
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-tasks`}>Misiones (opcional)</FieldLabel>
              <Input
                id={`${id}-tasks`}
                name="target_tasks"
                type="number"
                min={1}
                max={1000}
                inputMode="numeric"
                defaultValue={current?.target_tasks ?? ""}
                placeholder={period === "week" ? "15" : "60"}
              />
              <FieldDescription>Cuenta también las misiones personales.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Guardar meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
