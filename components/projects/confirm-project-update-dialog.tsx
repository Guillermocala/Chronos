"use client";

import { TriangleAlertIcon } from "lucide-react";

import type { ProjectUpdatePreview } from "@/app/(app)/projects/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatCOP, formatDate } from "@/lib/format";

type Props = {
  preview: ProjectUpdatePreview | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

/** Resumen de lo que cambia al editar un proyecto, antes de guardarlo. */
export function ConfirmProjectUpdateDialog({ preview, pending, onOpenChange, onConfirm }: Props) {
  const payments = preview?.payments;
  const paymentsChange = payments && payments.sync && !payments.unchanged ? payments : null;
  const nothingToSave = preview !== null && preview.changes.length === 0 && !paymentsChange;
  const overdue = paymentsChange?.overdueCount ?? 0;
  const onlyPayments = preview !== null && preview.changes.length === 0 && paymentsChange !== null;

  return (
    <AlertDialog open={preview !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{nothingToSave ? "No hay cambios para guardar" : "¿Guardar los cambios?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {nothingToSave
              ? "El proyecto y sus pagos ya coinciden con lo que hay en el formulario."
              : onlyPayments
                ? "Los datos no cambian, pero los cobros pendientes no coinciden con el contrato (el primer cobro va el mes siguiente al inicio). Al guardar se ajustan."
                : "Revisa lo que va a cambiar en el proyecto."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {preview && preview.changes.length > 0 && (
          <section aria-labelledby="changes-title" className="flex flex-col gap-2 text-sm">
            <h3 id="changes-title" className="font-medium">
              Datos del proyecto
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {preview.changes.map((c) => (
                <div key={c.field} className="contents">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd className="min-w-0 break-words">
                    <span className="text-muted-foreground line-through">{c.before}</span>
                    <span aria-hidden> → </span>
                    <span className="sr-only"> pasa a </span>
                    <span className="font-medium">{c.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {paymentsChange && (
          <section aria-labelledby="payments-title" className="flex flex-col gap-2 text-sm">
            <h3 id="payments-title" className="font-medium">
              Pagos mensuales pendientes
            </h3>
            {overdue > 0 && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>
                  {overdue === 1 ? "1 cobro quedaría" : `${overdue} cobros quedarían`} con fecha anterior a hoy
                </AlertTitle>
                <AlertDescription>
                  Revisa la fecha de inicio y los meses de contrato. Si guardas, aparecerán como vencidos.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <PaymentList
                title={`Se quitan (${paymentsChange.removed.length})`}
                items={paymentsChange.removed.map((p) => ({ ...p, overdue: false }))}
                muted
              />
              <PaymentList title={`Se agregan (${paymentsChange.added.length})`} items={paymentsChange.added} />
            </div>
            {paymentsChange.kept > 0 && (
              <p className="text-muted-foreground">
                {paymentsChange.kept === 1
                  ? "1 cobro pendiente ya coincide y se conserva."
                  : `${paymentsChange.kept} cobros pendientes ya coinciden y se conservan.`}
              </p>
            )}
            {paymentsChange.receivedKept > 0 && (
              <p className="text-muted-foreground">
                {paymentsChange.receivedKept === 1
                  ? "1 pago ya recibido no se modifica."
                  : `${paymentsChange.receivedKept} pagos ya recibidos no se modifican.`}
              </p>
            )}
          </section>
        )}

        {payments && !payments.sync && !payments.unchanged && (
          <p className="text-sm text-muted-foreground">
            Desmarcaste &quot;Recalcular pagos mensuales pendientes&quot;: los pagos actuales no cambian aunque
            ya no coincidan con el contrato.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{nothingToSave ? "Cerrar" : "Seguir editando"}</AlertDialogCancel>
          {!nothingToSave && (
            <AlertDialogAction
              variant={overdue > 0 ? "destructive" : "default"}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending && <Spinner data-icon="inline-start" />}
              {overdue > 0 ? "Guardar de todas formas" : "Guardar cambios"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PaymentList({
  title,
  items,
  muted = false,
}: {
  title: string;
  items: { due_date: string; amount_cop: number | null; overdue: boolean }[];
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="flex flex-col gap-0.5 tabular-nums">
          {items.map((p) => (
            <li
              key={p.due_date}
              className={muted ? "text-muted-foreground line-through" : p.overdue ? "text-destructive" : undefined}
            >
              {formatDate(p.due_date)} · {formatCOP(p.amount_cop)}
              {p.overdue && <span className="ml-1 text-xs font-medium">(vencido)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
