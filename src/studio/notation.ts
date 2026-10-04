/**
 * Text note entry for the "notes to MIDI" studio tool.
 *
 *   Do4 Re Mi:2 | Sol4+Si4+Re5:1.5 Fa#:0.5 | sus:1 C5:h.
 *
 * - Pitch: letter (C D E F G A B) or solfège (Do Re Mi Fa Sol La Si), `#` or `b` accidental, octave digit.
 *   A missing octave repeats the previous one (start: 4).
 * - Duration after `:` in beats (1 = quarter, 2 = half, 0.5 = eighth, 1/3 = triplet) or a letter
 *   (w h q e s, `.` for dotted). A missing duration repeats the previous one (start: 1).
 * - Chord: pitches joined with `+`. Rest: `-`, `r` or `sus`. Bar line: `|` (optional, checked when present).
 * - `//` starts a comment.
 */

import type { MidiFileSpec } from "./midiFile";

const LETTER: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SOLFEGE: Record<string, number> = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
const NAMED: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

export const SOLFEGE_NAMES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
export const LETTER_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export type NotationErrorKind = "badNote" | "badDuration" | "outOfRange";

export interface NotationError {
  kind: NotationErrorKind;
  token: string;
  line: number;
}

export interface ParsedNote {
  midi: number;
  /** In beats (quarter notes). */
  beat: number;
  beats: number;
}

export interface ParsedVoice {
  notes: ParsedNote[];
  /** Total length in beats. */
  length: number;
  errors: NotationError[];
  /** 1-based numbers of bars whose length doesn't match the time signature (first and last bar may be partial). */
  badBars: number[];
  /** Octave and duration in effect at the end of the text (what a new note without them would use). */
  endOctave: number;
  endDuration: number;
}

