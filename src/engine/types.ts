import type { SongNote } from "../midi/song";

export type InstrumentKind = "piano" | "guitar" | "violin";
export type GuitarTone = "steel" | "nylon" | "electric";
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
  /** Long notes: input source that started the note, song time it was hit, seconds held so far. */
  holdSrc: string | null;
  holdStart: number;
  held: number;
  /** Still being held/sounding right now (drawn lit). */
  holding: boolean;
  /** Missed at the head but caught later in its tail; earns hold credit from then on. */
  rejoined: boolean;
  /** How far off the hit was in real milliseconds (> 0 late); null when not timed (wait mode, early hold). */
  offsetMs: number | null;
  /** Piano: suggested finger, 1 thumb … 5 little finger; 0 = none. */
  finger: number;
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
  /** Long-note sustain credit earned / available (see holdWeight). */
  holdEarned: number;
  holdPossible: number;
}

export function emptyStats(total = 0): Stats {
  return { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0, wrong: 0, total, holdEarned: 0, holdPossible: 0 };
}

/** Notes at least this long (song seconds) must be held, not just tapped. */
export const HOLD_MIN_SEC = 0.45;
/** Score per second of sustain, before the combo multiplier. */
export const HOLD_POINTS_PER_SEC = 120;

/** How much a long note's sustain counts toward accuracy, relative to a perfectly timed attack (1). */
export function holdWeight(duration: number): number {
  return duration < HOLD_MIN_SEC ? 0 : Math.min(2, (duration - 0.3) * 0.6);
}

/** Wrong presses weigh half a miss, so mashing keys (especially in wait mode) doesn't pay off. */
export function accuracyOf(s: Stats): number {
  const judged = s.perfect + s.great + s.good + s.miss;
  if (!judged) return 0;
  return (s.perfect + s.great * 0.7 + s.good * 0.4 + s.holdEarned) / (judged + s.holdPossible + s.wrong * 0.5);
}

/** Hits may land a bit early and noticeably late (people react to the note reaching the line). */
export const EARLY_FACTOR = 1.2;
export const LATE_FACTOR = 1.8;
/** A press this far (song seconds at 1×) ahead of a note's window still lands if it's held until the note arrives. */
export const EARLY_HOLD_SEC = 0.5;

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

/** deltaMs > 0 is late. */
export function judge(deltaMs: number, windowMs: number): Judgement | null {
  if (deltaMs < -windowMs * EARLY_FACTOR || deltaMs > windowMs * LATE_FACTOR) return null;
  const d = Math.abs(deltaMs);
  if (d <= Math.min(60, windowMs * 0.4)) return "perfect";
  if (d <= Math.min(125, windowMs * 0.85)) return "great";
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
  /** Piano: released keys keep ringing and fade slowly, like playing with the pedal down. */
  pianoPedal: boolean;
  /** Piano: how long held and pedalled notes ring, 0 short … 1 long. */
  pianoSustain: number;
  /** Piano shows only the song's keys side by side; finger numbers then follow those columns. */
  compactKeys: boolean;
  loop: LoopRange;
  /** Song time (s) the run stops at; notes from there on are left out. 0 = the whole song. */
  segmentEnd: number;
}

export interface Fx {
  midi: number;
  string: number;
  fret: number;
  judgement: Judgement | "wrong";
  /** Off-beat hits say which way they were off. */
  timing: "early" | "late" | null;
  /** Played by auto-play: effects only, no judgement label. */
  auto: boolean;
  at: number;
}
