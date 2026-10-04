import type { NoteStyle } from "./appearance";
import { glowSprite, roundRect, shade, withAlpha } from "./theme";

export interface NoteDraw {
  lane: { x: number; w: number };
  yTop: number;
  yBottom: number;
  color: string;
  alpha: number;
  long: boolean;
  /** Pending or being held: drawn with its glow. */
  live: boolean;
  holding: boolean;
  missed: boolean;
  target: boolean;
  pulse: number;
  now: number;
  /** Glow strength, 0 when effects are off. */
  glow: number;
}

/** Styles drawn as one piece for the whole length instead of a head with a tail. */
const WHOLE: ReadonlySet<NoteStyle> = new Set<NoteStyle>(["classic", "block", "capsule"]);

/** Height of the head block of a long note (short notes are all head). */
export function headHeight(style: NoteStyle, laneW: number, height: number, long: boolean): number {
  if (!long || WHOLE.has(style)) return height;
  return Math.min(height, Math.max(18, Math.min(34, laneW * 0.85)));
}

/** Where the label sits: one-piece styles still get it in a head-sized area at the bottom. */
export function labelHeight(style: NoteStyle, laneW: number, height: number, long: boolean): number {
  return headHeight(WHOLE.has(style) ? "gem" : style, laneW, height, long);
}

/** Styles with a dark or see-through head need light label text. */
export function lightInk(style: NoteStyle, holding: boolean): boolean {
  return (style === "neon" || style === "glass") && !holding;
}

const DRAW: Record<NoteStyle, (ctx: CanvasRenderingContext2D, o: NoteDraw) => void> = {
  gem: (c, o) => gem(c, o),
  neon: (c, o) => neon(c, o),
  classic: (c, o) => classic(c, o),
  minimal: (c, o) => minimal(c, o),
  block: (c, o) => block(c, o),
  glass: (c, o) => glass(c, o),
  capsule: (c, o) => capsule(c, o),
  pixel: (c, o) => pixel(c, o),
  candy: (c, o) => candy(c, o),
  crystal: (c, o) => crystal(c, o),
};

