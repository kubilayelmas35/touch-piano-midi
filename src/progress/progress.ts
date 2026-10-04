/** Practice history: time per day, finished songs and unlocked achievements. Pure data helpers. */

export interface SongProgress {
  /** Best stars over all finished (non-practice) runs. */
  stars: number;
  plays: number;
  instruments: string[];
}

export interface Progress {
  v: 1;
  /** Seconds actually playing (not paused, not auto-play). */
  seconds: number;
  /** Local date "YYYY-MM-DD" → seconds practised that day. */
  days: Record<string, number>;
  notes: number;
  runs: number;
  bestCombo: number;
  songs: Record<string, SongProgress>;
  /** Achievement id → when it was unlocked (ms). */
  unlocked: Record<string, number>;
}

export function emptyProgress(): Progress {
  return { v: 1, seconds: 0, days: {}, notes: 0, runs: 0, bestCombo: 0, songs: {}, unlocked: {} };
}

/** A day counts towards the streak after this much practice. */
export const STREAK_MIN_SECONDS = 60;
const KEEP_DAYS = 400;

export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftDay(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Days in a row with practice, ending today (or yesterday, while today's practice hasn't happened yet). */
export function streak(p: Progress, now: Date = new Date()): number {
  const done = (d: Date) => (p.days[dayKey(d)] ?? 0) >= STREAK_MIN_SECONDS;
  let d = done(now) ? now : shiftDay(now, -1);
  let n = 0;
  while (done(d)) {
    n++;
    d = shiftDay(d, -1);
  }
  return n;
}

export function bestStreak(p: Progress): number {
  const keys = Object.keys(p.days)
    .filter((k) => p.days[k] >= STREAK_MIN_SECONDS)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev && dayKey(shiftDay(new Date(`${prev}T12:00:00`), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export function addPractice(p: Progress, seconds: number, now: Date = new Date()): Progress {
  const key = dayKey(now);
  const days = { ...p.days, [key]: (p.days[key] ?? 0) + seconds };
  const keys = Object.keys(days);
  if (keys.length > KEEP_DAYS) for (const k of keys.sort().slice(0, keys.length - KEEP_DAYS)) delete days[k];
  return { ...p, seconds: p.seconds + seconds, days };
}

export interface RunRecord {
  songId: string | null;
  instrument: string;
  stars: number;
  accuracy: number;
  maxCombo: number;
  notesHit: number;
  misses: number;
  waitMode: boolean;
  speed: number;
  /** Loop, auto-play or restarted mid-way: counts notes and time, not completion. */
  practice: boolean;
}

export function addRun(p: Progress, r: RunRecord): Progress {
  const next: Progress = { ...p, notes: p.notes + r.notesHit, bestCombo: Math.max(p.bestCombo, r.maxCombo) };
  if (r.practice || !r.songId) return next;
  const prev = p.songs[r.songId];
  next.runs = p.runs + 1;
  next.songs = {
    ...p.songs,
    [r.songId]: {
      stars: Math.max(prev?.stars ?? 0, r.stars),
      plays: (prev?.plays ?? 0) + 1,
      instruments: [...new Set([...(prev?.instruments ?? []), r.instrument])],
    },
  };
  return next;
}

/** Combines two copies (this device and the account) without losing anything either has. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const days: Record<string, number> = { ...a.days };
  for (const [k, v] of Object.entries(b.days)) days[k] = Math.max(days[k] ?? 0, v);
  const songs: Record<string, SongProgress> = { ...a.songs };
  for (const [id, s] of Object.entries(b.songs)) {
    const o = songs[id];
    songs[id] = o
      ? { stars: Math.max(o.stars, s.stars), plays: Math.max(o.plays, s.plays), instruments: [...new Set([...o.instruments, ...s.instruments])] }
      : s;
  }
  const unlocked: Record<string, number> = { ...a.unlocked };
  for (const [id, at] of Object.entries(b.unlocked)) unlocked[id] = Math.min(unlocked[id] ?? at, at);
  return {
    v: 1,
    seconds: Math.max(a.seconds, b.seconds),
    days,
    notes: Math.max(a.notes, b.notes),
    runs: Math.max(a.runs, b.runs),
    bestCombo: Math.max(a.bestCombo, b.bestCombo),
    songs,
    unlocked,
  };
}

export function sanitizeProgress(raw: unknown): Progress {
  const base = emptyProgress();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Progress>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const days: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.days ?? {})) if (/^\d{4}-\d\d-\d\d$/.test(k)) days[k] = num(v);
  const songs: Record<string, SongProgress> = {};
  for (const [id, s] of Object.entries(r.songs ?? {})) {
    if (!s || typeof s !== "object") continue;
    songs[id] = {
      stars: Math.min(5, num(s.stars)),
      plays: num(s.plays),
      instruments: Array.isArray(s.instruments) ? s.instruments.filter((x): x is string => typeof x === "string") : [],
    };
  }
  const unlocked: Record<string, number> = {};
  for (const [id, at] of Object.entries(r.unlocked ?? {})) unlocked[id] = num(at);
  return { v: 1, seconds: num(r.seconds), days, notes: num(r.notes), runs: num(r.runs), bestCombo: num(r.bestCombo), songs, unlocked };
}
