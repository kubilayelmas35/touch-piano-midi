import { foldIntoSpan } from "../lib/notes";
import { selectPlayerNotes, type HandFilter, type Song } from "../midi/song";

/** Sizes a MIDI keyboard is sold in. 0 in settings means the on-screen piano follows the song. */
export const MIDI_KEY_COUNTS = [25, 32, 37, 49, 61, 76, 88] as const;

export function isMidiKeyCount(n: number): boolean {
  return (MIDI_KEY_COUNTS as readonly number[]).includes(n);
}

const PIANO_LO = 21;
const PIANO_HI = 108;

export interface MidiMap {
  /** 0 = don't force a size. */
  keys: number;
  /** 0 = the usual lowest note for this size. Otherwise the note the leftmost key sends. */
  low: number;
  octave: number;
  transpose: number;
  /** Slide the window onto the song, keeping the size and the left key's pitch class. */
  fit: boolean;
}

/** Usual leftmost note: 25 and 37 start at C3, 49 and 61 at C2, 32 at F3, 76 at E1, 88 at A0. */
export function defaultMidiLow(count: number): number {
  switch (count) {
    case 32:
      return 53;
    case 49:
    case 61:
      return 36;
    case 76:
      return 28;
    case 88:
      return 21;
    default:
      return 48;
  }
}

/** Leftmost notes worth offering: C-to-C keyboards, F or C for 32, E for 76, A for 88. */
export function midiStartChoices(count: number): number[] {
  if (!count) return [];
  const pcs = count === 88 ? [9] : count === 76 ? [4] : count === 32 ? [0, 5] : [0];
  const out: number[] = [];
  for (let m = PIANO_LO; m + count - 1 <= PIANO_HI; m++) {
    if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
  }
  return out;
}

export function hardwareLow(map: MidiMap): number {
  const raw = map.low > 0 ? map.low : defaultMidiLow(map.keys);
  return Math.max(0, Math.min(127, Math.round(raw)));
}

function clampSpan(lo: number, count: number): [number, number] {
  const span = Math.max(1, count) - 1;
  let low = Math.round(lo);
  let high = low + span;
  if (high > PIANO_HI) {
    low -= high - PIANO_HI;
    high = PIANO_HI;
  }
  if (low < PIANO_LO) {
    high += PIANO_LO - low;
    low = PIANO_LO;
  }
  if (high > PIANO_HI) high = PIANO_HI;
  if (low > high) low = high;
  return [low, high];
}

/** Lowest note of the window of `count` keys that covers the most of [songLo, songHi]. */
export function fitLow(count: number, anchor: number, songLo: number, songHi: number): number {
  if (!(songHi >= songLo)) return anchor;
  const span = count - 1;
  const pc = ((anchor % 12) + 12) % 12;
  let best = anchor;
  let bestScore = -Infinity;
  let found = false;
  for (let lo = pc; lo + span <= PIANO_HI; lo += 12) {
    if (lo < PIANO_LO) continue;
    found = true;
    const hi = lo + span;
    const overlap = Math.min(hi, songHi) - Math.max(lo, songLo);
    const cover = overlap < 0 ? 0 : overlap + 1;
    const mid = (songLo + songHi) / 2;
    const score = cover * 100 + (mid >= lo && mid <= hi ? 10 : 0) - Math.abs((lo + hi) / 2 - mid);
    if (score > bestScore) {
      bestScore = score;
      best = lo;
    }
  }
  return found ? best : anchor;
}

/** Inclusive MIDI span the on-screen piano shows for this keyboard, or null when size is automatic. */
export function playedSpan(map: MidiMap, song: [number, number] | null): [number, number] | null {
  if (!map.keys) return null;
  const base = hardwareLow(map);
  const placed = map.fit && song ? fitLow(map.keys, base, song[0], song[1]) : base;
  return clampSpan(placed + map.octave * 12 + map.transpose, map.keys);
}

function clampMidi(n: number): number {
  return Math.max(0, Math.min(127, Math.round(n)));
}

/**
 * The pitch a raw MIDI note plays. With a fixed size, key number 0 (the leftmost key) plays the left of the
 * span, so the hardware lines up with the screen even after the window slides onto the song.
 */
export function mapMidiNote(raw: number, map: MidiMap, span: [number, number] | null, fold: boolean): number {
  const shift = map.octave * 12 + map.transpose;
  if (!map.keys || !span) return clampMidi(raw + shift);
  const n = span[0] + (raw - hardwareLow(map));
  return clampMidi(fold ? foldIntoSpan(n, span[0], span[1]) : n);
}

/** 0 light presses speak louder, 0.5 matches how hard the key was struck, 1 keeps soft playing quiet. */
export function shapeVelocity(velocity: number, curve: number): number {
  const x = Math.min(1, Math.max(0, velocity));
  const c = Math.min(1, Math.max(0, curve));
  const exp = c < 0.5 ? 0.45 + (c / 0.5) * 0.55 : 1 + ((c - 0.5) / 0.5) * 1.4;
  return Math.min(1, Math.max(0.08, Math.pow(x, exp)));
}

export function songPitchBounds(song: Song | null, playTracks: readonly number[], hand: HandFilter): [number, number] | null {
  if (!song) return null;
  const notes = selectPlayerNotes(song, [...playTracks], hand);
  if (!notes.length) return null;
  let lo = notes[0].midi;
  let hi = notes[0].midi;
  for (const n of notes) {
    if (n.midi < lo) lo = n.midi;
    if (n.midi > hi) hi = n.midi;
  }
  return [lo, hi];
}
