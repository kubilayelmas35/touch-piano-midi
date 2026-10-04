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
  shade,
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
  /** Drawn as a short motion streak instead of a soft dot. */
  streak?: boolean;
}

interface SprayLane {
  x: number;
  w: number;
  color: string;
}

interface Popup {
  text: string;
  color: string;
  x: number;
  born: number;
}

const MAX_PARTICLES = 700;
/** Sparks per second thrown off each side of a note that is being held. */
const SPRAY_RATE = 60;

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
      view.fret ? `f${view.fret.columns}:${view.fret.pluckW}:${view.fret.spec.tuning.length}:${view.naming}` : ""
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
      // Above the strike zone: one thin lane per string, showing which strings to strike.
      if (f.pluckW > 0) {
        const count = f.spec.tuning.length;
        const colors = count === 4 ? VIOLIN_STRING_COLORS : GUITAR_STRING_COLORS;
        g.fillStyle = "rgba(0,0,0,0.28)";
        g.fillRect(f.pluckX, 0, f.pluckW, this.h);
        g.fillStyle = "rgba(255,255,255,0.1)";
        g.fillRect(f.pluckX, 0, 2, this.h);
        const sw = f.pluckW / count;
        g.textAlign = "center";
        g.textBaseline = "bottom";
        g.font = "800 11px system-ui, sans-serif";
        for (let s = 0; s < count; s++) {
          const x = f.pluckX + s * sw;
          g.fillStyle = withAlpha(colors[s], 0.05);
          g.fillRect(x + 1, 0, sw - 2, this.h);
          g.fillStyle = withAlpha(colors[s], 0.7);
          const name = view.naming === "solfege" ? noteName(f.spec.tuning[s], "solfege") : f.spec.labels[s];
          g.fillText(name, x + sw / 2, this.h - 8);
        }
      }
    }
    this.bg = c;
  }

  /** Thin lane above the strike zone for a note's string. */
  private stringLaneOf(n: PlayNote, view: HighwayView): { x: number; w: number } | null {
    const f = view.fret;
    if (!f || f.pluckW <= 0 || n.string < 0) return null;
    const sw = f.pluckW / f.spec.tuning.length;
    const pad = Math.max(2, sw * 0.18);
    return { x: f.pluckX + n.string * sw + pad, w: sw - pad * 2 };
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

  /**
   * Notes on the same fret but different strings that overlap in time share the column side by side,
   * ordered low string → high string like the strike-zone lanes. Returns note id → [slot, slots].
   */
  private fretSlots(i0: number, i1: number, minDur: number): Map<number, [number, number]> {
    const notes = this.engine.notes;
    const byFret = new Map<number, PlayNote[]>();
    for (let i = i0; i < i1; i++) {
      const n = notes[i];
      if (n.fret < 0) continue;
      const list = byFret.get(n.fret);
      if (list) list.push(n);
      else byFret.set(n.fret, [n]);
    }
    const out = new Map<number, [number, number]>();
    for (const list of byFret.values()) {
      if (list.length < 2) continue;
      for (const n of list) {
        const end = n.time + Math.max(minDur, n.duration);
        const strings = new Set<number>([n.string]);
        for (const m of list) {
          if (m !== n && m.time < end - 0.005 && n.time < m.time + Math.max(minDur, m.duration) - 0.005) strings.add(m.string);
        }
        if (strings.size < 2) continue;
        const sorted = [...strings].sort((a, b) => a - b);
        out.set(n.id, [sorted.indexOf(n.string), sorted.length]);
      }
    }
    return out;
  }

  private headHeight(laneW: number, height: number, long: boolean): number {
    if (!long) return height;
    return Math.min(height, Math.max(18, Math.min(34, laneW * 0.85)));
  }

  /** Gem-like head where the note starts, with a glowing tail for its length. */
  private drawNote(
    ctx: CanvasRenderingContext2D,
    o: {
      lane: { x: number; w: number };
      yTop: number;
      yBottom: number;
      color: string;
      alpha: number;
      long: boolean;
      live: boolean;
      holding: boolean;
      missed: boolean;
      target: boolean;
      pulse: number;
      now: number;
      effects: boolean;
    }
  ): void {
    const { lane, yTop, yBottom, color, alpha } = o;
    const height = yBottom - yTop;
    const headH = this.headHeight(lane.w, height, o.long);
    const headTop = yBottom - headH;
    const cx = lane.x + lane.w / 2;
    const r = Math.min(10, lane.w * 0.4, headH / 2);

    // Halo.
    if (o.effects && o.live) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * (o.holding ? 0.95 : 0.38);
      const spread = o.holding ? 0.6 : 0.36;
      ctx.drawImage(glowSprite(color, 64), lane.x - lane.w * spread, headTop - 10, lane.w * (1 + spread * 2), headH + 20);
      if (o.long) {
        ctx.globalAlpha = alpha * (o.holding ? 0.45 : 0.16);
        ctx.drawImage(glowSprite(color, 64), lane.x - lane.w * 0.2, yTop - 6, lane.w * 1.4, height - headH + 12);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Tail.
    if (o.long && height > headH + 2) {
      const tw = Math.max(6, lane.w * (o.holding ? 0.88 : 0.78));
      const tx = cx - tw / 2;
      const tailBottom = headTop + headH * 0.5;
      const tailH = tailBottom - yTop;
      ctx.globalAlpha = alpha;
      // Cylinder shading across, fading out toward the end of the note.
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
      // Bright core line.
      const core = ctx.createLinearGradient(0, yTop, 0, tailBottom);
      core.addColorStop(0, "rgba(255,255,255,0)");
      core.addColorStop(1, `rgba(255,255,255,${o.holding ? 0.8 : 0.42})`);
      ctx.fillStyle = core;
      ctx.fillRect(cx - Math.max(1, tw * 0.09), yTop + 4, Math.max(2, tw * 0.18), tailH - 4);
      // Energy flowing down into the hit line while held.
      if (o.holding && o.effects) {
        ctx.globalCompositeOperation = "lighter";
        const gap = 22;
        const off = (o.now * 0.14) % gap;
        for (let y = tailBottom - off; y > yTop + 4; y -= gap) {
          const k = (y - yTop) / Math.max(1, tailH);
          ctx.fillStyle = `rgba(255,255,255,${0.32 * k})`;
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
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha("#ffffff", o.holding ? 0.4 : 0.16);
      roundRect(ctx, tx, yTop, tw, tailH, Math.min(tw / 2, 8));
      ctx.stroke();
    }

    // Head.
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
      // Side bevels give the head some depth.
      const bevel = ctx.createLinearGradient(lane.x, 0, lane.x + lane.w, 0);
      bevel.addColorStop(0, "rgba(255,255,255,0.18)");
      bevel.addColorStop(0.18, "rgba(255,255,255,0)");
      bevel.addColorStop(0.82, "rgba(0,0,0,0)");
      bevel.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = bevel;
      ctx.fill();
      // Glossy dome on the upper half.
      const shine = ctx.createLinearGradient(0, headTop, 0, headTop + headH * 0.55);
      shine.addColorStop(0, "rgba(255,255,255,0.55)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      roundRect(ctx, lane.x + lane.w * 0.12, headTop + 1.5, lane.w * 0.76, Math.max(3, headH * 0.45), Math.max(2, r * 0.7));
      ctx.fill();
      // Hot spot where it meets the keys.
      if (o.effects && headH >= 12) {
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

    roundRect(ctx, lane.x, headTop, lane.w, headH, r);
    if (o.target) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * o.pulse})`;
    } else if (o.missed) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(251,113,133,0.8)";
    } else {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = shade(color, 0.6, o.holding ? 0.95 : 0.55);
    }
    ctx.stroke();
  }

  private laneOf(n: PlayNote, view: HighwayView, slot?: [number, number]): { x: number; w: number } | null {
    if (view.fret) {
      if (n.fret < 0) return null;
      const col = view.fret.column(n.fret);
      const pad = Math.min(6, col.w * 0.12);
      if (slot && slot[1] > 1) {
        const inner = col.w - pad * 2;
        const gap = Math.min(3, inner * 0.06);
        const w = (inner - gap * (slot[1] - 1)) / slot[1];
        return { x: col.x + pad + slot[0] * (w + gap), w };
      }
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

    const slots = view.fret ? this.fretSlots(i0, i1, 10 / pps) : null;
    const holdingLanes: SprayLane[] = [];
    for (let i = i0; i < i1; i++) {
      const n = notes[i];
      const lane = this.laneOf(n, view, slots?.get(n.id));
      if (!lane) continue;
      const sounding = n.time <= t && t < n.time + n.duration;
      const isLong = n.holdSrc !== null || n.duration * pps > Math.max(36, lane.w * 1.4);
      const caught = n.state === NoteState.Missed && n.rejoined;
      const missed = n.state === NoteState.Missed && !caught;
      // A hit (or later caught) long note sticks to the hit line and its tail drains into it.
      const sticky = (n.state === NoteState.Hit || caught) && sounding && isLong;
      const brokenHold = sticky && n.holdSrc !== null && !n.holding;
      const holdingNow = sticky && !brokenHold;
      let yBottom = yOf(n.time);
      if (sticky) yBottom = Math.min(yBottom, hitY);
      const yTop = yOf(n.time) - Math.max(10, n.duration * pps - 2);
      const height = yBottom - yTop;
      if (height <= 0 || yTop > hitY || yBottom < -4) continue;

      const color = this.noteColor(n);
      let alpha = 1;
      let fill = color;
      if (missed) {
        fill = "#5b5f7a";
        alpha = 0.7;
      } else if (n.state === NoteState.Skipped) {
        alpha = 0.25;
      } else if ((n.state === NoteState.Hit || caught) && !sticky) {
        alpha = Math.max(0, 1 - (now - n.resolvedAt) / 450);
        if (alpha <= 0) continue;
      }
      const live = n.state === NoteState.Pending || holdingNow;
      const isTarget = n.state === NoteState.Pending && (n.group === waitGroup || Math.abs(n.time - t) <= win);

      this.drawNote(ctx, {
        lane,
        yTop,
        yBottom,
        color: brokenHold ? "#6b7092" : fill,
        alpha,
        long: isLong,
        live,
        holding: holdingNow,
        missed,
        target: isTarget,
        pulse,
        now,
        effects: view.effects,
      });
      if (holdingNow) holdingLanes.push({ x: lane.x, w: lane.w, color: fill });

      // Matching marker in the string lane above the strike zone.
      const sl = this.stringLaneOf(n, view);
      if (sl) {
        ctx.globalAlpha = alpha * (brokenHold ? 0.5 : 1);
        const sg = ctx.createLinearGradient(0, yTop, 0, yBottom);
        sg.addColorStop(0, withAlpha(fill, 0.25));
        sg.addColorStop(0.7, shade(fill, 0.25, 0.9));
        sg.addColorStop(1, shade(fill, 0.55));
        ctx.fillStyle = sg;
        roundRect(ctx, sl.x, yTop, sl.w, height, Math.min(6, sl.w * 0.45));
        ctx.fill();
      }

      // Label on the head.
      ctx.globalAlpha = alpha;
      const headH = this.headHeight(lane.w, height, isLong);
      const headMid = yBottom - headH / 2;
      if (view.fret && lane.w >= 14) {
        const fs = Math.min(15, Math.max(10, lane.w * 0.42));
        ctx.font = `800 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(10,12,30,0.9)";
        ctx.fillText(String(n.fret), lane.x + lane.w / 2, headMid + 0.5);
      } else if (view.showNames && lane.w >= 13 && headH >= 14) {
        const fs = Math.min(12, Math.max(8, lane.w * 0.5));
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(10,12,30,0.85)";
        ctx.fillText(noteName(n.midi, view.naming).replace("#", "♯"), lane.x + lane.w / 2, headMid + 0.5);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (view.effects) this.drawAuroras(view, hitY, now, i0, i1);

    // Hit line.
    const lineGrad = ctx.createLinearGradient(0, hitY - 14, 0, hitY + 2);
    lineGrad.addColorStop(0, "rgba(167,139,250,0)");
    lineGrad.addColorStop(1, "rgba(167,139,250,0.35)");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, hitY - 14, this.w, 16);
    ctx.fillStyle = engine.waiting ? `rgba(250,204,21,${0.6 + 0.4 * pulse})` : COLORS.hitLine;
    ctx.fillRect(0, hitY - 1, this.w, 3);

    if (view.effects) this.spray(holdingLanes, hitY, dt, now);
    this.consumeFx(view, hitY);
    this.drawEffects(dt, now, hitY);
  }

  /** Light pillars rising from keys/frets that are sounding. */
  private drawAuroras(view: HighwayView, hitY: number, now: number, i0: number, i1: number): void {
    const { ctx, engine } = this;
    const pillars = new Map<number, { x: number; w: number; color: string }>();
    const add = (lane: { x: number; w: number } | null, color: string) => {
      if (lane) pillars.set(Math.round(lane.x), { ...lane, color });
    };
    const t = view.t;
    for (let i = i0; i < i1; i++) {
      const n = engine.notes[i];
      const lit = n.state === NoteState.Hit || (n.state === NoteState.Missed && n.rejoined);
      if (lit && n.time <= t && t < n.time + n.duration && (n.holdSrc === null || n.holding)) {
        add(this.laneOf(n, view), this.noteColor(n));
      }
    }
    for (const h of engine.held.values()) {
      const fake = { midi: h.midi, string: h.string, fret: h.fret } as PlayNote;
      if (view.fret && h.fret < 0) continue;
      add(this.laneOf(fake, view), h.string >= 0 ? this.noteColor({ ...fake, track: 0 } as PlayNote) : "#a78bfa");
    }
    if (!pillars.size) return;
    const height = Math.min(150, hitY * 0.4);
    ctx.globalCompositeOperation = "lighter";
    for (const p of pillars.values()) {
      const g = ctx.createLinearGradient(0, hitY, 0, hitY - height);
      g.addColorStop(0, withAlpha(p.color, 0.42));
      g.addColorStop(0.5, withAlpha(p.color, 0.14));
      g.addColorStop(1, withAlpha(p.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x - p.w * 0.15, hitY - height, p.w * 1.3, height);
      // Drifting sparks.
      for (let k = 0; k < 5; k++) {
        const sx = p.x + p.w / 2 + Math.sin(now / 300 + k * 1.9 + p.x) * p.w * 0.35;
        const sy = hitY - 12 - ((now / 9 + k * 37) % (height * 0.8));
        ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (hitY - sy) / height)})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private fxLane(fx: { midi: number; string: number; fret: number }, view: HighwayView): { x: number; w: number } | null {
    if (view.fret) {
      if (fx.fret < 0) return null;
      const col = view.fret.column(fx.fret);
      return { x: col.x, w: col.w };
    }
    const lane = view.piano?.lane(fx.midi);
    return lane ? { x: lane.x, w: lane.w } : null;
  }

  /** Throws sparks sideways and up off both edges of a lane at the hit line. */
  private sideSparks(lane: { x: number; w: number }, color: string, hitY: number, count: number, power = 1): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const a = 0.3 + Math.random() * 1.0;
      const sp = (170 + Math.random() * 300) * power;
      this.particles.push({
        x: side < 0 ? lane.x + 1 : lane.x + lane.w - 1,
        y: hitY - 2 - Math.random() * 10,
        vx: side * Math.cos(a) * sp,
        vy: -Math.sin(a) * sp,
        life: 0,
        max: 0.3 + Math.random() * 0.45,
        size: 1.8 + Math.random() * 2.2,
        color: Math.random() < 0.45 ? "#ffffff" : color,
        streak: true,
      });
    }
  }

  /** Held notes: a hot bloom where they meet the hit line and a steady spray of sparks off both edges. */
  private spray(lanes: SprayLane[], hitY: number, dt: number, now: number): void {
    if (!lanes.length) return;
    const { ctx } = this;
    ctx.globalCompositeOperation = "lighter";
    for (const l of lanes) {
      const cx = l.x + l.w / 2;
      const flicker = 0.8 + 0.2 * Math.sin(now / 37 + l.x);
      ctx.globalAlpha = 0.7 * flicker;
      const cw = Math.max(110, l.w * 4.5);
      ctx.drawImage(glowSprite(l.color, 64), cx - cw / 2, hitY - cw * 0.5, cw, cw);
      ctx.globalAlpha = 0.95 * flicker;
      const ww = Math.max(56, l.w * 2.4);
      ctx.drawImage(glowSprite("#ffffff", 64), cx - ww / 2, hitY - ww * 0.4, ww, ww * 0.8);
      const n = SPRAY_RATE * 2 * dt;
      this.sideSparks(l, l.color, hitY, Math.floor(n) + (Math.random() < n % 1 ? 1 : 0), 0.85);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private consumeFx(view: HighwayView, hitY: number): void {
    const list = this.engine.fx;
    for (const fx of list) {
      if (fx.at <= this.lastFxAt) continue;
      const lane = this.fxLane(fx, view);
      if (!lane) continue;
      const x = lane.x + lane.w / 2;
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
        this.sideSparks(lane, color, hitY, fx.judgement === "perfect" ? 22 : fx.judgement === "great" ? 16 : 10, 1.15);
      }
    }
    if (list.length) this.lastFxAt = Math.max(this.lastFxAt, list[list.length - 1].at);
  }

  private drawEffects(dt: number, now: number, hitY: number): void {
    const { ctx } = this;
    if (this.particles.length) {
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      const alive: Particle[] = [];
      for (const p of this.particles) {
        p.life += dt;
        if (p.life >= p.max) continue;
        p.vy += 260 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = 1 - p.life / p.max;
        ctx.globalAlpha = k;
        if (p.streak) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * (0.5 + 0.5 * k);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
        } else {
          const s = p.size * (0.6 + 0.4 * k);
          ctx.drawImage(glowSprite(p.color, 32), p.x - s / 2, p.y - s / 2, s, s);
        }
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
