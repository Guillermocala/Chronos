"use client";

import { useState, type ReactElement, type ReactNode } from "react";

import { saveRecurring } from "@/app/(app)/tasks/recurring-actions";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/hooks/use-action-toast";
import { isISODate, type ISODate } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
import { describeRule, upcoming, WEEKDAYS, type Frequency, type Rule } from "@/lib/recurrence";
import type { Tables } from "@/lib/supabase/database.types";

import type { ProjectChoice } from "./task-dialog";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

type Props = {
  projects: ProjectChoice[];
  today: ISODate;
  recurring?: Tables<"recurring_tasks">;
  trigger: ReactElement;
  triggerLabel: ReactNode;
};

export function RecurringDialog({ projects, today, recurring, trigger, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  const [frequency, setFrequency] = useState<Frequency>(recurring?.frequency ?? "monthly");
  const [interval, setInterval] = useState(String(recurring?.interval ?? 1));
  const [weekdayValue, setWeekday] = useState(String(recurring?.weekday ?? 1));
  const [monthDay, setMonthDay] = useState(String(recurring?.month_day ?? 1));
  const [start, setStart] = useState<string>(recurring?.next_due ?? today);
  const [kind, setKind] = useState(recurring?.kind ?? "todo");
  const p = recurring?.id ?? "new";

  const rule: Rule = {
    frequency,
    interval: Math.min(12, Math.max(1, Number(interval) || 1)),
    weekday: frequency === "weekly" ? Number(weekdayValue) : null,
    month_day: frequency === "monthly" ? Math.min(31, Math.max(1, Number(monthDay) || 1)) : null,
  };
  const preview = isISODate(start) ? upcoming(rule, start, 3) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-lg">
        <form
          action={(formData) => run(() => saveRecurring(formData), () => setOpen(false))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{recurring ? "Editar tarea recurrente" : "Nueva tarea recurrente"}</DialogTitle>
            <DialogDescription>Se crea sola en la fecha que toca, a las 6 a. m.</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={recurring?.id ?? ""} />
          <input type="hidden" name="frequency" value={frequency} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${p}-title`}>Título</FieldLabel>
              <Input
                id={`${p}-title`}
                name="title"
                required
                defaultValue={recurring?.title}
                placeholder="Enviar cuenta de cobro…"
              />
            </Field>
            <Field>
              <FieldLabel>Frecuencia</FieldLabel>
              <ToggleGroup
                value={[frequency]}
                onValueChange={(value) => value[0] && setFrequency(value[0] as Frequency)}
                variant="outline"
                spacing={2}
              >
                {FREQUENCIES.map((f) => (
                  <ToggleGroupItem key={f.value} value={f.value}>
                    {f.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${p}-interval`}>
                  Cada ({frequency === "daily" ? "días" : frequency === "weekly" ? "semanas" : "meses"})
                </FieldLabel>
                <Input
                  id={`${p}-interval`}
                  name="interval"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                />
              </Field>
              {frequency === "weekly" && (
                <Field>
                  <FieldLabel htmlFor={`${p}-weekday`}>Día de la semana</FieldLabel>
                  <NativeSelect
                    id={`${p}-weekday`}
                    name="weekday"
                    value={weekdayValue}
                    onChange={(e) => setWeekday(e.target.value)}
                  >
                    {WEEKDAYS.map((day, i) => (
                      <NativeSelectOption key={day} value={String(i)}>
                        {day}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              {frequency === "monthly" && (
                <Field>
                  <FieldLabel htmlFor={`${p}-month-day`}>Día del mes</FieldLabel>
                  <Input
                    id={`${p}-month-day`}
                    name="month_day"
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={monthDay}
                    onChange={(e) => setMonthDay(e.target.value)}
                  />
                  <FieldDescription>31 = último día de cada mes.</FieldDescription>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor={`${p}-start`}>{recurring ? "Próxima fecha" : "Desde"}</FieldLabel>
                <Input
                  id={`${p}-start`}
                  name="start"
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${p}-lead`}>Crearla con anticipación (días)</FieldLabel>
                <Input
                  id={`${p}-lead`}
                  name="lead_days"
                  type="number"
                  min={0}
                  max={14}
                  defaultValue={recurring?.lead_days ?? 0}
                />
              </Field>
            </div>
            <p className="rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
              <span className="font-medium">{describeRule(rule)}.</span>{" "}
              {preview.length > 0 && <>Próximas: {preview.map((d) => formatShortDate(d)).join(" · ")}</>}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${p}-kind`}>Tipo</FieldLabel>
                <NativeSelect
                  id={`${p}-kind`}
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  <NativeSelectOption value="todo">Tarea</NativeSelectOption>
                  <NativeSelectOption value="follow_up">Seguimiento</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${p}-priority`}>Prioridad</FieldLabel>
                <NativeSelect id={`${p}-priority`} name="priority" defaultValue={String(recurring?.priority ?? 2)}>
                  <NativeSelectOption value="1">Alta</NativeSelectOption>
                  <NativeSelectOption value="2">Media</NativeSelectOption>
                  <NativeSelectOption value="3">Baja</NativeSelectOption>
                </NativeSelect>
              </Field>
              {kind === "follow_up" && (
                <Field>
                  <FieldLabel htmlFor={`${p}-waiting`}>Esperando a</FieldLabel>
                  <Input id={`${p}-waiting`} name="waiting_on" defaultValue={recurring?.waiting_on ?? ""} />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor={`${p}-project`}>Proyecto</FieldLabel>
                <NativeSelect id={`${p}-project`} name="project_id" defaultValue={recurring?.project_id ?? ""}>
                  <NativeSelectOption value="">Personal (sin proyecto)</NativeSelectOption>
                  {projects.map((pr) => (
                    <NativeSelectOption key={pr.id} value={pr.id}>
                      {pr.code_prefix} · {pr.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${p}-tags`}>Etiquetas</FieldLabel>
                <Input id={`${p}-tags`} name="tags" defaultValue={recurring?.tags.join(", ") ?? ""} placeholder="admin…" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`${p}-doc`}>Documento o carpeta de Drive</FieldLabel>
              <Input id={`${p}-doc`} name="doc" type="url" defaultValue={recurring?.doc_url ?? ""} />
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
