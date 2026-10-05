import { describe, expect, it } from "vitest";
import { softClipCurve } from "./context";

/** The curve covers inputs of ±2; value at amplitude a. */
function at(curve: Float32Array, a: number): number {
  const i = Math.round(((a / 2 + 1) / 2) * (curve.length - 1));
  return curve[i];
}

describe("softClipCurve", () => {
  const curve = softClipCurve();

  it("leaves normal levels untouched", () => {
    for (const a of [-0.6, -0.3, 0, 0.25, 0.5, 0.69]) expect(at(curve, a)).toBeCloseTo(a, 2);
  });

  it("rounds loud peaks off below full scale instead of cutting them flat", () => {
    expect(at(curve, 1)).toBeGreaterThan(0.85);
    expect(at(curve, 1)).toBeLessThan(0.98);
    expect(at(curve, 2)).toBeLessThanOrEqual(0.98);
    expect(at(curve, -2)).toBeGreaterThanOrEqual(-0.98);
    expect(at(curve, 1.5)).toBeGreaterThan(at(curve, 1));
  });
});
