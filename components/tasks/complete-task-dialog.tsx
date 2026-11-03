"use client";

import { useState } from "react";

import { completeTask } from "@/app/(app)/tasks/actions";
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
import { useAction } from "@/hooks/use-action-toast";
import { formatCOP } from "@/lib/format";
import { formatDuration, parseDurationInput } from "@/lib/time";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Al completar una tarea sin estimado: cuánto tomó (cronómetro externo). */
export function CompleteTaskDialog({ taskId, title, projectCode, rate, open, onOpenChange }: Props) {
  const { pending, run } = useAction();
  const [value, setValue] = useState("");
  const hours = parseDurationInput(value);
  const invalid = value.trim() !== "" && hours === null;

  const finish = (h: number | null) =>
    run(
      () => completeTask(taskId, h),
      () => {
        setValue("");
        onOpenChange(false);
      },
    );

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (hours !== null) finish(hours);
          }}
        >
          <DialogHeader>
            <DialogTitle>¿Cuántas horas te tomó?</DialogTitle>
            <DialogDescription className="break-words">{title}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor={`spent-${taskId}`}>Tiempo</FieldLabel>
            <Input
              id={`spent-${taskId}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder="1:30, 2h, 45m"
              aria-invalid={invalid || undefined}
            />
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  size="sm"
                  variant={hours === p.hours ? "default" : "outline"}
                  onClick={() => setValue(String(p.hours).replace(".", ","))}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {invalid ? (
              <FieldError>Escribe una duración como 1:30, 1,5, 2h o 90m (máx. 24 h).</FieldError>
            ) : (
              <FieldDescription>
                {projectCode
                  ? `Se suman a las horas de ${projectCode}.`
                  : "Tarea personal: queda como registro, sin tocar proyectos ni cobros."}
                {hours !== null && rate ? ` Ganas ${formatCOP(Math.round(hours * rate))}.` : ""}
              </FieldDescription>
            )}
          </Field>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => finish(null)}>
              Completar sin horas
            </Button>
            <Button type="submit" disabled={pending || hours === null}>
              {pending && <Spinner data-icon="inline-start" />}
              {hours !== null ? `Completar · ${formatDuration(hours)}` : "Completar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
