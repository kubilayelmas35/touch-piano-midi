import type { InstrumentKind } from "../engine/types";
import { BUILTIN_BY_DIFFICULTY, isArranged } from "../midi/builtin";

export type Skill = "new" | "some" | "good";
export type Goal = "learn" | "songs" | "free";
/** Piano: which hand plays. Guitar / violin: "right" = strike only (frets are pressed for you). */
export type Stage = "right" | "left" | "both";

export interface PathStep {
  song: string;
  stage: Stage;
  /** Index of the song in the path (lesson number - 1). */
  lesson: number;
}

export interface PathState {
  step: number;
  speed: number;
  wait: boolean;
  /** Runs in a row that were close but not good enough. */
  tries: number;
  /** Best stars per finished step, keyed by step index. */
  stars: Record<number, number>;
}

export const SPEEDS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
export const PASS = 0.8;
export const FAIL = 0.5;

export function startSpeed(skill: Skill): number {
  return skill === "new" ? 0.5 : skill === "some" ? 0.7 : 0.9;
}

/** Speed a step has to be played at to count as done; beginners grow into full speed over the first lessons. */
export function goalSpeed(skill: Skill, lesson: number): number {
  const base = skill === "new" ? 0.6 : skill === "some" ? 0.8 : 1;
  return Math.min(1, Math.round((base + 0.1 * lesson) * 10) / 10);
}

export function stagesFor(instrument: InstrumentKind, skill: Skill): Stage[] {
  if (instrument === "piano") return skill === "new" ? ["right", "left", "both"] : skill === "some" ? ["right", "both"] : ["both"];
  return skill === "new" ? ["right", "both"] : ["both"];
}

/** Tunes nearly everyone knows open the path; hearing what it should sound like makes the first steps easier. */
const FIRST_SONGS = ["twinkle", "hot-cross-buns", "mary-lamb", "ode-to-joy", "frere-jacques", "jingle-bells", "happy-birthday"];

export function pathSongs(): string[] {
  const rest = BUILTIN_BY_DIFFICULTY.filter((s) => isArranged(s.id) && !FIRST_SONGS.includes(s.id)).map((s) => s.id);
  return [...FIRST_SONGS.filter(isArranged), ...rest];
}

export function pathSteps(instrument: InstrumentKind, skill: Skill): PathStep[] {
  const stages = stagesFor(instrument, skill);
  return pathSongs().flatMap((song, lesson) => stages.map((stage) => ({ song, stage, lesson })));
}

export function freshState(skill: Skill): PathState {
  return { step: 0, speed: startSpeed(skill), wait: false, tries: 0, stars: {} };
}

function stepSpeed(speed: number, by: number): number {
  let i = SPEEDS.findIndex((v) => v >= speed - 1e-6);
  if (i < 0) i = SPEEDS.length - 1;
  return SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + by))];
}

export type Verdict =
  /** Too many misses: slowed down. */
  | "slower"
  /** Slowest speed still too hard: the song now waits for each note. */
  | "waitOn"
  /** Close: try once more at the same speed. */
  | "retry"
  /** Good, but below the step's goal speed: sped up. */
  | "faster"
  /** Good while the song waited: next run plays in time again. */
  | "waitOff"
  /** Step done; on to the next one. */
  | "passed"
  /** Last step done. */
  | "finished";

export interface RunResult {
  accuracy: number;
  speed: number;
  wait: boolean;
  stars: number;
}

