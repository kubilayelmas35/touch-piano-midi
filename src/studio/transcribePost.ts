import { PROGRAMS, splitHands, type MidiTrackSpec, type RawNote } from "./midiFile";

export type TranscribeInstrument = "piano" | "guitar" | "violin";

export interface TranscribeOptions {
  /** 0 (only clear notes) … 1 (catch quiet notes too). */
  sensitivity: number;
  instrument: TranscribeInstrument;
  /** Snap notes to a sixteenth-note grid at the detected tempo (for steady-tempo recordings). */
  quantize: boolean;
}

export const DEFAULT_TRANSCRIBE: TranscribeOptions = { sensitivity: 0.5, instrument: "piano", quantize: false };

/** Basic Pitch output note. */
export interface DetectedNote {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
}

/** Basic Pitch thresholds for a sensitivity; frequency limits keep each instrument's range. */
export function modelParams(o: TranscribeOptions) {
  const s = Math.max(0, Math.min(1, o.sensitivity));
  const range: Record<TranscribeInstrument, [number, number]> = {
    piano: [27, 4200],
    guitar: [80, 1400],
    violin: [190, 3600],
  };
  return {
    onsetThresh: 0.65 - 0.35 * s,
    frameThresh: 0.45 - 0.25 * s,
    minNoteLenFrames: Math.round(11 - 5 * s),
    minFreq: range[o.instrument][0],
    maxFreq: range[o.instrument][1],
  };
}

/**
 * Tempo from note onsets: autocorrelation of an onset envelope (100 frames/s) over 50–200 BPM,
 * weighted towards common tempos, then the beat phase that best lines up with the strong onsets.
 */
export function estimateTempo(notes: RawNote[]): { bpm: number; firstBeat: number } {
  if (notes.length < 8) return { bpm: 120, firstBeat: notes[0]?.time ?? 0 };
  const rate = 100;
  const end = Math.ceil((notes[notes.length - 1].time + 1) * rate);
  const env = new Float32Array(end + 1);
  for (const n of notes) {
    const i = Math.round(n.time * rate);
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j >= 0 && j <= end) env[j] += n.velocity * Math.exp(-(k * k) / 2);
    }
  }
  const corr = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag <= end; i++) s += env[i] * env[i + lag];
    return s;
  };
  let best = 120;
  let bestScore = -Infinity;
  for (let bpm = 50; bpm <= 200; bpm += 0.5) {
    const lag = (60 / bpm) * rate;
    const l0 = Math.floor(lag);
    const frac = lag - l0;
    const c = corr(l0) * (1 - frac) + corr(l0 + 1) * frac;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.9) ** 2);
    const score = c * prior;
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  const period = 60 / best;
  let re = 0;
  let im = 0;
  for (const n of notes) {
    const a = (2 * Math.PI * n.time) / period;
    re += n.velocity * Math.cos(a);
    im += n.velocity * Math.sin(a);
  }
  const phase = (((Math.atan2(im, re) / (2 * Math.PI)) * period) % period + period) % period;
  const first = notes[0].time;
  const firstBeat = phase + period * Math.floor((first - phase) / period + 1e-6);
  return { bpm: Math.round(best * 10) / 10, firstBeat };
}

/** Snaps starts and ends to a grid of `step` seconds (sixteenths), keeping at least one step per note. */
export function quantize(notes: RawNote[], step: number): RawNote[] {
  return notes.map((n) => {
    const start = Math.round(n.time / step) * step;
    const end = Math.max(start + step, Math.round((n.time + n.duration) / step) * step);
    return { ...n, time: start, duration: end - start };
  });
}

/** "Song - Piano Tutorial [Live].mp3" → "Song - Piano Tutorial" */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/\s*[[(].*?[\])]\s*/g, " ")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Transcription {
  bpm: number;
  tracks: MidiTrackSpec[];
  noteCount: number;
  duration: number;
}

/**
 * Cleans the model output into playable tracks: drops very short / faint notes, removes doubled onsets,
 * starts the song on the detected first beat, optionally quantizes, and splits piano into two hands.
 */
export function buildTranscription(detected: DetectedNote[], o: TranscribeOptions): Transcription {
  const minAmp = 0.12 + 0.18 * (1 - o.sensitivity);
  let notes: RawNote[] = detected
    .filter((n) => n.durationSeconds >= 0.05 && n.amplitude >= minAmp && n.pitchMidi >= 21 && n.pitchMidi <= 108)
    .map((n) => ({
      midi: Math.round(n.pitchMidi),
      time: n.startTimeSeconds,
      duration: n.durationSeconds,
      velocity: Math.max(0.25, Math.min(1, 0.3 + n.amplitude * 0.9)),
    }))
    .sort((a, b) => a.time - b.time || a.midi - b.midi);

  const lastOn = new Map<number, RawNote>();
  notes = notes.filter((n) => {
    const prev = lastOn.get(n.midi);
    if (prev && n.time - prev.time < 0.06) {
      prev.duration = Math.max(prev.duration, n.time + n.duration - prev.time);
      return false;
    }
    lastOn.set(n.midi, n);
    return true;
  });

  const { bpm, firstBeat } = estimateTempo(notes);
  const shift = notes.length ? Math.max(0, Math.min(firstBeat, notes[0].time)) : 0;
  notes = notes.map((n) => ({ ...n, time: n.time - shift }));
  if (o.quantize) notes = quantize(notes, 60 / bpm / 4);

  const program = o.instrument === "piano" ? PROGRAMS.piano : o.instrument === "guitar" ? PROGRAMS.guitarNylon : PROGRAMS.violin;
  const tracks: MidiTrackSpec[] =
    o.instrument === "piano" ? splitHands(notes, program) : [{ name: o.instrument === "guitar" ? "Guitar" : "Melody", program, notes }];
  const duration = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
  return { bpm, tracks, noteCount: notes.length, duration };
}
