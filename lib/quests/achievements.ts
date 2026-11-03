// Logros: un catálogo fijo. Se desbloquean una vez (quest_achievements) para
// celebrarlos solo cuando ocurren.

export type QuestStats = {
  totalMissions: number;
  personalMissions: number;
  totalEarned: number;
  bestStreak: number;
  bossesDefeated: number;
  maxConsecutiveBosses: number;
  monthsCompleted: number;
  perfectWeeks: number;
};

export type Achievement = {
  code: string;
  title: string;
  /** Pista visible mientras está bloqueado. */
  hint: string;
  emoji: string;
  check: (s: QuestStats) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { code: "first-mission", title: "Primer paso", hint: "Completa tu primera misión", emoji: "🎯", check: (s) => s.totalMissions >= 1 },
  { code: "streak-5", title: "En llamas", hint: "Racha de 5 días", emoji: "🔥", check: (s) => s.bestStreak >= 5 },
  { code: "streak-10", title: "Imparable", hint: "Racha de 10 días", emoji: "⚡", check: (s) => s.bestStreak >= 10 },
  { code: "streak-20", title: "Leyenda de la constancia", hint: "Racha de 20 días", emoji: "🏆", check: (s) => s.bestStreak >= 20 },
  { code: "boss-1", title: "Cazajefes", hint: "Derrota a un jefe semanal", emoji: "⚔️", check: (s) => s.bossesDefeated >= 1 },
  { code: "boss-4-row", title: "Mes invicto", hint: "Derrota 4 jefes seguidos", emoji: "🛡️", check: (s) => s.maxConsecutiveBosses >= 4 },
  { code: "season-1", title: "Temporada ganada", hint: "Cumple una meta mensual", emoji: "🥇", check: (s) => s.monthsCompleted >= 1 },
  { code: "perfect-week", title: "Semana perfecta", hint: "Cumple todos los días laborables de una semana, sin comodín", emoji: "💎", check: (s) => s.perfectWeeks >= 1 },
  { code: "cop-1m", title: "Primer millón", hint: "Produce $1.000.000 en misiones", emoji: "💰", check: (s) => s.totalEarned >= 1_000_000 },
  { code: "cop-10m", title: "Diez millones", hint: "Produce $10.000.000 en misiones", emoji: "🤑", check: (s) => s.totalEarned >= 10_000_000 },
  { code: "personal-10", title: "Vida en orden", hint: "Completa 10 misiones personales", emoji: "🏠", check: (s) => s.personalMissions >= 10 },
  { code: "missions-100", title: "Centurión", hint: "Completa 100 misiones", emoji: "💯", check: (s) => s.totalMissions >= 100 },
];

export const achievementByCode = (code: string) => ACHIEVEMENTS.find((a) => a.code === code);

/** Códigos que se cumplen ahora y aún no están desbloqueados. */
export function newlyUnlocked(stats: QuestStats, unlocked: ReadonlySet<string>): string[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.code) && a.check(stats)).map((a) => a.code);
}
