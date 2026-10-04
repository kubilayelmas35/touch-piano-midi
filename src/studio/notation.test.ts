import { describe, expect, it } from "vitest";
import { parseMidi } from "../midi/song";
import { writeMidi } from "./midiFile";
import {
  insertBar,
  insertNote,
  insertRest,
  measureBeats,
  notationToMidi,
  parseDuration,
  parsePitch,
  parseVoice,
  removeLastToken,
} from "./notation";

describe("parsePitch", () => {
  it("reads letters and solfège with accidentals and octaves", () => {
    expect(parsePitch("C4", 4)?.midi).toBe(60);
    expect(parsePitch("Do4", 4)?.midi).toBe(60);
    expect(parsePitch("la4", 4)?.midi).toBe(69);
    expect(parsePitch("A4", 0)?.midi).toBe(69);
    expect(parsePitch("F#3", 4)?.midi).toBe(54);
    expect(parsePitch("Sib3", 4)?.midi).toBe(58);
    expect(parsePitch("Eb5", 4)?.midi).toBe(75);
    expect(parsePitch("Do♯4", 4)?.midi).toBe(61);
    expect(parsePitch("B-1", 4)?.midi).toBe(11);
  });

  it("uses the given octave when the token has none", () => {
    expect(parsePitch("Sol", 5)).toEqual({ midi: 79, octave: 5 });
    expect(parsePitch("g", 3)).toEqual({ midi: 55, octave: 3 });
  });

  it("rejects non-pitches", () => {
    for (const s of ["H4", "Dox", "4", "", "Solo", "C##4"]) expect(parsePitch(s, 4)).toBeNull();
  });
});

describe("parseDuration", () => {
  it("reads beats, fractions and note letters", () => {
    expect(parseDuration("1")).toBe(1);
    expect(parseDuration("0.5")).toBe(0.5);
    expect(parseDuration("1/3")).toBeCloseTo(1 / 3);
    expect(parseDuration("h")).toBe(2);
    expect(parseDuration("q.")).toBe(1.5);
    expect(parseDuration("w")).toBe(4);
    expect(parseDuration("S")).toBe(0.25);
  });

  it("rejects zero, negative, huge and garbage values", () => {
    for (const s of ["0", "-1", "65", "x", "1/0", "q.."]) expect(parseDuration(s)).toBeNull();
  });
});

describe("parseVoice", () => {
  it("carries octave and duration forward", () => {
    const v = parseVoice("Do4 Re Mi:2 Fa", 4);
    expect(v.notes).toEqual([
      { midi: 60, beat: 0, beats: 1 },
      { midi: 62, beat: 1, beats: 1 },
      { midi: 64, beat: 2, beats: 2 },
      { midi: 65, beat: 4, beats: 2 },
    ]);
    expect(v.length).toBe(6);
    expect(v.errors).toEqual([]);
    expect(v.endOctave).toBe(4);
    expect(v.endDuration).toBe(2);
  });

  it("handles chords, rests, comments and multiple lines", () => {
    const v = parseVoice("C4+E4+G4:2 - // a rest\nr:1 sus A3:1", 4);
    expect(v.notes.map((n) => [n.midi, n.beat, n.beats])).toEqual([
      [60, 0, 2],
      [64, 0, 2],
      [67, 0, 2],
      [57, 6, 1],
    ]);
    expect(v.length).toBe(7);
  });

  it("reports bad tokens with their line and keeps going", () => {
    const v = parseVoice("Do4 Xy\nMi:abc Do9 Re", 4);
    expect(v.errors).toEqual([
      { kind: "badNote", token: "Xy", line: 1 },
      { kind: "badDuration", token: "Mi:abc", line: 2 },
      { kind: "outOfRange", token: "Do9", line: 2 },
    ]);
    expect(v.notes.map((n) => n.midi)).toEqual([60, 62]);
  });

  it("checks bar lengths, allowing a short pickup and last bar", () => {
    expect(parseVoice("Sol3 | Do4 Re Mi Fa | Sol:2 La:1 | Si:1 |", 4).badBars).toEqual([3]);
    expect(parseVoice("Do4 Re Mi Fa | Sol:2", 4).badBars).toEqual([]);
    expect(parseVoice("Do4:3 | Re:4 | Mi:3", 3).badBars).toEqual([2]);
    expect(parseVoice("Do4 Re Mi Fa Sol", 4).badBars).toEqual([]);
  });

  it("knows bar sizes of common time signatures", () => {
    expect(measureBeats([4, 4])).toBe(4);
    expect(measureBeats([3, 4])).toBe(3);
    expect(measureBeats([6, 8])).toBe(3);
    expect(measureBeats([2, 2])).toBe(4);
  });
});

