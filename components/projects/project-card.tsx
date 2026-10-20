import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ISODate } from "@/lib/dates";
import type { ProjectWithPayments } from "@/lib/data/projects";
import { formatCOP } from "@/lib/format";
import { BILLING_LABELS, phaseInfo } from "@/lib/projects/labels";
import { contractValue, paymentTotals } from "@/lib/valuation";

export function ProjectCard({ project, today }: { project: ProjectWithPayments; today: ISODate }) {
  const phase = phaseInfo(project, today);
  const value = contractValue(project);
  const totals = paymentTotals(project.payments, today);
  const percent = value ? Math.min(100, Math.round((totals.received / value) * 100)) : null;

  return (
    <Card className="relative transition-colors hover:bg-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-full bg-muted-foreground"
            style={project.color ? { backgroundColor: project.color } : undefined}
          />
          <Link href={`/projects/${project.id}`} className="truncate after:absolute after:inset-0">
            {project.name}
          </Link>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{project.code_prefix}</Badge>
          <Badge variant={phase.variant}>{phase.label}</Badge>
          {project.client && <span className="truncate">{project.client}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground">{BILLING_LABELS[project.billing_type]}</span>
          <span className="font-medium tabular-nums">
            {project.billing_type === "retainer"
              ? `${formatCOP(project.monthly_fee_cop)}/mes`
              : formatCOP(value)}
          </span>
        </div>
        {percent !== null && (
          <Progress value={percent} aria-label={`Cobrado ${percent}%`} />
        )}
        <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          <span>Cobrado {formatCOP(totals.received)}</span>
          <span>Pendiente {formatCOP(totals.expected)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
