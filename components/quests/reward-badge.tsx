import { CoinsIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatCOP } from "@/lib/format";
import type { Reward } from "@/lib/quests/reward";
import { formatDuration } from "@/lib/time";

/** Explicación del valor para el tooltip ("2 h × $21.875/h"). */
export function rewardExplanation(reward: Reward): string {
  if (reward.personal) return "Misión personal: no suma pesos, pero sí cuenta para la racha.";
  if (reward.source === "none") {
    if (reward.opportunityCost) return `Soporte: no se cobra (costo de oportunidad ${formatCOP(reward.opportunityCost)}).`;
    return reward.rate == null
      ? "El proyecto no tiene una tarifa calculable."
      : "Agrega horas estimadas (~2h) para ver cuánto vale.";
  }
  const hours = reward.hours != null ? formatDuration(reward.hours) : "?";
  const base = `${hours} × ${formatCOP(reward.rate)}/h`;
  if (reward.source === "ticket") {
    return reward.opportunityCost != null
      ? `Ticket de soporte: no se cobra (costo de oportunidad ${formatCOP(reward.opportunityCost)}).`
      : `Según el ticket: ${base}`;
  }
  return reward.source === "logged" ? `Horas registradas: ${base}` : `Horas estimadas: ${base}`;
}

export function RewardBadge({ reward, done = false }: { reward: Reward; done?: boolean }) {
  const label = rewardExplanation(reward);
  if (reward.cop > 0) {
    return (
      <Badge
        variant="outline"
        title={label}
        aria-label={`${done ? "Ganaste" : "Ganas"} ${formatCOP(reward.cop)}. ${label}`}
        className="border-amber-500/40 bg-amber-500/10 font-medium text-amber-700 tabular-nums dark:text-amber-300"
      >
        <CoinsIcon data-icon="inline-start" />+{formatCOP(reward.cop)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" title={label} className="text-muted-foreground">
      {reward.personal ? "Personal" : "$0"}
    </Badge>
  );
}
