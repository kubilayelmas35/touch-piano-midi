import { isBlack } from "../lib/notes";

export type HandSide = "left" | "right";

export interface FingerNote {
  midi: number;
  time: number;
  duration?: number;
  /** Notes sharing a group sound together (a chord). */
  group: number;
  hand: HandSide;
  /**
   * Where the key sits, counted in white keys (black keys halfway between). Defaults to the piano's layout;
   * a flat row of equal keys (only the song's keys on screen) passes its column and has no black keys.
   */
  step?: number;
}

/** Where each finger (1 thumb … 5 little finger) rests in a five-finger position, in white keys from the thumb. */
const POS = [0, 0, 1, 2, 3, 4];
/** The same for chord shapes in semitones, where a third (3–4 semitones) takes the middle finger. */
const CHORD_POS = [0, 0, 2, 3, 5, 7];
/** Passing the thumb under (or a finger over it) is easiest from the middle finger. */
const CROSS = [0, 0, 3, 2.5, 4.5, 8];
/** A pause this long (seconds) between onsets lets the hand move to a new position more freely. */
const FREE_GAP = 0.8;
/** Once the previous notes are let go for this long (seconds), the hand can jump anywhere. */
const RELEASE_GAP = 0.25;
/** Position of each pitch class in white keys from C. */
const WHITE_POS = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6];

function whiteStep(midi: number): number {
  return Math.floor(midi / 12) * 7 + WHITE_POS[((midi % 12) + 12) % 12];
}

/** Effort of going from one key to the next with the given fingers; positions are mirrored for the left hand. */
function step(a: number, fa: number, b: number, fb: number, hand: HandSide): number {
  const d = hand === "right" ? b - a : a - b;
  if (fa === fb) return d === 0 ? 0 : 6 + Math.abs(d) * 1.7;
  if (d === 0) return 1.5;
  if (d > 0 && fb < fa) return fb === 1 ? CROSS[fa] + Math.abs(d - 1) : 12;
  if (d < 0 && fb > fa) return fa === 1 ? CROSS[fb] + Math.abs(-d - 1) : 12;
  // How far the hand has to shift or stretch; a half step (a black key between) still sits under the finger.
  const off = Math.abs(d - (POS[fb] - POS[fa]));
  return Math.max(0, off - 0.5) + Math.max(0, off - 2.5) * 2;
}

function keyCost(midi: number, f: number, flat: boolean): number {
  if (flat || !isBlack(midi)) return 0;
  return f === 1 ? 2.5 : f === 5 ? 1 : 0;
}

/** Fingers for the notes of one chord (sorted low to high), spread over the hand by how wide it is. */
export function chordFingers(midis: number[], hand: HandSide): number[] {
  const rel = hand === "right" ? midis.map((m) => m - midis[0]) : midis.map((m) => midis[midis.length - 1] - m);
  const order = rel.map((r, i) => ({ r, i })).sort((x, y) => x.r - y.r);
  const span = order[order.length - 1].r;
  const scale = span > 7 ? 7 / span : 1;
  const out = new Array<number>(midis.length).fill(0);
  let next = 1;
  order.forEach(({ r, i }, k) => {
    const left = order.length - k - 1;
    let best = next;
    for (let f = next; f <= 5 - left; f++) if (Math.abs(CHORD_POS[f] - r * scale) < Math.abs(CHORD_POS[best] - r * scale)) best = f;
    if (best > 5) return;
    out[i] = best;
    next = best + 1;
  });
  return out;
}

interface Group {
  idx: number[];
  midis: number[];
  steps: number[];
  time: number;
  end: number;
  cands: number[][];
}

/** Suggested finger (1–5, 0 = none) for every note, chosen for the least effort along each hand. */
export function assignPianoFingers(notes: FingerNote[]): number[] {
  const out = new Array<number>(notes.length).fill(0);
  const flat = notes.some((n) => n.step !== undefined);
  for (const hand of ["right", "left"] as const) {
    const byGroup = new Map<number, number[]>();
    notes.forEach((n, i) => {
      if (n.hand !== hand) return;
      const g = byGroup.get(n.group);
      if (g) g.push(i);
      else byGroup.set(n.group, [i]);
    });
    const groups: Group[] = [...byGroup.values()].map((idx) => {
      idx.sort((x, y) => notes[x].midi - notes[y].midi);
      const midis = idx.map((i) => notes[i].midi);
      const steps = idx.map((i) => notes[i].step ?? whiteStep(notes[i].midi));
      const shape = flat ? steps.map((s) => (s * 12) / 7) : midis;
      const cands = midis.length === 1 ? [1, 2, 3, 4, 5].map((f) => [f]) : [chordFingers(shape, hand)];
      const time = notes[idx[0]].time;
      const end = Math.max(...idx.map((i) => notes[i].time + (notes[i].duration ?? 0)));
      return { idx, midis, steps, time, end, cands };
    });
    groups.sort((a, b) => a.time - b.time);
    if (!groups.length) continue;

    // Equal choices lean towards the finger that matches where the key lies in this hand's range.
    const lo = Math.min(...groups.flatMap((g) => g.steps));
    const span = Math.max(4, Math.max(...groups.flatMap((g) => g.steps)) - lo);
    const home = (s: number) => (hand === "right" ? 1 + ((s - lo) * 4) / span : 5 - ((s - lo) * 4) / span);
    const own = (g: Group, c: number[]) =>
      g.midis.reduce((s, m, k) => s + keyCost(m, c[k], flat) + (c[k] ? Math.abs(c[k] - home(g.steps[k])) * 0.02 : 0), 0);
    const link = (p: Group, pc: number[], g: Group, gc: number[]) => {
      // The note of each group nearest the other one carries the hand from one to the next.
      const lead = g.steps.length === 1 ? 0 : g.steps.reduce((b, m, k) => (Math.abs(m - p.steps[0]) < Math.abs(g.steps[b] - p.steps[0]) ? k : b), 0);
      const from = p.steps.reduce((b, m, k) => (Math.abs(m - g.steps[lead]) < Math.abs(p.steps[b] - g.steps[lead]) ? k : b), 0);
      if (!pc[from] || !gc[lead]) return 0;
      const cost = step(p.steps[from], pc[from], g.steps[lead], gc[lead], hand);
      // After letting go, any finger can take the next key, so the jump costs the same with each.
      if (p.end > p.time && g.time - p.end >= RELEASE_GAP) return Math.min(cost, 3) * 0.1;
      return g.time - p.time > FREE_GAP ? cost * 0.3 : cost;
    };

    let cost = groups[0].cands.map((c) => own(groups[0], c));
    const back: number[][] = [cost.map(() => -1)];
    for (let gi = 1; gi < groups.length; gi++) {
      const p = groups[gi - 1];
      const g = groups[gi];
      const next: number[] = [];
      const from: number[] = [];
      g.cands.forEach((gc) => {
        let best = Infinity;
        let arg = 0;
        p.cands.forEach((pc, pi) => {
          const v = cost[pi] + link(p, pc, g, gc);
          if (v < best) {
            best = v;
            arg = pi;
          }
        });
        next.push(best + own(g, gc));
        from.push(arg);
      });
      cost = next;
      back.push(from);
    }
    let ci = cost.indexOf(Math.min(...cost));
    for (let gi = groups.length - 1; gi >= 0; gi--) {
      const g = groups[gi];
      g.idx.forEach((ni, k) => (out[ni] = g.cands[ci][k]));
      ci = back[gi][ci];
    }
  }
  return out;
}
