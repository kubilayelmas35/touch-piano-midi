import { describe, expect, it } from "vitest";
import { assignPianoFingers, chordFingers, type FingerNote, type HandSide } from "./fingering";

const line = (midis: number[], hand: HandSide = "right", dt = 0.4): FingerNote[] =>
  midis.map((midi, i) => ({ midi, time: i * dt, group: i, hand }));

describe("piano fingering", () => {
  it("plays a five-finger position with one finger per note", () => {
    expect(assignPianoFingers(line([60, 62, 64, 65, 67]))).toEqual([1, 2, 3, 4, 5]);
    expect(assignPianoFingers(line([48, 50, 52, 53, 55], "left"))).toEqual([5, 4, 3, 2, 1]);
  });

  it("passes the thumb under in a C major scale", () => {
    expect(assignPianoFingers(line([60, 62, 64, 65, 67, 69, 71, 72]))).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
  });

  it("keeps the thumb off black keys when it can", () => {
    expect(assignPianoFingers(line([61, 62, 64]))[0]).not.toBe(1);
  });

  it("spreads chords over the hand", () => {
    expect(chordFingers([60, 64, 67], "right")).toEqual([1, 3, 5]);
    expect(chordFingers([48, 52, 55], "left")).toEqual([5, 3, 1]);
    expect(chordFingers([60, 72], "right")).toEqual([1, 5]);
    expect(chordFingers([60, 62], "right")).toEqual([1, 2]);
  });

  it("moves the hand freely once the notes are let go (Für Elise opening)", () => {
    const e = 0.2;
    const rh = (midi: number, k: number): FingerNote => ({ midi, time: k * e, duration: e * 0.9, group: k, hand: "right" });
    const notes = [76, 75, 76, 75, 76, 71, 74, 72, 69].map(rh);
    notes.push(rh(60, 12), rh(64, 13), rh(69, 14), rh(71, 15));
    // B D C A sit under one hand position (A B C D = 1 2 3 4), so the thumb doesn't jump.
    expect(assignPianoFingers(notes).slice(5, 10)).toEqual([2, 4, 3, 1, 1]);
  });

  it("fingers a flat row of song keys by column", () => {
    // E2 E3 G#3 on columns 0, 2, 3 with column 1 (A2) between: little finger, middle, index.
    const notes: FingerNote[] = [40, 52, 56].map((midi, k) => ({ midi, step: [0, 2, 3][k], time: k * 0.3, group: k, hand: "left" }));
    expect(assignPianoFingers(notes)).toEqual([5, 3, 2]);
    const row: FingerNote[] = [60, 61, 62, 63, 64].map((midi, k) => ({ midi, step: k, time: k * 0.3, group: k, hand: "right" }));
    expect(assignPianoFingers(row)).toEqual([1, 2, 3, 4, 5]);
  });

  it("fingers both hands at once", () => {
    const notes: FingerNote[] = [
      { midi: 64, time: 0, group: 0, hand: "right" },
      { midi: 48, time: 0, group: 0, hand: "left" },
      { midi: 65, time: 0.5, group: 1, hand: "right" },
      { midi: 67, time: 1, group: 2, hand: "right" },
    ];
    const f = assignPianoFingers(notes);
    expect(f.every((x) => x >= 1 && x <= 5)).toBe(true);
    expect(f[2]).toBeGreaterThan(f[0]);
    expect(f[3]).toBeGreaterThan(f[2]);
  });
});
