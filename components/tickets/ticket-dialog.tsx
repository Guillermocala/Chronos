"use client";

import { useState, type ReactElement, type ReactNode } from "react";

import { saveTicket } from "@/app/(app)/tickets/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action-toast";
import type { Ticket } from "@/lib/data/tickets";
import {
  TICKET_KIND_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
} from "@/lib/tickets/schema";

export type SprintChoice = { id: string; name: string };

type Props = {
  projectId: string;
  sprints: SprintChoice[];
  ticket?: Ticket;
  defaultSprintId?: string | null;
  trigger: ReactElement;
  triggerLabel: ReactNode;
};

export function TicketDialog({ projectId, sprints, ticket, defaultSprintId, trigger, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(ticket?.kind ?? "scope");
  const { pending, submit } = useAction();
  const p = ticket?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={submit(saveTicket, () => setOpen(false))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{ticket ? `Editar ${ticket.code}` : "Nuevo ticket"}</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="id" value={ticket?.id ?? ""} />
          <input type="hidden" name="project_id" value={projectId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${p}-title`}>Título</FieldLabel>
              <Input id={`${p}-title`} name="title" required defaultValue={ticket?.title} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${p}-description`}>Descripción</FieldLabel>
              <Textarea id={`${p}-description`} name="description" rows={4} defaultValue={ticket?.description ?? ""} />
              <FieldDescription>Admite Markdown.</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${p}-status`}>Estado</FieldLabel>
                <NativeSelect id={`${p}-status`} name="status" defaultValue={ticket?.status ?? "backlog"}>
                  {TICKET_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {TICKET_STATUS_LABELS[s]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${p}-priority`}>Prioridad</FieldLabel>
                <NativeSelect id={`${p}-priority`} name="priority" defaultValue={String(ticket?.priority ?? 3)}>
                  {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${p}-hours`}>Horas estimadas</FieldLabel>
                <Input
                  id={`${p}-hours`}
                  name="estimated_hours"
                  inputMode="decimal"
                  defaultValue={ticket?.estimated_hours ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${p}-due`}>Fecha límite</FieldLabel>
                <Input id={`${p}-due`} name="due_date" type="date" defaultValue={ticket?.due_date ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${p}-sprint`}>Sprint</FieldLabel>
                <NativeSelect
                  id={`${p}-sprint`}
                  name="sprint_id"
                  defaultValue={ticket?.sprint_id ?? defaultSprintId ?? ""}
                >
                  <NativeSelectOption value="">Sin sprint (backlog)</NativeSelectOption>
                  {sprints.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${p}-kind`}>Tipo</FieldLabel>
                <NativeSelect
                  id={`${p}-kind`}
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  {Object.entries(TICKET_KIND_LABELS).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {kind === "extra" && (
              <Field orientation="horizontal">
                <Checkbox id={`${p}-billable`} name="billable" defaultChecked={ticket?.billable ?? true} />
                <FieldLabel htmlFor={`${p}-billable`}>Se cobra aparte (facturable)</FieldLabel>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor={`${p}-tags`}>Etiquetas</FieldLabel>
              <Input id={`${p}-tags`} name="tags" defaultValue={ticket?.tags.join(", ") ?? ""} placeholder="front, api…" />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${p}-doc`}>Documento o carpeta de Drive</FieldLabel>
              <Input id={`${p}-doc`} name="doc" type="url" defaultValue={ticket?.doc_url ?? ""} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
