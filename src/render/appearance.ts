export const BACKGROUNDS = ["night", "space", "aurora", "synth", "plain"] as const;
export type Background = (typeof BACKGROUNDS)[number];

export const NOTE_STYLES = ["gem", "neon", "classic", "minimal"] as const;
export type NoteStyle = (typeof NOTE_STYLES)[number];

export const EFFECT_STYLES = ["sparks", "stars", "fire", "glow"] as const;
export type EffectStyle = (typeof EFFECT_STYLES)[number];

export function oneOf<T extends string>(list: readonly T[], v: unknown, d: T): T {
  return list.includes(v as T) ? (v as T) : d;
}
