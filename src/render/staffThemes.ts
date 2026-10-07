import { JUDGEMENT_COLORS, TRACK_COLORS } from "./theme";

export const STAFF_STYLES = ["night", "paper", "neon", "chalk", "blueprint", "sepia", "rose", "ocean", "sunset", "gold"] as const;
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
  chalk: {
    bg: ["#1f3a2e", "#142a20"],
    panel: "#1a3227",
    line: "rgba(240,244,236,0.42)",
    bar: "rgba(240,244,236,0.3)",
    ink: "#f4f7ef",
    ledger: "rgba(240,244,236,0.6)",
    clef: "rgba(244,247,239,0.92)",
    measure: "rgba(253,230,138,0.7)",
    playhead: "#fde68a",
    playheadGlow: "rgba(253,230,138,0.22)",
    finger: "#fde68a",
    handColors: false,
    glow: false,
    judged: { perfect: "#93c5fd", great: "#bbf7d0", good: "#fde68a", miss: "#fca5a5" },
    skipped: "rgba(240,244,236,0.3)",
  },
  blueprint: {
    bg: ["#16408a", "#0f2f6b"],
    panel: "#143a7e",
    line: "rgba(224,236,255,0.45)",
    bar: "rgba(224,236,255,0.32)",
    ink: "#ffffff",
    ledger: "rgba(224,236,255,0.62)",
    clef: "#e6efff",
    measure: "rgba(165,213,255,0.75)",
    playhead: "#facc15",
    playheadGlow: "rgba(250,204,21,0.22)",
    finger: "#fde68a",
    handColors: false,
    glow: false,
    judged: { perfect: "#67e8f9", great: "#86efac", good: "#fde68a", miss: "#fda4af" },
    skipped: "rgba(255,255,255,0.32)",
  },
  sepia: {
    bg: ["#efe0c2", "#dcc59c"],
    panel: "#e8d6b2",
    line: "rgba(92,58,24,0.5)",
    bar: "rgba(92,58,24,0.38)",
    ink: "#3b2410",
    ledger: "rgba(92,58,24,0.65)",
    clef: "#3b2410",
    measure: "rgba(140,74,24,0.75)",
    playhead: "#9a3412",
    playheadGlow: "rgba(154,52,18,0.18)",
    finger: "#9a3412",
    handColors: false,
    glow: false,
    judged: { perfect: "#0e7490", great: "#3f6212", good: "#a16207", miss: "#b91c1c" },
    skipped: "rgba(59,36,16,0.28)",
  },
  rose: {
    bg: ["#fff1f4", "#fbdde5"],
    panel: "#fde8ee",
    line: "rgba(131,24,67,0.4)",
    bar: "rgba(131,24,67,0.3)",
    ink: "#4a0f2a",
    ledger: "rgba(131,24,67,0.55)",
    clef: "#6b1238",
    measure: "rgba(190,24,93,0.6)",
    playhead: "#db2777",
    playheadGlow: "rgba(219,39,119,0.18)",
    finger: "#be185d",
    handColors: false,
    glow: false,
    judged: { perfect: "#0369a1", great: "#15803d", good: "#b45309", miss: "#e11d48" },
    skipped: "rgba(74,15,42,0.26)",
  },
  ocean: {
    bg: ["#053a4a", "#03202e"],
    panel: "#04303e",
    line: "rgba(165,243,252,0.32)",
    bar: "rgba(165,243,252,0.24)",
    ink: "#ecfeff",
    ledger: "rgba(165,243,252,0.52)",
    clef: "#a5f3fc",
    measure: "rgba(45,212,191,0.65)",
    playhead: "#2dd4bf",
    playheadGlow: "rgba(45,212,191,0.28)",
    finger: "#99f6e4",
    handColors: false,
    glow: true,
    judged: { perfect: JUDGEMENT_COLORS.perfect, great: JUDGEMENT_COLORS.great, good: JUDGEMENT_COLORS.good, miss: JUDGEMENT_COLORS.miss },
    skipped: "rgba(236,254,255,0.28)",
  },
  sunset: {
    bg: ["#3b0d3d", "#1c0626"],
    panel: "#310b35",
    line: "rgba(254,215,170,0.32)",
    bar: "rgba(254,215,170,0.24)",
    ink: "#fff7ed",
    ledger: "rgba(254,215,170,0.5)",
    clef: "#fdba74",
    measure: "rgba(251,146,60,0.65)",
    playhead: "#fb923c",
    playheadGlow: "rgba(251,146,60,0.3)",
    finger: "#fed7aa",
    handColors: true,
    glow: true,
    judged: { perfect: JUDGEMENT_COLORS.perfect, great: JUDGEMENT_COLORS.great, good: JUDGEMENT_COLORS.good, miss: JUDGEMENT_COLORS.miss },
    skipped: "rgba(255,247,237,0.26)",
  },
  gold: {
    bg: ["#0c0a07", "#050403"],
    panel: "#0a0806",
    line: "rgba(234,179,8,0.38)",
    bar: "rgba(234,179,8,0.28)",
    ink: "#fde68a",
    ledger: "rgba(234,179,8,0.55)",
    clef: "#facc15",
    measure: "rgba(250,204,21,0.6)",
    playhead: "#fbbf24",
    playheadGlow: "rgba(251,191,36,0.26)",
    finger: "#fef3c7",
    handColors: false,
    glow: true,
    judged: { perfect: "#fef9c3", great: "#bef264", good: "#fdba74", miss: "#f87171" },
    skipped: "rgba(253,230,138,0.28)",
  },
};

/** Right hand / left hand colours of the falling notes. */
export const HAND_INK = [TRACK_COLORS[0][0], TRACK_COLORS[1][0]] as const;