export function drawNote(ctx: CanvasRenderingContext2D, style: NoteStyle, o: NoteDraw): void {
  (DRAW[style] ?? gem)(ctx, o);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function halo(ctx: CanvasRenderingContext2D, o: NoteDraw, headTop: number, headH: number): void {
  if (o.glow <= 0 || !o.live) return;
  const { lane, yTop, color, alpha } = o;
  const height = o.yBottom - yTop;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha * o.glow * (o.holding ? 0.95 : 0.38);
  const spread = o.holding ? 0.6 : 0.36;
  ctx.drawImage(glowSprite(color, 64), lane.x - lane.w * spread, headTop - 10, lane.w * (1 + spread * 2), headH + 20);
  if (o.long) {
    ctx.globalAlpha = alpha * o.glow * (o.holding ? 0.45 : 0.16);
    ctx.drawImage(glowSprite(color, 64), lane.x - lane.w * 0.2, yTop - 6, lane.w * 1.4, height - headH + 12);
  }
  ctx.globalCompositeOperation = "source-over";
}

function outline(ctx: CanvasRenderingContext2D, o: NoteDraw, x: number, y: number, w: number, h: number, r: number): void {
  roundRect(ctx, x, y, w, h, r);
  if (o.target) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * o.pulse})`;
  } else if (o.missed) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(251,113,133,0.8)";
  } else {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = shade(o.color, 0.6, o.holding ? 0.95 : 0.55);
  }
  ctx.stroke();
}

/** Chevrons flowing down a held tail into the hit line. */
function chevrons(ctx: CanvasRenderingContext2D, o: NoteDraw, tx: number, tw: number, top: number, bottom: number): void {
  if (!o.holding || o.glow <= 0) return;
  const cx = tx + tw / 2;
  const span = Math.max(1, bottom - top);
  ctx.globalCompositeOperation = "lighter";
  const gap = 22;
  const off = (o.now * 0.14) % gap;
  for (let y = bottom - off; y > top + 4; y -= gap) {
    ctx.fillStyle = `rgba(255,255,255,${0.32 * o.glow * ((y - top) / span)})`;
    ctx.beginPath();
    ctx.moveTo(tx + 1, y - 7);
    ctx.lineTo(cx, y);
    ctx.lineTo(tx + tw - 1, y - 7);
    ctx.lineTo(tx + tw - 1, y - 4);
    ctx.lineTo(cx, y + 3);
    ctx.lineTo(tx + 1, y - 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

/** Gem-like head where the note starts, with a shaded glowing tail for its length. */
function gem(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, color, alpha } = o;
  const height = yBottom - yTop;
  const headH = headHeight("gem", lane.w, height, o.long);
  const headTop = yBottom - headH;
  const cx = lane.x + lane.w / 2;
  const r = Math.min(10, lane.w * 0.4, headH / 2);

  halo(ctx, o, headTop, headH);

  if (o.long && height > headH + 2) {
    const tw = Math.max(6, lane.w * (o.holding ? 0.88 : 0.78));
    const tx = cx - tw / 2;
    const tailBottom = headTop + headH * 0.5;
    const tailH = tailBottom - yTop;
    ctx.globalAlpha = alpha;
    const across = ctx.createLinearGradient(tx, 0, tx + tw, 0);
    across.addColorStop(0, shade(color, -0.35, 0.9));
    across.addColorStop(0.5, shade(color, o.holding ? 0.45 : 0.2));
    across.addColorStop(1, shade(color, -0.35, 0.9));
    ctx.fillStyle = across;
    roundRect(ctx, tx, yTop, tw, tailH, Math.min(tw / 2, 8));
    ctx.fill();
    const fade = ctx.createLinearGradient(0, yTop, 0, tailBottom);
    fade.addColorStop(0, "rgba(9,11,28,0.62)");
    fade.addColorStop(0.45, "rgba(9,11,28,0.18)");
    fade.addColorStop(1, "rgba(9,11,28,0)");
    ctx.fillStyle = fade;
    ctx.fill();
    const core = ctx.createLinearGradient(0, yTop, 0, tailBottom);
    core.addColorStop(0, "rgba(255,255,255,0)");
    core.addColorStop(1, `rgba(255,255,255,${o.holding ? 0.8 : 0.42})`);
    ctx.fillStyle = core;
    ctx.fillRect(cx - Math.max(1, tw * 0.09), yTop + 4, Math.max(2, tw * 0.18), tailH - 4);
    chevrons(ctx, o, tx, tw, yTop, tailBottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha("#ffffff", o.holding ? 0.4 : 0.16);
    roundRect(ctx, tx, yTop, tw, tailH, Math.min(tw / 2, 8));
    ctx.stroke();
  }

  ctx.globalAlpha = alpha;
  const body = ctx.createLinearGradient(0, headTop, 0, yBottom);
  if (o.missed) {
    body.addColorStop(0, "rgba(140,144,170,0.85)");
    body.addColorStop(1, "rgba(70,74,98,0.9)");
  } else {
    body.addColorStop(0, shade(color, o.holding ? 0.75 : 0.55));
    body.addColorStop(0.45, shade(color, o.holding ? 0.3 : 0.05));
    body.addColorStop(1, shade(color, o.holding ? 0 : -0.32));
  }
  ctx.fillStyle = body;
  roundRect(ctx, lane.x, headTop, lane.w, headH, r);
  ctx.fill();

  if (!o.missed && lane.w >= 8) {
    const bevel = ctx.createLinearGradient(lane.x, 0, lane.x + lane.w, 0);
    bevel.addColorStop(0, "rgba(255,255,255,0.18)");
    bevel.addColorStop(0.18, "rgba(255,255,255,0)");
    bevel.addColorStop(0.82, "rgba(0,0,0,0)");
    bevel.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = bevel;
    ctx.fill();
    const shine = ctx.createLinearGradient(0, headTop, 0, headTop + headH * 0.55);
    shine.addColorStop(0, "rgba(255,255,255,0.55)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    roundRect(ctx, lane.x + lane.w * 0.12, headTop + 1.5, lane.w * 0.76, Math.max(3, headH * 0.45), Math.max(2, r * 0.7));
    ctx.fill();
    if (o.glow > 0 && headH >= 12) {
      const cap = ctx.createRadialGradient(cx, yBottom, 0, cx, yBottom, lane.w * 0.7);
      cap.addColorStop(0, "rgba(255,255,255,0.75)");
      cap.addColorStop(0.4, withAlpha(color, 0.7));
      cap.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.ellipse(cx, yBottom - 1, lane.w * 0.5, Math.min(6, headH * 0.22), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  outline(ctx, o, lane.x, headTop, lane.w, headH, r);
}

/** Dark glass with a bright glowing outline, like neon tubes. */
function neon(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#7a7f9e" : o.color;
  const height = yBottom - yTop;
  const headH = headHeight("neon", lane.w, height, o.long);
  const headTop = yBottom - headH;
  const cx = lane.x + lane.w / 2;
  const r = Math.min(8, lane.w * 0.35, headH / 2);

  halo(ctx, o, headTop, headH);

  if (o.long && height > headH + 2) {
    const tw = Math.max(5, lane.w * 0.5);
    const tx = cx - tw / 2;
    const tailBottom = headTop + 2;
    ctx.globalAlpha = alpha;
    const fill = ctx.createLinearGradient(0, yTop, 0, tailBottom);
    fill.addColorStop(0, withAlpha(color, 0.02));
    fill.addColorStop(1, withAlpha(color, o.holding ? 0.4 : 0.18));
    ctx.fillStyle = fill;
    roundRect(ctx, tx, yTop, tw, tailBottom - yTop, tw / 2);
    ctx.fill();
    const edge = ctx.createLinearGradient(0, yTop, 0, tailBottom);
    edge.addColorStop(0, withAlpha(color, 0.15));
    edge.addColorStop(1, withAlpha(color, 1));
    ctx.strokeStyle = edge;
    ctx.lineWidth = o.holding ? 2.2 : 1.6;
    ctx.stroke();
    chevrons(ctx, o, tx, tw, yTop, tailBottom);
  }

  ctx.globalAlpha = alpha;
  roundRect(ctx, lane.x + 1, headTop + 1, lane.w - 2, headH - 2, r);
  ctx.fillStyle = o.holding ? withAlpha(color, 0.45) : "rgba(8,10,26,0.78)";
  ctx.fill();
  const inner = ctx.createLinearGradient(0, headTop, 0, yBottom);
  inner.addColorStop(0, withAlpha(color, 0.05));
  inner.addColorStop(1, withAlpha(color, 0.35));
  ctx.fillStyle = inner;
  ctx.fill();
  if (o.glow > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 5;
    ctx.strokeStyle = withAlpha(color, 0.22 * o.glow);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.lineWidth = o.target ? 2.6 : 2;
  ctx.strokeStyle = o.target ? `rgba(255,255,255,${0.7 + 0.3 * o.pulse})` : shade(color, 0.35);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(lane.x + r, headTop + 3, Math.max(0, lane.w - r * 2), 1.2);
}

/** One rounded gradient bar for the whole note, bright where it lands and glassy along its length. */
function classic(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#6b6f8e" : o.color;
  const height = yBottom - yTop;
  const r = Math.min(9, lane.w * 0.42, height / 2);

  if (o.glow > 0 && o.live) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * o.glow * (o.holding ? 0.7 : 0.3);
    ctx.drawImage(glowSprite(color, 64), lane.x - lane.w * 0.45, yTop - 8, lane.w * 1.9, height + 16);
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.globalAlpha = alpha;
  const body = ctx.createLinearGradient(0, yTop, 0, yBottom);
  body.addColorStop(0, withAlpha(color, o.long ? 0.28 : 0.75));
  body.addColorStop(o.long ? 0.6 : 0.3, shade(color, o.holding ? 0.25 : 0, 0.95));
  body.addColorStop(1, shade(color, o.holding ? 0.6 : 0.35));
  ctx.fillStyle = body;
  roundRect(ctx, lane.x, yTop, lane.w, height, r);
  ctx.fill();
  const glass = ctx.createLinearGradient(lane.x, 0, lane.x + lane.w, 0);
  glass.addColorStop(0, "rgba(255,255,255,0.32)");
  glass.addColorStop(0.3, "rgba(255,255,255,0.06)");
  glass.addColorStop(0.7, "rgba(255,255,255,0)");
  glass.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = glass;
  ctx.fill();
  if (o.holding) chevrons(ctx, o, lane.x + lane.w * 0.15, lane.w * 0.7, yTop, yBottom - 6);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(lane.x + r * 0.6, yBottom - 3, Math.max(0, lane.w - r * 1.2), 2);
  outline(ctx, o, lane.x, yTop, lane.w, height, r);
}

/** Flat colour blocks, no gloss — calm and easy to read. */
function minimal(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#5b5f7a" : o.color;
  const height = yBottom - yTop;
  const headH = headHeight("minimal", lane.w, height, o.long);
  const headTop = yBottom - headH;
  const r = Math.min(6, lane.w * 0.3, headH / 2);
  ctx.globalAlpha = alpha;
  if (o.long && height > headH) {
    const tw = Math.max(4, lane.w * 0.55);
    ctx.fillStyle = withAlpha(color, o.holding ? 0.75 : 0.45);
    roundRect(ctx, lane.x + (lane.w - tw) / 2, yTop, tw, height - headH + r, tw / 2);
    ctx.fill();
  }
  ctx.fillStyle = o.holding ? shade(color, 0.3) : color;
  roundRect(ctx, lane.x, headTop, lane.w, headH, r);
  ctx.fill();
  if (o.target || o.missed) outline(ctx, o, lane.x, headTop, lane.w, headH, r);
}

/** Soft light behind a whole one-piece note. */
function wholeGlow(ctx: CanvasRenderingContext2D, o: NoteDraw, color: string): void {
  if (o.glow <= 0 || !o.live) return;
  const { lane, yTop, yBottom } = o;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = o.alpha * o.glow * (o.holding ? 0.7 : 0.28);
  ctx.drawImage(glowSprite(color, 64), lane.x - lane.w * 0.45, yTop - 8, lane.w * 1.9, yBottom - yTop + 16);
  ctx.globalCompositeOperation = "source-over";
}

/** Solid flat bars for the whole length, like a piano roll. */
function block(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#5b5f7a" : o.color;
  const height = yBottom - yTop;
  const r = Math.min(4, lane.w * 0.2, height / 2);
  wholeGlow(ctx, o, color);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = o.holding ? shade(color, 0.35) : shade(color, -0.08);
  roundRect(ctx, lane.x, yTop, lane.w, height, r);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${o.holding ? 0.55 : 0.2})`;
  ctx.fillRect(lane.x + r, yBottom - 2, Math.max(0, lane.w - r * 2), 2);
  if (o.target || o.missed) outline(ctx, o, lane.x, yTop, lane.w, height, r);
}

