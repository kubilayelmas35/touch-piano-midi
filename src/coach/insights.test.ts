import { describe, expect, it } from "vitest";
import { NoteState } from "../engine/types";
import type { Beat } from "../midi/song";
import { analyzeRun, hasInsights, type InsightNote } from "./insights";

/** 4/4 at one beat per second, 12 measures. */
const beats: Beat[] = Array.from({ length: 48 }, (_, i) => ({ time: i, downbeat: i % 4 === 0, measure: Math.floor(i / 4) }));

function note(time: number, over: Partial<InsightNote> = {}): InsightNote {
  return { time, state: NoteState.Hit, judgement: "perfect", offsetMs: 0, hand: "right", ...over };
}

const clean = () => Array.from({ length: 48 }, (_, i) => note(i));

describe("run insights", () => {
  it("has nothing to say about a clean run", () => {
    expect(hasInsights(analyzeRun(clean(), [], beats))).toBe(false);
  });

  it("points at the measures with the most misses", () => {
    const notes = clean();
    for (const i of [24, 25, 27, 29, 30]) notes[i] = note(i, { state: NoteState.Missed, judgement: "miss", offsetMs: null });
    const r = analyzeRun(notes, [26.5], beats);
    expect(r.weak).not.toBeNull();
    expect(r.weak!.measureFrom).toBe(7);
    expect(r.weak!.measureTo).toBe(8);
    expect(r.weak!.from).toBe(24);
    expect(r.weak!.to).toBe(32);
  });

  it("ignores a single slip", () => {
    const notes = clean();
    notes[10] = note(10, { state: NoteState.Missed, judgement: "miss", offsetMs: null });
    expect(analyzeRun(notes, [], beats).weak).toBeNull();
  });

  it("says when hits are consistently late, and which hand", () => {
    const late = clean().map((n) => ({ ...n, offsetMs: 70 }));
    expect(analyzeRun(late, [], beats).drift).toEqual({ ms: 70, hand: null });

    const split = clean().map((n, i) => (i % 2 ? { ...n, hand: "left" as const, offsetMs: 95 } : { ...n, offsetMs: 5 }));
    expect(analyzeRun(split, [], beats).drift).toEqual({ ms: 95, hand: "left" });

    const early = clean().map((n) => ({ ...n, offsetMs: -55 }));
    expect(analyzeRun(early, [], beats).drift?.ms).toBe(-55);
  });

  it("finds the hand that misses more", () => {
    const notes = clean().map((n, i) =>
      i % 2 ? { ...n, hand: "left" as const, ...(i % 6 === 1 ? { state: NoteState.Missed, judgement: "miss" as const } : {}) } : n
    );
    expect(analyzeRun(notes, [], beats).weakHand).toBe("left");
  });
});
