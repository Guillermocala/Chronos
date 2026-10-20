import { describe, expect, it } from "vitest";

import { needsRebalance, positionBetween, rebalance } from "./ordering";

describe("positionBetween", () => {
  it("columna vacía", () => expect(positionBetween(null, null)).toBe(1000));
  it("al inicio", () => expect(positionBetween(null, 1000)).toBe(0));
  it("al final", () => expect(positionBetween(3000, null)).toBe(4000));
  it("entre dos", () => expect(positionBetween(1000, 2000)).toBe(1500));
});

describe("rebalance", () => {
  it("detecta vecinas demasiado juntas", () => {
    expect(needsRebalance(1, 1 + 1e-9)).toBe(true);
    expect(needsRebalance(1000, 1500)).toBe(false);
    expect(needsRebalance(null, 1)).toBe(false);
  });

  it("renumera conservando el orden", () => {
    expect([...rebalance(["a", "b", "c"]).entries()]).toEqual([
      ["a", 1000],
      ["b", 2000],
      ["c", 3000],
    ]);
  });
});
