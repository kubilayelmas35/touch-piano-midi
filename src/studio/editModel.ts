import { Midi } from "@tonejs/midi";
import type { MidiFileSpec } from "./midiFile";

/** A song opened in the note editor: plain notes in seconds, every edit makes a new document (undo). */

export interface EditNote {
  id: number;
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  /** Index into `EditDoc.tracks`. */
  track: number;
}

export interface EditTrack {
  name: string;
  program: number;
  channel: number;
  /** Drum tracks are kept as they are but not shown. */
  drum: boolean;
}

export interface EditDoc {
  title: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: EditTrack[];
  notes: EditNote[];
}

export const MIN_MIDI = 21;
export const MAX_MIDI = 108;
export const MIN_DURATION = 0.04;

let nextId = 1;
const newId = () => nextId++;

const byTime = (a: EditNote, b: EditNote) => a.time - b.time || a.midi - b.midi;
const clampMidi = (m: number) => Math.max(MIN_MIDI, Math.min(MAX_MIDI, Math.round(m)));

export function docFromMidi(data: ArrayBuffer, title: string): EditDoc {
  const midi = new Midi(data);
  const tracks: EditTrack[] = [];
  const notes: EditNote[] = [];
  for (const tr of midi.tracks) {
    if (!tr.notes.length) continue;
    const index = tracks.length;
    const drum = tr.channel === 9 || tr.instrument.percussion;
    tracks.push({ name: tr.name || `Track ${index + 1}`, program: tr.instrument.number, channel: tr.channel, drum });
    for (const n of tr.notes) {
      notes.push({ id: newId(), midi: n.midi, time: n.time, duration: Math.max(MIN_DURATION, n.duration), velocity: n.velocity, track: index });
    }
  }
  if (!tracks.some((t) => !t.drum)) tracks.push({ name: "Piano", program: 0, channel: 0, drum: false });
  const ts = midi.header.timeSignatures[0]?.timeSignature;
  return {
    title,
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? 120),
    timeSignature: ts && ts.length >= 2 ? [ts[0], ts[1]] : [4, 4],
    tracks,
    notes: notes.sort(byTime),
  };
}

export function docToSpec(doc: EditDoc): MidiFileSpec {
  return {
    title: doc.title,
    bpm: doc.bpm,
    timeSignature: doc.timeSignature,
    tracks: doc.tracks.map((t, i) => ({
      name: t.name,
      program: t.program,
      channel: t.channel,
      notes: doc.notes.filter((n) => n.track === i),
    })),
  };
}

/** Sixteenth note at the song tempo: the snap grid and the shorten / lengthen step. */
export function gridStep(doc: Pick<EditDoc, "bpm">): number {
  return 60 / Math.max(20, doc.bpm) / 4;
}

export function snap(t: number, step: number): number {
  return Math.round(t / step) * step;
}

/** Tracks the editor shows (all but drums). */
export function editableTracks(doc: EditDoc): number[] {
  return doc.tracks.flatMap((t, i) => (t.drum ? [] : [i]));
}

export function visibleNotes(doc: EditDoc): EditNote[] {
  return doc.notes.filter((n) => !doc.tracks[n.track]?.drum);
}

export function addNote(doc: EditDoc, note: Omit<EditNote, "id">): { doc: EditDoc; id: number } {
  const id = newId();
  const n: EditNote = {
    ...note,
    id,
    midi: clampMidi(note.midi),
    time: Math.max(0, note.time),
    duration: Math.max(MIN_DURATION, note.duration),
  };
  return { doc: { ...doc, notes: [...doc.notes, n].sort(byTime) }, id };
}

export function removeNotes(doc: EditDoc, ids: readonly number[]): EditDoc {
  const gone = new Set(ids);
  return { ...doc, notes: doc.notes.filter((n) => !gone.has(n.id)) };
}

/** Shifts notes in time (seconds) and pitch (semitones), keeping them inside the piano range and after 0. */
export function moveNotes(doc: EditDoc, ids: readonly number[], dt: number, dMidi: number): EditDoc {
  const set = new Set(ids);
  const moving = doc.notes.filter((n) => set.has(n.id));
  if (!moving.length) return doc;
  const earliest = Math.min(...moving.map((n) => n.time));
  const shift = Math.max(-earliest, dt);
  const lo = Math.min(...moving.map((n) => n.midi));
  const hi = Math.max(...moving.map((n) => n.midi));
  const dm = Math.max(MIN_MIDI - lo, Math.min(MAX_MIDI - hi, Math.round(dMidi)));
  return {
    ...doc,
    notes: doc.notes.map((n) => (set.has(n.id) ? { ...n, time: n.time + shift, midi: n.midi + dm } : n)).sort(byTime),
  };
}

/** Changes note lengths by `delta` seconds (never below MIN_DURATION). */
export function resizeNotes(doc: EditDoc, ids: readonly number[], delta: number): EditDoc {
  const set = new Set(ids);
  return {
    ...doc,
    notes: doc.notes.map((n) => (set.has(n.id) ? { ...n, duration: Math.max(MIN_DURATION, n.duration + delta) } : n)),
  };
}

export function setDuration(doc: EditDoc, id: number, duration: number): EditDoc {
  return { ...doc, notes: doc.notes.map((n) => (n.id === id ? { ...n, duration: Math.max(MIN_DURATION, duration) } : n)) };
}

/** Removes (non-drum) notes shorter than `minDuration`; returns how many went. */
export function removeShort(doc: EditDoc, minDuration: number): { doc: EditDoc; removed: number } {
  const keep = doc.notes.filter((n) => doc.tracks[n.track]?.drum || n.duration >= minDuration);
  return { doc: { ...doc, notes: keep }, removed: doc.notes.length - keep.length };
}

export function songEnd(doc: EditDoc): number {
  return doc.notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
}

/** Lowest and highest shown pitch, padded, at least two octaves around middle C when empty. */
export function pitchSpan(doc: EditDoc): [number, number] {
  const shown = visibleNotes(doc);
  let lo = shown.length ? Math.min(...shown.map((n) => n.midi)) : 60;
  let hi = shown.length ? Math.max(...shown.map((n) => n.midi)) : 60;
  lo = Math.max(MIN_MIDI, lo - 4);
  hi = Math.min(MAX_MIDI, hi + 4);
  while (hi - lo < 24) {
    if (lo > MIN_MIDI) lo--;
    if (hi - lo < 24 && hi < MAX_MIDI) hi++;
  }
  return [lo, hi];
}
