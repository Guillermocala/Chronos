// Jefe semanal: la meta de la semana convertida en un enemigo. Su vida es la meta
// en COP y cada misión completada le quita su valor.

import { daysBetween, type ISODate } from "@/lib/dates";

export const BOSSES = [
  { name: "El Procrastinador", emoji: "🦥" },
  { name: "La Hidra del Backlog", emoji: "🐉" },
  { name: "El Golem de Correos", emoji: "🗿" },
  { name: "La Sombra del Lunes", emoji: "👤" },
  { name: "El Kraken de Reuniones", emoji: "🐙" },
  { name: "El Dragón del Scope Creep", emoji: "🔥" },
  { name: "La Bruja de los Pendientes", emoji: "🧙" },
  { name: "El Titán del Deadline", emoji: "⏳" },
] as const;

/** Lunes de referencia para rotar los jefes de forma estable. */
const EPOCH_MONDAY = "2026-01-05";

export type BossState = "none" | "alive" | "wounded" | "defeated";

export type WeeklyBoss = {
  name: string;
  emoji: string;
  maxHp: number;
  /** Vida restante (0 si fue derrotado). */
  hp: number;
  damage: number;
  /** Porcentaje de daño, 0..100. */
  pct: number;
  state: BossState;
};

export function bossOf(weekStart: ISODate) {
  const index = Math.floor(daysBetween(EPOCH_MONDAY, weekStart) / 7);
  const n = BOSSES.length;
  return BOSSES[((index % n) + n) % n];
}

export function weeklyBoss(weekStart: ISODate, target: number | null, earned: number): WeeklyBoss {
  const { name, emoji } = bossOf(weekStart);
  if (!target || target <= 0) {
    return { name, emoji, maxHp: 0, hp: 0, damage: earned, pct: 0, state: "none" };
  }
  const pct = Math.min(Math.round((earned / target) * 100), 100);
  const state: BossState = earned >= target ? "defeated" : pct >= 50 ? "wounded" : "alive";
  return { name, emoji, maxHp: target, hp: Math.max(target - earned, 0), damage: earned, pct, state };
}
