/** Looks for the on-screen instruments; the first of each list is the original design. */
export const PIANO_SKINS = ["standard", "ebony", "ivory", "neon", "glass"] as const;
export type PianoSkinId = (typeof PIANO_SKINS)[number];

export const GUITAR_SKINS = ["standard", "maple", "ebony", "electric", "neon"] as const;
export type GuitarSkinId = (typeof GUITAR_SKINS)[number];

export const VIOLIN_SKINS = ["standard", "amber", "baroque", "white", "neon"] as const;
export type ViolinSkinId = (typeof VIOLIN_SKINS)[number];

export interface PianoSkin {
  bg: string;
  /** Top → middle → bottom of the key gradients. */
  white: readonly [string, string, string];
  black: readonly [string, string, string];
  /** Label colours (hex) on the white and black keys. */
  whiteInk: string;
  blackInk: string;
  /** Key outlines (hex); `glow` adds a soft halo around them. */
  edge?: string;
  blackEdge?: string;
  glow?: boolean;
  /** A shine across the upper part of the white keys. */
  gloss?: boolean;
  /** A felt strip along the top edge. */
  felt?: string;
}

export const PIANO_SKIN: Record<PianoSkinId, PianoSkin> = {
  standard: {
    bg: "#05060f",
    white: ["#f4f6ff", "#e3e7f7", "#c9cee4"],
    black: ["#1d2033", "#2b2f48", "#3a3f5e"],
    whiteInk: "#4b4f86",
    blackInk: "#dce0ff",
  },
  ebony: {
    bg: "#000000",
    white: ["#2b2e40", "#1d2030", "#13151f"],
    black: ["#f4f6ff", "#e3e7f7", "#c9cee4"],
    whiteInk: "#c7cbef",
    blackInk: "#3c406e",
    edge: "#3b3f58",
  },
  ivory: {
    bg: "#1c100a",
    white: ["#fff8e6", "#f2e4c4", "#d6c39b"],
    black: ["#0b0806", "#1a1310", "#2b211a"],
    whiteInk: "#6b4f2a",
    blackInk: "#f2e4c4",
    felt: "#8e1b2c",
  },
  neon: {
    bg: "#05030c",
    white: ["#141030", "#0e0b22", "#090717"],
    black: ["#1e0a30", "#280e40", "#32124f"],
    whiteInk: "#7dd3fc",
    blackInk: "#f5d0fe",
    edge: "#38d6ff",
    blackEdge: "#e879f9",
    glow: true,
  },
  glass: {
    bg: "#060b1c",
    white: ["#cfe3ff", "#9fbef0", "#7393d6"],
    black: ["#0d1630", "#16234a", "#22336a"],
    whiteInk: "#1e3a72",
    blackInk: "#d6e6ff",
    edge: "#eaf3ff",
    blackEdge: "#7fa6ff",
    gloss: true,
  },
};

export interface FretSkin {
  /** Fingerboard gradient, top → bottom. */
  wood: readonly [string, string, string];
  nut: string;
  /** Fret wire colour (guitar) or position line colour (violin), hex; `glow` adds a halo. */
  fret: string;
  fretAlpha: number;
  glow?: boolean;
  /** Position markers: dots, pearl blocks or faint bands across the board. */
  inlay: string;
  inlayAlpha: number;
  inlayShape: "dot" | "block" | "band";
  numbers: string;
  /** Computer-key labels over the frets. */
  accent: string;
  /** Strike zone (the body) from the neck side outwards. */
  zone: readonly string[];
  body: "hole" | "pickups" | "bridge";
  detail: string;
  /** f-holes drawn on violin bodies. */
  fholes?: boolean;
  /** A thin shadow under the strings, for light wood where pale strings would fade. */
  stringShadow?: string;
}

const GUITAR_BASE = {
  nut: "#e8e0cc",
  fretAlpha: 0.55,
  inlayShape: "dot",
  numbers: "rgba(255,255,255,0.35)",
  accent: "rgba(196,181,253,0.8)",
  body: "hole",
} as const;