/** Frosted see-through glass with a bright rim and a diagonal reflection. */
function glass(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#7a7f9e" : o.color;
  const height = yBottom - yTop;
  const headH = headHeight("glass", lane.w, height, o.long);
  const headTop = yBottom - headH;
  const cx = lane.x + lane.w / 2;
  const r = Math.min(9, lane.w * 0.38, headH / 2);

  halo(ctx, o, headTop, headH);

  if (o.long && height > headH + 2) {
    const tw = Math.max(5, lane.w * 0.62);
    const tx = cx - tw / 2;
    const tailBottom = headTop + headH * 0.4;
    ctx.globalAlpha = alpha;
    const fill = ctx.createLinearGradient(0, yTop, 0, tailBottom);
    fill.addColorStop(0, withAlpha(color, 0.05));
    fill.addColorStop(1, withAlpha(color, o.holding ? 0.42 : 0.2));
    ctx.fillStyle = fill;
    roundRect(ctx, tx, yTop, tw, tailBottom - yTop, Math.min(tw / 2, 7));
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha("#ffffff", o.holding ? 0.45 : 0.22);
    ctx.stroke();
    chevrons(ctx, o, tx, tw, yTop, tailBottom);
  }

  ctx.globalAlpha = alpha;
  const body = ctx.createLinearGradient(0, headTop, 0, yBottom);
  body.addColorStop(0, "rgba(255,255,255,0.3)");
  body.addColorStop(0.35, withAlpha(color, o.holding ? 0.55 : 0.3));
  body.addColorStop(1, withAlpha(color, o.holding ? 0.85 : 0.55));
  ctx.fillStyle = body;
  roundRect(ctx, lane.x, headTop, lane.w, headH, r);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(lane.x + lane.w * 0.15, yBottom);
  ctx.lineTo(lane.x + lane.w * 0.45, yBottom);
  ctx.lineTo(lane.x + lane.w * 0.85, headTop);
  ctx.lineTo(lane.x + lane.w * 0.55, headTop);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  roundRect(ctx, lane.x, headTop, lane.w, headH, r);
  if (o.target || o.missed) outline(ctx, o, lane.x, headTop, lane.w, headH, r);
  else {
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = withAlpha("#ffffff", o.holding ? 0.9 : 0.6);
    ctx.stroke();
  }
}

