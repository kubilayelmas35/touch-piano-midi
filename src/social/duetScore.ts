import { accuracyOf, emptyStats, starsFor, type Stats } from "../engine/types";

export type DuetHand = "left" | "right";

export interface DuetSide {
  name: string | null;
  hand: DuetHand;
  stats: Stats;
  accuracy: number;
  stars: number;
}

export interface DuetResult {
  me: DuetSide;
  /** Null until the partner's run arrives. */
  partner: DuetSide | null;
}

/** Room codes: no 0/O or 1/I, so they read out loud and type without mix-ups. */
export const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;

export function newRoomCode(random: (n: number) => number = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[random(CODE_CHARS.length)];
  return code;
}

/** What someone typed (or a link carried) as a room code; "" when it can't be one. */
export function normalizeCode(input: string): string {
  const code = input
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/[^A-Z0-9]/g, "");
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_CHARS.includes(c)) ? code : "";
}

/** Both hands as one performance: hits and misses add up, the score is the sum, the longest streak is the best one. */
export function combineSides(a: DuetSide, b: DuetSide): { stats: Stats; accuracy: number; stars: number } {
  const stats = emptyStats();
  for (const k of Object.keys(stats) as (keyof Stats)[]) stats[k] = a.stats[k] + b.stats[k];
  stats.maxCombo = Math.max(a.stats.maxCombo, b.stats.maxCombo);
  stats.combo = 0;
  const accuracy = accuracyOf(stats);
  return { stats, accuracy, stars: starsFor(accuracy) };
}

const num = (v: unknown, max: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(max, n));
};

/** A partner's result as it came over the wire, made safe to show. */
export function sideFrom(payload: unknown, fallbackName: string | null): DuetSide | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const raw = (p.stats && typeof p.stats === "object" ? p.stats : {}) as Record<string, unknown>;
  const stats = emptyStats();
  for (const k of Object.keys(stats) as (keyof Stats)[]) stats[k] = Math.round(num(raw[k], k === "score" ? 50_000_000 : 100_000) * 1000) / 1000;
  const name = typeof p.name === "string" ? p.name.slice(0, 24) : fallbackName;
  const accuracy = accuracyOf(stats);
  return { name, hand: p.hand === "left" ? "left" : "right", stats, accuracy, stars: starsFor(accuracy) };
}