/** Decides what the next attempt looks like after a run of the current step. */
export function judgeRun(
  state: PathState,
  run: RunResult,
  ctx: { skill: Skill; steps: PathStep[] }
): { verdict: Verdict; next: PathState } {
  const step = ctx.steps[state.step];
  const goal = goalSpeed(ctx.skill, step?.lesson ?? 0);
  const base = { ...state, speed: run.speed, wait: run.wait, stars: { ...state.stars } };

  if (run.wait) {
    if (run.accuracy >= PASS) return { verdict: "waitOff", next: { ...base, wait: false, tries: 0 } };
    return { verdict: "retry", next: { ...base, tries: 0 } };
  }

  if (run.accuracy >= PASS) {
    if (run.speed + 1e-6 < goal) {
      const up = stepSpeed(run.speed, run.accuracy >= 0.95 ? 2 : 1);
      return { verdict: "faster", next: { ...base, speed: Math.min(goal, up), tries: 0 } };
    }
    base.stars[state.step] = Math.max(base.stars[state.step] ?? 0, run.stars);
    const last = state.step >= ctx.steps.length - 1;
    if (last) return { verdict: "finished", next: { ...base, tries: 0 } };
    const nextGoal = goalSpeed(ctx.skill, ctx.steps[state.step + 1].lesson);
    // A new hand or song starts a notch slower than the speed just mastered.
    const speed = Math.min(nextGoal, Math.max(SPEEDS[0], stepSpeed(run.speed, -1)));
    return { verdict: "passed", next: { ...base, step: state.step + 1, speed, tries: 0 } };
  }

  const slower = () => {
    if (run.speed <= SPEEDS[0] + 1e-6) return { verdict: "waitOn" as const, next: { ...base, wait: true, tries: 0 } };
    return { verdict: "slower" as const, next: { ...base, speed: stepSpeed(run.speed, -1), tries: 0 } };
  };
  if (run.accuracy < FAIL) return slower();
  if (state.tries >= 1) return slower();
  return { verdict: "retry", next: { ...base, tries: state.tries + 1 } };
}

/** Saved path per "instrument:skill"; lives in the progress copy so it syncs with the account. */
export type PathStore = Record<string, PathState & { at?: number }>;

export const pathKey = (instrument: InstrumentKind, skill: Skill) => `${instrument}:${skill}`;

export function readPath(all: PathStore | undefined, instrument: InstrumentKind, skill: Skill): PathState {
  const s = all?.[pathKey(instrument, skill)];
  if (!s || typeof s.step !== "number") return freshState(skill);
  const max = pathSteps(instrument, skill).length - 1;
  return {
    step: Math.max(0, Math.min(max, Math.round(s.step))),
    speed: SPEEDS.includes(s.speed) ? s.speed : startSpeed(skill),
    wait: s.wait === true,
    tries: typeof s.tries === "number" ? s.tries : 0,
    stars: s.stars && typeof s.stars === "object" ? s.stars : {},
  };
}

export function sanitizePaths(raw: unknown): PathStore {
  const out: PathStore = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^(piano|guitar|violin):(new|some|good)$/.test(k) || !v || typeof v !== "object") continue;
    const s = v as Partial<PathState & { at: number }>;
    if (typeof s.step !== "number" || !Number.isFinite(s.step)) continue;
    const stars: Record<number, number> = {};
    for (const [i, n] of Object.entries(s.stars ?? {})) if (typeof n === "number") stars[Number(i)] = Math.max(0, Math.min(5, n));
    out[k] = {
      step: Math.max(0, Math.round(s.step)),
      speed: typeof s.speed === "number" ? s.speed : 0.5,
      wait: s.wait === true,
      tries: typeof s.tries === "number" ? s.tries : 0,
      stars,
      at: typeof s.at === "number" ? s.at : 0,
    };
  }
  return out;
}

/** The most recently saved state wins per instrument, so a restart on one device isn't undone by another. */
export function mergePaths(a: PathStore, b: PathStore): PathStore {
  const out: PathStore = { ...a };
  for (const [k, s] of Object.entries(b)) {
    const o = out[k];
    if (!o || (s.at ?? 0) > (o.at ?? 0) || ((s.at ?? 0) === (o.at ?? 0) && s.step > o.step)) out[k] = s;
  }
  return out;
}

const LEGACY_KEY = "sonatrio-path-v1";

/** Paths saved before they moved into the progress copy. */
export function legacyPaths(): PathStore {
  try {
    return sanitizePaths(JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null"));
  } catch {
    return {};
  }
}
