import type { Background } from "./appearance";
import { COLORS, glowSprite } from "./theme";

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function stars(g: CanvasRenderingContext2D, w: number, h: number, density: number, maxAlpha: number, seed: number): void {
  const rnd = rng(seed);
  for (let i = 0; i < Math.round((w * h) / density); i++) {
    const big = rnd() < 0.08;
    const tint = rnd();
    const rgb = tint < 0.15 ? "255,226,190" : tint < 0.35 ? "180,200,255" : "225,230,255";
    g.fillStyle = `rgba(${rgb},${0.05 + rnd() * maxAlpha})`;
    const s = big ? 1.6 : 1;
    g.fillRect(rnd() * w, rnd() * h * 0.92, s, s);
  }
}

function nebula(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},${a})`);
  grad.addColorStop(0.45, `rgba(${rgb},${a * 0.45})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function vertical(g: CanvasRenderingContext2D, h: number, stops: string[]): CanvasGradient {
  const grad = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  return grad;
}

const synthHorizon = (h: number) => h * 0.34;

/** The still part of a backdrop; painted once per size into a cached canvas. */
export function paintBackdrop(g: CanvasRenderingContext2D, w: number, h: number, bg: Background): void {
  const big = Math.max(w, h);
  if (bg === "plain") {
    g.fillStyle = "#090b17";
    g.fillRect(0, 0, w, h);
    return;
  }
  if (bg === "space") {
    g.fillStyle = vertical(g, h, ["#02030b", "#060a20", "#0d0826"]);
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    const rnd = rng(11);
    const clouds: [string, number][] = [
      ["124,58,237", 0.22],
      ["37,99,235", 0.18],
      ["219,39,119", 0.13],
      ["14,165,233", 0.12],
      ["139,92,246", 0.16],
    ];
    for (const [rgb, a] of clouds) nebula(g, rnd() * w, rnd() * h * 0.8, big * (0.28 + rnd() * 0.3), rgb, a);
    // A faint galactic band across the sky.
    g.save();
    g.translate(w / 2, h * 0.4);
    g.rotate(-0.5);
    const band = g.createLinearGradient(0, -big * 0.12, 0, big * 0.12);
    band.addColorStop(0, "rgba(200,190,255,0)");
    band.addColorStop(0.5, "rgba(200,190,255,0.07)");
    band.addColorStop(1, "rgba(200,190,255,0)");
    g.fillStyle = band;
    g.fillRect(-big, -big * 0.12, big * 2, big * 0.24);
    for (let i = 0; i < big * 1.2; i++) {
      g.fillStyle = `rgba(230,230,255,${0.08 + rnd() * 0.3})`;
      g.fillRect((rnd() - 0.5) * big * 2, (rnd() + rnd() - 1) * big * 0.1, 1, 1);
    }
    g.restore();
    g.globalCompositeOperation = "source-over";
    stars(g, w, h, 1800, 0.55, 3);
    return;
  }
  if (bg === "aurora") {
    g.fillStyle = vertical(g, h, ["#020712", "#05112a", "#0a1024"]);
    g.fillRect(0, 0, w, h);
    stars(g, w, h, 4000, 0.4, 5);
    g.globalCompositeOperation = "lighter";
    nebula(g, w * 0.5, h * 1.05, big * 0.6, "56,189,248", 0.08);
    g.globalCompositeOperation = "source-over";
    return;
  }
  if (bg === "synth") {
    const hz = synthHorizon(h);
    g.fillStyle = vertical(g, h, ["#07021a", "#1a0638", "#2a0a3e", "#12041f"]);
    g.fillRect(0, 0, w, h);
    stars(g, w, hz, 2500, 0.5, 9);
    // Striped sun sitting on the horizon.
    const sr = Math.min(w * 0.22, hz * 0.8);
    const sun = g.createLinearGradient(0, hz - sr, 0, hz);
    sun.addColorStop(0, "rgba(253,224,71,0.38)");
    sun.addColorStop(1, "rgba(236,72,153,0.32)");
    g.save();
    g.beginPath();
    g.arc(w / 2, hz, sr, Math.PI, 0);
    g.closePath();
    g.clip();
    g.fillStyle = sun;
    g.fillRect(w / 2 - sr, hz - sr, sr * 2, sr);
    g.fillStyle = "#1a0638";
    for (let i = 0; i < 6; i++) {
      const y = hz - sr * 0.08 - i * sr * 0.12;
      g.fillRect(w / 2 - sr, y, sr * 2, Math.max(1, 3 - i * 0.4));
    }
    g.restore();
    g.globalCompositeOperation = "lighter";
    nebula(g, w / 2, hz, sr * 2.2, "236,72,153", 0.12);
    g.globalCompositeOperation = "source-over";
    // Floor lines running to the vanishing point.
    g.strokeStyle = "rgba(236,72,153,0.2)";
    g.lineWidth = 1;
    for (let i = -14; i <= 14; i++) {
      g.beginPath();
      g.moveTo(w / 2 + i * 6, hz);
      g.lineTo(w / 2 + i * (w / 5), h);
      g.stroke();
    }
    g.fillStyle = "rgba(244,114,182,0.45)";
    g.fillRect(0, hz, w, 1);
    return;
  }
  // Night (default).
  g.fillStyle = vertical(g, h, [COLORS.bgTop, COLORS.bgBottom]);
  g.fillRect(0, 0, w, h);
  stars(g, w, h, 9000, 0.12, 7);
}

