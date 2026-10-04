import { isBlack } from "../lib/notes";
import type { FrettedSpec } from "./fretting";

export interface Lane {
  x: number;
  w: number;
  black: boolean;
}

export interface PianoOptions {
  /** Keyboard width as a multiple of the screen width (1 = fits; more = wider keys, the rest off screen). */
  zoom?: number;
  /** Which part is on screen when zoomed: 0 = left end … 1 = right end. */
  pan?: number;
  /** Show only these keys, side by side as equal columns (keys the song never uses are left out). */
  only?: readonly number[] | null;
}

/**
 * Piano key geometry for a range, in screen CSS pixels (already scrolled when zoomed). Shared by the keyboard
 * and the note highway.
 */
export class PianoLayout {
  readonly whiteCount: number;
  readonly whiteW: number;
  /** Keys drawn, low → high. */
  readonly keys: readonly number[];
  /** Only the song's keys, as equal full-height columns. */
  readonly compact: boolean;
  /** Width of the whole keyboard and how far it is scrolled left. */
  readonly fullW: number;
  readonly offset: number;
  /** Changes whenever the geometry does (cache key). */
  readonly sig: string;
  private readonly lanes = new Map<number, Lane>();

  constructor(
    readonly low: number,
    readonly high: number,
    readonly width: number,
    opts: PianoOptions = {}
  ) {
    const zoom = Math.max(1, opts.zoom ?? 1);
    this.fullW = width * zoom;
    this.offset = Math.round(Math.max(0, Math.min(1, opts.pan ?? 0.5)) * (this.fullW - width));
    const only = opts.only?.filter((m) => m >= low && m <= high) ?? [];
    this.compact = only.length > 0;
    if (this.compact) {
      this.keys = [...new Set(only)].sort((a, b) => a - b);
      this.whiteCount = this.keys.length;
      this.whiteW = this.fullW / this.keys.length;
      this.keys.forEach((m, i) => this.lanes.set(m, { x: i * this.whiteW - this.offset, w: this.whiteW, black: isBlack(m) }));
    } else {
      const keys: number[] = [];
      let whites = 0;
      for (let m = low; m <= high; m++) {
        keys.push(m);
        if (!isBlack(m)) whites++;
      }
      this.keys = keys;
      this.whiteCount = Math.max(1, whites);
      this.whiteW = this.fullW / this.whiteCount;
      const blackW = this.whiteW * 0.62;
      let wi = 0;
      for (let m = low; m <= high; m++) {
        if (isBlack(m)) {
          const pc = m % 12;
          // Nudge black keys off-centre like a real keyboard (C#/D# left-right, F#/G#/A# spread).
          const offset = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 }[pc] ?? 0;
          const cx = wi * this.whiteW + offset * this.whiteW;
          this.lanes.set(m, { x: cx - blackW / 2 - this.offset, w: blackW, black: true });
        } else {
          this.lanes.set(m, { x: wi * this.whiteW - this.offset, w: this.whiteW, black: false });
          wi++;
        }
      }
    }
    this.sig = `${low}-${high}@${width}x${zoom.toFixed(3)}+${this.offset}${this.compact ? `:${this.keys.join(",")}` : ""}`;
  }

  lane(midi: number): Lane | undefined {
    return this.lanes.get(midi);
  }

  /** Key under a point; y is relative to the keyboard top, blackDepth the black key height. */
  hit(x: number, y: number, blackDepth: number): number | null {
    const vx = x + this.offset;
    if (this.compact) return this.keys[Math.floor(vx / this.whiteW)] ?? null;
    if (y < blackDepth) {
      for (const m of this.keys) {
        const l = this.lanes.get(m)!;
        if (l.black && x >= l.x && x < l.x + l.w) return m;
      }
    }
    const wi = Math.floor(vx / this.whiteW);
    let count = 0;
    for (const m of this.keys) {
      if (isBlack(m)) continue;
      if (count === wi) return m;
      count++;
    }
    return null;
  }

  /** Pan (0–1) that centres the keys from `a` to `b` on screen. */
  panFor(a: number, b = a): number {
    const la = this.lanes.get(a);
    const lb = this.lanes.get(b);
    if (!la || !lb || this.fullW <= this.width) return 0.5;
    const centre = (la.x + lb.x + lb.w) / 2 + this.offset;
    return Math.max(0, Math.min(1, (centre - this.width / 2) / (this.fullW - this.width)));
  }
}

/**
 * Fretboard geometry: the neck (one uniform column per fret, fret 0 = open string at the nut) on the left
 * and the strike zone (where strings are plucked or bowed) on the right.
 */
export class FretLayout {
  readonly columns: number;
  readonly colW: number;
  /** Highest fret shown; narrow screens show only the frets a song needs. */
  readonly lastFret: number;
  /** Width of the neck; the strike zone spans neckW..totalW. */
  readonly width: number;
  readonly pluckX: number;
  readonly pluckW: number;

  constructor(
    readonly spec: FrettedSpec,
    readonly totalW: number,
    lastFret = spec.maxFret,
    pluckW = 0
  ) {
    this.pluckW = Math.max(0, Math.min(totalW * 0.5, pluckW));
    this.width = totalW - this.pluckW;
    this.pluckX = this.width;
    this.lastFret = Math.max(1, Math.min(spec.maxFret, Math.round(lastFret)));
    this.columns = this.lastFret + 1;
    this.colW = this.width / this.columns;
  }

  inPluckZone(x: number): boolean {
    return this.pluckW > 0 && x >= this.pluckX;
  }

  column(fret: number): Lane {
    return { x: fret * this.colW, w: this.colW, black: false };
  }

  fretAt(x: number): number {
    return Math.max(0, Math.min(this.lastFret, Math.floor(x / this.colW)));
  }
}

/** Strike-zone width: wide enough for a thumb, never more than about a quarter of the board. */
export function pluckWidth(totalW: number): number {
  return Math.round(Math.max(92, Math.min(240, totalW * 0.24)));
}

/** Frets to show: everything the song uses, padded to fill the width with comfortably wide columns. */
export function visibleFrets(spec: FrettedSpec, width: number, highestUsed: number): number {
  const comfortable = Math.floor(width / 52) - 1;
  return Math.min(spec.maxFret, Math.max(highestUsed + 1, comfortable, 5));
}
