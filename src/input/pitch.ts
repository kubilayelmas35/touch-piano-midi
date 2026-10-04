/** Monophonic pitch detection (McLeod pitch method) and a note tracker that turns pitch frames into note on/off. */

export interface Pitch {
  hz: number;
  /** 0–1: how periodic the frame is (≈1 for a clean tone). */
  clarity: number;
}

/** Pitch of a frame of samples, or null when nothing periodic is in range. */
export function detectPitch(buf: Float32Array, sampleRate: number, minHz = 60, maxHz = 1800): Pitch | null {
  const n = buf.length;
  const maxLag = Math.min(n >> 1, Math.floor(sampleRate / minHz));
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  if (maxLag <= minLag) return null;
  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = 0; tau <= maxLag + 1; tau++) {
    let acf = 0;
    let m = 0;
    for (let i = 0, end = n - tau; i < end; i++) {
      const a = buf[i];
      const b = buf[i + tau];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }
  // Key maxima: the highest point of each positive lobe after the first zero crossing.
  const peaks: number[] = [];
  let tau = 1;
  while (tau <= maxLag && nsdf[tau] > 0) tau++;
  while (tau <= maxLag) {
    while (tau <= maxLag && nsdf[tau] <= 0) tau++;
    let best = -1;
    while (tau <= maxLag && nsdf[tau] > 0) {
      if (best < 0 || nsdf[tau] > nsdf[best]) best = tau;
      tau++;
    }
    if (best >= minLag) peaks.push(best);
  }
  if (!peaks.length) return null;
  const top = Math.max(...peaks.map((p) => nsdf[p]));
  if (top < 0.5) return null;
  const pick = peaks.find((p) => nsdf[p] >= top * 0.9)!;
  const a = nsdf[pick - 1];
  const b = nsdf[pick];
  const c = nsdf[pick + 1];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
  const period = pick + Math.max(-0.5, Math.min(0.5, shift));
  return { hz: sampleRate / period, clarity: b };
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export function rmsOf(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, buf.length));
}

/** Halves the sample rate by averaging pairs (enough for pitch, a quarter of the work). */
export function decimate(buf: Float32Array): Float32Array {
  const out = new Float32Array(buf.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = (buf[2 * i] + buf[2 * i + 1]) * 0.5;
  return out;
}

export type TrackEvent = { type: "on"; midi: number; velocity: number } | { type: "off" };

export interface TrackFrame {
  rms: number;
  pitch: Pitch | null;
}

const MIN_CLARITY = 0.8;
/** Consecutive frames a new pitch must hold before it counts (filters attack noise and slides). */
const STABLE_FRAMES = 2;
const SILENT_FRAMES = 3;
const UNVOICED_FRAMES = 8;
/** A fresh attack on the same pitch: loudness rises this much over its dip since the last attack. */
const REATTACK_RISE = 1.8;

/** Turns pitch frames into note on/off events: debounced pitch changes, silence and re-struck notes. */
export class NoteTracker {
  current: number | null = null;
  private candidate: number | null = null;
  private candidateFrames = 0;
  private silent = 0;
  private unvoiced = 0;
  private floor = 0.002;
  private peak = 0;
  private valley = 0;
  private sinceOn = 0;

  /** 0 (only loud notes) … 1 (picks up quiet playing). */
  constructor(public sensitivity = 0.5) {}

  private gate(): number {
    const base = 0.02 - this.sensitivity * 0.016;
    return Math.max(base, this.floor * 3);
  }

  update(f: TrackFrame): TrackEvent[] {
    const out: TrackEvent[] = [];
    const gate = this.gate();
    const voiced = f.rms >= gate && !!f.pitch && f.pitch.clarity >= MIN_CLARITY;
    if (f.rms < gate) {
      // Background level, tracked slowly so a noisy room raises the gate.
      this.floor += (f.rms - this.floor) * 0.02;
      this.candidate = null;
      if (this.current !== null && ++this.silent >= SILENT_FRAMES) this.off(out);
      return out;
    }
    this.silent = 0;
    this.sinceOn++;
    if (!voiced) {
      this.candidate = null;
      if (this.current !== null && ++this.unvoiced >= UNVOICED_FRAMES) this.off(out);
      return out;
    }
    this.unvoiced = 0;
    const midi = Math.round(hzToMidi(f.pitch!.hz));
    if (midi === this.current) {
      this.candidate = null;
      if (this.sinceOn >= 4 && this.valley < this.peak * 0.7 && f.rms > this.valley * REATTACK_RISE) {
        out.push({ type: "off" });
        this.on(out, midi, f.rms);
      } else if (f.rms > this.peak) {
        this.peak = f.rms;
        this.valley = f.rms;
      } else this.valley = Math.min(this.valley, f.rms);
      return out;
    }
    if (midi !== this.candidate) {
      this.candidate = midi;
      this.candidateFrames = 1;
    } else this.candidateFrames++;
    if (this.candidateFrames >= STABLE_FRAMES) {
      if (this.current !== null) out.push({ type: "off" });
      this.on(out, midi, f.rms);
    }
    return out;
  }

  /** Lets go of the current note (e.g. when listening stops). */
  reset(): TrackEvent[] {
    const out: TrackEvent[] = [];
    if (this.current !== null) this.off(out);
    this.candidate = null;
    return out;
  }

  private on(out: TrackEvent[], midi: number, rms: number): void {
    this.current = midi;
    this.candidate = null;
    this.peak = rms;
    this.valley = rms;
    this.sinceOn = 0;
    out.push({ type: "on", midi, velocity: Math.max(0.2, Math.min(1, rms * 6)) });
  }

  private off(out: TrackEvent[]): void {
    this.current = null;
    this.silent = 0;
    this.unvoiced = 0;
    out.push({ type: "off" });
  }
}
