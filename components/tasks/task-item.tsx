"use client";

import {
  CalendarPlusIcon,
  CalendarXIcon,
  ClockIcon,
  EllipsisIcon,
  HourglassIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import {
  deleteTask,
  planTask,
  setTaskStatus,
  snoozeTask,
} from "@/app/(app)/tasks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action-toast";
import { daysBetween, type ISODate } from "@/lib/dates";
import type { TaskWithProject } from "@/lib/data/tasks";
import { relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DocLink } from "./doc-link";
import { ProjectBadge } from "./project-badge";
import { TaskDialog, type ProjectChoice } from "./task-dialog";

type Props = {
  task: TaskWithProject;
  today: ISODate;
  projects: ProjectChoice[];
};

export function TaskItem({ task, today, projects }: Props) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const done = task.status === "done";
  const overdue = !done && task.due_date !== null && daysBetween(task.due_date, today) > 0;
  const inMyDay = task.planned_on !== null && daysBetween(task.planned_on, today) >= 0;
  const waitingDays = daysBetween(task.created_at.slice(0, 10), today);

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50",
        pending && "opacity-60",
      )}
    >
      <Checkbox
        className="mt-0.5"
        checked={done}
        disabled={pending}
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
        onCheckedChange={(checked) =>
          run(() => setTaskStatus(task.id, checked ? "done" : "open"))
        }
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "text-left text-sm break-words",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {task.project && <ProjectBadge {...task.project} />}
          {task.priority === 1 && <Badge variant="destructive">Alta</Badge>}
          {task.kind === "follow_up" && (
            <Badge variant="secondary">
              <HourglassIcon data-icon="inline-start" />
              {task.waiting_on ? `Esperando a ${task.waiting_on}` : "Seguimiento"}
              {waitingDays > 0 && ` · ${waitingDays} d`}
            </Badge>
          )}
          {task.due_date && (
            <Badge variant={overdue ? "destructive" : "outline"}>
              <ClockIcon data-icon="inline-start" />
              {relativeDay(task.due_date, today)}
            </Badge>
          )}
          {inMyDay && !done && <Badge variant="secondary">Mi día</Badge>}
          {task.is_ticket_candidate && <Badge variant="outline">Convertir a ticket</Badge>}
          {task.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </div>
      {task.doc_url && task.doc_kind && <DocLink url={task.doc_url} kind={task.doc_kind} />}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" aria-label="Acciones de la tarea" />}
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <PencilIcon />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run(() => planTask(task.id, !inMyDay))}>
              {inMyDay ? <CalendarXIcon /> : <CalendarPlusIcon />}
              {inMyDay ? "Quitar de Mi día" : "Agregar a Mi día"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run(() => snoozeTask(task.id, 1))}>
              <ClockIcon />
              Posponer a mañana
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run(() => snoozeTask(task.id, 7))}>
              <ClockIcon />
              Posponer una semana
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => run(() => deleteTask(task.id))}>
              <Trash2Icon />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskDialog task={task} projects={projects} open={editing} onOpenChange={setEditing} />
    </li>
  );
}
