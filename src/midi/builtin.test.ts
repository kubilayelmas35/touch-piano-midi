import { describe, expect, it } from "vitest";
import { __test } from "./builtin";

const { voice, pitchToMidi, build, SPECS } = __test;

function beats(src: string): number {
  return src
    .trim()
    .split(/\s+/)
    .filter((t) => t !== "|")
    .reduce((sum, t) => sum + Number(t.split(":")[1]), 0);
}

describe("builtin notation", () => {
  it("parses pitches", () => {
    expect(pitchToMidi("C4")).toBe(60);
    expect(pitchToMidi("A4")).toBe(69);
    expect(pitchToMidi("F#5")).toBe(78);
    expect(pitchToMidi("Bb3")).toBe(58);
  });

  it("parses chords and rests", () => {
    const notes = voice("C3+E3:2 -:1 G3:1", 0, 0.5);
    expect(notes.map((n) => n.midi)).toEqual([48, 52, 55]);
    expect(notes[2].time).toBeCloseTo(1.5);
  });

  for (const spec of SPECS) {
    it(`${spec.id}: hands end together and fill whole measures`, () => {
      const right = beats(spec.right);
      const left = spec.left ? beats(spec.left) + (spec.pickup ?? 0) : right;
      expect(left).toBeCloseTo(right, 5);
      const [perMeasure, unit] = spec.meter;
      const measureLen = perMeasure * unit;
      const body = right - (spec.pickup ?? 0);
      expect(body / measureLen).toBeCloseTo(Math.round(body / measureLen), 5);
    });

    it(`${spec.id}: builds a playable song`, () => {
      const song = build(spec);
      expect(song.notes.length).toBeGreaterThan(10);
      expect(song.beats.length).toBeGreaterThan(4);
      expect(song.duration).toBeGreaterThan(5);
    });
  }
});
