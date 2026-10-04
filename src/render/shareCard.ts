import { JUDGEMENT_COLORS, roundRect, withAlpha } from "./theme";

export interface CardNote {
  time: number;
  duration: number;
  midi: number;
  /** perfect / great / good / miss, or null when the note wasn't reached. */
  judgement: string | null;
}

export interface ShareCardData {
  title: string;
  subtitle: string;
  stars: number;
  score: number;
  accuracy: number;
  maxCombo: number;
  streak: number;
  date: string;
  badges: string[];
  notes: CardNote[];
  labels: { score: string; accuracy: string; combo: string; streak: string; cta: string };
}

export const CARD_W = 1080;
export const CARD_H = 1350;

const FONT = `"Inter", "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Splits text into at most `max` lines that fit `width`, ending with an ellipsis when cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** The run's notes as a little piano roll: time left to right, pitch bottom to top, coloured by how each went. */
function drawRoll(ctx: CanvasRenderingContext2D, notes: CardNote[], x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x, y, w, h, 36);
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (!notes.length) return;
  const pad = 36;
  const t0 = notes[0].time;
  const t1 = Math.max(...notes.map((n) => n.time + n.duration));
  let lo = Math.min(...notes.map((n) => n.midi));
  let hi = Math.max(...notes.map((n) => n.midi));
  if (hi - lo < 12) {
    const mid = (hi + lo) / 2;
    lo = mid - 6;
    hi = mid + 6;
  }
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const rowH = Math.max(8, Math.min(22, ih / (hi - lo + 1)));
  const sx = iw / Math.max(0.5, t1 - t0);
  const minW = Math.max(rowH * 1.6, Math.min(26, iw / notes.length));
  ctx.save();
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 34);
  ctx.clip();
  for (const n of notes) {
    const nx = x + pad + (n.time - t0) * sx;
    const nw = Math.max(minW, n.duration * sx - 2);
    const ny = y + pad + ((hi - n.midi) / (hi - lo + 1)) * (ih - rowH * 0.82);
    const color = n.judgement ? JUDGEMENT_COLORS[n.judgement] ?? "#a78bfa" : "#5b5f86";
    const missed = n.judgement === "miss";
    ctx.shadowColor = withAlpha(color, missed ? 0.3 : 0.75);
    ctx.shadowBlur = missed ? 6 : 16;
    roundRect(ctx, nx, ny, nw, rowH * 0.82, rowH * 0.35);
    ctx.fillStyle = withAlpha(color, missed ? 0.55 : n.judgement ? 0.95 : 0.4);
    ctx.fill();
  }
  ctx.restore();
}

/** A shareable picture of a finished run (1080 × 1350). */
export async function drawShareCard(d: ShareCardData): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d")!;
  const W = CARD_W;

  const bg = ctx.createLinearGradient(0, 0, W * 0.4, CARD_H);
  bg.addColorStop(0, "#0b0e24");
  bg.addColorStop(0.55, "#16123a");
  bg.addColorStop(1, "#0a1630");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, CARD_H);
  for (const [gx, gy, r, color] of [
    [140, 120, 520, "rgba(139,92,246,0.35)"],
    [W - 60, CARD_H - 160, 560, "rgba(34,211,238,0.22)"],
    [W - 200, 420, 360, "rgba(244,63,94,0.12)"],
  ] as const) {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, CARD_H);
  }

  // Brand row.
  const logo = await loadImage(`${import.meta.env.BASE_URL}icons/icon-192.png`);
  if (logo) {
    ctx.save();
    roundRect(ctx, 72, 64, 84, 84, 22);
    ctx.clip();
    ctx.drawImage(logo, 72, 64, 84, 84);
    ctx.restore();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 46px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Sonatrio", logo ? 176 : 72, 106);
  ctx.fillStyle = "rgba(230,233,255,0.6)";
  ctx.font = `600 30px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(d.date, W - 72, 106);
  ctx.textAlign = "left";

  drawRoll(ctx, d.notes, 72, 196, W - 144, 360);

  // Title and subtitle.
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 64px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  const lines = wrap(ctx, d.title, W - 144, 2);
  let y = 660;
  for (const l of lines) {
    ctx.fillText(l, 72, y);
    y += 74;
  }
  ctx.fillStyle = "rgba(230,233,255,0.65)";
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText(d.subtitle, 72, y - 18);
  y += 40;

  // Stars, then the score.
  for (let i = 0; i < 5; i++) {
    const on = i < d.stars;
    starPath(ctx, 72 + 38 + i * 88, y + 30, 36);
    ctx.shadowColor = on ? "rgba(252,211,77,0.7)" : "transparent";
    ctx.shadowBlur = on ? 22 : 0;
    ctx.fillStyle = on ? "#fcd34d" : "rgba(255,255,255,0.12)";
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 96px ${FONT}`;
  ctx.fillText(d.score.toLocaleString(), W - 72, y + 62);
  ctx.fillStyle = "rgba(230,233,255,0.55)";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(d.labels.score.toUpperCase(), W - 72, y + 98);
  ctx.textAlign = "left";
  y += 140;

  // Three stat tiles.
  const tiles: [string, string, string][] = [
    [`${Math.round(d.accuracy * 100)}%`, d.labels.accuracy, "#7dd3fc"],
    [String(d.maxCombo), d.labels.combo, "#c4b5fd"],
    [String(d.streak), d.labels.streak, "#fdba74"],
  ];
  const gap = 24;
  const tw = (W - 144 - gap * 2) / 3;
  tiles.forEach(([value, label, color], i) => {
    const tx = 72 + i * (tw + gap);
    roundRect(ctx, tx, y, tw, 150, 28);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText(value, tx + 28, y + 78);
    ctx.fillStyle = "rgba(230,233,255,0.6)";
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(label, tx + 28, y + 122);
  });
  y += 190;

  // Badges.
  let bx = 72;
  ctx.font = `700 28px ${FONT}`;
  for (const b of d.badges) {
    const bw = ctx.measureText(b).width + 48;
    if (bx + bw > W - 72) break;
    roundRect(ctx, bx, y, bw, 56, 28);
    ctx.fillStyle = "rgba(52,211,153,0.18)";
    ctx.fill();
    ctx.fillStyle = "#a7f3d0";
    ctx.fillText(b, bx + 24, y + 38);
    bx += bw + 16;
  }

  // Call to action along the bottom.
  const cy = CARD_H - 128;
  const grad = ctx.createLinearGradient(72, 0, W - 72, 0);
  grad.addColorStop(0, "#8b5cf6");
  grad.addColorStop(1, "#22d3ee");
  roundRect(ctx, 72, cy, W - 144, 76, 38);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 32px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(d.labels.cta, W / 2, cy + 49);
  ctx.textAlign = "left";
  return c;
}
