import { describe, expect, it } from "vitest";
import { diatonic, ledgersFor, staffMetrics } from "./staff";

describe("staff", () => {
  it("places pitches on diatonic steps, sharps on their natural", () => {
    expect(diatonic(60)).toBe(35);
    expect(diatonic(61)).toBe(35);
    expect(diatonic(64)).toBe(37);
    expect(diatonic(72)).toBe(42);
  });

  it("picks the staves the song needs", () => {
    expect(staffMetrics([64, 67, 72], 100).clefs).toBe("treble");
    expect(staffMetrics([40, 48, 55], 100).clefs).toBe("bass");
    expect(staffMetrics([43, 76], 100).clefs).toBe("grand");
    expect(staffMetrics([64], 1000).height).toBeLessThan(staffMetrics([43, 76], 1000).height);
    expect(staffMetrics([43, 76], 1000).gap).toBe(8);
    expect(staffMetrics([43, 76], 10).gap).toBe(4.5);
  });

  it("draws ledger lines outside the staves and for middle C", () => {
    expect(ledgersFor(diatonic(60), "treble")).toEqual([35]);
    expect(ledgersFor(diatonic(57), "treble")).toEqual([35, 33]);
    expect(ledgersFor(diatonic(84), "treble")).toEqual([47, 49]);
    expect(ledgersFor(diatonic(67), "treble")).toEqual([]);
    expect(ledgersFor(diatonic(60), "grand")).toEqual([35]);
    expect(ledgersFor(diatonic(62), "grand")).toEqual([]);
  });
});
