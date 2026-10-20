"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { quickAddTask } from "@/app/(app)/tasks/actions";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";

type Props = {
  /** Proyecto por defecto (desde el detalle de un proyecto). */
  projectId?: string;
  defaultMyDay?: boolean;
  /** Abrir al cargar (atajo "Nueva tarea" de la app instalada: /today?add=1). */
  defaultOpen?: boolean;
  variant?: "sidebar" | "button";
};

export function QuickAddDialog({ projectId, defaultMyDay = false, defaultOpen = false, variant = "button" }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const { pending, run } = useAction();

  const trigger =
    variant === "sidebar" ? (
      <SidebarMenuButton tooltip="Nueva tarea" variant="outline" />
    ) : (
      <Button size="sm" />
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>
        <PlusIcon data-icon="inline-start" />
        <span>Nueva tarea</span>
      </DialogTrigger>
      <DialogContent>
        <form
          action={(formData) => run(() => quickAddTask(formData), () => setOpen(false))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription>
              Escribe y presiona Enter. Puedes usar marcadores como en el dictado.
            </DialogDescription>
          </DialogHeader>
          {projectId && <input type="hidden" name="project_id" value={projectId} />}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="quick-add-text">Tarea</FieldLabel>
              <Input
                id="quick-add-text"
                name="text"
                autoComplete="off"
                autoFocus
                required
                placeholder="Llamar al contador !mañana #alta…"
              />
              <FieldDescription>
                @PREFIJO proyecto · !hoy / !viernes / !25/10 fecha · #alta prioridad ·
                (esperando: Ana) seguimiento
              </FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="quick-add-my-day" name="my_day" defaultChecked={defaultMyDay} />
              <FieldLabel htmlFor="quick-add-my-day">Agregar a Mi día</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
