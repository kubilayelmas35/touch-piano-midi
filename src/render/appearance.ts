import { hslHex, mixHex } from "./theme";

export const BACKGROUNDS = ["night", "space", "aurora", "synth", "plain", "haze", "ocean", "sunset", "city", "matrix"] as const;
export type Background = (typeof BACKGROUNDS)[number];

export const NOTE_STYLES = ["gem", "neon", "classic", "minimal", "block", "glass", "capsule", "pixel", "candy", "crystal"] as const;
export type NoteStyle = (typeof NOTE_STYLES)[number];

/**
 * How notes are coloured: by hand/string (auto), one chosen colour, by pitch or octave, or a gradient that
 * changes with height so notes shift colour as they fall.
 */
export const NOTE_COLORS = [
  "auto",
  "solid",
  "custom",
  "rainbow",
  "octave",
  "gradient",
  "sunset",
  "ocean",
  "aurora",
  "candy",
  "ice",
  "pastel",
  "gold",
  "silver",
] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

/** The user's own colours: `solid` for one-colour notes, `from` (top) → `to` (hit line) for their gradient. */
export interface ColorChoice {
  solid: string;
  from: string;
  to: string;
}

export const COLOR_PRESETS = [
  "#8b5cf6",
  "#6366f1",
  "#38bdf8",
  "#22d3ee",
  "#2dd4bf",
  "#4ade80",
  "#a3e635",
  "#facc15",
  "#fb923c",
  "#f43f5e",
  "#ec4899",
  "#e879f9",
  "#ffffff",
] as const;

export const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Note colour for palette `p`. `base` is the hand/string colour, `black` marks black piano keys (drawn a shade
 * darker), `k` is the height on screen (0 top … 1 hit line) for gradients.
 */
export function paletteColor(p: NoteColor, base: string, midi: number, black: boolean, k: number, c: ColorChoice): string {
  switch (p) {
    case "solid":
      return black ? mixHex(c.solid, "#000000", 0.22) : c.solid;
    case "custom":
      return mixHex(c.from, c.to, k);
    case "rainbow":
      return hslHex((midi % 12) * 30, 0.85, 0.62);
    case "octave":
      return hslHex((200 + Math.floor(midi / 12) * 47) % 360, 0.8, black ? 0.52 : 0.62);
    case "gradient":
      return mixHex("#38d6ff", "#e879f9", k);
    case "sunset":
      return mixHex("#facc15", "#f43f5e", k);
    case "ocean":
      return mixHex("#5eead4", "#2563eb", k);
    case "aurora":
      return k < 0.5 ? mixHex("#4ade80", "#22d3ee", k * 2) : mixHex("#22d3ee", "#a78bfa", k * 2 - 1);
    case "candy":
      return mixHex("#f472b6", "#67e8f9", k);
    case "ice":
      return mixHex(base, "#e0f2fe", 0.6);
    case "pastel":
      return mixHex(base, "#ffffff", 0.42);
    case "gold":
      return black ? "#d97706" : "#fbbf24";
    case "silver":
      return black ? "#94a3b8" : "#e2e8f0";
    default:
      return base;
  }
}

export const EFFECT_STYLES = ["sparks", "stars", "fire", "glow", "notes", "confetti", "bubbles", "lightning", "petals", "pixels"] as const;
export type EffectStyle = (typeof EFFECT_STYLES)[number];

/** Clouds left floating behind the notes after hits and around held notes. */
export const DUST_STYLES = ["off", "smoke", "fountain", "plume", "rays", "sparkle", "nebula", "fog", "embers", "stardust"] as const;
export type DustStyle = (typeof DUST_STYLES)[number];

/** What happens in a note's lane while it falls towards its key. */
export const APPROACH_STYLES = ["off", "beam", "ring", "comet", "arrows", "keyglow"] as const;
export type ApproachStyle = (typeof APPROACH_STYLES)[number];

export function oneOf<T extends string>(list: readonly T[], v: unknown, d: T): T {
  return list.includes(v as T) ? (v as T) : d;
}
