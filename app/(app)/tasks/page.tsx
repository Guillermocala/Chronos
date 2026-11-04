import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadDataMenu } from "@/components/import/load-data-menu";
import { PageHeader } from "@/components/page-header";
import { GroupHeader } from "@/components/tasks/group-header";
import { QuickAddDialog } from "@/components/tasks/quick-add-dialog";
import { RecurringList } from "@/components/tasks/recurring-list";
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
import { VoiceDictation } from "@/components/voice/voice-dictation";
import { requireUser } from "@/lib/auth";
import { todayCO } from "@/lib/dates";
import { listProjectOptions, listProjectRates } from "@/lib/data/projects";
import { listRecurring } from "@/lib/data/recurring";
import { getTaskRewards } from "@/lib/data/quests";
import { listTasks, TASK_VIEWS, type TaskView } from "@/lib/data/tasks";
import { summarizeTasks } from "@/lib/tasks/summary";
import { matchesWhen, TASK_WHEN, whenOf, type TaskWhen } from "@/lib/tasks/today";

export const metadata: Metadata = { title: "Tareas · Chronos" };

const EMPTY_TEXT: Record<TaskView, string> = {
  upcoming: "No hay nada vencido, para hoy ni para los próximos 7 días.",
  waiting: "No estás esperando nada de nadie.",
  inbox: "La bandeja está vacía: todo tiene fecha.",
  done: "Todavía no hay tareas completadas.",
  recurring: "Sin tareas recurrentes.",
};

const UPCOMING_GROUPS: { key: Exclude<TaskWhen, "">; title: string }[] = [
  { key: "overdue", title: "Vencidas" },
  { key: "today", title: "Hoy" },
  { key: "week", title: "Próximos días" },
];

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <PageHeader
        title="Tareas"
        description="Pendientes y seguimientos de todos tus proyectos y de lo personal."
        actions={
          <div className="flex items-center gap-2">
            <LoadDataMenu />
            <Suspense fallback={null}>
              <TasksDictation />
            </Suspense>
            <QuickAddDialog />
          </div>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TasksContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Dictado por voz: lo dictado sin fecha cae en la bandeja de entrada. */
async function TasksDictation() {
  await requireUser();
  const projects = await listProjectRates();
  return <VoiceDictation projects={projects} today={todayCO()} />;
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

  const [all, projects, recurring] = await Promise.all([
    listTasks({ view, project, tag }, today),
    listProjectOptions({ includeClosed: true }),
    view === "recurring" ? listRecurring() : Promise.resolve([]),
  ]);

  // Filtro por fecha: solo en las vistas con fechas.
  const datedView = view === "upcoming" || view === "waiting";
  const requestedWhen = param(params.when) ?? "";
  const when: TaskWhen = datedView && TASK_WHEN.some((w) => w.key === requestedWhen) ? (requestedWhen as TaskWhen) : "";
  const whenCounts = datedView
    ? Object.fromEntries(TASK_WHEN.map((w) => [w.key, all.filter((t) => whenOf(t, today) === w.key).length]))
    : undefined;
  const tasks = all.filter((t) => matchesWhen(t, when, today));
  const rewards = view === "upcoming" ? await getTaskRewards(tasks) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <TaskFilters
        view={view}
        project={project}
        tag={tag}
        projects={projects}
        when={when}
        whenCounts={whenCounts as Record<Exclude<TaskWhen, "">, number> | undefined}
      />
      {view === "recurring" ? (
        <RecurringList
          items={recurring.filter(
            (r) => !project || (project === "personal" ? r.project_id === null : r.project_id === project),
          )}
          projects={projects}
          today={today}
        />
      ) : tasks.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Sin tareas</EmptyTitle>
            <EmptyDescription>{when ? "Nada en este filtro de fecha." : EMPTY_TEXT[view]}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view === "upcoming" ? (
        <div className="flex flex-col gap-6">
          {UPCOMING_GROUPS.map((group) => {
            const items = tasks.filter((t) => (whenOf(t, today) ?? "week") === group.key);
            if (items.length === 0) return null;
            return (
              <section key={group.key} className="flex flex-col gap-2" aria-labelledby={`tasks-${group.key}`}>
                <GroupHeader
                  id={`tasks-${group.key}`}
                  title={group.title}
                  summary={summarizeTasks(items, rewards)}
                  tone={group.key === "overdue" ? "destructive" : "default"}
                />
                <TaskList tasks={items} today={today} projects={projects} rewards={rewards} />
              </section>
            );
          })}
        </div>
      ) : (
        <TaskList tasks={tasks} today={today} projects={projects} />
      )}
    </div>
  );
}
