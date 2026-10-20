import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { QuickAddDialog } from "@/components/tasks/quick-add-dialog";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskList } from "@/components/tasks/task-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { todayCO } from "@/lib/dates";
import { listProjectOptions } from "@/lib/data/projects";
import { listTasks, TASK_VIEWS, type TaskView } from "@/lib/data/tasks";

export const metadata: Metadata = { title: "Tareas · Chronos" };

const EMPTY_TEXT: Record<TaskView, string> = {
  upcoming: "No hay nada programado para los próximos 7 días.",
  waiting: "No estás esperando nada de nadie.",
  inbox: "La bandeja está vacía: todo tiene fecha.",
  done: "Todavía no hay tareas completadas.",
};

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <PageHeader
        title="Tareas"
        description="Pendientes y seguimientos de todos tus proyectos y de lo personal."
        actions={<QuickAddDialog />}
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TasksContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function TasksContent({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  await requireUser();
  const params = await searchParams;
  const requested = param(params.view);
  const view: TaskView = TASK_VIEWS.some((v) => v.key === requested)
    ? (requested as TaskView)
    : "upcoming";
  const project = param(params.project) || undefined;
  const tag = param(params.tag) || undefined;
  const today = todayCO();

  const [tasks, projects] = await Promise.all([
    listTasks({ view, project, tag }, today),
    listProjectOptions({ includeClosed: true }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <TaskFilters view={view} project={project} tag={tag} projects={projects} />
      {tasks.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Sin tareas</EmptyTitle>
            <EmptyDescription>{EMPTY_TEXT[view]}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TaskList tasks={tasks} today={today} projects={projects} />
      )}
    </div>
  );
}
