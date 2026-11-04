"use client";

import {
  CalendarPlusIcon,
  CalendarXIcon,
  ClockIcon,
  EllipsisIcon,
  HourglassIcon,
  PencilIcon,
  TicketIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  deleteTask,
  planTask,
  setTaskStatus,
  snoozeTask,
} from "@/app/(app)/tasks/actions";
import { convertTaskToTicket } from "@/app/(app)/tickets/actions";
import { restoreDeleted } from "@/app/(app)/undo-actions";
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
import { RewardBadge } from "@/components/quests/reward-badge";
import { useAction } from "@/hooks/use-action-toast";
import { daysBetween, type ISODate } from "@/lib/dates";
import type { TaskWithProject } from "@/lib/data/tasks";
import { relativeDay } from "@/lib/format";
import type { Reward } from "@/lib/quests/reward";
import { defaultCompletionHours, realHours } from "@/lib/tasks/hours";
import { cn } from "@/lib/utils";

import { DocLink } from "./doc-link";
import { HoursBadge } from "./hours-badge";
import { ProjectBadge } from "./project-badge";
import { CompleteTaskDialog } from "./complete-task-dialog";
import { TaskDialog, type ProjectChoice } from "./task-dialog";

type Props = {
  task: TaskWithProject;
  today: ISODate;
  projects: ProjectChoice[];
  /** Misiones: cuánto vale terminarla. */
  reward?: Reward;
};

export function TaskItem({ task, today, projects, reward }: Props) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const done = task.status === "done";
  const overdue = !done && task.due_date !== null && daysBetween(task.due_date, today) > 0;
  const inMyDay = task.planned_on !== null && daysBetween(task.planned_on, today) >= 0;
  const waitingDays = daysBetween(task.created_at.slice(0, 10), today);
  const loggedHours = realHours(task);
  const estimate = task.estimated_hours != null ? Number(task.estimated_hours) : null;
  // Al completarla se pregunta cuánto tomó (opcional: si no, se registra lo estimado).
  // Las automáticas (entregas, cobros) no llevan horas.
  const askHours = !task.auto_source;

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
        onCheckedChange={(checked) => {
          if (checked && askHours) setCompleting(true);
          else run(() => setTaskStatus(task.id, checked ? "done" : "open"));
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "rounded-sm text-left text-sm break-words outline-none focus-visible:ring-2 focus-visible:ring-ring",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {reward && <RewardBadge reward={reward} done={done} />}
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
          <HoursBadge real={loggedHours} estimated={estimate} />
          {task.is_ticket_candidate && <Badge variant="outline">Convertir a ticket</Badge>}
          {task.recurring_task_id && (
            <Link href="/tasks?view=recurring" className="hover:underline" title="Tarea recurrente">
              ↻ Recurrente
            </Link>
          )}
          {task.source_note_id && (
            <Link href={`/notes/${task.source_note_id}`} className="hover:underline">
              Ver nota
            </Link>
          )}
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
            {task.is_ticket_candidate && !done && (
              <DropdownMenuItem
                onClick={() =>
                  task.project_id
                    ? run(() => convertTaskToTicket(task.id))
                    : setEditing(true)
                }
              >
                <TicketIcon />
                {task.project_id ? "Convertir a ticket" : "Asignar proyecto para convertir"}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => run(() => deleteTask(task.id), undefined, () => restoreDeleted("tasks", task.id))}>
              <Trash2Icon />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskDialog task={task} projects={projects} open={editing} onOpenChange={setEditing} />
      {askHours && (
        <CompleteTaskDialog
          taskId={task.id}
          title={task.title}
          projectCode={task.project?.code_prefix}
          rate={reward?.rate}
          fallbackHours={defaultCompletionHours(task)}
          open={completing}
          onOpenChange={setCompleting}
        />
      )}
    </li>
  );
}
