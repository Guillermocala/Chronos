"use client";

import { PencilIcon, PlusIcon, RepeatIcon, Trash2Icon } from "lucide-react";

import { deleteRecurring, toggleRecurring } from "@/app/(app)/tasks/recurring-actions";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action-toast";
import type { ISODate } from "@/lib/dates";
import type { RecurringTask } from "@/lib/data/recurring";
import { relativeDay } from "@/lib/format";
import { describeRule } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

import { ProjectBadge } from "./project-badge";
import { RecurringDialog } from "./recurring-dialog";
import type { ProjectChoice } from "./task-dialog";

type Props = { items: RecurringTask[]; projects: ProjectChoice[]; today: ISODate };

export function RecurringList({ items, projects, today }: Props) {
  const { pending, run } = useAction();
  const createButton = (
    <RecurringDialog
      projects={projects}
      today={today}
      trigger={<Button size="sm" />}
      triggerLabel={
        <>
          <PlusIcon data-icon="inline-start" />
          Nueva recurrente
        </>
      }
    />
  );

  if (items.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RepeatIcon />
          </EmptyMedia>
          <EmptyTitle>Sin tareas recurrentes</EmptyTitle>
          <EmptyDescription>
            Por ejemplo: “Enviar cuenta de cobro” cada mes el día 1, o “Revisar backups” cada lunes.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{createButton}</EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>{createButton}</div>
      <ul className="flex flex-col divide-y rounded-lg border">
        {items.map((r) => (
          <li key={r.id} className={cn("flex items-center gap-3 px-3 py-2.5", !r.active && "opacity-60")}>
            <Switch
              checked={r.active}
              disabled={pending}
              aria-label={r.active ? `Pausar ${r.title}` : `Reanudar ${r.title}`}
              onCheckedChange={(checked) => run(() => toggleRecurring(r.id, checked))}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{r.title}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {describeRule(r)}
                {r.active && <> · próxima {relativeDay(r.next_due, today).toLowerCase()}</>}
                {r.lead_days > 0 && <> · se crea {r.lead_days} d antes</>}
                {r.project && <ProjectBadge {...r.project} />}
              </span>
            </div>
            <RecurringDialog
              projects={projects}
              today={today}
              recurring={r}
              trigger={<Button variant="ghost" size="icon-sm" aria-label={`Editar ${r.title}`} />}
              triggerLabel={<PencilIcon />}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar ${r.title}`}
              disabled={pending}
              onClick={() => run(() => deleteRecurring(r.id))}
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
