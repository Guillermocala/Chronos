"use client";

import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { createTask, getTaskFormOptions, quickAddTask } from "@/app/(app)/tasks/actions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action-toast";
import { todayCO } from "@/lib/dates";

import { EMPTY_TASK_FIELDS, TaskFields, type ProjectChoice } from "./task-fields";

type Props = {
  /** Proyecto por defecto (desde el detalle de un proyecto). */
  projectId?: string;
  defaultMyDay?: boolean;
  /** Abrir al cargar (atajo "Nueva tarea" de la app instalada: /today?add=1). */
  defaultOpen?: boolean;
  variant?: "sidebar" | "button";
};

type Mode = "quick" | "detailed";
const MODE_KEY = "chronos:new-task-mode";

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "detailed" ? "detailed" : "quick";
  } catch {
    return "quick";
  }
}

function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Sin almacenamiento (modo privado): no se recuerda.
  }
}

/**
 * "Nueva tarea" con dos modos:
 * - Rápida: una línea con marcadores (@WEB !viernes #alta ~2h).
 * - Detallada: todos los campos, con fecha de inicio hoy y estimado opcional.
 */
export function QuickAddDialog({ projectId, defaultMyDay = false, defaultOpen = false, variant = "button" }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<Mode>("quick");
  const [text, setText] = useState("");
  // Se incrementa para reiniciar el formulario detallado con valores nuevos.
  const [formKey, setFormKey] = useState(0);
  const [projects, setProjects] = useState<ProjectChoice[] | null>(null);
  const quick = useAction();
  const detailed = useAction();

  // Los proyectos (con su tarifa) se piden al abrir: el botón del menú lateral no los tiene.
  useEffect(() => {
    if (!open || mode !== "detailed" || projects) return;
    let active = true;
    getTaskFormOptions()
      .then((list) => active && setProjects(list))
      .catch(() => active && setProjects([]));
    return () => {
      active = false;
    };
  }, [open, mode, projects]);

  const changeMode = (next: Mode) => {
    setMode(next);
    saveMode(next);
    if (next === "detailed") setFormKey((k) => k + 1);
  };

  // La última pestaña usada se recuerda al abrir.
  const openDialog = () => {
    const remembered = readMode();
    setMode(remembered);
    if (remembered === "detailed") setFormKey((k) => k + 1);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setText("");
  };

  const trigger =
    variant === "sidebar" ? (
      <SidebarMenuButton tooltip="Nueva tarea" variant="outline" />
    ) : (
      <Button size="sm" />
    );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? openDialog() : close())}>
      <DialogTrigger render={trigger}>
        <PlusIcon data-icon="inline-start" />
        <span>Nueva tarea</span>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>
            {mode === "quick"
              ? "Escribe y presiona Enter. Puedes usar marcadores como en el dictado."
              : "Con todos los campos. Las horas estimadas son opcionales."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(value) => changeMode(value as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="quick">Rápida</TabsTrigger>
            <TabsTrigger value="detailed">Detallada</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="pt-2">
            <form onSubmit={quick.submit(quickAddTask, close)} className="flex flex-col gap-4">
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
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Llamar al contador !mañana #alta…"
                  />
                  <FieldDescription>
                    @PREFIJO proyecto · !hoy / !viernes / !25/10 fecha · #alta prioridad · ~2h horas ·
                    (esperando: Ana) seguimiento
                  </FieldDescription>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox id="quick-add-my-day" name="my_day" defaultChecked={defaultMyDay} />
                  <FieldLabel htmlFor="quick-add-my-day">Agregar a Mi día</FieldLabel>
                </Field>
              </FieldGroup>
              <DialogFooter className="items-center sm:justify-between">
                <Button type="button" variant="link" className="px-0" onClick={() => changeMode("detailed")}>
                  Más campos → Detallada
                </Button>
                <Button type="submit" disabled={quick.pending}>
                  {quick.pending && <Spinner data-icon="inline-start" />}
                  Crear
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="detailed" className="pt-2">
            {projects === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Spinner /> Cargando proyectos…
              </div>
            ) : (
              <form
                key={formKey}
                onSubmit={detailed.submit(createTask, close)}
                className="flex flex-col gap-4"
              >
                <FieldGroup>
                  <TaskFields
                    idPrefix="new-task"
                    projects={projects}
                    autoFocus
                    defaults={{
                      ...EMPTY_TASK_FIELDS,
                      title: text,
                      project_id: projectId ?? "",
                      planned_on: todayCO(),
                    }}
                  />
                </FieldGroup>
                <DialogFooter>
                  <Button type="submit" disabled={detailed.pending}>
                    {detailed.pending && <Spinner data-icon="inline-start" />}
                    Crear tarea
                  </Button>
                </DialogFooter>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
