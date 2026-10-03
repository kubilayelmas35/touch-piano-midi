export interface FrettedSpec {
  /** Open-string MIDI notes, lowest string first. */
  tuning: number[];
  maxFret: number;
  labels: string[];
}

export const GUITAR: FrettedSpec = {
  tuning: [40, 45, 50, 55, 59, 64],
  maxFret: 15,
  labels: ["E", "A", "D", "G", "B", "e"],
};

export const VIOLIN: FrettedSpec = {
  tuning: [55, 62, 69, 76],
  maxFret: 12,
  labels: ["G", "D", "A", "E"],
};

export interface Fingering {
  string: number;
  fret: number;
}

export function rangeOf(spec: FrettedSpec): [number, number] {
  return [spec.tuning[0], spec.tuning[spec.tuning.length - 1] + spec.maxFret];
}

/** Moves a pitch by octaves into the playable range of the instrument. */
export function foldIntoRange(midi: number, spec: FrettedSpec): number {
  const [lo, hi] = rangeOf(spec);
  let m = midi;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

export function midiAt(spec: FrettedSpec, string: number, fret: number): number {
  return spec.tuning[string] + fret;
}

function candidates(midi: number, spec: FrettedSpec): Fingering[] {
  const out: Fingering[] = [];
  spec.tuning.forEach((open, string) => {
    const fret = midi - open;
    if (fret >= 0 && fret <= spec.maxFret) out.push({ string, fret });
  });
  return out;
}

interface Option {
  /** Fingerings in the group's sorted pitch order. */
  frets: Fingering[];
  /** Lowest / highest fretted fret, null when only open strings ring. */
  lo: number | null;
  hi: number | null;
  cost: number;
}

/** Four fingers cover frets p..p+3; one extra fret is a stretch. */
const REACH = 3;
const MAX_OPTIONS = 14;

/** All string assignments for one chord (no shared strings), cheapest first. */
function groupOptions(sorted: number[], spec: FrettedSpec): Option[] {
  const per = sorted.map((m) => candidates(m, spec));
  const out: Option[] = [];
  const chosen: Fingering[] = [];
  const used = new Set<number>();
  const walk = (i: number) => {
    if (out.length > 400) return;
    if (i === per.length) {
      const fretted = chosen.filter((c) => c.fret > 0).map((c) => c.fret);
      const lo = fretted.length ? Math.min(...fretted) : null;
      const hi = fretted.length ? Math.max(...fretted) : null;
      if (lo != null && hi! - lo > REACH + 1) return;
      let cost = 0;
      for (const c of chosen) cost += c.fret === 0 ? 0.1 : 0.35 + c.fret * 0.05;
      out.push({ frets: chosen.map((c) => ({ ...c })), lo, hi, cost });
      return;
    }
    for (const c of per[i]) {
      if (used.has(c.string)) continue;
      used.add(c.string);
      chosen.push(c);
      walk(i + 1);
      chosen.pop();
      used.delete(c.string);
    }
  };
  walk(0);
  out.sort((a, b) => a.cost - b.cost);
  return out.slice(0, MAX_OPTIONS);
}

/** Extra cost of playing option `o` with the index finger at fret `p`, or Infinity if out of reach. */
function reachCost(o: Option, p: number): number {
  if (o.lo == null) return 0;
  if (o.lo < p || o.hi! > p + REACH + 1) return Infinity;
  return o.hi! > p + REACH ? 0.6 : 0;
}

function shiftCost(from: number, to: number): number {
  return from === to ? 0 : 1.2 + Math.abs(from - to) * 0.3;
}

function fallbackOption(g: number[], spec: FrettedSpec): Option {
  // Not playable as a whole (e.g. more notes than strings): keep what fits greedily.
  const taken = new Set<number>();
  const frets = g.map((m) => {
    const pick = candidates(m, spec).find((c) => !taken.has(c.string));
    if (!pick) return { string: -1, fret: -1 };
    taken.add(pick.string);
    return pick;
  });
  return { frets, lo: null, hi: null, cost: 5 };
}

/**
 * Assigns string/fret to groups of simultaneous pitches. A Viterbi pass over hand
 * positions keeps passages in one position where possible (like a real player) and
 * never places two chord notes on the same string. Unplayable notes get string -1.
 */
export function assignFingerings(groups: number[][], spec: FrettedSpec): Fingering[][] {
  const sortedGroups = groups.map((g) => [...g].sort((a, b) => a - b));
  const options = sortedGroups.map((g) => {
    const opts = groupOptions(g, spec);
    return opts.length ? opts : [fallbackOption(g, spec)];
  });
  const n = options.length;
  if (!n) return [];

  const P = spec.maxFret; // hand positions 1..P
  const positions = Array.from({ length: P }, (_, i) => i + 1);
  const posPref = (p: number) => p * 0.04;

  // best[i][p], with back-pointers to the previous position and the chosen option.
  const best: Float64Array[] = [];
  const prevPos: Int16Array[] = [];
  const choice: Int16Array[] = [];

  const bestOption = (i: number, p: number): [number, number] => {
    let c = Infinity;
    let arg = -1;
    options[i].forEach((o, j) => {
      const v = o.cost + reachCost(o, p);
      if (v < c) {
        c = v;
        arg = j;
      }
    });
    return [c, arg];
  };

  for (let i = 0; i < n; i++) {
    best[i] = new Float64Array(P + 1).fill(Infinity);
    prevPos[i] = new Int16Array(P + 1);
    choice[i] = new Int16Array(P + 1).fill(-1);
    for (const p of positions) {
      const [oc, oj] = bestOption(i, p);
      if (oj < 0 || !Number.isFinite(oc)) continue;
      let from = 0;
      let base = 0;
      if (i > 0) {
        base = Infinity;
        for (const q of positions) {
          const v = best[i - 1][q] + shiftCost(q, p);
          if (v < base) {
            base = v;
            from = q;
          }
        }
      }
      best[i][p] = base + oc + posPref(p);
      prevPos[i][p] = from;
      choice[i][p] = oj;
    }
    // Every option out of reach everywhere (shouldn't happen) → take the cheapest option at position 1.
    if (best[i].every((v) => !Number.isFinite(v))) {
      let base = 0;
      let from = 1;
      if (i > 0) {
        base = Infinity;
        for (const q of positions) {
          if (best[i - 1][q] < base) {
            base = best[i - 1][q];
            from = q;
          }
        }
      }
      best[i][1] = base + options[i][0].cost;
      prevPos[i][1] = from;
      choice[i][1] = 0;
    }
  }

  let p = 1;
  for (const q of positions) if (best[n - 1][q] < best[n - 1][p]) p = q;
  const picked: Option[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    picked[i] = options[i][Math.max(0, choice[i][p])];
    p = prevPos[i][p] || 1;
  }

  return groups.map((g, gi) => {
    const sorted = sortedGroups[gi];
    const byPitch = new Map<number, Fingering>();
    sorted.forEach((m, i) => byPitch.set(m, picked[gi].frets[i]));
    return g.map((m) => byPitch.get(m) ?? { string: -1, fret: -1 });
  });
}
