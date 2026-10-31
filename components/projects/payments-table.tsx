"use client";

import { CheckIcon, DownloadIcon, EllipsisIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import { regenerateMonthlyPayments } from "@/app/(app)/projects/actions";
import { restoreDeleted } from "@/app/(app)/undo-actions";
import { deletePayment, markPaymentReceived } from "@/app/(app)/projects/payment-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAction } from "@/hooks/use-action-toast";
import { isMonthlyBilling, type PeriodRow } from "@/lib/billing/hours-settlement";
import { daysBetween, type ISODate } from "@/lib/dates";
import type { Payment, Project } from "@/lib/data/projects";
import { formatCOP, formatDate, formatShortDate } from "@/lib/format";
import { PAYMENT_KIND_LABELS } from "@/lib/projects/labels";
import { formatDuration } from "@/lib/time";

import { PaymentDialog } from "./payment-dialog";
import { SettleDialog } from "./settle-dialog";

type Props = {
  project: Project;
  payments: Payment[];
  today: ISODate;
  /** Solo OPS: período y valor calculado de cada mensualidad (por id de pago). */
  settlements?: Record<string, PeriodRow>;
};

export function PaymentsTable({ project, payments, today, settlements }: Props) {
  const { pending, run } = useAction();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <PaymentDialog
          projectId={project.id}
          today={today}
          trigger={<Button size="sm" />}
          triggerLabel={
            <>
              <PlusIcon data-icon="inline-start" />
              Agregar pago
            </>
          }
        />
        {isMonthlyBilling(project.billing_type) && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => regenerateMonthlyPayments(project.id))}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Regenerar pagos mensuales
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<a href={`/api/reports/payments.csv?project=${project.id}&from=2000-01-01&to=2100-12-31`} download />}
        >
          <DownloadIcon data-icon="inline-start" />
          CSV
        </Button>
      </div>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Esperado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const overdue =
                payment.status === "expected" &&
                payment.due_date !== null &&
                daysBetween(payment.due_date, today) > 0;
              const settle = settlements?.[payment.id];
              const periodEnded = settle ? settle.end < today : false;
              return (
                <TableRow key={payment.id}>
                  <TableCell>
                    {PAYMENT_KIND_LABELS[payment.kind]}
                    {settle && (
                      <span className="block text-xs text-muted-foreground">
                        Horas {formatShortDate(settle.start)} – {formatShortDate(settle.end)}
                        {payment.settled_at ? (
                          <Badge variant="secondary" className="ml-1.5">
                            Liquidado · {formatDuration(Number(payment.settled_hours ?? 0))}
                          </Badge>
                        ) : payment.status === "expected" ? (
                          <Badge variant={periodEnded ? "destructive" : "outline"} className="ml-1.5">
                            {periodEnded ? "Por liquidar" : "Estimado"}
                          </Badge>
                        ) : null}
                      </span>
                    )}
                    {payment.note && (
                      <span className="block max-w-48 truncate text-xs text-muted-foreground">
                        {payment.note}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCOP(payment.amount_cop)}</TableCell>
                  <TableCell>{formatDate(payment.due_date)}</TableCell>
                  <TableCell>
                    {payment.status === "received" ? (
                      <Badge variant="secondary">Recibido {formatDate(payment.paid_at)}</Badge>
                    ) : (
                      <Badge variant={overdue ? "destructive" : "outline"}>
                        {overdue ? "Vencido" : "Pendiente"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {settle && payment.status === "expected" && project.monthly_fee_cop != null && (
                        <SettleDialog projectName={project.name} fee={project.monthly_fee_cop} row={settle} />
                      )}
                      {payment.status === "expected" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Marcar como recibido hoy"
                          title="Marcar como recibido hoy"
                          disabled={pending}
                          onClick={() => run(() => markPaymentReceived(payment.id))}
                        >
                          <CheckIcon />
                        </Button>
                      )}
                      <PaymentDialog
                        projectId={project.id}
                        today={today}
                        payment={payment}
                        trigger={<Button variant="ghost" size="icon-xs" aria-label="Editar pago" />}
                        triggerLabel={<PencilIcon />}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-xs" aria-label="Más acciones del pago" />}
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => run(() => deletePayment(payment.id), undefined, () => restoreDeleted("payments", payment.id))}
                            >
                              <Trash2Icon />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
