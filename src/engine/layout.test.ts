import { describe, expect, it } from "vitest";
import { GUITAR, VIOLIN } from "./fretting";
import { FretLayout, fretView, pluckWidth } from "./layout";

const base = { usedFrets: [0, 2, 3, 7], usedStrings: [1, 2, 4], hideNut: false, compactFrets: false, compactStrings: false, part: "both" as const };

describe("FretLayout", () => {
  it("shows the nut and every fret up to the last by default", () => {
    const L = new FretLayout(GUITAR, 1000, { lastFret: 9, pluckW: 200 });
    expect(L.frets).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(L.hasNut).toBe(true);
    expect(L.column(3)).toEqual({ x: 240, w: 80, black: false });
    expect(L.fretAt(250)).toBe(3);
    expect(L.posAt(280)).toBeCloseTo(3);
    expect(L.xOf(3)).toBeCloseTo(280);
  });

  it("maps columns to only the frets given and interpolates between them", () => {
    const L = new FretLayout(GUITAR, 400, { frets: [7, 3, 5] });
    expect(L.frets).toEqual([3, 5, 7]);
    expect(L.hasNut).toBe(false);
    expect(L.column(4)).toBeNull();
    expect(L.fretAt(150)).toBe(5);
    expect(L.posAt(200)).toBeCloseTo(5);
    expect(L.posAt(800 / 3)).toBeCloseTo(6);
    expect(L.xOf(6)).toBeCloseTo(800 / 3);
  });

  it("stacks only the given strings, highest on top", () => {
    const L = new FretLayout(GUITAR, 600, { strings: [4, 1], pluckW: 200 });
    expect(L.rows).toBe(2);
    expect(L.rowOf(4)).toBe(0);
    expect(L.rowOf(1)).toBe(1);
    expect(L.rowOf(0)).toBe(-1);
    expect(L.stringAt(10, 100)).toBe(4);
    expect(L.stringAt(90, 100)).toBe(1);
    expect(L.stringLane(4)).toEqual({ x: 500, w: 100 });
    expect(L.stringLane(0)).toBeNull();
  });
});

describe("fretView", () => {
  it("drops the open-string column when asked", () => {
    const L = fretView(GUITAR, 1000, { ...base, hideNut: true });
    expect(L.frets[0]).toBe(1);
    expect(L.hasNut).toBe(false);
    expect(L.pluckW).toBe(pluckWidth(1000));
  });

  it("keeps the open-string column with no strike zone, where open notes would have nowhere to fall", () => {
    const L = fretView(GUITAR, 1000, { ...base, hideNut: true, part: "neck" });
    expect(L.hasNut).toBe(true);
    expect(L.pluckW).toBe(0);
  });

  it("shows only the song's frets and strings", () => {
    const L = fretView(VIOLIN, 800, { ...base, compactFrets: true, compactStrings: true });
    expect(L.frets).toEqual([0, 2, 3, 7]);
    expect(L.strings).toEqual([1, 2]);
    const noNut = fretView(VIOLIN, 800, { ...base, compactFrets: true, hideNut: true });
    expect(noNut.frets).toEqual([2, 3, 7]);
  });

  it("gives the whole width to the strike zone when only the strings are shown", () => {
    const L = fretView(GUITAR, 900, { ...base, part: "strings" });
    expect(L.width).toBe(0);
    expect(L.pluckW).toBe(900);
    expect(L.column(2)).toBeNull();
    expect(L.inPluckZone(0)).toBe(true);
  });
});
