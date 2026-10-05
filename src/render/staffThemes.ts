import { JUDGEMENT_COLORS, TRACK_COLORS } from "./theme";

export const STAFF_STYLES = ["night", "paper", "neon"] as const;
export type StaffStyle = (typeof STAFF_STYLES)[number];

export interface StaffTheme {
  /** Background, top → bottom. */
  bg: [string, string];
  /** Behind the clefs; notes slide under it. */
  panel: string;
  line: string;
  bar: string;
  /** Notes still to play (unless coloured by hand). */
  ink: string;
  ledger: string;
  clef: string;
  measure: string;
  playhead: string;
  playheadGlow: string;
  finger: string;
  /** Notes take their hand's colour, as on the falling notes. */
  handColors: boolean;
  /** Notes and the playhead glow. */
  glow: boolean;
  judged: Record<"perfect" | "great" | "good" | "miss", string>;
  skipped: string;
}

export const STAFF_THEMES: Record<StaffStyle, StaffTheme> = {
  night: {
    bg: ["#100d29", "#08061a"],
    panel: "#0d0b22",
    line: "rgba(226,232,255,0.34)",
    bar: "rgba(226,232,255,0.24)",
    ink: "#f4f6ff",
    ledger: "rgba(226,232,255,0.55)",
    clef: "rgba(226,232,255,0.9)",
    measure: "rgba(196,181,253,0.6)",
    playhead: "#a78bfa",
    playheadGlow: "rgba(167,139,250,0.32)",
    finger: "#c4b5fd",
    handColors: false,
    glow: false,
    judged: { perfect: JUDGEMENT_COLORS.perfect, great: JUDGEMENT_COLORS.great, good: JUDGEMENT_COLORS.good, miss: JUDGEMENT_COLORS.miss },
    skipped: "rgba(255,255,255,0.3)",
  },
  paper: {
    bg: ["#fbf6ea", "#ece2ca"],
    panel: "#f5eedb",
    line: "rgba(52,44,78,0.5)",
    bar: "rgba(52,44,78,0.38)",
    ink: "#211b36",
    ledger: "rgba(52,44,78,0.65)",
    clef: "#211b36",
    measure: "rgba(120,86,52,0.75)",
    playhead: "#7c3aed",
    playheadGlow: "rgba(124,58,237,0.2)",
    finger: "#6d28d9",
    handColors: false,
    glow: false,
    judged: { perfect: "#0284c7", great: "#15803d", good: "#b45309", miss: "#e11d48" },
    skipped: "rgba(33,27,54,0.28)",
  },
  neon: {
    bg: ["#050a1c", "#0d0424"],
    panel: "#060818",
    line: "rgba(56,214,255,0.24)",
    bar: "rgba(192,132,252,0.32)",
    ink: "#ffffff",
    ledger: "rgba(56,214,255,0.45)",
    clef: "#7dd3fc",
    measure: "rgba(56,214,255,0.7)",
    playhead: "#f0abfc",
    playheadGlow: "rgba(240,171,252,0.38)",
    finger: "#f5d0fe",
    handColors: true,
    glow: true,
    judged: { perfect: JUDGEMENT_COLORS.perfect, great: JUDGEMENT_COLORS.great, good: JUDGEMENT_COLORS.good, miss: JUDGEMENT_COLORS.miss },
    skipped: "rgba(255,255,255,0.25)",
  },
};

/** Right hand / left hand colours of the falling notes. */
export const HAND_INK = [TRACK_COLORS[0][0], TRACK_COLORS[1][0]] as const;
