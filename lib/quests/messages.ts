// Texto del aviso al completar una misión.

import { formatCOP } from "@/lib/format";
import type { Celebration } from "@/lib/action-result";

import { achievementByCode } from "./achievements";
import type { Reward } from "./reward";

export type QuestEventLike = {
  reward: Reward | null;
  unlocked: string[];
  bossDefeated: string | null;
  dayGoalMet: boolean;
  streak: number;
};

export function questMessage(event: QuestEventLike | null): {
  message: string;
  description?: string;
  celebrate?: Celebration;
} {
  if (!event) return { message: "¡Hecho!" };
  const cop = event.reward?.cop ?? 0;
  const message = cop > 0 ? `¡Hecho! +${formatCOP(cop)}` : event.reward?.personal ? "¡Misión personal cumplida!" : "¡Hecho!";

  const extras: string[] = [];
  if (event.bossDefeated) extras.push(`⚔️ Derrotaste a ${event.bossDefeated}.`);
  if (event.dayGoalMet) extras.push(`🔥 ¡Día cumplido! Racha de ${event.streak} ${event.streak === 1 ? "día" : "días"}.`);
  for (const code of event.unlocked) {
    const a = achievementByCode(code);
    if (a) extras.push(`${a.emoji} Logro: ${a.title}.`);
  }

  const big = Boolean(event.bossDefeated || event.unlocked.length);
  return {
    message,
    description: extras.length ? extras.join(" ") : undefined,
    celebrate: big ? "big" : event.dayGoalMet || cop > 0 ? "small" : undefined,
  };
}
