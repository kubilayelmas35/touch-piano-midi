import { isBlack } from "../lib/notes";
import type { FrettedSpec } from "./fretting";

export interface Lane {
  x: number;
  w: number;
  black: boolean;
}

/** Piano key geometry for a range, in CSS pixels. Shared by the keyboard and the note highway. */
export class PianoLayout {
  readonly whiteCount: number;
  readonly whiteW: number;
  private readonly lanes = new Map<number, Lane>();

  constructor(
    readonly low: number,
    readonly high: number,
    readonly width: number
  ) {
    let whites = 0;
    for (let m = low; m <= high; m++) if (!isBlack(m)) whites++;
    this.whiteCount = Math.max(1, whites);
    this.whiteW = width / this.whiteCount;
    const blackW = this.whiteW * 0.62;
    let wi = 0;
    for (let m = low; m <= high; m++) {
      if (isBlack(m)) {
        const pc = m % 12;
        // Nudge black keys off-centre like a real keyboard (C#/D# left-right, F#/G#/A# spread).
        const offset = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 }[pc] ?? 0;
        const cx = wi * this.whiteW + offset * this.whiteW;
        this.lanes.set(m, { x: cx - blackW / 2, w: blackW, black: true });
      } else {
        this.lanes.set(m, { x: wi * this.whiteW, w: this.whiteW, black: false });
        wi++;
      }
    }
  }

  lane(midi: number): Lane | undefined {
    return this.lanes.get(midi);
  }

  /** Key under a point; y is relative to the keyboard top, blackDepth the black key height. */
  hit(x: number, y: number, blackDepth: number): number | null {
    if (y < blackDepth) {
      for (let m = this.low; m <= this.high; m++) {
        const l = this.lanes.get(m)!;
        if (l.black && x >= l.x && x < l.x + l.w) return m;
      }
    }
    const wi = Math.floor(x / this.whiteW);
    let count = 0;
    for (let m = this.low; m <= this.high; m++) {
      if (isBlack(m)) continue;
      if (count === wi) return m;
      count++;
    }
    return null;
  }
}

/** Fretboard geometry: one uniform column per fret (fret 0 = open string at the nut). */
export class FretLayout {
  readonly columns: number;
  readonly colW: number;
  /** Highest fret shown; narrow screens show only the frets a song needs. */
  readonly lastFret: number;

  constructor(
    readonly spec: FrettedSpec,
    readonly width: number,
    lastFret = spec.maxFret
  ) {
    this.lastFret = Math.max(1, Math.min(spec.maxFret, Math.round(lastFret)));
    this.columns = this.lastFret + 1;
    this.colW = width / this.columns;
  }

  column(fret: number): Lane {
    return { x: fret * this.colW, w: this.colW, black: false };
  }

  fretAt(x: number): number {
    return Math.max(0, Math.min(this.lastFret, Math.floor(x / this.colW)));
  }
}

/** Frets to show: everything the song uses, padded to fill the width with comfortably wide columns. */
export function visibleFrets(spec: FrettedSpec, width: number, highestUsed: number): number {
  const comfortable = Math.floor(width / 52) - 1;
  return Math.min(spec.maxFret, Math.max(highestUsed + 1, comfortable, 5));
}
