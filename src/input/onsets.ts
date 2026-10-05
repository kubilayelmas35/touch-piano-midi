/**
 * Targeted note detection for the microphone. The app knows which notes the player should strike next, so instead
 * of naming whatever pitch dominates (which fails while earlier notes still ring under the pedal), it checks whether
 * the harmonics of each expected key just jumped up in the spectrum.
 */

const HARMONICS = 5;
/** Frames kept; the baseline is the quietest of the older ones. */
const HISTORY = 10;
const BASE_FROM = 4;
/** A harmonic counts as struck when it rises this much over its baseline. */
const RISE = 2;
/** ...and stands this far above the frame's typical bin, so hiss rising doesn't count. */
const ABOVE_FLOOR = 4;
const MAX_HZ = 6000;
/** Below this the piano's fundamental is weak; more harmonics have to agree instead. */
const WEAK_FUNDAMENTAL_HZ = 150;

export function midiHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export class KeyOnsets {
  private readonly frames: Float32Array[] = [];
  private readonly bins: number;
  private floor = 0;

  constructor(binCount: number, private readonly binHz: number) {
    this.bins = Math.min(binCount, Math.ceil(MAX_HZ / binHz) + 2);
  }

  /** Adds a frame of AnalyserNode frequency data (dB). */
  pushDb(db: Float32Array): void {
    const frame = this.frames.length >= HISTORY ? this.frames.shift()! : new Float32Array(this.bins);
    for (let i = 0; i < this.bins; i++) frame[i] = db[i] > -160 ? 10 ** (db[i] / 20) : 0;
    this.push(frame);
  }

  /** Adds a frame of linear magnitudes (tests). */
  push(frame: Float32Array): void {
    if (this.frames.length >= HISTORY) this.frames.shift();
    this.frames.push(frame);
    this.floor = medianOf(frame, Math.max(2, Math.floor(80 / this.binHz)), this.bins);
  }

  reset(): void {
    this.frames.length = 0;
  }

  /** Strength of a key's harmonics in the newest frame (to follow a note's decay). */
  strength(midi: number): number {
    const now = this.frames[this.frames.length - 1];
    if (!now) return 0;
    let sum = 0;
    for (let h = 1; h <= HARMONICS; h++) {
      const c = (midiHz(midi) * h) / this.binHz;
      if (c + 1 >= this.bins) break;
      sum += this.peak(now, c);
    }
    return sum;
  }

  /** Did this key just sound? */
  struck(midi: number): boolean {
    if (this.frames.length < HISTORY) return false;
    const now = this.frames[this.frames.length - 1];
    const f0 = midiHz(midi);
    let rising = 0;
    let usable = 0;
    let fundamental = false;
    for (let h = 1; h <= HARMONICS; h++) {
      const c = (f0 * h) / this.binHz;
      if (c + 1 >= this.bins) break;
      usable++;
      const p = this.peak(now, c);
      let base = Infinity;
      for (let k = 0; k <= HISTORY - BASE_FROM; k++) base = Math.min(base, this.peak(this.frames[k], c));
      if (p > base * RISE && p > this.floor * ABOVE_FLOOR) {
        rising++;
        if (h === 1) fundamental = true;
      }
    }
    if (usable < 2) return false;
    if (f0 >= WEAK_FUNDAMENTAL_HZ) return fundamental && rising >= 2;
    return rising >= Math.min(3, usable);
  }

  /** Highest bin within a quarter tone of a frequency (as a bin position). */
  private peak(frame: Float32Array, center: number): number {
    const tol = Math.max(0.6, center * 0.029);
    let p = 0;
    const hi = Math.min(this.bins - 1, Math.ceil(center + tol));
    for (let b = Math.max(1, Math.floor(center - tol)); b <= hi; b++) if (frame[b] > p) p = frame[b];
    return p;
  }
}

function medianOf(frame: Float32Array, from: number, to: number): number {
  const part = Array.from(frame.subarray(from, to)).sort((a, b) => a - b);
  return part.length ? part[part.length >> 1] : 0;
}
