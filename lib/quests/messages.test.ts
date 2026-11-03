import { describe, expect, it } from "vitest";

import { questMessage } from "./messages";
import type { Reward } from "./reward";

const reward = (cop: number, personal = false): Reward => ({
  cop,
  source: cop ? "estimate" : "none",
  hours: 2,
  rate: 21_875,
  opportunityCost: null,
  personal,
});
const base = { unlocked: [], bossDefeated: null, dayGoalMet: false, streak: 0 };

describe("aviso al completar", () => {
  it("sin datos del juego queda el aviso de siempre", () => {
    expect(questMessage(null)).toEqual({ message: "¡Hecho!" });
  });

  it("muestra lo ganado y celebra en pequeño", () => {
    const m = questMessage({ ...base, reward: reward(43_750) });
    expect(m.message).toMatch(/^¡Hecho! \+\$\s?43\.750$/);
    expect(m.celebrate).toBe("small");
  });

  it("misión personal sin confeti salvo que cumpla el día", () => {
    expect(questMessage({ ...base, reward: reward(0, true) })).toEqual({
      message: "¡Misión personal cumplida!",
      description: undefined,
      celebrate: undefined,
    });
    const day = questMessage({ ...base, reward: reward(0, true), dayGoalMet: true, streak: 4 });
    expect(day.description).toContain("Racha de 4 días");
    expect(day.celebrate).toBe("small");
  });

  it("jefe derrotado o logro nuevo: celebración grande", () => {
    const m = questMessage({ ...base, reward: reward(10_000), bossDefeated: "El Procrastinador", unlocked: ["streak-5"] });
    expect(m.description).toContain("Derrotaste a El Procrastinador");
    expect(m.description).toContain("Logro: En llamas");
    expect(m.celebrate).toBe("big");
  });
});