interface Twinkle {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
}

/** The moving part of a backdrop, drawn every frame between the cached backdrop and the lanes. */
export class BackdropAnimator {
  private twinkles: Twinkle[] = [];
  private key = "";
  private shot: { x: number; y: number; vx: number; vy: number; born: number } | null = null;
  private nextShot = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, bg: Background, now: number): void {
    if (bg === "space") this.space(ctx, w, h, now);
    else if (bg === "aurora") this.aurora(ctx, w, h, now);
    else if (bg === "synth") this.synth(ctx, w, h, now);
  }

  private ensureTwinkles(w: number, h: number, count: number, seed: number): void {
    const key = `${w}x${h}:${count}:${seed}`;
    if (key === this.key) return;
    this.key = key;
    const rnd = rng(seed);
    this.twinkles = Array.from({ length: count }, () => ({
      x: rnd() * w,
      y: rnd() * h * 0.9,
      size: 1 + rnd() * 2.2,
      phase: rnd() * Math.PI * 2,
      speed: 0.6 + rnd() * 1.8,
    }));
  }

  private space(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    this.ensureTwinkles(w, h, Math.round(Math.min(70, (w * h) / 12000)), 21);
    ctx.globalCompositeOperation = "lighter";
    for (const s of this.twinkles) {
      const a = 0.5 + 0.5 * Math.sin(now * 0.001 * s.speed + s.phase);
      ctx.globalAlpha = 0.15 + a * 0.75;
      const d = s.size * (2.5 + a * 2);
      ctx.drawImage(glowSprite("#dbe4ff", 32), s.x - d / 2, s.y - d / 2, d, d);
      if (s.size > 2.6) {
        ctx.fillStyle = `rgba(230,236,255,${0.35 * a})`;
        ctx.fillRect(s.x - d, s.y - 0.5, d * 2, 1);
        ctx.fillRect(s.x - 0.5, s.y - d, 1, d * 2);
      }
    }
    // An occasional shooting star.
    if (!this.shot && now > this.nextShot) {
      const fromLeft = Math.random() < 0.5;
      this.shot = { x: fromLeft ? Math.random() * w * 0.5 : w * (0.5 + Math.random() * 0.5), y: Math.random() * h * 0.35, vx: fromLeft ? 900 : -900, vy: 380, born: now };
      this.nextShot = now + 5000 + Math.random() * 7000;
    }
    if (this.shot) {
      const age = (now - this.shot.born) / 1000;
      if (age > 0.8) this.shot = null;
      else {
        const x = this.shot.x + this.shot.vx * age;
        const y = this.shot.y + this.shot.vy * age;
        const tail = 0.12;
        const g = ctx.createLinearGradient(x, y, x - this.shot.vx * tail, y - this.shot.vy * tail);
        const a = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.65;
        g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - this.shot.vx * tail, y - this.shot.vy * tail);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private aurora(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    const ribbons: [string, number, number][] = [
      ["52,211,153", 0.1, 0],
      ["34,211,238", 0.2, 2.1],
      ["167,139,250", 0.3, 4.2],
    ];
    ctx.globalCompositeOperation = "lighter";
    const step = Math.max(16, w / 40);
    for (const [rgb, yFrac, seed] of ribbons) {
      const base = h * yFrac;
      const amp = Math.min(40, h * 0.06);
      const depth = Math.min(260, h * 0.38);
      const tt = now * 0.00035;
      const yAt = (x: number) =>
        base + Math.sin(x * 0.006 + tt * (1 + seed * 0.1) + seed) * amp + Math.sin(x * 0.017 - tt * 1.7 + seed) * amp * 0.45;
      ctx.beginPath();
      ctx.moveTo(0, yAt(0));
      for (let x = step; x <= w + step; x += step) ctx.lineTo(x, yAt(x));
      for (let x = w + step; x >= 0; x -= step) ctx.lineTo(x, yAt(x) + depth * (0.7 + 0.3 * Math.sin(x * 0.01 + tt * 2 + seed)));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - amp, 0, base + depth);
      g.addColorStop(0, `rgba(${rgb},0)`);
      g.addColorStop(0.12, `rgba(${rgb},0.18)`);
      g.addColorStop(0.45, `rgba(${rgb},0.06)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private synth(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    const hz = synthHorizon(h);
    const lines = 12;
    for (let k = 0; k < lines; k++) {
      const p = (k / lines + now * 0.00022) % 1;
      const y = hz + (h - hz) * p * p;
      ctx.fillStyle = `rgba(236,72,153,${0.06 + 0.3 * p})`;
      ctx.fillRect(0, y, w, p > 0.5 ? 2 : 1);
    }
  }
}
