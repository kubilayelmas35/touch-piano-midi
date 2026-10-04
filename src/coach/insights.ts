import { NoteState, type Judgement } from "../engine/types";
import type { Beat } from "../midi/song";

export type Hand = "left" | "right";

/** The stretch of measures that went worst in a run. */
export interface WeakSpot {
  /** Song seconds the stretch starts and ends at. */
  from: number;
  to: number;
  /** 1-based measure numbers, inclusive. */
  measureFrom: number;
  measureTo: number;
  errors: number;
}

export interface RunInsights {
  weak: WeakSpot | null;
  /** Hits land consistently off by this many milliseconds (> 0 late); `hand` when it is mostly one hand. */
  drift: { ms: number; hand: Hand | null } | null;
  /** One hand missed clearly more than the other. */
  weakHand: Hand | null;
}

export interface InsightNote {
  time: number;
  state: NoteState;
  judgement: Judgement | null;
  offsetMs: number | null;
  hand: Hand | null;
}

const ERROR_WEIGHT: Record<Judgement, number> = { perfect: 0, great: 0.15, good: 0.5, miss: 1 };
const WRONG_WEIGHT = 0.5;
/** Average offset that is worth telling the player about. */
const DRIFT_MS = 40;
const MIN_TIMED = 8;

function trimmedMean(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const cut = Math.floor(v.length * 0.1);
  const kept = v.slice(cut, v.length - cut);
  return kept.reduce((s, x) => s + x, 0) / kept.length;
}

function upperBound(arr: number[], t: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function findWeakSpot(notes: InsightNote[], wrongTimes: number[], beats: Beat[]): WeakSpot | null {
  const starts = beats.filter((b) => b.downbeat).map((b) => b.time);
  if (starts.length < 3) return null;
  const played = notes.filter((n) => n.state === NoteState.Hit || n.state === NoteState.Missed);
  if (!played.length) return null;
  const measureOf = (t: number) => Math.max(0, upperBound(starts, t + 0.02) - 1);
  const firstM = measureOf(played[0].time);
  const lastM = measureOf(played[played.length - 1].time);
  const span = lastM - firstM + 1;
  const avgMeasure = (starts[starts.length - 1] - starts[0]) / (starts.length - 1);
  const width = Math.max(2, Math.min(4, Math.round(6 / Math.max(0.5, avgMeasure))));
  // Pointing at (nearly) the whole run doesn't help.
  if (span < width + 2) return null;

  const err = new Array<number>(span).fill(0);
  const count = new Array<number>(span).fill(0);
  for (const n of played) {
    const m = measureOf(n.time) - firstM;
    if (m < 0 || m >= span) continue;
    count[m]++;
    err[m] += n.state === NoteState.Missed ? 1 : ERROR_WEIGHT[n.judgement ?? "good"];
  }
  for (const t of wrongTimes) {
    const m = measureOf(t) - firstM;
    if (m >= 0 && m < span) err[m] += WRONG_WEIGHT;
  }

  let best = -1;
  let bestErr = 0;
  let bestNotes = 0;
  for (let i = 0; i + width <= span; i++) {
    let e = 0;
    let c = 0;
    for (let k = i; k < i + width; k++) {
      e += err[k];
      c += count[k];
    }
    if (e > bestErr + 1e-9) {
      best = i;
      bestErr = e;
      bestNotes = c;
    }
  }
  if (best < 0 || bestErr < 2 || bestErr / Math.max(1, bestNotes) < 0.2) return null;
  const m0 = firstM + best;
  const m1 = m0 + width - 1;
  const end = m1 + 1 < starts.length ? starts[m1 + 1] : played[played.length - 1].time + 1;
  return { from: starts[m0], to: end, measureFrom: m0 + 1, measureTo: m1 + 1, errors: Math.round(bestErr) };
}

function findDrift(notes: InsightNote[]): RunInsights["drift"] {
  const timed = notes.filter((n) => n.state === NoteState.Hit && n.offsetMs != null);
  if (timed.length < MIN_TIMED) return null;
  const all = trimmedMean(timed.map((n) => n.offsetMs!));
  const byHand = (h: Hand) => timed.filter((n) => n.hand === h).map((n) => n.offsetMs!);
  const left = byHand("left");
  const right = byHand("right");
  if (left.length >= 6 && right.length >= 6) {
    const l = trimmedMean(left);
    const r = trimmedMean(right);
    const [hand, worse, other] = Math.abs(l) >= Math.abs(r) ? (["left", l, r] as const) : (["right", r, l] as const);
    if (Math.abs(worse) >= DRIFT_MS && Math.abs(worse) - Math.abs(other) >= 25) return { ms: Math.round(worse), hand };
  }
  return Math.abs(all) >= DRIFT_MS ? { ms: Math.round(all), hand: null } : null;
}

function findWeakHand(notes: InsightNote[]): Hand | null {
  const rate = (h: Hand) => {
    const mine = notes.filter((n) => n.hand === h && (n.state === NoteState.Hit || n.state === NoteState.Missed));
    if (mine.length < 8) return null;
    const e = mine.reduce((s, n) => s + (n.state === NoteState.Missed ? 1 : ERROR_WEIGHT[n.judgement ?? "good"]), 0);
    return e / mine.length;
  };
  const l = rate("left");
  const r = rate("right");
  if (l == null || r == null) return null;
  if (l - r >= 0.15 && l >= 0.2) return "left";
  if (r - l >= 0.15 && r >= 0.2) return "right";
  return null;
}

/** What went wrong in a run, in a form the coach can talk about. */
export function analyzeRun(notes: InsightNote[], wrongTimes: number[], beats: Beat[]): RunInsights {
  return { weak: findWeakSpot(notes, wrongTimes, beats), drift: findDrift(notes), weakHand: findWeakHand(notes) };
}

export function hasInsights(i: RunInsights | undefined): i is RunInsights {
  return !!i && (!!i.weak || !!i.drift || !!i.weakHand);
}
