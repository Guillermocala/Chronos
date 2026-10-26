"use client";

import { BadgeDollarSignIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteTicket, markExtraBillable } from "@/app/(app)/tickets/actions";
import { restoreDeleted } from "@/app/(app)/undo-actions";
import { MoneyInput } from "@/components/projects/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";
import type { Ticket } from "@/lib/data/tickets";

import { TicketDialog, type SprintChoice } from "./ticket-dialog";

type Props = {
  ticket: Ticket;
  sprints: SprintChoice[];
  /** Horas × tarifa estimada, para precargar el cobro del extra. */
  suggestedExtraCOP: number | null;
};

export function TicketActions({ ticket, sprints, suggestedExtraCOP }: Props) {
  const router = useRouter();
  const { pending, run, submit } = useAction();
  const [extraOpen, setExtraOpen] = useState(false);

  return (
    <>
      <TicketDialog
        projectId={ticket.project_id}
        sprints={sprints}
        ticket={ticket}
        trigger={<Button variant="outline" size="sm" />}
        triggerLabel={
          <>
            <PencilIcon data-icon="inline-start" />
            Editar
          </>
        }
      />
      {!(ticket.kind === "extra" && ticket.billable) && (
        <Dialog open={extraOpen} onOpenChange={setExtraOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <BadgeDollarSignIcon data-icon="inline-start" />
            Cobrar como extra
          </DialogTrigger>
          <DialogContent>
            <form
              onSubmit={submit(markExtraBillable, () => setExtraOpen(false))}
              className="flex flex-col gap-4"
            >
              <DialogHeader>
                <DialogTitle>Cobrar {ticket.code} como extra</DialogTitle>
                <DialogDescription>
                  El ticket pasa a “Extra facturable” y se crea un pago esperado con su seguimiento
                  “Cobrar…”. Úsalo para trabajo fuera del alcance o pedido después del soporte.
                </DialogDescription>
              </DialogHeader>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <Field>
                <FieldLabel htmlFor="extra-amount">Monto a cobrar</FieldLabel>
                <MoneyInput id="extra-amount" name="amount" required defaultValue={suggestedExtraCOP} />
                <FieldDescription>Sugerido: horas estimadas × tarifa del proyecto.</FieldDescription>
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Crear cobro
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(
            () => deleteTicket(ticket.id),
            () => router.push(`/projects/${ticket.project_id}`),
            () => restoreDeleted("tickets", ticket.id),
          )
        }
      >
        <Trash2Icon data-icon="inline-start" />
        Eliminar
      </Button>
    </>
  );
}
