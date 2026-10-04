import { describe, expect, it } from "vitest";
import { BUILTIN_CATEGORIES, BUILTIN_SONGS, __test } from "./builtin";

const { voice, pitchToMidi, build, duration, SPECS } = __test;

const tokens = (src: string) => src.trim().split(/\s+/).filter((t) => t && t !== "|");
const beats = (src: string) => tokens(src).reduce((sum, t) => sum + duration(t.split(":")[1]), 0);
/** Bar lengths; a line break counts as a bar line too. */
const bars = (src: string) =>
  src
    .split(/\||\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(beats);

describe("builtin notation", () => {
  it("parses pitches", () => {
    expect(pitchToMidi("C4")).toBe(60);
    expect(pitchToMidi("A4")).toBe(69);
    expect(pitchToMidi("F#5")).toBe(78);
    expect(pitchToMidi("Bb3")).toBe(58);
    expect(pitchToMidi("B#3")).toBe(60);
  });

  it("parses chords, rests and triplets", () => {
    const notes = voice("C3+E3:2 -:1 G3:1", 0, 0.5);
    expect(notes.map((n) => n.midi)).toEqual([48, 52, 55]);
    expect(notes[2].time).toBeCloseTo(1.5);
    const trip = voice("C4:1/3 D4:1/3 E4:1/3 F4:1", 0, 1);
    expect(trip[3].time).toBeCloseTo(1);
  });

  it("has unique ids and known categories", () => {
    const ids = BUILTIN_SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of BUILTIN_SONGS) expect(BUILTIN_CATEGORIES).toContain(s.category);
  });

  for (const spec of SPECS) {
    it(`${spec.id}: hands end together and every bar is one measure`, () => {
      const pickup = spec.pickup ?? 0;
      const right = beats(spec.right);
      const left = spec.left ? beats(spec.left) + pickup : right;
      expect(left).toBeCloseTo(right, 5);
      const measureLen = spec.meter[0] * spec.meter[1];
      const rightBars = bars(spec.right);
      if (pickup) expect(rightBars.shift()).toBeCloseTo(pickup, 5);
      rightBars.forEach((b, i) => expect(b, `right bar ${i + 1}`).toBeCloseTo(measureLen, 5));
      if (spec.left) bars(spec.left).forEach((b, i) => expect(b, `left bar ${i + 1}`).toBeCloseTo(measureLen, 5));
    });

    it(`${spec.id}: builds a playable song`, () => {
      const song = build(spec);
      expect(song.notes.length).toBeGreaterThan(10);
      expect(song.beats.length).toBeGreaterThan(4);
      expect(song.duration).toBeGreaterThan(5);
    });
  }
});