/** Fully rounded pill for the whole length with a glossy highlight line. */
function capsule(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#6b6f8e" : o.color;
  const height = yBottom - yTop;
  const r = Math.min(lane.w / 2, height / 2);
  wholeGlow(ctx, o, color);
  ctx.globalAlpha = alpha;
  const across = ctx.createLinearGradient(lane.x, 0, lane.x + lane.w, 0);
  across.addColorStop(0, shade(color, -0.35));
  across.addColorStop(0.45, shade(color, o.holding ? 0.55 : 0.3));
  across.addColorStop(1, shade(color, -0.4));
  ctx.fillStyle = across;
  roundRect(ctx, lane.x, yTop, lane.w, height, r);
  ctx.fill();
  if (o.long) {
    const fade = ctx.createLinearGradient(0, yTop, 0, yBottom);
    fade.addColorStop(0, "rgba(9,11,28,0.55)");
    fade.addColorStop(0.6, "rgba(9,11,28,0)");
    ctx.fillStyle = fade;
    ctx.fill();
  }
  if (height > r * 2 + 4) {
    ctx.fillStyle = `rgba(255,255,255,${o.holding ? 0.7 : 0.45})`;
    ctx.fillRect(lane.x + lane.w * 0.28, yTop + r, Math.max(1.5, lane.w * 0.08), height - r * 2);
  }
  if (o.holding) chevrons(ctx, o, lane.x + lane.w * 0.15, lane.w * 0.7, yTop + r, yBottom - r);
  if (o.glow > 0) {
    const cap = ctx.createRadialGradient(lane.x + lane.w / 2, yBottom, 0, lane.x + lane.w / 2, yBottom, lane.w * 0.6);
    cap.addColorStop(0, "rgba(255,255,255,0.7)");
    cap.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(lane.x + lane.w / 2, yBottom - 1, lane.w * 0.45, Math.min(6, height * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  outline(ctx, o, lane.x, yTop, lane.w, height, r);
}

/** Retro 8-bit blocks: notched corners, hard bevels, a tail of squares. */
function pixel(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#5b5f7a" : o.color;
  const height = yBottom - yTop;
  const headH = Math.round(headHeight("pixel", lane.w, height, o.long));
  const headTop = Math.round(yBottom - headH);
  const x = Math.round(lane.x);
  const w = Math.round(lane.w);
  const px = Math.max(2, Math.round(w / 9));

  ctx.globalAlpha = alpha;
  if (o.long && height > headH + 2) {
    const tw = Math.max(px * 2, Math.round(w * 0.5 / px) * px);
    const tx = x + Math.round((w - tw) / 2 / px) * px;
    ctx.fillStyle = withAlpha(color, o.holding ? 0.9 : 0.55);
    for (let y = headTop - px - tw; y > yTop - tw; y -= tw + px) {
      const top = Math.max(yTop, y);
      ctx.fillRect(tx, top, tw, y + tw - top);
    }
  }
  const notched = (sx: number, sy: number, sw: number, sh: number) => {
    ctx.beginPath();
    ctx.moveTo(sx + px, sy);
    ctx.lineTo(sx + sw - px, sy);
    ctx.lineTo(sx + sw - px, sy + px);
    ctx.lineTo(sx + sw, sy + px);
    ctx.lineTo(sx + sw, sy + sh - px);
    ctx.lineTo(sx + sw - px, sy + sh - px);
    ctx.lineTo(sx + sw - px, sy + sh);
    ctx.lineTo(sx + px, sy + sh);
    ctx.lineTo(sx + px, sy + sh - px);
    ctx.lineTo(sx, sy + sh - px);
    ctx.lineTo(sx, sy + px);
    ctx.lineTo(sx + px, sy + px);
    ctx.closePath();
  };
  if (o.glow > 0 && o.live) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * o.glow * (o.holding ? 0.8 : 0.3);
    ctx.drawImage(glowSprite(color, 64), x - w * 0.4, headTop - 8, w * 1.8, headH + 16);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
  }
  ctx.fillStyle = o.holding ? shade(color, 0.3) : color;
  notched(x, headTop, w, headH);
  ctx.fill();
  if (!o.missed && headH > px * 3) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + px, headTop + px, w - px * 3, px);
    ctx.fillRect(x + px, headTop + px, px, headH - px * 3);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + px * 2, headTop + headH - px * 2, w - px * 3, px);
    ctx.fillRect(x + w - px * 2, headTop + px * 2, px, headH - px * 3);
  }
  if (o.target || o.missed) {
    notched(x, headTop, w, headH);
    ctx.lineWidth = 2;
    ctx.strokeStyle = o.target ? `rgba(255,255,255,${0.55 + 0.45 * o.pulse})` : "rgba(251,113,133,0.8)";
    ctx.stroke();
  }
}

