"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { deleteSprint } from "@/app/(app)/projects/sprint-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAction } from "@/hooks/use-action-toast";
import { addDays, daysBetween, type ISODate } from "@/lib/dates";
import type { Project, Sprint } from "@/lib/data/projects";
import { formatCOP, formatDate } from "@/lib/format";
import { sprintValue } from "@/lib/valuation";

import { SprintDialog } from "./sprint-dialog";

type Props = { project: Project; sprints: Sprint[]; today: ISODate };

const VALUE_HINT = {
  override: "manual",
  retainer: "prorrateado",
  tickets: "por tickets",
  pending: "se calcula con los tickets",
} as const;

export function SprintsList({ project, sprints, today }: Props) {
  const { pending, run } = useAction();
  const latest = sprints.reduce<Sprint | null>(
    (acc, s) => (!acc || s.end_date > acc.end_date ? s : acc),
    null,
  );
  const suggestedStart =
    latest && daysBetween(today, latest.end_date) >= 0 ? addDays(latest.end_date, 1) : today;
  const dialogProps = {
    projectId: project.id,
    defaultSprintDays: project.default_sprint_days,
    suggestedStart,
    nextNumber: sprints.filter((s) => !s.is_support).length + 1,
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <SprintDialog
          {...dialogProps}
          trigger={<Button size="sm" />}
          triggerLabel={
            <>
              <PlusIcon data-icon="inline-start" />
              Nuevo sprint
            </>
          }
        />
      </div>
      {sprints.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin sprints. La duración por defecto de este proyecto es de {project.default_sprint_days} días.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sprint</TableHead>
              <TableHead>Fechas</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sprints.map((sprint) => {
              const value = sprintValue(project, sprint);
              const current =
                daysBetween(sprint.start_date, today) >= 0 && daysBetween(today, sprint.end_date) >= 0;
              return (
                <TableRow key={sprint.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{sprint.name}</span>
                      {current && <Badge>En curso</Badge>}
                      {sprint.is_support && <Badge variant="secondary">Soporte</Badge>}
                    </div>
                    {sprint.goal && (
                      <span className="block max-w-64 truncate text-xs text-muted-foreground">{sprint.goal}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="tabular-nums">{value.value !== null ? formatCOP(value.value) : "—"}</span>
                    <span className="block text-xs text-muted-foreground">{VALUE_HINT[value.source]}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <SprintDialog
                        {...dialogProps}
                        sprint={sprint}
                        trigger={<Button variant="ghost" size="icon-xs" aria-label={`Editar ${sprint.name}`} />}
                        triggerLabel={<PencilIcon />}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Eliminar ${sprint.name}`}
                        disabled={pending}
                        onClick={() => run(() => deleteSprint(sprint.id, project.id))}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
