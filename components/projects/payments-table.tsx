"use client";

import { CheckIcon, DownloadIcon, EllipsisIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import { regenerateMonthlyPayments } from "@/app/(app)/projects/actions";
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
import { daysBetween, type ISODate } from "@/lib/dates";
import type { Payment, Project } from "@/lib/data/projects";
import { formatCOP, formatDate } from "@/lib/format";
import { PAYMENT_KIND_LABELS } from "@/lib/projects/labels";

import { PaymentDialog } from "./payment-dialog";

type Props = { project: Project; payments: Payment[]; today: ISODate };

export function PaymentsTable({ project, payments, today }: Props) {
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
        {project.billing_type === "retainer" && (
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
              return (
                <TableRow key={payment.id}>
                  <TableCell>
                    {PAYMENT_KIND_LABELS[payment.kind]}
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
                              onClick={() => run(() => deletePayment(payment.id))}
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
