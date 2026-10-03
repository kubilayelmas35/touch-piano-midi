import type { Engine } from "../engine/engine";
import type { FretLayout, PianoLayout } from "../engine/layout";
import { NoteState, type PlayNote } from "../engine/types";
import { HAND_SPLIT } from "../midi/song";
import { isBlack, noteName, type NoteNaming } from "../lib/notes";
import {
  COLORS,
  GUITAR_STRING_COLORS,
  JUDGEMENT_COLORS,
  TRACK_COLORS,
  VIOLIN_STRING_COLORS,
  glowSprite,
  roundRect,
  withAlpha,
} from "./theme";

export interface HighwayView {
  t: number;
  fallSeconds: number;
  piano: PianoLayout | null;
  fret: FretLayout | null;
  naming: NoteNaming;
  showNames: boolean;
  effects: boolean;
  labels: Record<string, string>;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

interface Popup {
  text: string;
  color: string;
  x: number;
  born: number;
}

const MAX_PARTICLES = 400;

export class Highway {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = "";
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private lastFxAt = 0;
  private lastFrame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly engine: Engine
  ) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
  }

  resize(w: number, h: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.bgKey = "";
  }

  /** Clears effects (e.g. after seeking). */
  resetEffects(): void {
    this.particles = [];
    this.popups = [];
    this.lastFxAt = performance.now();
  }

  private ensureBackground(view: HighwayView): void {
    const key = `${this.w}x${this.h}@${this.dpr}|${view.piano ? `p${view.piano.low}-${view.piano.high}` : ""}|${
      view.fret ? `f${view.fret.columns}` : ""
    }`;
    if (key === this.bgKey && this.bg) return;
    this.bgKey = key;
    const c = this.bg ?? document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext("2d")!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, COLORS.bgTop);
    grad.addColorStop(1, COLORS.bgBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);

    // Faint stars for depth.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < Math.round((this.w * this.h) / 9000); i++) {
      g.fillStyle = `rgba(200,210,255,${0.04 + rnd() * 0.12})`;
      g.fillRect(rnd() * this.w, rnd() * this.h * 0.85, 1, 1);
    }

    if (view.piano) {
      const p = view.piano;
      for (let m = p.low; m <= p.high; m++) {
        const lane = p.lane(m)!;
        if (lane.black) {
          g.fillStyle = COLORS.laneBlack;
          g.fillRect(lane.x, 0, lane.w, this.h);
        }
        if (!isBlack(m) && (m % 12 === 0 || m % 12 === 5)) {
          g.fillStyle = m % 12 === 0 ? COLORS.octaveLine : COLORS.laneLine;
          g.fillRect(Math.round(lane.x), 0, 1, this.h);
        }
      }
    } else if (view.fret) {
      const f = view.fret;
      for (let i = 0; i <= f.columns; i++) {
        g.fillStyle = i === 1 ? "rgba(255,255,255,0.16)" : COLORS.laneLine;
        g.fillRect(Math.round(i * f.colW), 0, i === 1 ? 2 : 1, this.h);
      }
      for (const fret of [3, 5, 7, 9, 12, 15]) {
        if (fret >= f.columns) continue;
        g.fillStyle = COLORS.lane;
        g.fillRect(fret * f.colW, 0, f.colW, this.h);
      }
    }
    this.bg = c;
  }

  private noteColor(n: PlayNote): string {
    const e = this.engine;
    if (n.string >= 0) {
      const colors = e.config.instrument === "violin" ? VIOLIN_STRING_COLORS : GUITAR_STRING_COLORS;
      return colors[n.string % colors.length];
    }
    const tracks = e.config.playTracks;
    const idx = tracks.length > 1 ? Math.max(0, tracks.indexOf(n.track)) : n.midi >= HAND_SPLIT ? 0 : 1;
    const pair = TRACK_COLORS[idx % TRACK_COLORS.length];
    return isBlack(n.midi) ? pair[1] : pair[0];
  }

  private laneOf(n: PlayNote, view: HighwayView): { x: number; w: number } | null {
    if (view.fret) {
      if (n.fret < 0) return null;
      const col = view.fret.column(n.fret);
      const pad = Math.min(6, col.w * 0.12);
      return { x: col.x + pad, w: col.w - pad * 2 };
    }
    if (view.piano) {
      const lane = view.piano.lane(n.midi);
      if (!lane) return null;
      const pad = lane.black ? 0.5 : Math.min(3, lane.w * 0.08);
      return { x: lane.x + pad, w: lane.w - pad * 2 };
    }
    return null;
  }

  draw(view: HighwayView): void {
    const { ctx, engine } = this;
    if (!this.w || !this.h) return;
    const now = performance.now();
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now;
    this.ensureBackground(view);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg!, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const { t } = view;
    const hitY = this.h - 2;
    const pps = (this.h - 8) / Math.max(0.5, view.fallSeconds);
    const yOf = (time: number) => hitY - (time - t) * pps;

    // Loop band.
    const loop = engine.config.loop;
    if (loop.b - loop.a > 0.25) {
      const yA = yOf(loop.a);
      const yB = yOf(loop.b);
      if (yB < this.h && yA > 0) {
        ctx.fillStyle = loop.enabled ? COLORS.loop : "rgba(56,189,248,0.04)";
        ctx.fillRect(0, Math.max(0, yB), this.w, Math.min(this.h, yA) - Math.max(0, yB));
        ctx.fillStyle = loop.enabled ? COLORS.loopEdge : "rgba(56,189,248,0.3)";
        if (yA > 0 && yA < this.h) ctx.fillRect(0, yA - 1, this.w, 2);
        if (yB > 0 && yB < this.h) ctx.fillRect(0, yB - 1, this.w, 2);
      }
    }

    // Beat + measure lines.
    const grid = engine.grid;
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textBaseline = "bottom";
    let measureNo = 0;
    for (let i = 0; i < grid.length; i++) {
      const b = grid[i];
      if (b.downbeat && b.time >= -0.001) measureNo++;
      if (b.time < t - 0.2) continue;
      if (b.time > t + view.fallSeconds) break;
      const y = Math.round(yOf(b.time));
      ctx.fillStyle = b.downbeat ? COLORS.measure : COLORS.beat;
      ctx.fillRect(0, y, this.w, 1);
      if (b.downbeat && b.time >= 0) {
        ctx.fillStyle = "rgba(167,139,250,0.55)";
        ctx.fillText(String(measureNo), 4, y - 2);
      }
    }

    // Notes.
    const [i0, i1] = engine.visibleRange(t - 0.3, t + view.fallSeconds + 0.05);
    const notes = engine.notes;
    const win = (engine.config.timingWindowMs / 1000) * engine.config.speed;
    const waitGroup = engine.waiting ? notes.find((n) => n.state === NoteState.Pending)?.group ?? -1 : -1;
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, hitY);
    ctx.clip();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = i0; i < i1; i++) {
      const n = notes[i];
      const lane = this.laneOf(n, view);
      if (!lane) continue;
      const yBottom = yOf(n.time);
      const height = Math.max(10, n.duration * pps - 2);
      const yTop = yBottom - height;
      if (yTop > hitY || yBottom < -4) continue;
      const color = this.noteColor(n);
      const sounding = n.time <= t && t < n.time + n.duration;
      let alpha = 1;
      let fill = color;
      if (n.state === NoteState.Missed) {
        fill = "#5b5f7a";
        alpha = 0.75;
      } else if (n.state === NoteState.Skipped) {
        alpha = 0.25;
      } else if (n.state === NoteState.Hit && !sounding) {
        alpha = Math.max(0.15, 1 - (now - n.resolvedAt) / 500);
      }
      const r = Math.min(7, lane.w * 0.3);
      ctx.globalAlpha = alpha;

      if (n.state === NoteState.Hit && sounding) {
        ctx.globalCompositeOperation = "lighter";
        const s = glowSprite(color, 64);
        ctx.drawImage(s, lane.x - lane.w * 0.4, yTop - 10, lane.w * 1.8, height + 20);
        ctx.globalCompositeOperation = "source-over";
      }

      const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
      grad.addColorStop(0, withAlpha(fill, 0.78));
      grad.addColorStop(1, fill);
      ctx.fillStyle = grad;
      roundRect(ctx, lane.x, yTop, lane.w, height, r);
      ctx.fill();

      const isTarget =
        n.state === NoteState.Pending && (n.group === waitGroup || Math.abs(n.time - t) <= win);
      if (isTarget) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * pulse})`;
        ctx.stroke();
      } else if (n.state === NoteState.Missed) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(251,113,133,0.8)";
        ctx.stroke();
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.stroke();
      }

      // Label.
      if (view.fret && lane.w >= 14) {
        const label = String(n.fret);
        const fs = Math.min(15, Math.max(10, lane.w * 0.42));
        ctx.font = `800 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(10,12,30,0.88)";
        const ly = Math.min(yBottom - fs * 0.75, Math.max(yTop + fs * 0.75, yBottom - fs * 0.75));
        ctx.fillText(label, lane.x + lane.w / 2, ly);
      } else if (view.showNames && lane.w >= 13 && height >= 14) {
        const fs = Math.min(12, Math.max(8, lane.w * 0.5));
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(10,12,30,0.85)";
        const label = noteName(n.midi, view.naming).replace("#", "♯");
        ctx.fillText(label, lane.x + lane.w / 2, yBottom - Math.min(height / 2, fs * 0.9));
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Hit line.
    const lineGrad = ctx.createLinearGradient(0, hitY - 14, 0, hitY + 2);
    lineGrad.addColorStop(0, "rgba(167,139,250,0)");
    lineGrad.addColorStop(1, "rgba(167,139,250,0.35)");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, hitY - 14, this.w, 16);
    ctx.fillStyle = engine.waiting ? `rgba(250,204,21,${0.6 + 0.4 * pulse})` : COLORS.hitLine;
    ctx.fillRect(0, hitY - 1, this.w, 3);

    this.consumeFx(view, hitY);
    this.drawEffects(dt, now, hitY);
  }

  private fxX(fx: { midi: number; string: number; fret: number }, view: HighwayView): number | null {
    if (view.fret) {
      if (fx.fret < 0) return null;
      const col = view.fret.column(fx.fret);
      return col.x + col.w / 2;
    }
    const lane = view.piano?.lane(fx.midi);
    return lane ? lane.x + lane.w / 2 : null;
  }

  private consumeFx(view: HighwayView, hitY: number): void {
    const list = this.engine.fx;
    for (const fx of list) {
      if (fx.at <= this.lastFxAt) continue;
      const x = this.fxX(fx, view);
      if (x == null) continue;
      const color = JUDGEMENT_COLORS[fx.judgement] ?? "#ffffff";
      if (fx.judgement !== "wrong") {
        // Labels are wider than a key, so neighbours replace each other instead of piling up.
        this.popups = this.popups.filter((p) => Math.abs(p.x - x) > 70);
        this.popups.push({ text: view.labels[fx.judgement] ?? fx.judgement, color, x, born: fx.at });
        if (this.popups.length > 8) this.popups.shift();
      }
      if (view.effects && fx.judgement !== "miss" && fx.judgement !== "wrong") {
        const count = fx.judgement === "perfect" ? 18 : fx.judgement === "great" ? 12 : 7;
        for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
          const sp = 90 + Math.random() * 220;
          this.particles.push({
            x: x + (Math.random() - 0.5) * 10,
            y: hitY - 2,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0,
            max: 0.35 + Math.random() * 0.45,
            size: 6 + Math.random() * 10,
            color,
          });
        }
      }
    }
    if (list.length) this.lastFxAt = Math.max(this.lastFxAt, list[list.length - 1].at);
  }

  private drawEffects(dt: number, now: number, hitY: number): void {
    const { ctx } = this;
    if (this.particles.length) {
      ctx.globalCompositeOperation = "lighter";
      const alive: Particle[] = [];
      for (const p of this.particles) {
        p.life += dt;
        if (p.life >= p.max) continue;
        p.vy += 260 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = 1 - p.life / p.max;
        ctx.globalAlpha = k;
        const s = p.size * (0.6 + 0.4 * k);
        ctx.drawImage(glowSprite(p.color, 32), p.x - s / 2, p.y - s / 2, s, s);
        alive.push(p);
      }
      this.particles = alive;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    if (this.popups.length) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const keep: Popup[] = [];
      for (const p of this.popups) {
        const age = (now - p.born) / 800;
        if (age >= 1) continue;
        keep.push(p);
        const y = hitY - 44 - age * 40;
        const scale = age < 0.15 ? 0.7 + (age / 0.15) * 0.3 : 1;
        ctx.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
        ctx.font = `800 ${Math.round(18 * scale)}px system-ui, sans-serif`;
        const x = Math.max(44, Math.min(this.w - 44, p.x));
        ctx.lineWidth = 5;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(7,10,26,0.85)";
        ctx.strokeText(p.text, x, y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, x, y);
      }
      ctx.globalAlpha = 1;
      this.popups = keep;
    }
  }
}
