import { Midi } from "@tonejs/midi";

export interface SongNote {
  midi: number;
  /** Seconds from song start. */
  time: number;
  duration: number;
  velocity: number;
  track: number;
}

export interface SongTrack {
  index: number;
  name: string;
  instrument: string;
  isDrum: boolean;
  noteCount: number;
  low: number;
  high: number;
}

export interface Beat {
  time: number;
  downbeat: boolean;
  measure: number;
}

export interface Song {
  title: string;
  duration: number;
  /** All pitched notes, sorted by time then pitch. */
  notes: SongNote[];
  tracks: SongTrack[];
  beats: Beat[];
  /** Seconds per beat at the start (used for count-in). */
  firstBeatSec: number;
  beatsPerMeasure: number;
  bpm: number;
}

function sortNotes(notes: SongNote[]): SongNote[] {
  return notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
}

export function finalizeSong(
  title: string,
  notes: SongNote[],
  tracks: SongTrack[],
  beats: Beat[],
  bpm: number,
  beatsPerMeasure: number
): Song {
  sortNotes(notes);
  const duration = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
  return {
    title,
    duration,
    notes,
    tracks,
    beats,
    firstBeatSec: 60 / bpm,
    beatsPerMeasure,
    bpm,
  };
}

function trackLabel(name: string, instrument: string, index: number): string {
  const n = name.trim();
  if (n) return n;
  if (instrument) return instrument.replace(/\b\w/g, (c) => c.toUpperCase());
  return `Track ${index + 1}`;
}

export function parseMidi(data: ArrayBuffer, title: string): Song {
  const midi = new Midi(data);
  const notes: SongNote[] = [];
  const tracks: SongTrack[] = [];

  midi.tracks.forEach((tr) => {
    if (!tr.notes.length) return;
    const isDrum = tr.channel === 9 || tr.instrument.percussion;
    const index = tracks.length;
    let low = 127;
    let high = 0;
    if (!isDrum) {
      for (const n of tr.notes) {
        if (n.duration <= 0) continue;
        notes.push({
          midi: n.midi,
          time: n.time,
          duration: Math.max(0.05, n.duration),
          velocity: n.velocity || 0.7,
          track: index,
        });
        low = Math.min(low, n.midi);
        high = Math.max(high, n.midi);
      }
    }
    tracks.push({
      index,
      name: trackLabel(tr.name, isDrum ? "drums" : tr.instrument.name, index),
      instrument: isDrum ? "drums" : tr.instrument.family || tr.instrument.name,
      isDrum,
      noteCount: tr.notes.length,
      low,
      high,
    });
  });

  // Beat grid from the header's tempo + time signature maps.
  const header = midi.header;
  const ppq = header.ppq || 480;
  const sigs = header.timeSignatures.length
    ? header.timeSignatures.map((s) => ({ ticks: s.ticks, num: s.timeSignature[0], den: s.timeSignature[1] }))
    : [{ ticks: 0, num: 4, den: 4 }];
  sigs.sort((a, b) => a.ticks - b.ticks);
  const lastNoteEnd = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
  const endTick = header.secondsToTicks(lastNoteEnd + 0.5);

  const beats: Beat[] = [];
  let measure = 0;
  for (let si = 0; si < sigs.length; si++) {
    const sig = sigs[si];
    const beatTicks = (ppq * 4) / (sig.den || 4);
    const until = si + 1 < sigs.length ? sigs[si + 1].ticks : endTick;
    let beatInMeasure = 0;
    for (let tick = sig.ticks; tick < until && beats.length < 20000; tick += beatTicks) {
      beats.push({ time: header.ticksToSeconds(tick), downbeat: beatInMeasure === 0, measure });
      beatInMeasure++;
      if (beatInMeasure >= (sig.num || 4)) {
        beatInMeasure = 0;
        measure++;
      }
    }
    if (beatInMeasure) measure++;
  }

  const bpm = header.tempos.length ? header.tempos[0].bpm : 120;
  const cleanTitle = (header.name && header.name.trim().length > 2 ? header.name.trim() : title).slice(0, 120);
  return finalizeSong(cleanTitle || title, notes, tracks, beats, bpm, sigs[0].num || 4);
}

/** Notes the player is responsible for, given selected tracks and hand split. */
export type HandFilter = "both" | "right" | "left";

export const HAND_SPLIT = 60;

export function selectPlayerNotes(song: Song, playTracks: number[], hand: HandFilter): SongNote[] {
  const set = new Set(playTracks);
  return song.notes.filter((n) => {
    if (!set.has(n.track)) return false;
    if (hand === "right") return n.midi >= HAND_SPLIT;
    if (hand === "left") return n.midi < HAND_SPLIT;
    return true;
  });
}

export function selectAccompanimentNotes(song: Song, playTracks: number[], hand: HandFilter, muted: number[]): SongNote[] {
  const play = new Set(playTracks);
  const mute = new Set(muted);
  return song.notes.filter((n) => {
    if (mute.has(n.track)) return false;
    if (!play.has(n.track)) return true;
    if (hand === "right") return n.midi < HAND_SPLIT;
    if (hand === "left") return n.midi >= HAND_SPLIT;
    return false;
  });
}

/** Picks sensible default player tracks: the busiest non-drum track(s) typical of piano parts. */
export function defaultPlayTracks(song: Song): number[] {
  const pitched = song.tracks.filter((t) => !t.isDrum && t.noteCount > 0);
  if (!pitched.length) return [];
  const right = pitched.find((t) => /right|\brh\b|sağ/i.test(t.name));
  const left = pitched.find((t) => /left|\blh\b|sol el/i.test(t.name));
  if (right && left) return [right.index, left.index].sort((a, b) => a - b);
  const pianoish = pitched.filter((t) => /piano|keyboard|klavier|right|left|rh|lh/i.test(`${t.name} ${t.instrument}`));
  if (pianoish.length && pianoish.length <= 2) return pianoish.map((t) => t.index);
  if (pitched.length <= 2) return pitched.map((t) => t.index);
  const busiest = [...pitched].sort((a, b) => b.noteCount - a.noteCount)[0];
  return [busiest.index];
}
