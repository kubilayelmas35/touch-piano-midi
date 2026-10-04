export const BACKGROUNDS = ["night", "space", "aurora", "synth", "plain", "haze", "ocean", "sunset", "city", "matrix"] as const;
export type Background = (typeof BACKGROUNDS)[number];

export const NOTE_STYLES = ["gem", "neon", "classic", "minimal", "block", "glass", "capsule", "pixel", "candy", "crystal"] as const;
export type NoteStyle = (typeof NOTE_STYLES)[number];

/**
 * How notes are coloured: by hand/string (auto), one colour, by pitch, or a gradient that changes
 * with height so notes shift colour as they fall.
 */
export const NOTE_COLORS = ["auto", "violet", "rainbow", "gradient", "sunset", "ice", "pastel"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const EFFECT_STYLES = ["sparks", "stars", "fire", "glow", "notes", "confetti", "bubbles", "lightning", "petals", "pixels"] as const;
export type EffectStyle = (typeof EFFECT_STYLES)[number];

/** Clouds left floating behind the notes after hits and around held notes. */
export const DUST_STYLES = ["off", "smoke", "sparkle", "nebula", "fog", "embers", "stardust"] as const;
export type DustStyle = (typeof DUST_STYLES)[number];

/** What happens in a note's lane while it falls towards its key. */
export const APPROACH_STYLES = ["off", "beam", "ring", "comet", "arrows", "keyglow"] as const;
export type ApproachStyle = (typeof APPROACH_STYLES)[number];

export function oneOf<T extends string>(list: readonly T[], v: unknown, d: T): T {
  return list.includes(v as T) ? (v as T) : d;
}
