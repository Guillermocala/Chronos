import { CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { GroupHeader } from "@/components/tasks/group-header";
import { ProjectBadge } from "@/components/tasks/project-badge";
import { QuickAddDialog } from "@/components/tasks/quick-add-dialog";
import { TimerButton } from "@/components/tickets/timer-button";
import { TaskList } from "@/components/tasks/task-list";
import { VoiceDictation } from "@/components/voice/voice-dictation";
import { Badge } from "@/components/ui/badge";
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
import { listAllPayments, listProjectRates } from "@/lib/data/projects";
import { getTaskRewards } from "@/lib/data/quests";
import { listDoneToday, listTodayCandidates } from "@/lib/data/tasks";
import { realHours } from "@/lib/tasks/hours";
import { summarizeTasks } from "@/lib/tasks/summary";
import { getRunningTimer, listTicketsInProgress } from "@/lib/data/tickets";
import { formatCOP, plural } from "@/lib/format";
import { groupTodayTasks, TODAY_GROUPS } from "@/lib/tasks/today";
import { formatDuration } from "@/lib/time";
import { paymentTotals } from "@/lib/valuation";

export const metadata: Metadata = { title: "Hoy · Chronos" };

export default function TodayPage({ searchParams }: PageProps<"/today">) {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayContent searchParams={searchParams} />
    </Suspense>
  );
}

const longDate = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

async function TodayContent({ searchParams }: Pick<PageProps<"/today">, "searchParams">) {
  await requireUser();
  const today = todayCO();
  const month = today.slice(0, 7);

  const [tasks, doneToday, projects, payments, inProgress, running] = await Promise.all([
    listTodayCandidates(today),
    listDoneToday(today),
    listProjectRates(),
    listAllPayments(),
    listTicketsInProgress(),
    getRunningTimer(),
  ]);

  const params = await searchParams;
  const groups = groupTodayTasks(tasks, today);
  const pendingCount = Object.values(groups).reduce((n, g) => n + g.length, 0);
  const myDayHours = groups.myDay.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
  // Misiones: chip "+$X" en lo que se juega hoy.
  const rewards = await getTaskRewards([...groups.overdue, ...groups.myDay, ...groups.dueToday, ...doneToday]);
  // Resumen del día: lo que falta (valor + horas estimadas) y lo hecho (horas reales vs estimadas).
  const myDayCop = groups.myDay.reduce((sum, t) => sum + (rewards[t.id]?.cop ?? 0), 0);
  const doneCop = doneToday.reduce((sum, t) => sum + (rewards[t.id]?.cop ?? 0), 0);
  const doneReal = doneToday.reduce((sum, t) => sum + realHours(t), 0);
  const doneEstimate = doneToday.reduce((sum, t) => sum + Number(t.estimated_hours ?? 0), 0);

  const totals = paymentTotals(payments, today);
  const committedThisMonth = payments
    .filter((p) => p.due_date?.startsWith(month))
    .reduce((sum, p) => sum + p.amount_cop, 0);
  const receivedThisMonth = payments
    .filter((p) => p.status === "received" && p.paid_at?.startsWith(month))
    .reduce((sum, p) => sum + p.amount_cop, 0);

  const dateLabel = longDate.format(new Date(`${today}T12:00:00-05:00`));

  return (
    <>
      <PageHeader
        title="Hoy"
        description={
          <span className="first-letter:uppercase">
            {dateLabel} · {pendingCount === 0 ? "sin pendientes" : `${pendingCount} pendientes`}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <VoiceDictation
              projects={projects}
              today={today}
              defaultMyDay
              defaultOpen={params.dictate === "1"}
            />
            <QuickAddDialog defaultMyDay defaultOpen={params.add === "1"} />
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3" aria-label="Resumen de tu día">
        <StatCard
          label="Mi día · por hacer"
          value={formatCOP(myDayCop)}
          hint={`${plural(groups.myDay.length, "tarea", "tareas")}${myDayHours > 0 ? ` · ~${formatDuration(myDayHours)} estimadas` : ""}`}
        />
        <StatCard
          label="Hecho hoy"
          value={doneReal > 0 ? `${formatDuration(doneReal)} reales` : plural(doneToday.length, "tarea", "tareas")}
          hint={
            doneToday.length === 0
              ? "Aún nada completado."
              : [
                  doneReal > 0 ? plural(doneToday.length, "tarea", "tareas") : null,
                  doneEstimate > 0 ? `~${formatDuration(doneEstimate)} estimadas` : null,
                  doneCop > 0 ? formatCOP(doneCop) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
        />
      </section>

      {inProgress.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="group-tickets">
          <div className="flex items-center gap-2">
            <h2 id="group-tickets" className="text-sm font-semibold">
              Tickets en curso
            </h2>
            <Badge variant="secondary">{inProgress.length}</Badge>
          </div>
          <ul className="flex flex-col">
            {inProgress.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                <TimerButton ticketId={t.id} code={t.code} running={running?.ticket.id === t.id} />
                <Link href={`/tickets/${t.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                  <span className="font-mono text-xs text-muted-foreground">{t.code}</span> {t.title}
                </Link>
                {t.project && <ProjectBadge {...t.project} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingCount === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Nada pendiente para hoy</EmptyTitle>
            <EmptyDescription>
              Agrega tareas a Mi día o revisa los próximos 7 días en Tareas.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {TODAY_GROUPS.filter((g) => groups[g.key].length > 0).map((group) => (
            <section key={group.key} className="flex flex-col gap-2" aria-labelledby={`group-${group.key}`}>
              <GroupHeader
                id={`group-${group.key}`}
                title={group.title}
                summary={summarizeTasks(groups[group.key], rewards)}
                tone={group.key === "overdue" ? "destructive" : "default"}
              />
              <TaskList tasks={groups[group.key]} today={today} projects={projects} rewards={rewards} />
            </section>
          ))}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen de cobros">
        <StatCard label="Comprometido este mes" value={formatCOP(committedThisMonth)} />
        <StatCard label="Cobrado este mes" value={formatCOP(receivedThisMonth)} />
        <StatCard label="Pendiente total" value={formatCOP(totals.expected)} />
        <StatCard
          label="Vencido"
          value={formatCOP(totals.overdue)}
          hint={totals.overdueCount > 0 ? plural(totals.overdueCount, "pago", "pagos") : undefined}
        />
      </section>
    </>
  );
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
