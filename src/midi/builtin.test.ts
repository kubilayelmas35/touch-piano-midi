import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILTIN_CATEGORIES, BUILTIN_SONGS, __test } from "./builtin";
import { defaultPlayTracks, parseMidi } from "./song";

const { voice, pitchToMidi, build, duration, verseCount, nameHands, SPECS, MUTOPIA } = __test;

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

    it(`${spec.id}: repeats verses to last about a minute, each starting on a downbeat`, () => {
      const song = build(spec);
      const verses = verseCount(spec);
      expect(verses).toBeGreaterThanOrEqual(1);
      expect(verses).toBeLessThanOrEqual(3);
      if (verses < 3) expect(song.duration).toBeGreaterThan(45);
      const spb = 60 / spec.bpm;
      const first = song.notes.filter((n) => n.track === 0)[0];
      const rightPerVerse = song.notes.filter((n) => n.track === 0).length / verses;
      expect(Number.isInteger(rightPerVerse)).toBe(true);
      const downbeats = new Set(song.beats.filter((b) => b.downbeat).map((b) => Math.round(b.time * 1000)));
      for (let v = 1; v < verses; v++) {
        const start = song.notes.filter((n) => n.track === 0)[v * rightPerVerse];
        const offset = start.time - first.time;
        expect(downbeats.has(Math.round((offset + (spec.pickup ?? 0) * spb) * 1000))).toBe(true);
      }
    });
  }
});

describe("broken-chord accompaniment", () => {
  it("spreads held chords on alternate verses and keeps their length", () => {
    const plain = voice("C3+E3+G3:4", 1, 1);
    const spread = voice("C3+E3+G3:4", 1, 1, 0, 0.6, 1);
    expect(plain.map((n) => n.time)).toEqual([0, 0, 0]);
    expect(spread.map((n) => n.midi)).toEqual([48, 55, 52, 55]);
    expect(spread.map((n) => n.time)).toEqual([0, 1, 2, 3]);
    expect(voice("C3+G3:1", 1, 1, 0, 0.6, 1)).toHaveLength(2);
  });
});

describe("Mutopia pieces", () => {
  it("are listed once each", () => {
    const ids = MUTOPIA.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(MUTOPIA.map((p) => p.m)).size).toBe(ids.length);
  });

  for (const p of MUTOPIA) {
    it(`${p.id}: ships a MIDI file with playable hands`, () => {
      const file = `public/songs/mutopia/${p.id}.mid`;
      expect(existsSync(file)).toBe(true);
      const buf = readFileSync(file);
      const song = nameHands(parseMidi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), p.title), p.title, p.category === "guitar");
      expect(song.title).toBe(p.title);
      expect(song.duration).toBeGreaterThan(20);
      expect(song.notes.length).toBeGreaterThan(100);
      const play = defaultPlayTracks(song);
      expect(play.length).toBeGreaterThan(0);
      if (song.tracks.length === 2) {
        const names = song.tracks.map((t) => t.name).sort();
        expect(names).toEqual(["Left hand", "Right hand"]);
        expect(play).toHaveLength(2);
      }
    });
  }
});
