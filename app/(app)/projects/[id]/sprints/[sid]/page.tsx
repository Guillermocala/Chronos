import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { KanbanBoard } from "@/components/tickets/kanban-board";
import { QuickTicketForm } from "@/components/tickets/quick-ticket-form";
import { TicketDialog } from "@/components/tickets/ticket-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatCOP } from "@/lib/format";
import { getProjectHours, getRunningTimer, getSprint, listSprintTickets } from "@/lib/data/tickets";
import { formatDuration } from "@/lib/time";
import { sprintValue, ticketValue } from "@/lib/valuation";

export const metadata: Metadata = { title: "Tablero · Chronos" };

export default function SprintBoardPage({ params }: PageProps<"/projects/[id]/sprints/[sid]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SprintBoard params={params} />
    </Suspense>
  );
}

async function SprintBoard({ params }: Pick<PageProps<"/projects/[id]/sprints/[sid]">, "params">) {
  const { id, sid } = await params;
  const sprint = await getSprint(sid);
  if (!sprint || sprint.project_id !== id) notFound();
  const { project } = sprint;

  const [tickets, hours, running] = await Promise.all([
    listSprintTickets(sid),
    getProjectHours(id),
    getRunningTimer(),
  ]);

  const values = Object.fromEntries(
    tickets.map((t) => [t.id, ticketValue(project, t, hours.scope_estimated).value]),
  );
  const scopeHoursInSprint = tickets
    .filter((t) => t.kind === "scope")
    .reduce((sum, t) => sum + Number(t.estimated_hours ?? 0), 0);
  const value = sprintValue(project, sprint, scopeHoursInSprint, hours.scope_estimated);
  const estimated = tickets.reduce((sum, t) => sum + Number(t.estimated_hours ?? 0), 0);
  const logged = tickets.reduce((sum, t) => sum + t.logged_hours, 0);
  const done = tickets.filter((t) => t.status === "done").length;

  return (
    <>
      <PageHeader
        title={sprint.name}
        description={`${project.name} · ${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)}${sprint.goal ? ` · ${sprint.goal}` : ""}`}
        actions={
          <>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/projects/${id}`} />}>
              <ArrowLeftIcon data-icon="inline-start" />
              Proyecto
            </Button>
            <TicketDialog
              projectId={id}
              sprints={[{ id: sprint.id, name: sprint.name }]}
              defaultSprintId={sprint.id}
              trigger={<Button size="sm" />}
              triggerLabel={
                <>
                  <PlusIcon data-icon="inline-start" />
                  Ticket
                </>
              }
            />
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Valor del sprint"
          value={value.value !== null ? formatCOP(value.value) : "—"}
          hint={value.source === "retainer" ? "prorrateado" : value.source === "tickets" ? "por tickets" : undefined}
        />
        <StatCard label="Horas estimadas" value={formatDuration(estimated)} />
        <StatCard label="Horas registradas" value={formatDuration(logged)} />
        <StatCard label="Hechos" value={`${done} / ${tickets.length}`} />
      </div>
      <QuickTicketForm projectId={id} sprintId={sprint.id} />
      <KanbanBoard tickets={tickets} values={values} runningTicketId={running?.ticket.id ?? null} />
    </>
  );
}
