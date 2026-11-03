"use client";

import { Settings2Icon } from "lucide-react";
import { useState } from "react";

import { saveQuestSettings } from "@/app/(app)/quests/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";
import type { QuestSettings } from "@/lib/quests/streak";

// Lunes primero (0 = domingo en la base).
const DAYS = [
  [1, "Lun"],
  [2, "Mar"],
  [3, "Mié"],
  [4, "Jue"],
  [5, "Vie"],
  [6, "Sáb"],
  [0, "Dom"],
] as const;

export function QuestSettingsDialog({ settings }: { settings: QuestSettings }) {
  const [open, setOpen] = useState(false);
  const { pending, submit } = useAction();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Settings2Icon data-icon="inline-start" />
        Reglas
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit(saveQuestSettings, () => setOpen(false))} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reglas del juego</DialogTitle>
            <DialogDescription>Cuándo un día cuenta para la racha.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="quest-min">Misiones por día</FieldLabel>
              <Input
                id="quest-min"
                name="daily_min_tasks"
                type="number"
                min={1}
                max={20}
                required
                defaultValue={settings.daily_min_tasks}
                className="w-24"
              />
              <FieldDescription>Completa al menos estas para cumplir el día.</FieldDescription>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Días laborables</FieldLegend>
              <FieldDescription>
                Fuera de ellos la racha no se rompe; si cumples, suman. Tienes 1 comodín por semana para un día
                fallado.
              </FieldDescription>
              <div className="flex flex-wrap gap-3">
                {DAYS.map(([value, label]) => (
                  <Field key={value} orientation="horizontal" className="w-auto">
                    <Checkbox
                      id={`quest-day-${value}`}
                      name="work_days"
                      value={String(value)}
                      defaultChecked={settings.work_days.includes(value)}
                    />
                    <FieldLabel htmlFor={`quest-day-${value}`}>{label}</FieldLabel>
                  </Field>
                ))}
              </div>
            </FieldSet>
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
