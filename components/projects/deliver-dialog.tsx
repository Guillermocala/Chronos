"use client";

import { PackageCheckIcon } from "lucide-react";
import { useState } from "react";

import { deliverProject } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";
import type { ISODate } from "@/lib/dates";

import { MoneyInput } from "./money-input";

type Props = {
  projectId: string;
  supportDays: number;
  today: ISODate;
  /** Valor del contrato − cobrado; precarga el pago final. */
  remainingCOP: number | null;
};

export function DeliverDialog({ projectId, supportDays, today, remainingCOP }: Props) {
  const [open, setOpen] = useState(false);
  const [registerFinal, setRegisterFinal] = useState(remainingCOP !== null && remainingCOP > 0);
  const { pending, run } = useAction();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PackageCheckIcon data-icon="inline-start" />
        Marcar entregado
      </DialogTrigger>
      <DialogContent>
        <form
          action={(formData) => run(() => deliverProject(formData), () => setOpen(false))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Marcar entregado</DialogTitle>
            <DialogDescription>
              Abre la ventana de soporte: los tickets nuevos contarán como soporte no facturable y se
              crea el seguimiento “Cerrar soporte”.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={projectId} />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="delivered_at">Fecha de entrega</FieldLabel>
                <Input id="delivered_at" name="delivered_at" type="date" required defaultValue={today} />
              </Field>
              <Field>
                <FieldLabel htmlFor="support_days">Días de soporte</FieldLabel>
                <Input
                  id="support_days"
                  name="support_days"
                  type="number"
                  min={0}
                  max={90}
                  required
                  defaultValue={supportDays}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="register_final"
                name="register_final"
                checked={registerFinal}
                onCheckedChange={setRegisterFinal}
              />
              <FieldLabel htmlFor="register_final">Registrar pago final</FieldLabel>
            </Field>
            {registerFinal && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="final_amount">Monto</FieldLabel>
                  <MoneyInput id="final_amount" name="final_amount" required defaultValue={remainingCOP} />
                  <FieldDescription>Precargado con lo que falta por cobrar.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="final_status">Estado</FieldLabel>
                  <NativeSelect id="final_status" name="final_status" defaultValue="received">
                    <NativeSelectOption value="received">Recibido</NativeSelectOption>
                    <NativeSelectOption value="expected">Pendiente</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
            )}
            <Field orientation="horizontal">
              <Checkbox id="create_support_sprint" name="create_support_sprint" defaultChecked />
              <FieldLabel htmlFor="create_support_sprint">Crear sprint de soporte</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Confirmar entrega
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
