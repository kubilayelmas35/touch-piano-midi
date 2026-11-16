import { describe, expect, it } from "vitest";
import { PianoLayout } from "../engine/layout";
import { foldIntoSpan } from "../lib/notes";
import { defaultMidiLow, mapMidiNote, midiStartChoices, playedSpan, shapeVelocity, type MidiMap } from "./midiKeyboard";

const fixed = (over: Partial<MidiMap> = {}): MidiMap => ({
  keys: 25,
  low: 0,
  octave: 0,
  transpose: 0,
  fit: false,
  ...over,
});

describe("MIDI keyboard span", () => {
  it("uses the usual range for each size", () => {
    expect(playedSpan(fixed(), null)).toEqual([48, 72]);
    expect(defaultMidiLow(32)).toBe(53);
    expect(playedSpan(fixed({ keys: 32 }), null)).toEqual([53, 84]);
    expect(playedSpan(fixed({ keys: 37 }), null)).toEqual([48, 84]);
    expect(playedSpan(fixed({ keys: 49 }), null)).toEqual([36, 84]);
    expect(playedSpan(fixed({ keys: 61 }), null)).toEqual([36, 96]);
    expect(playedSpan(fixed({ keys: 76 }), null)).toEqual([28, 103]);
    expect(playedSpan(fixed({ keys: 88 }), null)).toEqual([21, 108]);
    expect(playedSpan(fixed({ keys: 0 }), null)).toBeNull();
  });

  it("draws a 25-key keyboard as one continuous run of neighbours", () => {
    const [lo, hi] = playedSpan(fixed(), null)!;
    expect(hi - lo + 1).toBe(25);
    const layout = new PianoLayout(lo, hi, 1500);
    expect(layout.keys).toEqual(Array.from({ length: 25 }, (_, i) => lo + i));
    const c = layout.lane(60)!;
    const d = layout.lane(62)!;
    expect(c.x + c.w).toBeCloseTo(d.x);
    expect(layout.lane(61)!.black).toBe(true);
  });

  it("slides onto the song by octaves and still honours an extra octave", () => {
    const onSong = playedSpan(fixed({ fit: true }), [72, 84]);
    expect(onSong).toEqual([60, 84]);
    expect(playedSpan(fixed({ fit: true, octave: 1 }), [72, 84])).toEqual([72, 96]);
    expect(playedSpan(fixed({ fit: true, low: 36 }), [72, 84])![0] % 12).toBe(0);
  });

  it("maps the leftmost key onto the left of the screen, then folds strays back", () => {
    const map = fixed({ fit: true });
    const span = playedSpan(map, [72, 84])!;
    expect(mapMidiNote(48, map, span, true)).toBe(60);
    expect(mapMidiNote(72, map, span, true)).toBe(84);
    expect(mapMidiNote(36, map, span, false)).toBe(48);
    expect(mapMidiNote(36, map, span, true)).toBe(60);
  });

  it("shifts a full-size keyboard without resizing the piano", () => {
    expect(mapMidiNote(60, fixed({ keys: 0, octave: 1, transpose: 2 }), null, true)).toBe(74);
  });

  it("offers only the natural left-hand keys", () => {
    expect(midiStartChoices(25)[0]).toBe(24);
    expect(midiStartChoices(25).every((n) => n % 12 === 0)).toBe(true);
    expect(midiStartChoices(88)).toEqual([21]);
    expect(midiStartChoices(76)).toEqual([28]);
  });
});

describe("foldIntoSpan", () => {
  it("keeps notes inside and moves the others by octaves", () => {
    expect(foldIntoSpan(67, 60, 84)).toBe(67);
    expect(foldIntoSpan(48, 60, 84)).toBe(60);
    expect(foldIntoSpan(96, 60, 84)).toBe(84);
    expect(foldIntoSpan(49, 60, 84)).toBe(61);
  });
});

describe("shapeVelocity", () => {
  it("is linear in the middle, louder when soft and quieter when firm", () => {
    expect(shapeVelocity(0.25, 0.5)).toBeCloseTo(0.25);
    expect(shapeVelocity(0.25, 0)).toBeGreaterThan(0.25);
    expect(shapeVelocity(0.25, 1)).toBeLessThan(0.25);
    expect(shapeVelocity(1, 0)).toBe(1);
    expect(shapeVelocity(0, 1)).toBe(0.08);
  });
});
