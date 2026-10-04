/** Practice history: time per day, finished songs and unlocked achievements. Pure data helpers. */
import { mergePaths, sanitizePaths, type PathStore } from "../coach/path";

export interface SongProgress {
  /** Best stars over all finished (non-practice) runs. */
  stars: number;
  plays: number;
  instruments: string[];
  /** Best accuracy (0–1) of a finished run. */
  acc: number;
  /** Fastest speed played well (MASTERY_STARS or more) without Wait for me. */
  speed: number;
  /** When the song was first mastered (ms), 0 = not yet. */
  mastered: number;
  /** Last finished run (ms). */
  last: number;
}

export interface RecentRun {
  at: number;
  song: string;
  instrument: string;
  acc: number;
  stars: number;
  speed: number;
  wait: boolean;
}

export interface Progress {
  v: 1;
  /** Seconds actually playing (not paused, not auto-play). */
  seconds: number;
  /** Local date "YYYY-MM-DD" → seconds practised that day. */
  days: Record<string, number>;
  /** Instrument → seconds played on it (counted since this field exists). */
  inst: Record<string, number>;
  notes: number;
  runs: number;
  bestCombo: number;
  songs: Record<string, SongProgress>;
  /** Latest finished runs, newest first. */
  recent: RecentRun[];
  /** Learning path per instrument and skill. */
  path: PathStore;
  /** Achievement id → when it was unlocked (ms). */
  unlocked: Record<string, number>;
}

export function emptyProgress(): Progress {
  return { v: 1, seconds: 0, days: {}, inst: {}, notes: 0, runs: 0, bestCombo: 0, songs: {}, recent: [], path: {}, unlocked: {} };
}

/** A song is mastered by a finished run at full speed, without Wait for me, with at least this many stars (85 %+). */
export const MASTERY_STARS = 4;
export const RECENT_MAX = 30;

export function isMasteryRun(r: Pick<RunRecord, "practice" | "waitMode" | "speed" | "stars">): boolean {
  return !r.practice && !r.waitMode && r.speed >= 1 - 1e-6 && r.stars >= MASTERY_STARS;
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

export function addPractice(p: Progress, seconds: number, now: Date = new Date(), instrument?: string): Progress {
  const key = dayKey(now);
  const days = { ...p.days, [key]: (p.days[key] ?? 0) + seconds };
  const keys = Object.keys(days);
  if (keys.length > KEEP_DAYS) for (const k of keys.sort().slice(0, keys.length - KEEP_DAYS)) delete days[k];
  const inst = instrument ? { ...p.inst, [instrument]: (p.inst[instrument] ?? 0) + seconds } : p.inst;
  return { ...p, seconds: p.seconds + seconds, days, inst };
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

export function addRun(p: Progress, r: RunRecord, now = Date.now()): Progress {
  const next: Progress = { ...p, notes: p.notes + r.notesHit, bestCombo: Math.max(p.bestCombo, r.maxCombo) };
  if (r.practice || !r.songId) return next;
  const prev = p.songs[r.songId];
  const good = !r.waitMode && r.stars >= MASTERY_STARS;
  next.runs = p.runs + 1;
  next.songs = {
    ...p.songs,
    [r.songId]: {
      stars: Math.max(prev?.stars ?? 0, r.stars),
      plays: (prev?.plays ?? 0) + 1,
      instruments: [...new Set([...(prev?.instruments ?? []), r.instrument])],
      acc: Math.max(prev?.acc ?? 0, r.accuracy),
      speed: Math.max(prev?.speed ?? 0, good ? r.speed : 0),
      mastered: prev?.mastered || (isMasteryRun(r) ? now : 0),
      last: now,
    },
  };
  const entry: RecentRun = {
    at: now,
    song: r.songId,
    instrument: r.instrument,
    acc: r.accuracy,
    stars: r.stars,
    speed: r.speed,
    wait: r.waitMode,
  };
  next.recent = [entry, ...p.recent].slice(0, RECENT_MAX);
  return next;
}

/** Ids of mastered songs. */
export function masteredSongs(p: Progress): string[] {
  return Object.keys(p.songs).filter((id) => p.songs[id].mastered > 0);
}

/** Seconds practised per day over the last `n` days, oldest first. */
export function lastDays(p: Progress, n: number, now: Date = new Date()): { key: string; date: Date; v: number }[] {
  const out: { key: string; date: Date; v: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = shiftDay(now, -i);
    out.push({ key: dayKey(d), date: d, v: p.days[dayKey(d)] ?? 0 });
  }
  return out;
}

/** Combines two copies (this device and the account) without losing anything either has. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const days: Record<string, number> = { ...a.days };
  for (const [k, v] of Object.entries(b.days)) days[k] = Math.max(days[k] ?? 0, v);
  const songs: Record<string, SongProgress> = { ...a.songs };
  for (const [id, s] of Object.entries(b.songs)) {
    const o = songs[id];
    const firstOf = (x: number, y: number) => (x && y ? Math.min(x, y) : x || y);
    songs[id] = o
      ? {
          stars: Math.max(o.stars, s.stars),
          plays: Math.max(o.plays, s.plays),
          instruments: [...new Set([...o.instruments, ...s.instruments])],
          acc: Math.max(o.acc, s.acc),
          speed: Math.max(o.speed, s.speed),
          mastered: firstOf(o.mastered, s.mastered),
          last: Math.max(o.last, s.last),
        }
      : s;
  }
  const inst: Record<string, number> = { ...a.inst };
  for (const [k, v] of Object.entries(b.inst)) inst[k] = Math.max(inst[k] ?? 0, v);
  const recent = [...a.recent, ...b.recent.filter((r) => !a.recent.some((x) => x.at === r.at && x.song === r.song))]
    .sort((x, y) => y.at - x.at)
    .slice(0, RECENT_MAX);
  const unlocked: Record<string, number> = { ...a.unlocked };
  for (const [id, at] of Object.entries(b.unlocked)) unlocked[id] = Math.min(unlocked[id] ?? at, at);
  return {
    v: 1,
    seconds: Math.max(a.seconds, b.seconds),
    days,
    inst,
    notes: Math.max(a.notes, b.notes),
    runs: Math.max(a.runs, b.runs),
    bestCombo: Math.max(a.bestCombo, b.bestCombo),
    songs,
    recent,
    path: mergePaths(a.path, b.path),
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
      acc: Math.min(1, num(s.acc)),
      speed: Math.min(2, num(s.speed)),
      mastered: num(s.mastered),
      last: num(s.last),
    };
  }
  const inst: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.inst ?? {})) if (typeof k === "string") inst[k] = num(v);
  const recent: RecentRun[] = (Array.isArray(r.recent) ? r.recent : [])
    .filter((x): x is RecentRun => !!x && typeof x === "object" && typeof x.song === "string" && typeof x.instrument === "string")
    .map((x) => ({
      at: num(x.at),
      song: x.song,
      instrument: x.instrument,
      acc: Math.min(1, num(x.acc)),
      stars: Math.min(5, num(x.stars)),
      speed: Math.min(2, num(x.speed)),
      wait: x.wait === true,
    }))
    .slice(0, RECENT_MAX);
  const unlocked: Record<string, number> = {};
  for (const [id, at] of Object.entries(r.unlocked ?? {})) unlocked[id] = num(at);
  return {
    v: 1,
    seconds: num(r.seconds),
    days,
    inst,
    notes: num(r.notes),
    runs: num(r.runs),
    bestCombo: num(r.bestCombo),
    songs,
    recent,
    path: sanitizePaths(r.path),
    unlocked,
  };
}
