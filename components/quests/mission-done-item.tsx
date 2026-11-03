"use client";

import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { ProjectBadge } from "@/components/tasks/project-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAction } from "@/hooks/use-action-toast";
import type { TaskWithProject } from "@/lib/data/tasks";
import type { Reward } from "@/lib/quests/reward";
import { cn } from "@/lib/utils";

import { RewardBadge } from "./reward-badge";

/** Misión completada hoy: se puede desmarcar si fue un error. */
export function MissionDoneItem({
  id,
  title,
  project,
  reward,
}: {
  id: string;
  title: string;
  project: TaskWithProject["project"];
  reward: Reward;
}) {
  const { pending, run } = useAction();
  return (
    <li className={cn("flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50", pending && "opacity-60")}>
      <Checkbox
        className="mt-0.5"
        checked
        disabled={pending}
        aria-label="Marcar como pendiente"
        onCheckedChange={(checked) => {
          if (!checked) run(() => setTaskStatus(id, "open"));
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm break-words text-muted-foreground line-through">{title}</span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <RewardBadge reward={reward} done />
          {project && <ProjectBadge {...project} />}
        </div>
      </div>
    </li>
  );
}