describe("editor helpers", () => {
  it("writes octave and length only when they change", () => {
    let r = insertNote("", 0, { name: "Do", octave: 4, duration: 1 });
    expect(r).toEqual({ text: "Do", cursor: 2 });
    r = insertNote(r.text, r.cursor, { name: "Re", octave: 4, duration: 1 });
    expect(r.text).toBe("Do Re");
    r = insertNote(r.text, r.cursor, { name: "Mi", octave: 5, duration: 2 });
    expect(r.text).toBe("Do Re Mi5:2");
    r = insertNote(r.text, r.cursor, { name: "Fa", octave: 5, duration: 2 });
    expect(r.text).toBe("Do Re Mi5:2 Fa");
    expect(parseVoice(r.text, 4).notes.map((n) => n.midi)).toEqual([60, 62, 76, 77]);
  });

  it("joins chord notes into the previous token before its length", () => {
    let r = insertNote("C4:2", 4, { name: "E", octave: 4, duration: 2, chord: true });
    expect(r.text).toBe("C4+E:2");
    r = insertNote(r.text, r.cursor, { name: "G", octave: 4, duration: 2, chord: true });
    expect(r.text).toBe("C4+E+G:2");
    expect(parseVoice(r.text, 4).notes.map((n) => [n.midi, n.beat])).toEqual([
      [60, 0],
      [64, 0],
      [67, 0],
    ]);
    expect(insertNote("C4 |", 4, { name: "E", octave: 4, duration: 1, chord: true }).text).toBe("C4 | E");
  });

  it("inserts at the cursor without gluing tokens", () => {
    const r = insertNote("Do Mi", 2, { name: "Re", octave: 4, duration: 1 });
    expect(r.text).toBe("Do Re Mi");
    expect(r.cursor).toBe(5);
  });

  it("adds rests, bar lines and deletes the last token", () => {
    let r = insertRest("Do4:2", 5, 2);
    expect(r.text).toBe("Do4:2 -");
    r = insertRest(r.text, r.cursor, 1);
    expect(r.text).toBe("Do4:2 - -:1");
    r = insertBar(r.text, r.cursor);
    expect(r.text).toBe("Do4:2 - -:1 |");
    r = removeLastToken(r.text, r.cursor);
    expect(r).toEqual({ text: "Do4:2 - -:1", cursor: 11 });
    expect(removeLastToken("", 0)).toEqual({ text: "", cursor: 0 });
  });
});

describe("notationToMidi", () => {
  it("converts beats to seconds and survives a MIDI round trip", () => {
    const spec = notationToMidi({
      title: "Test",
      bpm: 120,
      timeSignature: [3, 4],
      program: 0,
      parts: [
        { name: "Right hand", text: "Mi5 Re Do | Re:3" },
        { name: "Left hand", text: "Do3+Sol3:3 | Sol2:3" },
      ],
    });
    expect(spec.errors).toEqual([]);
    expect(spec.noteCount).toBe(7);
    expect(spec.tracks[0].notes[1]).toMatchObject({ midi: 74, time: 0.5 });
    expect(spec.tracks[1].notes[2]).toMatchObject({ midi: 43, time: 1.5 });

    const song = parseMidi(writeMidi(spec), "Test");
    expect(song.notes).toHaveLength(7);
    expect(song.tracks.map((t) => t.name)).toEqual(["Right hand", "Left hand"]);
    expect(song.bpm).toBeCloseTo(120, 0);
    expect(song.beatsPerMeasure).toBe(3);
    const re = song.notes.find((n) => n.midi === 74 && n.time > 1)!;
    expect(re.time).toBeCloseTo(1.5, 2);
    expect(re.duration).toBeCloseTo(1.5 * 0.96, 2);
  });

  it("skips empty parts", () => {
    const spec = notationToMidi({ title: "x", bpm: 90, timeSignature: [4, 4], program: 40, parts: [{ name: "A", text: "La4" }, { name: "B", text: "" }] });
    const song = parseMidi(writeMidi(spec), "x");
    expect(song.tracks).toHaveLength(1);
    expect(song.notes[0].midi).toBe(69);
  });
});
