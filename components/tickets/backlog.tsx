import { KanbanSquareIcon } from "lucide-react";
import Link from "next/link";

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
import { daysBetween, type ISODate } from "@/lib/dates";
import type { Project, Sprint } from "@/lib/data/projects";
import type { TicketWithHours } from "@/lib/data/tickets";
import { formatCOP } from "@/lib/format";
import { TICKET_KIND_LABELS, TICKET_STATUS_LABELS } from "@/lib/tickets/schema";
import { formatDuration } from "@/lib/time";
import { ticketValue } from "@/lib/valuation";

import { QuickTicketForm } from "./quick-ticket-form";
import { TimerButton } from "./timer-button";

type Props = {
  project: Project;
  sprints: Sprint[];
  tickets: TicketWithHours[];
  scopeEstimated: number;
  runningTicketId: string | null;
  today: ISODate;
};

/** Pestaña "Tickets" del proyecto: agrupados por sprint (en curso, siguientes, pasados) y backlog. */
export function Backlog({ project, sprints, tickets, scopeEstimated, runningTicketId, today }: Props) {
  const isCurrent = (s: Sprint) => daysBetween(s.start_date, today) >= 0 && daysBetween(today, s.end_date) >= 0;
  const ordered = [...sprints].sort((a, b) => {
    const rank = (s: Sprint) => (isCurrent(s) ? 0 : daysBetween(today, s.start_date) > 0 ? 1 : 2);
    return rank(a) - rank(b) || a.start_date.localeCompare(b.start_date);
  });
  const groups = [
    ...ordered.map((s) => ({ key: s.id, sprint: s, items: tickets.filter((t) => t.sprint_id === s.id) })),
    { key: "backlog", sprint: null, items: tickets.filter((t) => !t.sprint_id) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <QuickTicketForm projectId={project.id} />
      {groups.map(({ key, sprint, items }) =>
        sprint === null && items.length === 0 ? null : (
          <section key={key} className="flex flex-col gap-2" aria-labelledby={`group-${key}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`group-${key}`} className="text-sm font-semibold">
                {sprint ? sprint.name : "Backlog (sin sprint)"}
              </h3>
              {sprint && isCurrent(sprint) && <Badge>En curso</Badge>}
              {sprint?.is_support && <Badge variant="secondary">Soporte</Badge>}
              <span className="text-xs text-muted-foreground">{items.length} tickets</span>
              {sprint && (
                <Button
                  variant="ghost"
                  size="xs"
                  nativeButton={false}
                  render={<Link href={`/projects/${project.id}/sprints/${sprint.id}`} />}
                >
                  <KanbanSquareIcon data-icon="inline-start" />
                  Tablero
                </Button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin tickets en este sprint.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">Cronómetro</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((t) => {
                    const value = ticketValue(project, t, scopeEstimated);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="max-w-80 whitespace-normal">
                          <Link href={`/tickets/${t.id}`} className="hover:underline">
                            <span className="font-mono text-xs text-muted-foreground">{t.code}</span> {t.title}
                          </Link>
                          {t.kind !== "scope" && (
                            <Badge variant="outline" className="ml-1.5">
                              {TICKET_KIND_LABELS[t.kind]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.status === "done" ? "secondary" : "outline"}>
                            {TICKET_STATUS_LABELS[t.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDuration(t.logged_hours)}
                          {t.estimated_hours != null && (
                            <span className="text-muted-foreground"> / {formatDuration(Number(t.estimated_hours))}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {value.value !== null ? formatCOP(value.value) : "—"}
                        </TableCell>
                        <TableCell>
                          <TimerButton ticketId={t.id} code={t.code} running={t.id === runningTicketId} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        ),
      )}
      {tickets.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin tickets todavía. Créalos arriba o convierte las tareas “Convertir a ticket” de tus dictados.
        </p>
      )}
    </div>
  );
}
