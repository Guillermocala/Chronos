"use client";

import { ClockIcon } from "lucide-react";
import Link from "next/link";

import { DocLink } from "@/components/tasks/doc-link";
import { Badge } from "@/components/ui/badge";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { setTicketStatus } from "@/app/(app)/tickets/actions";
import { useAction } from "@/hooks/use-action-toast";
import type { TicketWithHours } from "@/lib/data/tickets";
import { formatCOP } from "@/lib/format";
import {
  TICKET_KIND_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketStatus,
} from "@/lib/tickets/schema";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

import { TimerButton } from "./timer-button";

type Props = {
  ticket: TicketWithHours;
  value: number | null;
  running: boolean;
  dragging?: boolean;
};

export function TicketCard({ ticket, value, running, dragging }: Props) {
  const { pending, run } = useAction();
  const overEstimate =
    ticket.estimated_hours != null &&
    ticket.logged_hours > Number(ticket.estimated_hours);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm shadow-xs",
        dragging && "opacity-50",
        running && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/tickets/${ticket.id}`}
          className="min-w-0 break-words hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span
            className="font-mono text-xs text-muted-foreground"
            translate="no"
          >
            {ticket.code}
          </span>{" "}
          {ticket.title}
        </Link>
        <TimerButton
          ticketId={ticket.id}
          code={ticket.code}
          running={running}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {ticket.priority <= 2 && (
          <Badge variant={ticket.priority === 1 ? "destructive" : "secondary"}>
            {TICKET_PRIORITY_LABELS[ticket.priority]}
          </Badge>
        )}
        {ticket.kind !== "scope" && (
          <Badge variant={ticket.kind === "extra" ? "default" : "outline"}>
            {TICKET_KIND_LABELS[ticket.kind]}
            {ticket.kind === "extra" && !ticket.billable && " (no facturable)"}
          </Badge>
        )}
        <Badge variant={overEstimate ? "destructive" : "outline"}>
          <ClockIcon data-icon="inline-start" />
          {formatDuration(ticket.logged_hours)}
          {ticket.estimated_hours != null &&
            ` / ${formatDuration(Number(ticket.estimated_hours))}`}
        </Badge>
        {value !== null && value > 0 && (
          <span className="text-muted-foreground tabular-nums">
            {formatCOP(value)}
          </span>
        )}
        {ticket.doc_url && ticket.doc_kind && (
          <DocLink url={ticket.doc_url} kind={ticket.doc_kind} />
        )}
      </div>
      {/* Alternativa al arrastre (celular, lectores de pantalla). */}
      <NativeSelect
        size="sm"
        aria-label={`Estado de ${ticket.code}`}
        value={ticket.status}
        disabled={pending}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) =>
          run(() => setTicketStatus(ticket.id, e.target.value as TicketStatus))
        }
        className="md:hidden"
      >
        {TICKET_STATUSES.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {TICKET_STATUS_LABELS[s]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
