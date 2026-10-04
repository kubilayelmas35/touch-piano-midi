import { describe, expect, it } from "vitest";
import { parseMidi } from "../midi/song";
import { PROGRAMS, midiFileName, splitHands, writeMidi, type RawNote } from "./midiFile";
import { RING_MAX, Recorder } from "./recorder";

const on = (key: string, midi: number, velocity = 0.8) => ({ type: "on" as const, key, midi, velocity });
const off = (key: string, ring = false) => ({ type: "off" as const, key, ring });

describe("Recorder", () => {
  it("records press / release pairs, shifted so the take starts at 0", () => {
    const r = new Recorder(10);
    r.input(on("a", 60), 12);
    r.input(on("b", 64, 0.5), 12.5);
    r.input(off("a"), 13);
    r.input(off("b"), 14);
    expect(r.noteCount).toBe(2);
    expect(r.finish(15)).toEqual([
      { midi: 60, time: 0, duration: 1, velocity: 0.8 },
      { midi: 64, time: 0.5, duration: 1.5, velocity: 0.5 },
    ]);
  });

  it("closes notes still held when recording stops", () => {
    const r = new Recorder(0);
    r.input(on("k", 72), 1);
    expect(r.finish(3)).toEqual([{ midi: 72, time: 0, duration: 2, velocity: 0.8 }]);
  });

  it("lets plucked strings ring until muted, re-plucked or capped", () => {
    const r = new Recorder(0);
    r.input(on("s1", 40), 0);
    r.input(off("s1", true), 0.2);
    r.input({ type: "mute", key: "s1" }, 1);
    r.input(on("s2", 45), 1);
    r.input(off("s2", true), 1.1);
    r.input(on("s2", 47), 2);
    r.input(off("s2", true), 2.1);
    const notes = r.finish(20);
    expect(notes.map((n) => [n.midi, n.time, +n.duration.toFixed(3)])).toEqual([
      [40, 0, 1],
      [45, 1, 1],
      [47, 2, +(0.1 + RING_MAX).toFixed(3)],
    ]);
  });

  it("holds released notes while the sustain pedal is down", () => {
    const r = new Recorder(0);
    r.input({ type: "sustain", on: true }, 0);
    r.input(on("a", 60), 0);
    r.input(off("a"), 0.5);
    r.input(on("b", 62), 1);
    r.input(off("b"), 1.2);
    r.input({ type: "sustain", on: false }, 3);
    r.input(on("c", 64), 3);
    r.input(off("c"), 3.5);
    expect(r.finish(4).map((n) => [n.midi, n.duration])).toEqual([
      [60, 3],
      [62, 2],
      [64, 0.5],
    ]);
  });

  it("closes a held key pressed again and ignores stray releases", () => {
    const r = new Recorder(0);
    r.input(off("ghost"), 0);
    r.input(on("a", 60), 1);
    r.input(on("a", 61), 2);
    r.input(off("a"), 2.5);
    expect(r.finish(3).map((n) => [n.midi, n.time, n.duration])).toEqual([
      [60, 0, 1],
      [61, 1, 0.5],
    ]);
  });

  it("returns nothing for an empty take", () => {
    expect(new Recorder(0).finish(5)).toEqual([]);
  });
});

describe("midiFile", () => {
  const notes: RawNote[] = [
    { midi: 48, time: 0, duration: 1, velocity: 0.6 },
    { midi: 64, time: 0, duration: 0.5, velocity: 0.9 },
    { midi: 67, time: 0.5, duration: 0.5, velocity: 0.9 },
  ];

  it("splits notes into hands at middle C", () => {
    const [right, left] = splitHands(notes, 0);
    expect(right.name).toBe("Right hand");
    expect(right.notes.map((n) => n.midi)).toEqual([64, 67]);
    expect(left.name).toBe("Left hand");
    expect(left.notes.map((n) => n.midi)).toEqual([48]);
    expect(splitHands(notes.slice(1), 0)).toHaveLength(1);
    expect(splitHands(notes.slice(0, 1), 0)[0].name).toBe("Left hand");
  });

  it("writes a MIDI file the app can read back", () => {
    const data = writeMidi({ title: "Take", bpm: 120, timeSignature: [4, 4], tracks: splitHands(notes, PROGRAMS.guitarNylon) });
    const song = parseMidi(data, "Take");
    expect(song.tracks.map((t) => t.name)).toEqual(["Right hand", "Left hand"]);
    expect(song.notes.map((n) => n.midi).sort()).toEqual([48, 64, 67]);
    const g = song.notes.find((n) => n.midi === 67)!;
    expect(g.time).toBeCloseTo(0.5, 2);
    expect(g.duration).toBeCloseTo(0.5, 2);
    expect(g.velocity).toBeCloseTo(0.9, 1);
    expect(song.tracks[0].instrument.toLowerCase()).toContain("guitar");
  });

  it("makes safe file names", () => {
    expect(midiFileName("Yılan Hikayesi / Şarkı?")).toBe("Yilan-Hikayesi-Sarki.mid");
    expect(midiFileName("Für Elise")).toBe("Fur-Elise.mid");
    expect(midiFileName("???")).toBe("sonatrio.mid");
  });
});
