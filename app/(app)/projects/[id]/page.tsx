import { TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { PaymentsTable } from "@/components/projects/payments-table";
import { ProjectActions } from "@/components/projects/project-actions";
import { SprintsList } from "@/components/projects/sprints-list";
import { Backlog } from "@/components/tickets/backlog";
import { StatCard } from "@/components/stat-card";
import { QuickAddDialog } from "@/components/tasks/quick-add-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayCO } from "@/lib/dates";
import { getProject, listProjectOptions } from "@/lib/data/projects";
import { listProjectTasks } from "@/lib/data/tasks";
import { getProjectHours, getRunningTimer, listProjectTickets } from "@/lib/data/tickets";
import { formatCOP, formatDate, formatHours } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import { BILLING_LABELS, phaseInfo } from "@/lib/projects/labels";
import { contractValue, paymentTotals, projectValuation } from "@/lib/valuation";

export const metadata: Metadata = { title: "Proyecto · Chronos" };

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProjectContent params={params} />
    </Suspense>
  );
}

async function ProjectContent({ params }: Pick<PageProps<"/projects/[id]">, "params">) {
  const { id } = await params;
  const [project, tasks, projects, tickets, hours, running] = await Promise.all([
    getProject(id),
    listProjectTasks(id),
    listProjectOptions(),
    listProjectTickets(id),
    getProjectHours(id),
    getRunningTimer(),
  ]);
  if (!project) notFound();

  const today = todayCO();
  const { payments, sprints, ...fields } = project;
  const phase = phaseInfo(project, today);
  const value = contractValue(project);
  const totals = paymentTotals(payments, today);
  const remaining = value !== null ? Math.max(0, value - totals.received) : null;
  // Tarifa real: solo lo cobrado del contrato (los extras se cobran aparte).
  const receivedContract = payments
    .filter((p) => p.status === "received" && p.kind !== "extra")
    .reduce((sum, p) => sum + p.amount_cop, 0);
  const valuation = projectValuation(project, hours, receivedContract);
  const scopeHoursBySprint = Object.fromEntries(
    sprints.map((s) => [
      s.id,
      tickets
        .filter((t) => t.sprint_id === s.id && t.kind === "scope")
        .reduce((sum, t) => sum + Number(t.estimated_hours ?? 0), 0),
    ]),
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full bg-muted-foreground"
              style={project.color ? { backgroundColor: project.color } : undefined}
            />
            {project.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{project.code_prefix}</Badge>
            <Badge variant={phase.variant}>{phase.label}</Badge>
            <span>{BILLING_LABELS[project.billing_type]}</span>
            {project.client && <span>· {project.client}</span>}
          </span>
        }
        actions={<ProjectActions project={fields} today={today} remainingCOP={remaining} />}
      />

      {phase.supportDaysLeft !== null && phase.supportDaysLeft <= 3 && (
        <Alert variant={phase.supportDaysLeft < 0 ? "destructive" : "default"}>
          <TriangleAlertIcon />
          <AlertTitle>
            {phase.supportDaysLeft < 0
              ? "La ventana de soporte ya terminó"
              : "La ventana de soporte está por terminar"}
          </AlertTitle>
          <AlertDescription>
            Termina el {formatDate(project.support_until)}. Si ya no hay ajustes pendientes, cierra el
            proyecto; lo que llegue después puede registrarse como extra facturable.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
          <TabsTrigger value="payments">Pagos ({payments.length})</TabsTrigger>
          <TabsTrigger value="sprints">Sprints ({sprints.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tareas ({tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex flex-col gap-4 pt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Valor del contrato"
              value={formatCOP(value)}
              hint={
                project.billing_type === "retainer"
                  ? `${formatCOP(project.monthly_fee_cop)}/mes${project.contract_months ? ` × ${project.contract_months}` : ""}`
                  : undefined
              }
            />
            <StatCard label="Cobrado" value={formatCOP(totals.received)} />
            <StatCard label="Pendiente" value={formatCOP(totals.expected)} />
            <StatCard
              label="Vencido"
              value={formatCOP(totals.overdue)}
              hint={totals.overdueCount > 0 ? `${totals.overdueCount} pagos` : undefined}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Tarifa estimada"
              value={valuation.estimatedRate !== null ? `${formatCOP(valuation.estimatedRate)}/h` : "—"}
              hint={hours.scope_estimated > 0 ? `según ${formatDuration(hours.scope_estimated)} de tickets` : undefined}
            />
            <StatCard
              label="Tarifa real"
              value={valuation.realRate !== null ? `${formatCOP(valuation.realRate)}/h` : "—"}
              hint="cobrado ÷ horas de alcance y soporte"
            />
            <StatCard
              label="Horas registradas"
              value={formatDuration(valuation.loggedHours)}
              hint={`alcance ${formatDuration(hours.scope_logged)}${hours.extra_logged > 0 ? ` · extra ${formatDuration(hours.extra_logged)}` : ""}`}
            />
            <StatCard
              label="Soporte absorbido"
              value={formatDuration(hours.support_logged)}
              hint={
                valuation.support.opportunityCostCOP
                  ? `${formatCOP(valuation.support.opportunityCostCOP)} sin cobrar`
                  : undefined
              }
            />
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <SummaryRow
              label={project.billing_type === "retainer" ? "Horas por mes" : "Horas estimadas"}
              value={formatHours(
                project.billing_type === "retainer"
                  ? project.expected_hours_per_month
                  : project.estimated_total_hours,
              )}
            />
            <SummaryRow
              label="Fechas"
              value={`${formatDate(project.start_date)} – ${formatDate(project.end_date)}`}
            />
            <SummaryRow label="Duración de sprint" value={`${project.default_sprint_days} días`} />
            <SummaryRow
              label="Entrega"
              value={
                project.delivered_at
                  ? `${formatDate(project.delivered_at)} · soporte hasta ${formatDate(project.support_until)}`
                  : `Pendiente · ${project.support_days} días de soporte`
              }
            />
            {project.billing_type === "retainer" && (
              <SummaryRow label="Día de cobro" value={project.billing_day ? `Día ${project.billing_day}` : "—"} />
            )}
          </dl>
        </TabsContent>

        <TabsContent value="tickets" className="pt-4">
          <Backlog
            project={fields}
            sprints={sprints}
            tickets={tickets}
            scopeEstimated={hours.scope_estimated}
            runningTicketId={running?.ticket.id ?? null}
            today={today}
          />
        </TabsContent>

        <TabsContent value="payments" className="pt-4">
          <PaymentsTable project={fields} payments={payments} today={today} />
        </TabsContent>

        <TabsContent value="sprints" className="pt-4">
          <SprintsList
            project={fields}
            sprints={sprints}
            today={today}
            scopeHoursBySprint={scopeHoursBySprint}
            scopeEstimated={hours.scope_estimated}
          />
        </TabsContent>

        <TabsContent value="tasks" className="flex flex-col gap-3 pt-4">
          <div>
            <QuickAddDialog projectId={project.id} />
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tareas ni seguimientos abiertos.</p>
          ) : (
            <TaskList tasks={tasks} today={today} projects={projects} />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
