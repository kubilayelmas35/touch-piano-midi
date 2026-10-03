import type { SongNote } from "../midi/song";

export type InstrumentKind = "piano" | "guitar" | "violin";
export type GuitarTone = "steel" | "nylon";
export type Judgement = "perfect" | "great" | "good" | "miss";

export const NoteState = {
  Pending: 0,
  Hit: 1,
  Missed: 2,
  Skipped: 3,
} as const;
export type NoteState = (typeof NoteState)[keyof typeof NoteState];

export interface PlayNote extends SongNote {
  id: number;
  /** Chord group index (notes within ~35 ms share a group). */
  group: number;
  /** Fretted instruments only; -1 for piano or unplayable. */
  string: number;
  fret: number;
  state: NoteState;
  judgement: Judgement | null;
  /** performance.now() when hit/missed (for effects). */
  resolvedAt: number;
}

export type Status = "empty" | "loading" | "ready" | "playing" | "paused" | "complete";

export interface Stats {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  wrong: number;
  total: number;
}

export function emptyStats(total = 0): Stats {
  return { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0, wrong: 0, total };
}

/** Wrong presses weigh half a miss, so mashing keys (especially in wait mode) doesn't pay off. */
export function accuracyOf(s: Stats): number {
  const judged = s.perfect + s.great + s.good + s.miss;
  if (!judged) return 0;
  return (s.perfect + s.great * 0.7 + s.good * 0.4) / (judged + s.wrong * 0.5);
}

export function starsFor(accuracy: number): number {
  if (accuracy >= 0.95) return 5;
  if (accuracy >= 0.85) return 4;
  if (accuracy >= 0.7) return 3;
  if (accuracy >= 0.5) return 2;
  if (accuracy > 0) return 1;
  return 0;
}

export function comboMultiplier(combo: number): number {
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 1;
}

export function judge(deltaMs: number, windowMs: number): Judgement | null {
  const d = Math.abs(deltaMs);
  if (d > windowMs) return null;
  if (d <= Math.min(50, windowMs * 0.34)) return "perfect";
  if (d <= Math.min(100, windowMs * 0.67)) return "great";
  return "good";
}

export const JUDGEMENT_POINTS: Record<Judgement, number> = { perfect: 300, great: 200, good: 100, miss: 0 };

export interface LoopRange {
  a: number;
  b: number;
  enabled: boolean;
}

export interface EngineConfig {
  instrument: InstrumentKind;
  guitarTone: GuitarTone;
  playTracks: number[];
  mutedTracks: number[];
  hand: "both" | "right" | "left";
  speed: number;
  waitMode: boolean;
  autoPlay: boolean;
  metronome: boolean;
  countIn: boolean;
  timingWindowMs: number;
  accompVolume: number;
  playerVolume: number;
  loop: LoopRange;
}

export interface Fx {
  midi: number;
  string: number;
  fret: number;
  judgement: Judgement | "wrong";
  at: number;
}