/** Diagonal white stripes across a box; the caller clips them to the shape. */
function stripes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, off: number, a: number): void {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  for (let k = -h - 2 * s + off; k < w + h; k += 2 * s) {
    ctx.beginPath();
    ctx.moveTo(x + k, y + h);
    ctx.lineTo(x + k + s, y + h);
    ctx.lineTo(x + k + s + h, y);
    ctx.lineTo(x + k + h, y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Glossy sweets with moving candy-cane stripes. */
function candy(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#6b6f8e" : o.color;
  const height = yBottom - yTop;
  const headH = headHeight("candy", lane.w, height, o.long);
  const headTop = yBottom - headH;
  const cx = lane.x + lane.w / 2;
  const r = Math.min(10, lane.w * 0.45, headH / 2);
  const s = Math.max(4, lane.w * 0.2);
  const off = o.missed ? 0 : (o.now * 0.025) % (2 * s);

  halo(ctx, o, headTop, headH);

  if (o.long && height > headH + 2) {
    const tw = Math.max(6, lane.w * 0.6);
    const tx = cx - tw / 2;
    const tailBottom = headTop + headH * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = shade(color, o.holding ? 0.25 : 0, 0.85);
    roundRect(ctx, tx, yTop, tw, tailBottom - yTop, tw / 2);
    ctx.fill();
    ctx.save();
    ctx.clip();
    stripes(ctx, tx, yTop, tw, tailBottom - yTop, s, off, 0.3);
    const fade = ctx.createLinearGradient(0, yTop, 0, tailBottom);
    fade.addColorStop(0, "rgba(9,11,28,0.6)");
    fade.addColorStop(0.6, "rgba(9,11,28,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(tx, yTop, tw, tailBottom - yTop);
    ctx.restore();
  }

  ctx.globalAlpha = alpha;
  const body = ctx.createLinearGradient(0, headTop, 0, yBottom);
  body.addColorStop(0, shade(color, 0.5));
  body.addColorStop(1, shade(color, o.holding ? 0.15 : -0.2));
  ctx.fillStyle = body;
  roundRect(ctx, lane.x, headTop, lane.w, headH, r);
  ctx.fill();
  ctx.save();
  ctx.clip();
  stripes(ctx, lane.x, headTop, lane.w, headH, s, off, o.missed ? 0.12 : 0.38);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  roundRect(ctx, lane.x + lane.w * 0.15, headTop + 2, lane.w * 0.7, Math.max(3, headH * 0.3), r);
  ctx.fill();
  ctx.restore();
  outline(ctx, o, lane.x, headTop, lane.w, headH, r);
}

/** Faceted gem-stone head on a thin light beam. */
function crystal(ctx: CanvasRenderingContext2D, o: NoteDraw): void {
  const { lane, yTop, yBottom, alpha } = o;
  const color = o.missed ? "#7a7f9e" : o.color;
  const height = yBottom - yTop;
  const headH = headHeight("crystal", lane.w, height, o.long);
  const headTop = yBottom - headH;
  const cx = lane.x + lane.w / 2;
  const cy = headTop + headH / 2;
  const bevel = Math.min(headH * 0.32, lane.w * 0.4);

  halo(ctx, o, headTop, headH);

  if (o.long && height > headH + 2) {
    const tw = Math.max(3, lane.w * (o.holding ? 0.3 : 0.2));
    ctx.globalAlpha = alpha;
    const beam = ctx.createLinearGradient(0, yTop, 0, headTop);
    beam.addColorStop(0, withAlpha(color, 0.1));
    beam.addColorStop(1, withAlpha(color, o.holding ? 0.95 : 0.6));
    ctx.fillStyle = beam;
    roundRect(ctx, cx - tw / 2, yTop, tw, headTop - yTop + 2, tw / 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${o.holding ? 0.8 : 0.45})`;
    ctx.fillRect(cx - 0.75, yTop + 4, 1.5, Math.max(0, headTop - yTop - 4));
    chevrons(ctx, o, lane.x + lane.w * 0.2, lane.w * 0.6, yTop, headTop);
  }

  const pts: [number, number][] = [
    [cx, headTop],
    [lane.x + lane.w, headTop + bevel],
    [lane.x + lane.w, yBottom - bevel],
    [cx, yBottom],
    [lane.x, yBottom - bevel],
    [lane.x, headTop + bevel],
  ];
  const k = 0.45;
  const inner = pts.map(([px, py]) => [cx + (px - cx) * k, cy + (py - cy) * k] as [number, number]);
  const poly = (p: [number, number][]) => {
    ctx.beginPath();
    p.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
  };
  ctx.globalAlpha = alpha;
  const body = ctx.createLinearGradient(lane.x, headTop, lane.x + lane.w, yBottom);
  body.addColorStop(0, shade(color, o.holding ? 0.7 : 0.5));
  body.addColorStop(0.5, shade(color, o.holding ? 0.2 : 0));
  body.addColorStop(1, shade(color, -0.45));
  ctx.fillStyle = body;
  poly(pts);
  ctx.fill();
  ctx.fillStyle = shade(color, o.holding ? 0.8 : 0.6, 0.85);
  poly(inner);
  ctx.fill();
  if (!o.missed && lane.w >= 10) {
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(inner[i][0], inner[i][1]);
    }
    ctx.stroke();
  }
  poly(pts);
  if (o.target) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * o.pulse})`;
  } else if (o.missed) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(251,113,133,0.8)";
  } else {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = shade(color, 0.7, 0.9);
  }
  ctx.stroke();
}
