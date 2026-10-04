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
  if (bg === "haze") {
    g.fillStyle = vertical(g, h, ["#030208", "#07040f", "#0a0616"]);
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    const rnd = rng(17);
    for (let i = 0; i < 6; i++) nebula(g, rnd() * w, h * (0.3 + rnd() * 0.75), big * (0.18 + rnd() * 0.22), i % 2 ? "109,40,217" : "139,92,246", 0.1 + rnd() * 0.06);
    for (let i = 0; i < (w * h) / 900; i++) {
      g.fillStyle = `rgba(167,139,250,${0.04 + rnd() * 0.22})`;
      g.fillRect(rnd() * w, rnd() * h, 1, 1);
    }
    g.globalCompositeOperation = "source-over";
    return;
  }
  if (bg === "ocean") {
    g.fillStyle = vertical(g, h, ["#04304d", "#03203a", "#021428", "#010a17"]);
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    // Sunlight shafts from the surface.
    const rnd = rng(23);
    for (let i = 0; i < 7; i++) {
      const x = rnd() * w;
      const spread = 30 + rnd() * 90;
      const ray = g.createLinearGradient(0, 0, 0, h * 0.85);
      ray.addColorStop(0, `rgba(125,211,252,${0.05 + rnd() * 0.05})`);
      ray.addColorStop(1, "rgba(125,211,252,0)");
      g.fillStyle = ray;
      g.beginPath();
      g.moveTo(x - 12, 0);
      g.lineTo(x + 12, 0);
      g.lineTo(x + spread + h * 0.15, h * 0.85);
      g.lineTo(x - spread + h * 0.15, h * 0.85);
      g.closePath();
      g.fill();
    }
    nebula(g, w * 0.5, 0, big * 0.5, "56,189,248", 0.1);
    g.globalCompositeOperation = "source-over";
    return;
  }
  if (bg === "sunset") {
    const hz = h * 0.6;
    g.fillStyle = vertical(g, hz, ["#140b2e", "#3b1856", "#8a2c6b", "#d9506a", "#f59e5b"]);
    g.fillRect(0, 0, w, hz);
    stars(g, w, hz * 0.45, 5000, 0.35, 13);
    g.globalCompositeOperation = "lighter";
    nebula(g, w / 2, hz, Math.min(w, h) * 0.55, "253,186,116", 0.35);
    g.globalCompositeOperation = "source-over";
    const sr = Math.min(w * 0.12, hz * 0.3);
    const sun = g.createLinearGradient(0, hz - sr, 0, hz);
    sun.addColorStop(0, "#fff1c1");
    sun.addColorStop(1, "#fb923c");
    g.fillStyle = sun;
    g.beginPath();
    g.arc(w / 2, hz, sr, Math.PI, 0);
    g.fill();
    // Mountain ridges, far to near.
    const ridges: [string, number, number][] = [
      ["#5a2150", 0.04, 31],
      ["#3a1640", 0.09, 37],
      ["#200d2c", 0.16, 41],
    ];
    for (const [color, rise, seed] of ridges) {
      const rnd = rng(seed);
      const peaks = Array.from({ length: 9 }, () => rnd());
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, h);
      for (let i = 0; i <= 8; i++) {
        const x = (i / 8) * w;
        g.lineTo(x, hz - h * rise * (0.4 + peaks[i]));
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    }
    g.fillStyle = vertical(g, h, ["rgba(16,8,26,0)", "rgba(16,8,26,0)", "#100818"]);
    g.fillRect(0, hz, w, h - hz);
    return;
  }
  if (bg === "city") {
    g.fillStyle = vertical(g, h, ["#03050f", "#0a0d2a", "#1a1340", "#2a1450"]);
    g.fillRect(0, 0, w, h);
    stars(g, w, h * 0.5, 4000, 0.4, 19);
    const mr = Math.min(28, w * 0.04);
    g.globalCompositeOperation = "lighter";
    nebula(g, w * 0.8, h * 0.14, mr * 5, "226,232,255", 0.12);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#e9ecff";
    g.beginPath();
    g.arc(w * 0.8, h * 0.14, mr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#0a0d2a";
    g.beginPath();
    g.arc(w * 0.8 + mr * 0.45, h * 0.14 - mr * 0.2, mr * 0.9, 0, Math.PI * 2);
    g.fill();
    // Two rows of buildings with a few lit windows.
    for (const [depth, seed, color] of [
      [0.42, 43, "#0d0f26"],
      [0.3, 47, "#06071a"],
    ] as [number, number, string][]) {
      const rnd = rng(seed);
      let x = -10;
      while (x < w) {
        const bw = 26 + rnd() * 50;
        const bh = h * depth * (0.35 + rnd() * 0.65);
        g.fillStyle = color;
        g.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 8; wy < h - 6; wy += 9) {
          for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
            if (rnd() < 0.16) {
              g.fillStyle = rnd() < 0.7 ? "rgba(253,224,140,0.32)" : "rgba(125,211,252,0.28)";
              g.fillRect(wx, wy, 3, 4);
            }
          }
        }
        x += bw + 2 + rnd() * 6;
      }
    }
    return;
  }
  if (bg === "matrix") {
    g.fillStyle = vertical(g, h, ["#010604", "#020a06", "#010503"]);
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    nebula(g, w / 2, h, big * 0.5, "34,197,94", 0.06);
    g.globalCompositeOperation = "source-over";
    return;
  }
  // Night (default).
  g.fillStyle = vertical(g, h, [COLORS.bgTop, COLORS.bgBottom]);
  g.fillRect(0, 0, w, h);
  stars(g, w, h, 9000, 0.12, 7);
}

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789♪♫";

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
    else if (bg === "haze") this.haze(ctx, w, h, now);
    else if (bg === "ocean") this.ocean(ctx, w, h, now);
    else if (bg === "sunset") this.sunset(ctx, w, h, now);
    else if (bg === "city") this.city(ctx, w, h, now);
    else if (bg === "matrix") this.matrix(ctx, w, h, now);
  }

  /** Purple dust slowly rising and swaying. */
  private haze(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    this.ensureTwinkles(w, h, Math.round(Math.min(140, (w * h) / 5000)), 29);
    ctx.globalCompositeOperation = "lighter";
    const t = now * 0.001;
    for (const s of this.twinkles) {
      const y = (((s.y - t * 9 * s.speed) % h) + h) % h;
      const x = s.x + Math.sin(t * 0.5 * s.speed + s.phase) * 14;
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.fillStyle = s.size > 2.4 ? "#c4b5fd" : "#8b5cf6";
      ctx.fillRect(x, y, s.size * 0.8, s.size * 0.8);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** Bubbles rising and light rippling under the surface. */
  private ocean(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    this.ensureTwinkles(w, h, Math.round(Math.min(40, (w * h) / 16000)), 31);
    const t = now * 0.001;
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y = 10 + k * 14 + Math.sin(x * 0.02 + t * (0.8 + k * 0.3) + k) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(165,243,252,${0.08 - k * 0.02})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (const s of this.twinkles) {
      const y = (((s.y - t * 30 * s.speed) % h) + h) % h;
      const x = s.x + Math.sin(t * 2 * s.speed + s.phase) * 4;
      ctx.strokeStyle = `rgba(186,230,253,${0.12 + 0.2 * (y / h)})`;
      ctx.beginPath();
      ctx.arc(x, y, s.size * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** Thin clouds drifting across the evening sky. */
  private sunset(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    const t = now * 0.001;
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 4; k++) {
      const cw = w * (0.3 + k * 0.08);
      const x = ((k * 0.31 * w + t * (6 + k * 3)) % (w + cw)) - cw;
      const y = h * (0.12 + k * 0.09);
      const grad = ctx.createLinearGradient(x, 0, x + cw, 0);
      grad.addColorStop(0, "rgba(253,186,116,0)");
      grad.addColorStop(0.5, `rgba(253,186,116,${0.07 + k * 0.015})`);
      grad.addColorStop(1, "rgba(253,186,116,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cw, 3 + k);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** Blinking lights on the rooftops. */
  private city(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    this.ensureTwinkles(w, h, 9, 37);
    ctx.globalCompositeOperation = "lighter";
    for (const s of this.twinkles) {
      const on = Math.sin(now * 0.002 * s.speed + s.phase) > 0.6;
      if (!on) continue;
      const y = h - h * 0.42 * (0.4 + (s.y / h) * 0.6);
      ctx.drawImage(glowSprite("#f87171", 32), s.x - 5, y - 5, 10, 10);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** Columns of falling green glyphs. */
  private matrix(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    const col = 22;
    const cols = Math.ceil(w / col);
    this.ensureTwinkles(cols, h, cols, 41);
    ctx.font = "600 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const t = now * 0.001;
    const trail = 9;
    for (let i = 0; i < this.twinkles.length; i++) {
      const s = this.twinkles[i];
      const head = ((s.y + t * 60 * s.speed) % (h + trail * 16)) - 16;
      for (let k = 0; k < trail; k++) {
        const y = head - k * 16;
        if (y < -10 || y > h + 10) continue;
        const a = (k === 0 ? 0.45 : 0.22) * (1 - k / trail);
        ctx.fillStyle = k === 0 ? `rgba(187,247,208,${a})` : `rgba(34,197,94,${a})`;
        const g = GLYPHS[(Math.floor(t * 4 * s.speed) + i * 7 + k * 3) % GLYPHS.length];
        ctx.fillText(g, i * col + col / 2, y);
      }
    }
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
