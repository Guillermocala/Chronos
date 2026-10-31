"use client";

import { CalculatorIcon } from "lucide-react";
import { useState } from "react";

import { settleMonthlyPayment } from "@/app/(app)/projects/payment-actions";
import { CopyButton } from "@/components/granola/copy-button";
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
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action-toast";
import { settlementText, type PeriodRow } from "@/lib/billing/hours-settlement";
import { formatCOP, formatDate } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

type Props = { projectName: string; fee: number; row: PeriodRow };

/**
 * Liquidar una mensualidad OPS: muestra período, horas, tarifa y el valor
 * calculado frente a la mensualidad. Permite copiar el detalle para la cuenta de cobro.
 */
export function SettleDialog({ projectName, fee, row }: Props) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  const s = row.settlement;
  if (!s || !row.expected || !row.payment) return null;

  const hours = row.hours.settleable;
  const settled = row.payment.settled_at != null;
  const text = settlementText({
    projectName,
    period: row,
    hours,
    expectedHours: row.expected,
    settlement: s,
    formatMoney: formatCOP,
    formatDate,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-xs" aria-label={settled ? "Volver a liquidar" : "Liquidar por horas"} title={settled ? "Volver a liquidar" : "Liquidar por horas"} />}
      >
        <CalculatorIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{settled ? "Volver a liquidar mensualidad" : "Liquidar mensualidad"}</DialogTitle>
          <DialogDescription>
            Horas del {formatDate(row.start)} al {formatDate(row.end)}. Cuentan alcance, soporte y horas
            directas; los extras facturables se cobran aparte.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Horas trabajadas</dt>
          <dd className="text-right tabular-nums">
            {formatDuration(hours)} de {formatDuration(row.expected)} ({Math.round(s.ratio * 100)} %)
          </dd>
          <dt className="text-muted-foreground">Valor hora</dt>
          <dd className="text-right tabular-nums">
            {formatCOP(fee)} ÷ {formatDuration(row.expected)} = {formatCOP(Math.round(s.rate))}
          </dd>
          <dt className="text-muted-foreground">Mensualidad pactada</dt>
          <dd className="text-right tabular-nums">{formatCOP(fee)}</dd>
          <dt className="font-medium">Cuenta de cobro</dt>
          <dd className="text-right text-base font-semibold tabular-nums">{formatCOP(s.amount)}</dd>
          <dt className="text-muted-foreground">Diferencia</dt>
          <dd
            className={cn(
              "text-right tabular-nums",
              s.difference < 0 ? "text-destructive" : s.difference > 0 ? "text-emerald-600 dark:text-emerald-400" : "",
            )}
          >
            {s.difference === 0 ? "—" : `${s.difference > 0 ? "+" : "−"}${formatCOP(Math.abs(s.difference))}`}
          </dd>
        </dl>

        {hours === 0 && (
          <p className="text-sm text-destructive">
            No hay horas registradas en este período. Regístralas en la pestaña Horas antes de liquidar.
          </p>
        )}

        <DialogFooter>
          <CopyButton text={text} label="Copiar detalle" />
          <Button
            disabled={pending || hours === 0}
            onClick={() => run(() => settleMonthlyPayment(row.payment!.id), () => setOpen(false))}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {settled ? "Actualizar a" : "Liquidar en"} {formatCOP(s.amount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
