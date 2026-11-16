import { mixHex, withAlpha } from "./theme";

/** How a colour loads into a falling note. */
export const CUE_STYLES = ["fill", "rise", "pulse", "neon", "ring", "ember", "wave", "spark"] as const;
export type CueStyle = (typeof CUE_STYLES)[number];

/** Colours for that load. `note` follows the note's own colour. */
export const CUE_COLORS = ["gold", "amber", "white", "cyan", "rose", "violet", "lime", "ice", "note", "custom"] as const;
export type CueColor = (typeof CUE_COLORS)[number];

/** Light thrown from the bottom edge of the screen toward a keyboard sitting under it. */
export const LAMP_STYLES = ["beam", "bloom", "bar", "spark", "rainbow"] as const;
export type LampStyle = (typeof LAMP_STYLES)[number];

export const LAMP_COLORS = ["match", ...CUE_COLORS] as const;
export type LampColor = (typeof LAMP_COLORS)[number];

const SWATCH: Record<Exclude<CueColor, "note" | "custom">, string> = {
  gold: "#f5c451",
  amber: "#fb923c",
  white: "#fff6d8",
  cyan: "#22d3ee",
  rose: "#fb7185",
  violet: "#c4b5fd",
  lime: "#bef264",
  ice: "#e0f2fe",
};

const NOTE_HUES = ["#fb7185", "#fb923c", "#f5c451", "#bef264", "#4ade80", "#2dd4bf", "#22d3ee", "#38bdf8", "#818cf8", "#c4b5fd", "#e879f9", "#f472b6"];

export function cueNoteHex(midi: number): string {
  return NOTE_HUES[((midi % 12) + 12) % 12] ?? "#f5c451";
}

export function cueSwatch(color: CueColor, custom = "#f5c451"): string {
  if (color === "note") return NOTE_HUES[0] ?? "#38d6ff";
  if (color === "custom") return custom;
  return SWATCH[color];
}

/** 0 far … 1 at the hit line. `flash` is the moment the key should go down. */
export function cueProgress(aheadSec: number, fallSeconds: number, speed: number, windowSec: number): { p: number; flash: boolean } | null {
  const span = Math.min(Math.max(0.35, fallSeconds) * 0.5, 1.15 * Math.max(0.25, speed));
  const win = Math.max(0.06, windowSec);
  if (aheadSec > span || aheadSec < -win) return null;
  const p = aheadSec <= 0 ? 1 : Math.max(0, Math.min(1, 1 - aheadSec / span));
  const flash = aheadSec <= Math.max(0.16, win * 0.45) && aheadSec >= -Math.max(0.08, win * 0.35);
  return { p, flash };
}

export function paintNoteCue(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  prog: { p: number; flash: boolean },
  style: CueStyle,
  color: string,
  level: number,
  now: number
): void {
  const { x, y, w, h } = box;
  if (w < 4 || h < 4) return;
  const p = prog.p;
  const flash = prog.flash;
  const a = Math.max(0.15, Math.min(1, level)) * (flash ? 1 : 0.55 + 0.45 * p);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = "source-over";
  const bottom = y + h;
  if (style === "fill") {
    const loaded = h * (flash ? 1 : 0.15 + 0.85 * p);
    const g = ctx.createLinearGradient(0, bottom - loaded, 0, bottom);
    g.addColorStop(0, withAlpha(color, 0));
    g.addColorStop(0.35, withAlpha(color, 0.55 * a));
    g.addColorStop(1, withAlpha(flash ? "#ffffff" : color, flash ? 0.95 : a));
    ctx.fillStyle = g;
    ctx.fillRect(x, bottom - loaded, w, loaded);
  } else if (style === "rise") {
    const band = Math.max(6, Math.min(h * 0.22, 18));
    const travel = (flash ? 0.92 : p) * (h - band);
    const yy = bottom - band - travel;
    const g = ctx.createLinearGradient(0, yy, 0, yy + band);
    g.addColorStop(0, withAlpha(color, 0));
    g.addColorStop(0.5, withAlpha(flash ? "#ffffff" : color, a));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, yy, w, band);
  } else if (style === "pulse") {
    const beat = 0.55 + 0.45 * Math.sin(now / (flash ? 60 : 220 - 140 * p));
    ctx.fillStyle = withAlpha(flash ? mixHex(color, "#ffffff", 0.55) : color, a * beat);
    ctx.fillRect(x, y, w, h);
  } else if (style === "neon") {
    const inset = 1 + (1 - p) * 3;
    ctx.strokeStyle = withAlpha(flash ? "#ffffff" : color, 0.45 + 0.55 * a);
    ctx.lineWidth = flash ? 3 : 1.25 + 2 * p;
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    ctx.fillStyle = withAlpha(color, 0.12 * a);
    ctx.fillRect(x, y, w, h);
  } else if (style === "ring") {
    const cx = x + w / 2;
    const cy = bottom - Math.min(h * 0.35, 16);
    const r = Math.max(4, w * (0.85 - 0.45 * p));
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, Math.max(3, r * 0.42), 0, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(color, 0.35 + 0.6 * a);
    ctx.lineWidth = flash ? 3 : 1.5;
    ctx.stroke();
    if (flash) {
      ctx.fillStyle = withAlpha("#ffffff", 0.55);
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.28, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === "ember") {
    const n = 4 + Math.round(4 * p);
    for (let i = 0; i < n; i++) {
      const yy = bottom - ((i / n) * h * (0.25 + 0.75 * p) + ((now / 40 + i * 17) % 10));
      const xx = x + w * (0.2 + 0.6 * ((Math.sin(now / 180 + i) + 1) / 2));
      ctx.fillStyle = withAlpha(i % 2 ? "#fff6d8" : color, a);
      ctx.fillRect(xx, yy, 2.2, 2.2);
    }
  } else if (style === "wave") {
    const reach = h * (flash ? 1 : 0.2 + 0.8 * p);
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const xx = x + (w * i) / steps;
      const wave = Math.sin(i * 1.3 + now / 140) * Math.min(8, h * 0.12);
      ctx.lineTo(xx, bottom - reach + wave);
    }
    ctx.lineTo(x + w, bottom);
    ctx.closePath();
    ctx.fillStyle = withAlpha(flash ? mixHex(color, "#ffffff", 0.4) : color, 0.45 * a);
    ctx.fill();
  } else {
    const cx = x + w / 2;
    const cy = bottom - Math.min(10 + p * 8, h * 0.4);
    const r = (flash ? 1 : 0.35 + 0.65 * p) * Math.min(w, 16) * 0.55;
    ctx.fillStyle = withAlpha(flash ? "#ffffff" : color, a);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * i) / 4 - Math.PI / 2;
      const rad = i % 2 ? r : r * 0.42;
      const xx = cx + Math.cos(ang) * rad;
      const yy = cy + Math.sin(ang) * rad * 0.72;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
