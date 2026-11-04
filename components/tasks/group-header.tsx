import { Badge } from "@/components/ui/badge";
import { formatCOP } from "@/lib/format";
import type { GroupSummary } from "@/lib/tasks/summary";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  title: string;
  summary: GroupSummary;
  /** Grupo de completadas: muestra horas reales frente a las estimadas. */
  done?: boolean;
  tone?: "default" | "destructive";
  as?: "h2" | "h3";
};

/** Encabezado de grupo: "Mi día [3] · $120.000 · ~4 h 30 m" (o "3 h reales / ~2 h" en completadas). */
export function GroupHeader({ id, title, summary, done = false, tone = "default", as: Heading = "h2" }: Props) {
  const { count, cop, estimated, real } = summary;
  const over = done && estimated > 0 && real > estimated + 0.005;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Heading id={id} className="text-sm font-semibold">
        {title}
      </Heading>
      <Badge variant={tone === "destructive" ? "destructive" : "secondary"}>{count}</Badge>
      <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground tabular-nums">
        {cop > 0 && <span>{formatCOP(cop)}</span>}
        {done
          ? (real > 0 || estimated > 0) && (
              <span className={cn(over && "text-destructive")}>
                ⏱️ {formatDuration(real)} reales{estimated > 0 && ` / ~${formatDuration(estimated)}`}
              </span>
            )
          : estimated > 0 && <span>~{formatDuration(estimated)}</span>}
      </span>
    </div>
  );
}