/** Parses one pitch; `octave` is used when the token has none. Returns null when it isn't a pitch. */
export function parsePitch(token: string, octave: number): { midi: number; octave: number } | null {
  const m = /^(do|re|mi|fa|sol|la|si|[a-g])(#|♯|b|♭)?(-?\d)?$/i.exec(token.trim());
  if (!m) return null;
  const name = m[1].toLowerCase();
  const base = name.length > 1 ? SOLFEGE[name] : LETTER[name];
  if (base === undefined) return null;
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0;
  const oct = m[3] !== undefined ? Number(m[3]) : octave;
  return { midi: (oct + 1) * 12 + base + acc, octave: oct };
}

/** Parses a duration in beats; null when invalid. */
export function parseDuration(s: string): number | null {
  const t = s.trim().toLowerCase();
  const named = /^([whqes])(\.?)$/.exec(t);
  if (named) return NAMED[named[1]] * (named[2] ? 1.5 : 1);
  const frac = /^(\d+(?:\.\d+)?)(?:\/(\d+))?$/.exec(t);
  if (!frac) return null;
  const v = frac[2] ? Number(frac[1]) / Number(frac[2]) : Number(frac[1]);
  return v > 0 && v <= 64 ? v : null;
}

export function parseVoice(src: string, measureBeats: number): ParsedVoice {
  const notes: ParsedNote[] = [];
  const errors: NotationError[] = [];
  const bars: number[] = [];
  let beat = 0;
  let barStart = 0;
  let octave = 4;
  let dur = 1;
  let sawBar = false;

  src.split(/\r?\n/).forEach((rawLine, li) => {
    const line = rawLine.replace(/\/\/.*$/, "");
    for (const token of line.split(/\s+/).filter(Boolean)) {
      if (token === "|") {
        sawBar = true;
        bars.push(beat - barStart);
        barStart = beat;
        continue;
      }
      const colon = token.lastIndexOf(":");
      const head = colon >= 0 ? token.slice(0, colon) : token;
      if (colon >= 0) {
        const d = parseDuration(token.slice(colon + 1));
        if (d === null) {
          errors.push({ kind: "badDuration", token, line: li + 1 });
          continue;
        }
        dur = d;
      }
      if (/^(-|r|sus)$/i.test(head)) {
        beat += dur;
        continue;
      }
      const midis: number[] = [];
      let ok = true;
      for (const part of head.split("+")) {
        const p = parsePitch(part, octave);
        if (!p) {
          errors.push({ kind: "badNote", token, line: li + 1 });
          ok = false;
          break;
        }
        if (p.midi < 21 || p.midi > 108) {
          errors.push({ kind: "outOfRange", token, line: li + 1 });
          ok = false;
          break;
        }
        octave = p.octave;
        midis.push(p.midi);
      }
      if (!ok) continue;
      for (const midi of midis) notes.push({ midi, beat, beats: dur });
      beat += dur;
    }
  });

  if (sawBar && beat > barStart) bars.push(beat - barStart);
  const badBars = sawBar
    ? bars
        .map((len, i) => ({ len, n: i + 1 }))
        .filter(({ len, n }) => Math.abs(len - measureBeats) > 1e-6 && !((n === 1 || n === bars.length) && len < measureBeats))
        .map(({ n }) => n)
    : [];
  return { notes, length: beat, errors, badBars, endOctave: octave, endDuration: dur };
}

/** Quarter-note beats in one bar of a time signature like [6, 8]. */
export function measureBeats([num, den]: [number, number]): number {
  return (num * 4) / den;
}

export interface EditResult {
  text: string;
  cursor: number;
}

function place(text: string, cursor: number, before: string): EditResult {
  const after = text.slice(cursor);
  const glue = after && !/^\s/.test(after) ? " " : "";
  return { text: before + glue + after, cursor: before.length };
}

function append(before: string, token: string): string {
  return before + (before && !/\s$/.test(before) ? " " : "") + token;
}

/**
 * Inserts a note at the cursor, writing the octave / duration only when they differ from what's in
 * effect there. With `chord` the pitch joins the token before the cursor (Do4 → Do4+Mi4).
 */
export function insertNote(
  text: string,
  cursor: number,
  note: { name: string; octave: number; duration: number; chord?: boolean }
): EditResult {
  const before = text.slice(0, cursor);
  const ctx = parseVoice(before, 4);
  const pitch = note.name + (note.octave !== ctx.endOctave ? note.octave : "");
  const last = /(\S+)$/.exec(before)?.[1];
  if (note.chord && last) {
    const colon = last.lastIndexOf(":");
    const head = colon >= 0 ? last.slice(0, colon) : last;
    if (head !== "|" && !/^(-|r|sus)$/i.test(head)) {
      const tail = colon >= 0 ? last.slice(colon) : "";
      return place(text, cursor, before.slice(0, before.length - last.length) + `${head}+${pitch}${tail}`);
    }
  }
  const dur = note.duration !== ctx.endDuration ? `:${note.duration}` : "";
  return place(text, cursor, append(before, pitch + dur));
}

export function insertRest(text: string, cursor: number, duration: number): EditResult {
  const before = text.slice(0, cursor);
  const dur = duration !== parseVoice(before, 4).endDuration ? `:${duration}` : "";
  return place(text, cursor, append(before, `-${dur}`));
}

export function insertBar(text: string, cursor: number): EditResult {
  return place(text, cursor, append(text.slice(0, cursor), "|"));
}

export function removeLastToken(text: string, cursor: number): EditResult {
  const before = text.slice(0, cursor).replace(/\S+\s*$/, "").replace(/[ \t]+$/, "");
  return { text: before + text.slice(cursor), cursor: before.length };
}

export interface NotationSpec {
  title: string;
  bpm: number;
  timeSignature: [number, number];
  /** One text per hand / part; empty parts are skipped. */
  parts: { name: string; text: string }[];
  program: number;
}

/** Turns typed parts into a MIDI file spec (beats → seconds at the given tempo). */
export function notationToMidi(spec: NotationSpec): MidiFileSpec & { errors: NotationError[]; noteCount: number } {
  const spb = 60 / spec.bpm;
  const beatsPerBar = measureBeats(spec.timeSignature);
  const errors: NotationError[] = [];
  let noteCount = 0;
  const tracks = spec.parts.map(({ name, text }) => {
    const v = parseVoice(text, beatsPerBar);
    errors.push(...v.errors);
    noteCount += v.notes.length;
    return {
      name,
      program: spec.program,
      notes: v.notes.map((n) => ({ midi: n.midi, time: n.beat * spb, duration: n.beats * spb * 0.96, velocity: 0.75 })),
    };
  });
  return { title: spec.title, bpm: spec.bpm, timeSignature: spec.timeSignature, tracks, errors, noteCount };
}
