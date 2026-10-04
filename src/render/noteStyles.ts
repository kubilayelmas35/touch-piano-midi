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

/** Height of the head block of a long note (short notes are all head). */
export function headHeight(style: NoteStyle, laneW: number, height: number, long: boolean): number {
  if (!long || style === "classic") return height;
  return Math.min(height, Math.max(18, Math.min(34, laneW * 0.85)));
}

export function drawNote(ctx: CanvasRenderingContext2D, style: NoteStyle, o: NoteDraw): void {
  if (style === "neon") neon(ctx, o);
  else if (style === "classic") classic(ctx, o);
  else if (style === "minimal") minimal(ctx, o);
  else gem(ctx, o);
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
