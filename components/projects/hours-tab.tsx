import { TimeLog } from "@/components/tickets/time-log";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PeriodRow } from "@/lib/billing/hours-settlement";
import type { ISODate } from "@/lib/dates";
import type { ProjectTimeEntry } from "@/lib/data/tickets";
import { formatCOP, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/time";

type Props = {
  projectId: string;
  ops: boolean;
  fee: number | null;
  rows: PeriodRow[];
  /** Registros sin ticket (los de tickets se ven en cada ticket). */
  directEntries: ProjectTimeEntry[];
  today: ISODate;
};

const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });

function periodLabel(row: PeriodRow, ops: boolean) {
  if (ops) return `${formatShortDate(row.start)} – ${formatShortDate(row.end)}`;
  return monthFmt.format(new Date(`${row.start}T12:00:00Z`));
}

const percent = (hours: number, expected: number | null) =>
  expected ? Math.round((hours / expected) * 100) : null;

/** Pestaña "Horas": horas por mes (o por período de cobro en OPS) y registro directo. */
export function HoursTab({ projectId, ops, fee, rows, directEntries, today }: Props) {
  const current = rows.find((r) => r.current);
  const counted = (r: PeriodRow) => (ops ? r.hours.settleable : r.hours.total);

  return (
    <div className="flex flex-col gap-6">
      {current && current.expected && (
        <section className="flex flex-col gap-2 rounded-lg border p-4" aria-label="Período en curso">
          <p className="text-sm">
            <span className="font-medium">
              Llevas {formatDuration(counted(current))} de {formatDuration(current.expected)}
            </span>{" "}
            <span className="text-muted-foreground">
              ({percent(counted(current), current.expected)} %) · {periodLabel(current, ops)}
            </span>
          </p>
          <Progress
            value={Math.min(100, percent(counted(current), current.expected) ?? 0)}
            aria-label="Horas del período en curso"
          />
          {ops && current.settlement && (
            <p className="text-sm text-muted-foreground">
              Cuenta de cobro con las horas de hoy:{" "}
              <span className="font-medium text-foreground tabular-nums">{formatCOP(current.settlement.amount)}</span>
              {fee != null && ` de ${formatCOP(fee)}`}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="hours-periods-title">
        <h2 id="hours-periods-title" className="text-sm font-semibold">
          {ops ? "Horas por período de cobro" : "Horas por mes"}
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {ops ? "El proyecto aún no tiene mensualidades." : "Sin horas registradas."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ops ? "Período" : "Mes"}</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  {rows[0].expected && <TableHead className="text-right">Cumplido</TableHead>}
                  {ops && <TableHead className="text-right">Cuenta de cobro</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const pct = percent(counted(row), row.expected);
                  const s = row.settlement;
                  return (
                    <TableRow key={row.start} className={cn(row.current && "bg-muted/40")}>
                      <TableCell>
                        <span className="first-letter:uppercase">{periodLabel(row, ops)}</span>
                        {row.current && (
                          <Badge variant="secondary" className="ml-2">
                            En curso
                          </Badge>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {breakdown(row)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(counted(row))}</TableCell>
                      {rows[0].expected && (
                        <TableCell className="text-right tabular-nums">{pct === null ? "—" : `${pct} %`}</TableCell>
                      )}
                      {ops && (
                        <TableCell className="text-right tabular-nums">
                          {row.payment?.settled_at ? (
                            <>
                              {formatCOP(row.payment.amount_cop)}
                              <span className="block text-xs text-muted-foreground">
                                {row.payment.status === "received" ? "Recibido" : "Liquidado"}
                              </span>
                            </>
                          ) : s ? (
                            <>
                              {formatCOP(s.amount)}
                              <span
                                className={cn(
                                  "block text-xs",
                                  s.difference < 0 ? "text-destructive" : "text-muted-foreground",
                                )}
                              >
                                {s.difference === 0
                                  ? "= mensualidad"
                                  : `${s.difference > 0 ? "+" : "−"}${formatCOP(Math.abs(s.difference))}`}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {ops && (
          <p className="text-xs text-muted-foreground">
            Cuentan las horas de tickets (alcance y soporte) y las directas; los extras facturables se cobran
            aparte. Liquida cada mensualidad desde la pestaña Pagos.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="direct-hours-title">
        <h2 id="direct-hours-title" className="text-sm font-semibold">
          Horas directas al proyecto
        </h2>
        <p className="text-xs text-muted-foreground">
          Operación, reuniones o soporte que no vale la pena volver ticket.
        </p>
        <TimeLog projectId={projectId} entries={directEntries} today={today} />
      </section>
    </div>
  );
}

function breakdown(row: PeriodRow) {
  const parts = [
    ["alcance", row.hours.scope],
    ["soporte", row.hours.support],
    ["directas", row.hours.direct],
    ["extra", row.hours.extra],
  ] as const;
  const text = parts
    .filter(([, h]) => h > 0)
    .map(([label, h]) => `${label} ${formatDuration(h)}`)
    .join(" · ");
  return text || "sin horas";
}
