import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { CashflowChart, HoursChart } from "@/components/reports/charts";
import { ReportFilters } from "@/components/reports/report-filters";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { addDays, todayCO } from "@/lib/dates";
import {
  listReportEntries,
  listReportPayments,
  listReportProjects,
} from "@/lib/data/reports";
import { formatCOP, formatShortDate, plural } from "@/lib/format";
import {
  formatMonth,
  monthlyCashflow,
  monthsBetween,
  REPORT_RANGE_MONTHS,
  shiftMonth,
} from "@/lib/reports/cashflow";
import { hoursByProject, mondayOf, weeklyHours } from "@/lib/reports/hours";
import { formatDuration } from "@/lib/time";
import { paymentTotals, projectValuation } from "@/lib/valuation";

export const metadata: Metadata = { title: "Reportes · Chronos" };

const WEEKS = 8;

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <>
      <PageHeader
        title="Reportes"
        description="Cobros, horas y tarifas de tus proyectos."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function ReportsContent({
  searchParams,
}: Pick<PageProps<"/reports">, "searchParams">) {
  await requireUser();
  const params = await searchParams;
  const project = param(params.project) || undefined;
  const requestedMonths = Number(param(params.months));
  const months = (REPORT_RANGE_MONTHS as readonly number[]).includes(
    requestedMonths,
  )
    ? requestedMonths
    : 6;

  const today = todayCO();
  const currentMonth = today.slice(0, 7);
  const fromMonth = shiftMonth(currentMonth, -(months - 1));
  const toMonth = shiftMonth(currentMonth, 3);
  const weeksFrom = addDays(mondayOf(today), -7 * (WEEKS - 1));

  const [payments, entries, allProjects] = await Promise.all([
    listReportPayments(project),
    listReportEntries(weeksFrom, today, project),
    listReportProjects(),
  ]);
  const projects = project
    ? allProjects.filter((p) => p.id === project)
    : allProjects;

  const cashflow = monthlyCashflow(payments, fromMonth, toMonth, today).map(
    (m) => ({ ...m, label: formatMonth(m.month) }),
  );
  const inRange = payments.filter((p) => {
    const month = (p.status === "received" ? p.paid_at : p.due_date)?.slice(
      0,
      7,
    );
    return (
      month !== undefined &&
      monthsBetween(fromMonth, currentMonth).includes(month)
    );
  });
  const rangeTotals = paymentTotals(inRange, today);
  const totals = paymentTotals(payments, today);
  const weekly = weeklyHours(
    entries.map((e) => ({
      started_at: e.started_at,
      hours: e.hours,
      deleted_at: e.deleted_at,
      kind: e.ticket.kind,
    })),
    WEEKS,
    today,
  ).map((w) => ({
    ...w,
    label: formatShortDate(w.week).replace(/^\w+,\s*/, ""),
  }));
  const weeklyTotal = weekly.reduce(
    (sum, w) => sum + w.scope + w.support + w.extra,
    0,
  );
  const byProject = hoursByProject(
    projects.map((p) => ({
      project_id: p.id,
      code_prefix: p.code_prefix,
      name: p.name,
      scope_logged: p.hours.scope_logged,
      support_logged: p.hours.support_logged,
      extra_logged: p.hours.extra_logged,
    })),
  );

  const csvParams = new URLSearchParams({
    from: `${fromMonth}-01`,
    to: today,
    ...(project ? { project } : {}),
  });

  return (
    <div className="flex flex-col gap-6">
      <ReportFilters project={project} months={months} projects={allProjects} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`Cobrado (${months} meses)`}
          value={formatCOP(rangeTotals.received)}
        />
        <StatCard label="Pendiente" value={formatCOP(totals.expected)} />
        <StatCard
          label="Vencido"
          value={formatCOP(totals.overdue)}
          hint={
            totals.overdueCount > 0 ? plural(totals.overdueCount, "pago", "pagos") : undefined
          }
        />
        <StatCard
          label={`Horas (${WEEKS} semanas)`}
          value={formatDuration(weeklyTotal)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cobros por mes</CardTitle>
          <CardDescription>
            Recibido por fecha de pago; pendiente y vencido por fecha esperada.
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={`/api/reports/payments.csv?${csvParams}`} download />
              }
            >
              <DownloadIcon data-icon="inline-start" />
              CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CashflowChart data={cashflow} />
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Ver tabla
            </summary>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Recibido</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Vencido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashflow.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{m.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(m.received)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCOP(m.pending)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.overdue > 0
                        ? `⚠ ${formatCOP(m.overdue)}`
                        : formatCOP(0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horas por semana</CardTitle>
          <CardDescription>
            Últimas {WEEKS} semanas, por tipo de ticket (semana desde el lunes).
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={`/api/reports/hours.csv?${csvParams}`} download />
              }
            >
              <DownloadIcon data-icon="inline-start" />
              CSV de horas
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <HoursChart data={weekly} />
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Ver tabla
            </summary>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead className="text-right">Alcance</TableHead>
                  <TableHead className="text-right">Soporte</TableHead>
                  <TableHead className="text-right">Extra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekly.map((w) => (
                  <TableRow key={w.week}>
                    <TableCell>{w.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(w.scope)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(w.support)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(w.extra)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horas y tarifa por proyecto</CardTitle>
          <CardDescription>
            Totales históricos. La tarifa real incluye las horas de soporte no
            cobradas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {byProject.length > 0 ? (
            <HoursChart data={byProject} layout="horizontal" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no hay horas registradas.
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Tarifa estimada</TableHead>
                <TableHead className="text-right">Tarifa real</TableHead>
                <TableHead className="text-right">Soporte absorbido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const received = payments
                  .filter(
                    (x) =>
                      x.project_id === p.id &&
                      x.status === "received" &&
                      x.kind !== "extra",
                  )
                  .reduce((sum, x) => sum + x.amount_cop, 0);
                const v = projectValuation(p, p.hours, received);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.code_prefix}
                      </span>{" "}
                      {p.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(v.loggedHours)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.estimatedRate !== null
                        ? `${formatCOP(v.estimatedRate)}/h`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.realRate !== null ? `${formatCOP(v.realRate)}/h` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(p.hours.support_logged)}
                      {v.support.opportunityCostCOP ? (
                        <span className="block text-xs text-muted-foreground">
                          {formatCOP(v.support.opportunityCostCOP)}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
