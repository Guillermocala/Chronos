import { ArrowLeftIcon, KanbanSquareIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DocLink } from "@/components/tasks/doc-link";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { TimeLog } from "@/components/tickets/time-log";
import { TimerButton } from "@/components/tickets/timer-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { daysBetween, todayCO } from "@/lib/dates";
import { listProjectSprintChoices } from "@/lib/data/projects";
import { getProjectHours, getRunningTimer, getTicket } from "@/lib/data/tickets";
import { formatCOP, formatDate } from "@/lib/format";
import {
  TICKET_KIND_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/tickets/schema";
import { formatDuration } from "@/lib/time";
import { estimatedHourlyRate, ticketValue } from "@/lib/valuation";

export const metadata: Metadata = { title: "Ticket · Chronos" };

export default function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TicketContent params={params} />
    </Suspense>
  );
}

async function TicketContent({ params }: Pick<PageProps<"/tickets/[id]">, "params">) {
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const today = todayCO();
  const { project, sprint, source_note, time_entries, ...fields } = ticket;
  const [hours, running, sprints] = await Promise.all([
    getProjectHours(project.id),
    getRunningTimer(),
    listProjectSprintChoices(project.id),
  ]);

  const logged = time_entries.reduce((sum, e) => sum + Number(e.hours ?? 0), 0);
  const value = ticketValue(project, ticket, hours.scope_estimated);
  const rate = estimatedHourlyRate(project, hours.scope_estimated);
  const suggestedExtra =
    rate !== null ? Math.round(rate * Number(ticket.estimated_hours ?? logged ?? 0)) || null : null;
  const supportExpired =
    project.phase === "closed" ||
    (project.support_until !== null && daysBetween(project.support_until, today) > 0);

  return (
    <>
      <PageHeader
        title={
          <span>
            <span className="font-mono text-muted-foreground">{ticket.code}</span> {ticket.title}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Link href={`/projects/${project.id}`} className="hover:underline">
              {project.name}
            </Link>
            <Badge variant="outline">{TICKET_STATUS_LABELS[ticket.status]}</Badge>
            <Badge variant={ticket.kind === "scope" ? "outline" : "secondary"}>
              {TICKET_KIND_LABELS[ticket.kind]}
              {ticket.kind !== "scope" && (ticket.billable ? " · facturable" : " · no facturable")}
            </Badge>
            <Badge variant={ticket.priority <= 2 ? "destructive" : "outline"}>
              {TICKET_PRIORITY_LABELS[ticket.priority]}
            </Badge>
          </span>
        }
        actions={
          <>
            <TimerButton
              ticketId={ticket.id}
              code={ticket.code}
              running={running?.ticket.id === ticket.id}
              size="sm"
            />
            <TicketActions ticket={fields} sprints={sprints} suggestedExtraCOP={suggestedExtra} />
          </>
        }
      />

      {ticket.kind === "support" && supportExpired && (
        <Alert>
          <AlertTitle>La ventana de soporte ya terminó</AlertTitle>
          <AlertDescription>
            Si este trabajo es nuevo y no un ajuste de lo entregado, usa “Cobrar como extra”.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Estimado" value={formatDuration(ticket.estimated_hours != null ? Number(ticket.estimated_hours) : null)} />
        <StatCard label="Registrado" value={formatDuration(logged)} />
        <StatCard
          label={ticket.kind === "support" ? "Costo de oportunidad" : "Valor"}
          value={formatCOP(ticket.kind === "support" ? value.opportunityCost : value.value)}
        />
        <StatCard label="Fecha límite" value={formatDate(ticket.due_date)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {sprint ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/projects/${project.id}/sprints/${sprint.id}`} />}
          >
            <KanbanSquareIcon data-icon="inline-start" />
            {sprint.name}
          </Button>
        ) : (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/projects/${project.id}`} />}>
            <ArrowLeftIcon data-icon="inline-start" />
            Backlog del proyecto
          </Button>
        )}
        {ticket.doc_url && ticket.doc_kind && <DocLink url={ticket.doc_url} kind={ticket.doc_kind} />}
        {source_note && (
          <Link href={`/notes/${source_note.id}`} className="text-muted-foreground hover:underline">
            Origen: {source_note.title} ({formatDate(source_note.meeting_date)})
          </Link>
        )}
        {ticket.tags.map((tag) => (
          <span key={tag} className="text-muted-foreground">
            #{tag}
          </span>
        ))}
      </div>

      {ticket.description && (
        <Card>
          <CardHeader>
            <CardTitle>Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Horas</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeLog ticketId={ticket.id} entries={time_entries} today={today} />
        </CardContent>
      </Card>
    </>
  );
}
