"use client";

import { Trash2Icon } from "lucide-react";
import { useRef } from "react";

import { deleteTimeEntry, logTime } from "@/app/(app)/tickets/time-actions";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";
import type { ISODate } from "@/lib/dates";
import type { TimeEntry } from "@/lib/data/tickets";
import { formatShortDate } from "@/lib/format";
import { formatDuration } from "@/lib/time";

const timeFormatter = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });

export function TimeLog({ ticketId, entries, today }: { ticketId: string; entries: TimeEntry[]; today: ISODate }) {
  const { pending, run } = useAction();
  const form = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        ref={form}
        action={(formData) => run(() => logTime(formData), () => form.current?.reset())}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="ticket_id" value={ticketId} />
        <FieldGroup className="grid gap-3 sm:grid-cols-[9rem_8rem_1fr_auto] sm:items-end">
          <Field>
            <FieldLabel htmlFor="log-date">Fecha</FieldLabel>
            <Input id="log-date" name="date" type="date" required defaultValue={today} />
          </Field>
          <Field>
            <FieldLabel htmlFor="log-duration">Duración</FieldLabel>
            <Input id="log-duration" name="duration" required placeholder="1:30" autoComplete="off" />
          </Field>
          <Field>
            <FieldLabel htmlFor="log-note">Nota</FieldLabel>
            <Input id="log-note" name="note" autoComplete="off" />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Registrar
          </Button>
        </FieldGroup>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin horas registradas.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {entries.map((e) => {
            const runningEntry = e.hours === null && e.ended_at === null;
            const manual = e.started_at === e.ended_at;
            return (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-muted-foreground">
                  {formatShortDate(dateOf.format(new Date(e.started_at)))}
                </span>
                <span className="w-24 shrink-0 font-medium tabular-nums">
                  {runningEntry ? "En curso…" : formatDuration(Number(e.hours))}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {e.note ?? (manual ? "Registro manual" : `${timeFormatter.format(new Date(e.started_at))}${e.ended_at ? ` – ${timeFormatter.format(new Date(e.ended_at))}` : ""}`)}
                </span>
                {!runningEntry && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Eliminar registro"
                    disabled={pending}
                    onClick={() => run(() => deleteTimeEntry(e.id))}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
