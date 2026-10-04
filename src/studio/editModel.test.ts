import { describe, expect, it } from "vitest";
import {
  addNote,
  docFromMidi,
  docToSpec,
  gridStep,
  moveNotes,
  pitchSpan,
  removeNotes,
  removeShort,
  resizeNotes,
  setDuration,
  snap,
  visibleNotes,
  MIN_DURATION,
  type EditDoc,
} from "./editModel";
import { writeMidi } from "./midiFile";

function sampleDoc(): EditDoc {
  const data = writeMidi({
    title: "Test",
    bpm: 100,
    timeSignature: [3, 4],
    tracks: [
      {
        name: "Right hand",
        program: 0,
        notes: [
          { midi: 64, time: 0, duration: 0.5, velocity: 0.8 },
          { midi: 67, time: 0.6, duration: 0.05, velocity: 0.6 },
        ],
      },
      { name: "Left hand", program: 0, notes: [{ midi: 48, time: 0, duration: 1, velocity: 0.7 }] },
      { name: "Drums", program: 0, channel: 9, notes: [{ midi: 36, time: 0, duration: 0.1, velocity: 0.9 }] },
    ],
  });
  return docFromMidi(data, "Test");
}

describe("docFromMidi / docToSpec", () => {
  it("reads tracks, tempo, meter and keeps drums hidden", () => {
    const doc = sampleDoc();
    expect(doc.bpm).toBe(100);
    expect(doc.timeSignature).toEqual([3, 4]);
    expect(doc.tracks.map((t) => t.drum)).toEqual([false, false, true]);
    expect(doc.notes).toHaveLength(4);
    expect(visibleNotes(doc)).toHaveLength(3);
  });

  it("round-trips through a MIDI file with the drum channel intact", () => {
    const doc = sampleDoc();
    const again = docFromMidi(writeMidi(docToSpec(doc)), "Test");
    expect(again.notes.map((n) => n.midi).sort()).toEqual(doc.notes.map((n) => n.midi).sort());
    expect(again.tracks[2].channel).toBe(9);
    expect(again.tracks[2].drum).toBe(true);
  });
});

describe("edits", () => {
  it("adds a note inside the piano range and keeps notes sorted", () => {
    const doc = sampleDoc();
    const { doc: next, id } = addNote(doc, { midi: 200, time: -1, duration: 0, velocity: 0.7, track: 0 });
    const n = next.notes.find((x) => x.id === id)!;
    expect(n.midi).toBe(108);
    expect(n.time).toBe(0);
    expect(n.duration).toBe(MIN_DURATION);
    expect(doc.notes).toHaveLength(4);
    expect(next.notes.every((x, i) => i === 0 || next.notes[i - 1].time <= x.time)).toBe(true);
  });

  it("removes notes by id", () => {
    const doc = sampleDoc();
    const next = removeNotes(doc, [doc.notes[0].id]);
    expect(next.notes).toHaveLength(3);
  });

  it("moves notes without going before zero or off the keyboard", () => {
    const doc = sampleDoc();
    const e = doc.notes.find((n) => n.midi === 64)!;
    const g = doc.notes.find((n) => n.midi === 67)!;
    const next = moveNotes(doc, [e.id, g.id], -5, 100);
    const e2 = next.notes.find((n) => n.id === e.id)!;
    const g2 = next.notes.find((n) => n.id === g.id)!;
    expect(e2.time).toBe(0);
    expect(g2.time).toBeCloseTo(0.6, 2);
    expect(g2.midi).toBe(108);
    expect(e2.midi).toBe(105);
  });

  it("shortens and lengthens with a floor", () => {
    const doc = sampleDoc();
    const e = doc.notes.find((n) => n.midi === 64)!;
    expect(resizeNotes(doc, [e.id], 0.25).notes.find((n) => n.id === e.id)!.duration).toBeCloseTo(0.75, 2);
    expect(resizeNotes(doc, [e.id], -5).notes.find((n) => n.id === e.id)!.duration).toBe(MIN_DURATION);
    expect(setDuration(doc, e.id, 2).notes.find((n) => n.id === e.id)!.duration).toBe(2);
  });

  it("cleans up short notes but never drums", () => {
    const doc = sampleDoc();
    const { doc: next, removed } = removeShort(doc, 0.12);
    expect(removed).toBe(1);
    expect(next.notes.some((n) => n.midi === 67)).toBe(false);
    expect(next.notes.some((n) => n.midi === 36)).toBe(true);
  });
});

describe("helpers", () => {
  it("snaps to a sixteenth grid at the tempo", () => {
    expect(gridStep({ bpm: 120 })).toBeCloseTo(0.125);
    expect(snap(0.3, 0.125)).toBeCloseTo(0.25);
  });

  it("pads the pitch span to at least two octaves", () => {
    const [lo, hi] = pitchSpan(sampleDoc());
    expect(lo).toBeLessThanOrEqual(44);
    expect(hi).toBeGreaterThanOrEqual(71);
    expect(hi - lo).toBeGreaterThanOrEqual(24);
  });
});
