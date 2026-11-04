import { TimerIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/time";

/** "1 h 30 m / ~2 h": horas reales frente al estimado (rojo si se pasó); solo "~2 h" si aún no hay reales. */
export function HoursBadge({ real, estimated }: { real: number; estimated: number | null }) {
  if (real > 0) {
    const over = estimated !== null && real > estimated + 0.005;
    return (
      <Badge
        variant={over ? "destructive" : "secondary"}
        title={estimated !== null ? `Real ${formatDuration(real)} / estimado ${formatDuration(estimated)}` : "Horas reales"}
      >
        <TimerIcon data-icon="inline-start" />
        {formatDuration(real)}
        {estimated !== null && ` / ~${formatDuration(estimated)}`}
      </Badge>
    );
  }
  if (estimated === null) return null;
  return (
    <Badge variant="outline" title="Horas estimadas">
      ~{formatDuration(estimated)}
    </Badge>
  );
}
