import { cueSwatch, type CueColor, type LampStyle } from "./cue";
import { mixHex, withAlpha } from "./theme";

export interface LampHit {
  midi: number;
  p: number;
  flash: boolean;
}

/** Where a key's light sits in viewport pixels, after the player scales and slides the row. */
export function lampSpot(
  lane: { x: number; w: number },
  originX: number,
  width: number,
  scale: number,
  shift: number
): { x: number; w: number } {
  const s = Math.max(0.25, Math.min(1, scale));
  const cx = width / 2 + (lane.x + lane.w / 2 - width / 2) * s + shift * width * 0.42;
  const w = Math.max(4, lane.w * s);
  return { x: originX + cx - w / 2, w };
}

export function paintKeyLamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spots: { x: number; w: number; p: number; flash: boolean; midi: number; color: string }[],
  style: LampStyle,
  level: number,
  now: number
): void {
  ctx.clearRect(0, 0, width, height);
  if (!spots.length) return;
  const gain = Math.max(0.2, Math.min(1, level));
  ctx.globalCompositeOperation = "lighter";
  for (const s of spots) {
    const flash = s.flash;
    const a = gain * (flash ? 1 : 0.18 + 0.55 * s.p);
    const ink = style === "rainbow" ? cueSwatch(RAINBOW[(s.midi % 12) % RAINBOW.length] ?? "gold") : s.color;
    const hot = flash ? mixHex(ink, "#ffffff", 0.62) : ink;
    const x = s.x;
    const w = s.w;
    if (style === "bar") {
      ctx.fillStyle = withAlpha(hot, 0.55 * a);
      ctx.fillRect(x, height - 10, w, 10);
      ctx.fillStyle = withAlpha(ink, 0.35 * a);
      ctx.fillRect(x, height - 28, w, 18);
    } else if (style === "bloom" || style === "rainbow") {
      const g = ctx.createRadialGradient(x + w / 2, height, 2, x + w / 2, height, w * (flash ? 1.8 : 1.1));
      g.addColorStop(0, withAlpha(hot, 0.95 * a));
      g.addColorStop(0.45, withAlpha(ink, 0.45 * a));
      g.addColorStop(1, withAlpha(ink, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w, height - w * 2, w * 3, w * 2);
    } else if (style === "spark") {
      const flick = 0.65 + 0.35 * Math.sin(now / (flash ? 40 : 90) + s.midi);
      ctx.fillStyle = withAlpha(hot, a * flick);
      ctx.fillRect(x + w * 0.35, height - (flash ? 36 : 14 + 16 * s.p), w * 0.3, flash ? 36 : 14);
      ctx.fillStyle = withAlpha("#ffffff", 0.8 * a * flick);
      ctx.fillRect(x + w * 0.42, height - 8, Math.max(2, w * 0.16), 8);
    } else {
      const reach = height * (flash ? 1 : 0.35 + 0.5 * s.p);
      const g = ctx.createLinearGradient(0, height, 0, height - reach);
      g.addColorStop(0, withAlpha(hot, 0.95 * a));
      g.addColorStop(0.35, withAlpha(ink, 0.4 * a));
      g.addColorStop(1, withAlpha(ink, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w * 0.25, height - reach, w * 1.5, reach);
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

const RAINBOW: CueColor[] = ["rose", "amber", "gold", "lime", "cyan", "violet", "ice", "white"];
