import { describe, expect, it } from "vitest";
import { GUITAR, VIOLIN, assignFingerings, foldIntoRange, midiAt } from "./fretting";
import { judge, starsFor, accuracyOf, emptyStats } from "./types";

describe("fretting", () => {
  it("places every note on a string that produces the right pitch", () => {
    const groups = [[64], [67], [72], [76], [60, 64, 67], [40], [45, 52, 57]];
    const result = assignFingerings(groups, GUITAR);
    result.forEach((g, gi) =>
      g.forEach((f, ni) => {
        expect(f.string).toBeGreaterThanOrEqual(0);
        expect(midiAt(GUITAR, f.string, f.fret)).toBe(groups[gi][ni]);
      })
    );
  });

  it("never puts two chord notes on one string", () => {
    const [chord] = assignFingerings([[48, 52, 55, 60, 64]], GUITAR);
    expect(new Set(chord.map((f) => f.string)).size).toBe(chord.length);
  });

  it("keeps a scale in one hand position instead of climbing one string", () => {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72].map((m) => [m]);
    const placed = assignFingerings(scale, GUITAR).map((g) => g[0]);
    const fretted = placed.filter((f) => f.fret > 0).map((f) => f.fret);
    expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(5);
    expect(new Set(placed.map((f) => f.string)).size).toBeGreaterThanOrEqual(3);
  });

  it("folds out-of-range notes by octaves", () => {
    expect(foldIntoRange(30, GUITAR)).toBe(42);
    expect(foldIntoRange(100, GUITAR)).toBe(76);
    expect(foldIntoRange(48, VIOLIN)).toBe(60);
  });
});

describe("scoring", () => {
  it("judges by timing", () => {
    expect(judge(10, 150)).toBe("perfect");
    expect(judge(-80, 150)).toBe("great");
    expect(judge(140, 150)).toBe("good");
    expect(judge(160, 150)).toBeNull();
  });

  it("computes accuracy and stars", () => {
    const s = { ...emptyStats(10), perfect: 9, miss: 1 };
    expect(accuracyOf(s)).toBeCloseTo(0.9);
    expect(accuracyOf({ ...s, wrong: 2 })).toBeCloseTo(9 / 11);
    expect(starsFor(0.9)).toBe(4);
    expect(starsFor(0.96)).toBe(5);
    expect(starsFor(0)).toBe(0);
  });
});
