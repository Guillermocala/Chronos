import { describe, expect, it } from "vitest";

import { elapsedHours, formatDuration, formatElapsed, parseDurationInput } from "./time";

describe("elapsedHours", () => {
  it("redondea a 0,01 h", () => {
    expect(elapsedHours("2026-10-21T10:00:00Z", "2026-10-21T11:25:00Z")).toBe(1.42);
  });
  it("mínimo 0,01 h", () => {
    expect(elapsedHours("2026-10-21T10:00:00Z", "2026-10-21T10:00:05Z")).toBe(0.01);
  });
});

describe("formatos", () => {
  it.each([
    [1.42, "1 h 25 min"],
    [0.75, "45 min"],
    [2, "2 h"],
    [null, "—"],
  ])("formatDuration(%s) → %s", (h, expected) => expect(formatDuration(h)).toBe(expected));

  it("formatElapsed", () => {
    expect(formatElapsed(65 * 60_000)).toBe("1:05");
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("parseDurationInput", () => {
  it.each([
    ["1:30", 1.5],
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["90m", 1.5],
    ["90 min", 1.5],
    ["2h", 2],
    ["2h30", 2.5],
    ["2 h 30 min", 2.5],
    ["8", 8],
    ["0:20", 0.33],
  ])("%s → %s", (input, expected) => expect(parseDurationInput(input)).toBe(expected));

  it.each(["", "abc", "0", "25", "1:75"])("rechaza %j", (input) => {
    expect(parseDurationInput(input)).toBeNull();
  });
});
