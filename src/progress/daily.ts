import type { Skill } from "../coach/path";
import { BUILTIN_BY_DIFFICULTY } from "../midi/builtin";
import { dayKey, type Progress } from "./progress";

/** Daily songs stay short enough for a quick session. */
const DAILY_MAX_SECONDS = 200;
/** Stars a daily song needs (a finished run, not practice). */
export const DAILY_STARS = 3;

const LEVEL: Record<Skill, number> = { new: 1, some: 2, good: 3 };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pool(skill: Skill): string[] {
  const level = LEVEL[skill];
  const fit = BUILTIN_BY_DIFFICULTY.filter((s) => s.level === level && s.seconds <= DAILY_MAX_SECONDS);
  return (fit.length >= 3 ? fit : BUILTIN_BY_DIFFICULTY.filter((s) => s.level <= level)).map((s) => s.id);
}

function pick(key: string, skill: Skill): string {
  const list = pool(skill);
  return list[hash(`${key}:${skill}`) % list.length];
}

/** The song of the day: the same for everyone at a skill level, never the same two days running. */
export function dailySong(skill: Skill, now: Date = new Date()): string {
  const today = pick(dayKey(now), skill);
  const prev = new Date(now);
  prev.setDate(prev.getDate() - 1);
  if (today !== pick(dayKey(prev), skill)) return today;
  const list = pool(skill);
  return list[(list.indexOf(today) + 1) % list.length];
}

export function dailyDone(p: Progress, now: Date = new Date()): boolean {
  return !!p.daily[dayKey(now)];
}

export function dailyCount(p: Progress): number {
  return Object.keys(p.daily).length;
}
