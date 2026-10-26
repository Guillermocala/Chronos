"use client";

import { useState, useTransition, type FormEvent } from "react";

import {
  createProject,
  previewProjectUpdate,
  updateProject,
  type ProjectUpdatePreview,
} from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { markInvalidField, showResult, useAction } from "@/hooks/use-action-toast";
import type { Project } from "@/lib/data/projects";
import { BILLING_LABELS } from "@/lib/projects/labels";

import { ConfirmProjectUpdateDialog } from "./confirm-project-update-dialog";
import { MoneyInput } from "./money-input";

type Billing = Project["billing_type"];

export function ProjectForm({ project }: { project?: Project }) {
  const { pending, run, submit } = useAction();
  const [previewing, startPreview] = useTransition();
  const [billing, setBilling] = useState<Billing>(project?.billing_type ?? "fixed");
  const [syncPayments, setSyncPayments] = useState(true);
  // Edición: primero se muestra qué cambia y se guarda solo al confirmar.
  const [pendingUpdate, setPendingUpdate] = useState<{
    form: HTMLFormElement;
    formData: FormData;
    preview: ProjectUpdatePreview;
  } | null>(null);

  function reviewChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startPreview(async () => {
      const result = await previewProjectUpdate(formData);
      if (!result.ok) {
        showResult(result);
        markInvalidField(form, result.field);
        return;
      }
      setPendingUpdate({ form, formData, preview: result.preview });
    });
  }

  function confirmUpdate() {
    if (!pendingUpdate) return;
    const { form, formData } = pendingUpdate;
    run(
      () => updateProject(formData),
      undefined,
      undefined,
      (result) => {
        setPendingUpdate(null);
        markInvalidField(form, result.field);
      },
    );
  }

  const busy = pending || previewing;

  return (
    <form
      onSubmit={project ? reviewChanges : submit(createProject)}
      className="flex max-w-2xl flex-col gap-6"
    >
      {project && <input type="hidden" name="id" value={project.id} />}
      <input type="hidden" name="billing_type" value={billing} />

      <FieldSet>
        <FieldLegend>Proyecto</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input id="name" name="name" required defaultValue={project?.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="code_prefix">Prefijo</FieldLabel>
              <Input
                id="code_prefix"
                name="code_prefix"
                required
                maxLength={10}
                defaultValue={project?.code_prefix}
                placeholder="WEB…"
                className="uppercase"
              />
            </Field>
          </div>
          <FieldDescription>
            El prefijo numera los tickets (WEB-1, WEB-2…) y se usa al dictar: @WEB.
          </FieldDescription>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field>
              <FieldLabel htmlFor="client">Cliente</FieldLabel>
              <Input id="client" name="client" defaultValue={project?.client ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="color">Color</FieldLabel>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue={project?.color ?? "#6366f1"}
                className="p-1"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="drive_folder_url">Carpeta de Google Drive</FieldLabel>
            <Input
              id="drive_folder_url"
              name="drive_folder_url"
              type="url"
              defaultValue={project?.drive_folder_url ?? ""}
              placeholder="https://drive.google.com/drive/folders/…"
            />
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Cobro</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel>Modalidad</FieldLabel>
            <ToggleGroup
              value={[billing]}
              onValueChange={(value) => value[0] && setBilling(value[0] as Billing)}
              variant="outline"
              spacing={2}
            >
              {(Object.keys(BILLING_LABELS) as Billing[]).map((key) => (
                <ToggleGroupItem key={key} value={key}>
                  {BILLING_LABELS[key]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          {billing === "fixed" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="fixed_amount_cop">Valor total</FieldLabel>
                <MoneyInput id="fixed_amount_cop" name="fixed_amount_cop" required defaultValue={project?.fixed_amount_cop} />
              </Field>
              <Field>
                <FieldLabel htmlFor="estimated_total_hours">Horas estimadas</FieldLabel>
                <Input
                  id="estimated_total_hours"
                  name="estimated_total_hours"
                  inputMode="decimal"
                  defaultValue={project?.estimated_total_hours ?? ""}
                />
                <FieldDescription>Para calcular la tarifa por hora.</FieldDescription>
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="monthly_fee_cop">Mensualidad</FieldLabel>
                <MoneyInput id="monthly_fee_cop" name="monthly_fee_cop" required defaultValue={project?.monthly_fee_cop} />
              </Field>
              <Field>
                <FieldLabel htmlFor="expected_hours_per_month">Horas por mes</FieldLabel>
                <Input
                  id="expected_hours_per_month"
                  name="expected_hours_per_month"
                  inputMode="decimal"
                  required
                  defaultValue={project?.expected_hours_per_month ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contract_months">Meses de contrato</FieldLabel>
                <Input
                  id="contract_months"
                  name="contract_months"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={project?.contract_months ?? ""}
                />
                <FieldDescription>
                  Con fecha de inicio, se genera un pago por mes desde el mes siguiente al inicio.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="billing_day">Día de cobro</FieldLabel>
                <Input
                  id="billing_day"
                  name="billing_day"
                  type="number"
                  min={1}
                  max={28}
                  defaultValue={project?.billing_day ?? 1}
                />
              </Field>
            </div>
          )}

          {project && (billing === "retainer" || project.billing_type === "retainer") && (
            <Field orientation="horizontal">
              <input type="hidden" name="sync_payments" value={syncPayments ? "1" : "0"} />
              <Checkbox
                id="sync_payments"
                checked={syncPayments}
                onCheckedChange={(checked) => setSyncPayments(checked === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="sync_payments">Recalcular pagos mensuales pendientes</FieldLabel>
                <FieldDescription>
                  Los pagos pendientes se rehacen con los datos del contrato (inicio, meses, mensualidad,
                  día de cobro, modalidad). Antes de guardar verás cuáles cambian. Los pagos ya recibidos
                  no se modifican.
                </FieldDescription>
              </FieldContent>
            </Field>
          )}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Fechas y ritmo</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="start_date">Inicio</FieldLabel>
              <Input id="start_date" name="start_date" type="date" defaultValue={project?.start_date ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="end_date">Fin estimado</FieldLabel>
              <Input id="end_date" name="end_date" type="date" defaultValue={project?.end_date ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="default_sprint_days">Duración de sprint (días)</FieldLabel>
              <Input
                id="default_sprint_days"
                name="default_sprint_days"
                type="number"
                min={1}
                max={60}
                required
                defaultValue={project?.default_sprint_days ?? 14}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="support_days">Días de soporte tras la entrega</FieldLabel>
              <Input
                id="support_days"
                name="support_days"
                type="number"
                min={0}
                max={90}
                required
                defaultValue={project?.support_days ?? 14}
              />
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      <div>
        <Button type="submit" disabled={busy}>
          {busy && <Spinner data-icon="inline-start" />}
          {project ? "Revisar y guardar" : "Crear proyecto"}
        </Button>
      </div>

      {project && (
        <ConfirmProjectUpdateDialog
          preview={pendingUpdate?.preview ?? null}
          pending={pending}
          onOpenChange={(open) => !open && !pending && setPendingUpdate(null)}
          onConfirm={confirmUpdate}
        />
      )}
    </form>
  );
}
