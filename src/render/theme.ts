/** Colours shared by canvas renderers and CSS. */
export const COLORS = {
  bgTop: "#070a1a",
  bgBottom: "#121633",
  lane: "rgba(255,255,255,0.025)",
  laneBlack: "rgba(0,0,0,0.22)",
  laneLine: "rgba(255,255,255,0.06)",
  octaveLine: "rgba(255,255,255,0.12)",
  beat: "rgba(255,255,255,0.06)",
  measure: "rgba(167,139,250,0.28)",
  hitLine: "#a78bfa",
  loop: "rgba(56,189,248,0.10)",
  loopEdge: "rgba(56,189,248,0.75)",
  text: "#e6e9ff",
  muted: "#8b90b8",
};

/** Per-hand/track colours [white-key, black-key]. */
export const TRACK_COLORS: [string, string][] = [
  ["#38d6ff", "#1a9cc9"],
  ["#c084fc", "#9049d6"],
  ["#4ade80", "#22a75a"],
  ["#fbbf24", "#d18e0b"],
  ["#fb7185", "#d6455b"],
  ["#60a5fa", "#2f73cf"],
];

/** Rocksmith-style string colours, lowest string first. */
export const GUITAR_STRING_COLORS = ["#c084fc", "#4ade80", "#fb923c", "#60a5fa", "#facc15", "#f87171"];
export const VIOLIN_STRING_COLORS = ["#4ade80", "#60a5fa", "#facc15", "#f87171"];

export const JUDGEMENT_COLORS: Record<string, string> = {
  perfect: "#7dd3fc",
  great: "#86efac",
  good: "#fde68a",
  miss: "#fb7185",
  wrong: "#fb7185",
};

export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Lightens (amount > 0, towards white) or darkens (amount < 0, towards black) a hex colour. */
export function shade(hex: string, amount: number, a = 1): string {
  const h = hex.replace("#", "");
  const target = amount > 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amount));
  const ch = (i: number) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - k) + target * k);
  return `rgba(${ch(0)},${ch(2)},${ch(4)},${a})`;
}

const spriteCache = new Map<string, HTMLCanvasElement>();

/** Soft radial glow sprite, cached per colour. */
export function glowSprite(color: string, size = 64): HTMLCanvasElement {
  const key = `${color}:${size}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, withAlpha(color, 0.95));
  grad.addColorStop(0.25, withAlpha(color, 0.5));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

/** Flat-profiled soft blob for smoke and fog (no bright core like glowSprite). */
export function softSprite(color: string, size = 64): HTMLCanvasElement {
  const key = `soft:${color}:${size}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, withAlpha(color, 0.5));
  grad.addColorStop(0.45, withAlpha(color, 0.3));
  grad.addColorStop(0.75, withAlpha(color, 0.1));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

/** Blends two hex colours (k = 0 → a, 1 → b) into a hex colour. */
export function mixHex(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i + 1, i + 3), 16);
  const out = [0, 2, 4].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** HSL (h in degrees, s/l 0–1) to hex. */
export function hslHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