export const GUITAR_SKIN: Record<GuitarSkinId, FretSkin> = {
  standard: {
    ...GUITAR_BASE,
    wood: ["#2a1a12", "#3a2418", "#24160f"],
    fret: "#c8c8d7",
    inlay: "#ebe1cd",
    inlayAlpha: 0.22,
    zone: ["#161a2c", "#0b0d18"],
    detail: "rgba(196,181,253,0.18)",
  },
  maple: {
    ...GUITAR_BASE,
    wood: ["#d4b07c", "#e4c792", "#c39f69"],
    nut: "#faf6ea",
    fret: "#6e6a66",
    fretAlpha: 0.8,
    inlay: "#1a120a",
    inlayAlpha: 0.7,
    numbers: "rgba(70,45,20,0.65)",
    accent: "rgba(91,33,182,0.85)",
    zone: ["#2e1406", "#9a5719", "#d08a35"],
    detail: "rgba(255,236,200,0.35)",
    stringShadow: "rgba(40,22,8,0.55)",
  },
  ebony: {
    ...GUITAR_BASE,
    wood: ["#0d0b0b", "#181414", "#0a0808"],
    nut: "#f6f1e7",
    fret: "#e6e6f0",
    fretAlpha: 0.7,
    inlay: "#dcebf5",
    inlayAlpha: 0.24,
    inlayShape: "block",
    numbers: "rgba(255,255,255,0.4)",
    zone: ["#1c1411", "#0b0807"],
    detail: "rgba(232,220,200,0.25)",
  },
  electric: {
    ...GUITAR_BASE,
    wood: ["#1e130e", "#2c1c15", "#18100b"],
    fret: "#e8ecf4",
    fretAlpha: 0.85,
    inlay: "#f2f2f2",
    inlayAlpha: 0.32,
    zone: ["#4a0a0a", "#b91c1c", "#7f1d1d"],
    body: "pickups",
    detail: "#d6dae4",
  },
  neon: {
    ...GUITAR_BASE,
    wood: ["#07051a", "#0d0a26", "#060414"],
    nut: "#e879f9",
    fret: "#38d6ff",
    fretAlpha: 0.85,
    glow: true,
    inlay: "#e879f9",
    inlayAlpha: 0.55,
    numbers: "rgba(125,211,252,0.75)",
    accent: "rgba(245,208,254,0.9)",
    zone: ["#0d0924", "#05030f"],
    detail: "rgba(232,121,249,0.5)",
  },
};

const VIOLIN_BASE = {
  nut: "#e8e0cc",
  fret: "#ffffff",
  fretAlpha: 0.05,
  inlay: "#ffffff",
  inlayAlpha: 0.05,
  inlayShape: "band",
  numbers: "rgba(255,255,255,0.35)",
  accent: "rgba(196,181,253,0.8)",
  body: "bridge",
} as const;

export const VIOLIN_SKIN: Record<ViolinSkinId, FretSkin> = {
  standard: {
    ...VIOLIN_BASE,
    wood: ["#15110f", "#221a16", "#120e0c"],
    zone: ["#3a2414", "#24170e", "#140d08"],
    detail: "rgba(222,190,140,0.55)",
  },
  amber: {
    ...VIOLIN_BASE,
    wood: ["#18120e", "#261c16", "#140f0b"],
    zone: ["#d08328", "#a85d16", "#62320a"],
    detail: "rgba(250,232,196,0.85)",
    fholes: true,
  },
  baroque: {
    ...VIOLIN_BASE,
    wood: ["#3a2618", "#4a3120", "#302014"],
    nut: "#f2e6c8",
    fretAlpha: 0.07,
    inlay: "#f2d9a8",
    inlayAlpha: 0.08,
    numbers: "rgba(255,240,215,0.45)",
    zone: ["#6b1d12", "#4a130b", "#260806"],
    detail: "rgba(236,206,160,0.7)",
    fholes: true,
  },
  white: {
    ...VIOLIN_BASE,
    wood: ["#0f0f12", "#1a1a1f", "#0c0c0f"],
    nut: "#f4f4f6",
    zone: ["#f5f5f7", "#dedee4", "#b9b9c4"],
    detail: "rgba(40,40,52,0.65)",
    stringShadow: "rgba(20,20,30,0.45)",
  },
  neon: {
    ...VIOLIN_BASE,
    wood: ["#07051a", "#0d0a26", "#060414"],
    nut: "#e879f9",
    fret: "#38d6ff",
    fretAlpha: 0.3,
    glow: true,
    inlay: "#38d6ff",
    inlayAlpha: 0.07,
    numbers: "rgba(125,211,252,0.75)",
    accent: "rgba(245,208,254,0.9)",
    zone: ["#140b2c", "#07041a"],
    detail: "#e879f9",
  },
};
