"use client";

import { useState, type ReactElement } from "react";

import { savePayment } from "@/app/(app)/projects/payment-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action-toast";
import type { ISODate } from "@/lib/dates";
import type { Payment } from "@/lib/data/projects";
import { PAYMENT_KIND_LABELS } from "@/lib/projects/labels";

import { MoneyInput } from "./money-input";

type Props = {
  projectId: string;
  today: ISODate;
  payment?: Payment;
  trigger: ReactElement;
  triggerLabel: React.ReactNode;
};

export function PaymentDialog({ projectId, today, payment, trigger, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(payment?.status ?? "expected");
  const { pending, run } = useAction();
  const prefix = payment?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <form
          action={(formData) => run(() => savePayment(formData), () => setOpen(false))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{payment ? "Editar pago" : "Agregar pago"}</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="id" value={payment?.id ?? ""} />
          <input type="hidden" name="project_id" value={projectId} />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${prefix}-kind`}>Tipo</FieldLabel>
                <NativeSelect id={`${prefix}-kind`} name="kind" defaultValue={payment?.kind ?? "advance"}>
                  {Object.entries(PAYMENT_KIND_LABELS).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-amount`}>Monto</FieldLabel>
                <MoneyInput id={`${prefix}-amount`} name="amount_cop" required defaultValue={payment?.amount_cop} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-status`}>Estado</FieldLabel>
                <NativeSelect
                  id={`${prefix}-status`}
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <NativeSelectOption value="expected">Pendiente</NativeSelectOption>
                  <NativeSelectOption value="received">Recibido</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-due`}>Fecha esperada</FieldLabel>
                <Input id={`${prefix}-due`} name="due_date" type="date" defaultValue={payment?.due_date ?? ""} />
              </Field>
              {status === "received" && (
                <Field>
                  <FieldLabel htmlFor={`${prefix}-paid`}>Fecha de pago</FieldLabel>
                  <Input
                    id={`${prefix}-paid`}
                    name="paid_at"
                    type="date"
                    required
                    defaultValue={payment?.paid_at ?? today}
                  />
                </Field>
              )}
            </div>
            <Field>
              <FieldLabel htmlFor={`${prefix}-note`}>Nota</FieldLabel>
              <Textarea id={`${prefix}-note`} name="note" rows={2} defaultValue={payment?.note ?? ""} />
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
