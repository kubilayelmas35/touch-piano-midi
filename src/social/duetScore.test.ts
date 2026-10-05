import { describe, expect, it } from "vitest";
import { accuracyOf, emptyStats, starsFor, type Stats } from "../engine/types";
import { CODE_CHARS, combineSides, newRoomCode, normalizeCode, sideFrom, type DuetSide } from "./duetScore";

function side(hand: "left" | "right", s: Partial<Stats>): DuetSide {
  const stats = { ...emptyStats(), ...s };
  const accuracy = accuracyOf(stats);
  return { name: hand, hand, stats, accuracy, stars: starsFor(accuracy) };
}

describe("room codes", () => {
  it("makes five unambiguous characters", () => {
    const code = newRoomCode();
    expect(code).toHaveLength(5);
    expect([...code].every((c) => CODE_CHARS.includes(c))).toBe(true);
  });

  it("reads what people type", () => {
    expect(normalizeCode(" ab-c 2d ")).toBe("ABC2D");
    expect(normalizeCode("abcd")).toBe("");
    // O and I aren't used; typed by mistake they become 0 / 1, which aren't valid either.
    expect(normalizeCode("ABCDO")).toBe("");
    expect(normalizeCode("ABCDEF")).toBe("");
  });
});

describe("combineSides", () => {
  it("adds both hands up into one performance", () => {
    const right = side("right", { score: 9000, perfect: 40, great: 5, miss: 5, maxCombo: 30 });
    const left = side("left", { score: 6000, perfect: 20, good: 5, miss: 15, wrong: 4, maxCombo: 12 });
    const both = combineSides(right, left);
    expect(both.stats.score).toBe(15000);
    expect(both.stats.perfect).toBe(60);
    expect(both.stats.miss).toBe(20);
    expect(both.stats.maxCombo).toBe(30);
    expect(both.accuracy).toBeCloseTo(accuracyOf(both.stats));
    // Together sits between the stronger and the weaker hand.
    expect(both.accuracy).toBeLessThan(right.accuracy);
    expect(both.accuracy).toBeGreaterThan(left.accuracy);
    expect(both.stars).toBe(starsFor(both.accuracy));
  });
});

describe("sideFrom", () => {
  it("recomputes accuracy and stars from the stats instead of trusting them", () => {
    const s = sideFrom({ stats: { score: 500, perfect: 10, miss: 10 }, accuracy: 1, stars: 5, hand: "left", name: "deniz" }, null)!;
    expect(s.accuracy).toBeCloseTo(0.5);
    expect(s.stars).toBe(2);
    expect(s.hand).toBe("left");
    expect(s.name).toBe("deniz");
  });

  it("cleans up junk", () => {
    const s = sideFrom({ stats: { score: -5, perfect: "x", miss: Infinity } }, "can")!;
    expect(s.stats.score).toBe(0);
    expect(s.stats.perfect).toBe(0);
    expect(s.stats.miss).toBe(0);
    expect(s.name).toBe("can");
    expect(s.hand).toBe("right");
    expect(sideFrom(null, null)).toBeNull();
  });
});
