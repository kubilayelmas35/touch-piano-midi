import type { Engine } from "../engine/engine";
import type { FretLayout, PianoLayout } from "../engine/layout";
import { NoteState, type PlayNote } from "../engine/types";
import { HAND_SPLIT } from "../midi/song";
import { isBlack, noteName, type NoteNaming } from "../lib/notes";
import { paletteColor, type ApproachStyle, type Background, type ColorChoice, type DustStyle, type EffectStyle, type NoteColor, type NoteStyle } from "./appearance";
import { BackdropAnimator, paintBackdrop } from "./backgrounds";
import { drawNote, labelHeight, lightInk } from "./noteStyles";
import {
  COLORS,
  GUITAR_STRING_COLORS,
  JUDGEMENT_COLORS,
  TRACK_COLORS,
  VIOLIN_STRING_COLORS,
  glowSprite,
  mixHex,
  softSprite,
  withAlpha,
} from "./theme";

export interface HighwayView {
  t: number;
  fallSeconds: number;
  piano: PianoLayout | null;
  fret: FretLayout | null;
  /** Fretless: no fret column lines or inlay lanes. */
  hideFrets?: boolean;
  naming: NoteNaming;
  showNames: boolean;
  /** Piano: computer key per MIDI note, shown on the falling notes. */
  keyLabels?: Map<number, string> | null;
  /** Piano: suggested finger numbers in a badge above each note. */
  fingers?: boolean;
  effects: boolean;
  /** 0.1–1 intensity of particles and glows. */
  effectLevel: number;
  effectStyle: EffectStyle;
  dust: DustStyle | "off";
  /** 0.1–1 density of the dust cloud. */
  dustLevel: number;
  approach: ApproachStyle | "off";
  noteStyle: NoteStyle;
  noteColor: NoteColor;
  colors: ColorChoice;
  background: Background;
  labels: Record<string, string>;
}

type ParticleKind =
  | "dot"
  | "streak"
  | "star"
  | "flame"
  | "ring"
  | "mote"
  | "haze"
  | "puff"
  | "ember"
  | "twinkle"
  | "jet"
  | "glyph"
  | "confetti"
  | "bubble"
  | "bolt"
  | "petal"
  | "pixel";

/** Drawn behind the notes: the dust clouds that linger after hits. */
const BACK_KINDS: ReadonlySet<ParticleKind> = new Set<ParticleKind>(["mote", "haze", "puff", "ember", "twinkle", "jet"]);
/** Opaque-looking kinds that would wash out with additive blending. */
const SOLID_KINDS: ReadonlySet<ParticleKind> = new Set<ParticleKind>(["confetti", "petal", "pixel"]);

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Downward acceleration (negative floats up). */
  g: number;
  life: number;
  max: number;
  size: number;
  color: string;
  /** Rotation and spin (rad, rad/s) for shapes that tumble. */
  rot?: number;
  vr?: number;
  /** Air resistance per second. */
  drag?: number;
  /** Random sideways drift per second. */
  wander?: number;
  /** Height/width of a puff (fog is wide and flat). */
  squash?: number;
  /** Peak opacity for clouds. */
  peak?: number;
  /** Streak length per unit of speed (seconds of motion shown) for jets. */
  trail?: number;
  text?: string;
}

interface SprayLane {
  x: number;
  w: number;
  /** Top of the held note on screen. */
  top: number;
  color: string;
}

interface Popup {
  text: string;
  /** "Early" / "Late" under the judgement. */
  sub?: string;
  subColor?: string;
  color: string;
  x: number;
  born: number;
}

const MAX_PARTICLES = 1200;
/** Particles per second thrown off a held note at full effect level. */
const SPRAY_RATE = 70;
/** How much of SPRAY_RATE each style uses while a note is held. */
const SPRAY_SHARE: Record<EffectStyle, number> = {
  sparks: 1,
  stars: 0.4,
  fire: 1,
  glow: 0,
  notes: 0.15,
  confetti: 0.3,
  bubbles: 0.3,
  lightning: 0.12,
  petals: 0.2,
  pixels: 0.5,
};
const FIRE = ["#fff7c2", "#fde047", "#fb923c", "#ef4444"];
const CONFETTI = ["#f472b6", "#facc15", "#38d6ff", "#4ade80", "#a78bfa", "#fb923c"];
const PETALS = ["#fbcfe8", "#f9a8d4", "#fda4af", "#ffffff"];
const NEBULA = ["#ec4899", "#3b82f6", "#a855f7", "#22d3ee"];
const EMBERS = ["#fde68a", "#fb923c", "#f97316"];
const NOTE_GLYPHS = ["♪", "♫", "♩", "♬"];

export class Highway {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  /** Cached still backdrop (opaque). */
  private backdrop: HTMLCanvasElement | null = null;
  private backdropKey = "";
  /** Cached lane markings drawn over the animated backdrop (transparent). */
  private lanes: HTMLCanvasElement | null = null;
  private lanesKey = "";
  private readonly animator = new BackdropAnimator();
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private lastFxAt = 0;
  private lastFrame = 0;
  private palette: NoteColor = "auto";
  private colors: ColorChoice = { solid: "#8b5cf6", from: "#22d3ee", to: "#f43f5e" };
  /** Size / lifetime multipliers for hit effects, from the effect intensity. */
  private fxSize = 1;
  private fxLife = 1;

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
    this.backdropKey = "";
    this.lanesKey = "";
  }

  /** Hit effects or judgement popups are still playing out. */
  get animating(): boolean {
    return this.particles.length > 0 || this.popups.length > 0;
  }

  /** Clears effects (e.g. after seeking). */
  resetEffects(): void {
    this.particles = [];
    this.popups = [];
    this.lastFxAt = performance.now();
  }

  private layer(existing: HTMLCanvasElement | null): CanvasRenderingContext2D {
    const c = existing ?? document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext("2d")!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    return g;
  }

  private ensureBackground(view: HighwayView): void {
    const size = `${this.w}x${this.h}@${this.dpr}`;
    const bKey = `${size}|${view.background}`;
    if (bKey !== this.backdropKey || !this.backdrop) {
      this.backdropKey = bKey;
      const g = this.layer(this.backdrop);
      paintBackdrop(g, this.w, this.h, view.background);
      this.backdrop = g.canvas;
    }
    const key = `${size}|${view.piano ? `p${view.piano.sig}:${view.hideFrets ? 1 : 0}` : ""}|${
      view.fret
        ? `f${view.fret.frets.join(",")}:${view.fret.strings.join(",")}:${view.fret.pluckW}:${view.fret.spec.tuning.length}:${view.naming}:${view.hideFrets ? 1 : 0}`
        : ""
    }`;
    if (key === this.lanesKey && this.lanes) return;
    this.lanesKey = key;
    const g = this.layer(this.lanes);

    if (view.piano) {
      const p = view.piano;
      for (const m of view.hideFrets ? [] : p.keys) {
        const lane = p.lane(m)!;
        if (lane.black) {
          g.fillStyle = COLORS.laneBlack;
          g.fillRect(lane.x, 0, lane.w, this.h);
        }
        if (p.compact) {
          g.fillStyle = m % 12 === 0 ? COLORS.octaveLine : COLORS.laneLine;
          g.fillRect(Math.round(lane.x), 0, 1, this.h);
        } else if (!isBlack(m) && (m % 12 === 0 || m % 12 === 5)) {
          g.fillStyle = m % 12 === 0 ? COLORS.octaveLine : COLORS.laneLine;
          g.fillRect(Math.round(lane.x), 0, 1, this.h);
        }
      }
    } else if (view.fret) {
      const f = view.fret;
      if (f.width > 0) {
        for (let i = 0; i <= f.columns; i++) {
          const nut = i === 1 && f.hasNut;
          if (view.hideFrets && !nut && i > 0 && i < f.columns) continue;
          const x = Math.round(i * f.colW);
          g.fillStyle = nut ? "rgba(255,255,255,0.16)" : COLORS.laneLine;
          g.fillRect(x, 0, nut ? 2 : 1, this.h);
          // Frets left out between two columns: a double line.
          if (i > 0 && i < f.columns && f.frets[i] - f.frets[i - 1] > 1 && !(i === 1 && f.frets[0] === 0)) g.fillRect(x + 3, 0, 1, this.h);
        }
        for (const fret of view.hideFrets ? [] : [3, 5, 7, 9, 12, 15]) {
          const col = f.column(fret);
          if (!col) continue;
          g.fillStyle = COLORS.lane;
          g.fillRect(col.x, 0, col.w, this.h);
        }
      }
      // Above the strike zone: one thin lane per string, showing which strings to strike.
      if (f.pluckW > 0) {
        const colors = f.spec.tuning.length === 4 ? VIOLIN_STRING_COLORS : GUITAR_STRING_COLORS;
        g.fillStyle = "rgba(0,0,0,0.28)";
        g.fillRect(f.pluckX, 0, f.pluckW, this.h);
        g.fillStyle = "rgba(255,255,255,0.1)";
        g.fillRect(f.pluckX, 0, 2, this.h);
        g.textAlign = "center";
        g.textBaseline = "bottom";
        g.font = "800 11px system-ui, sans-serif";
        for (const s of f.strings) {
          const lane = f.stringLane(s)!;
          g.fillStyle = withAlpha(colors[s], 0.05);
          g.fillRect(lane.x + 1, 0, lane.w - 2, this.h);
          g.fillStyle = withAlpha(colors[s], 0.7);
          const name = view.naming === "solfege" ? noteName(f.spec.tuning[s], "solfege") : f.spec.labels[s];
          g.fillText(name, lane.x + lane.w / 2, this.h - 8);
        }
      }
    }
    this.lanes = g.canvas;
  }

  /** Thin lane above the strike zone for a note's string. */
  private stringLaneOf(n: { string: number }, view: HighwayView): { x: number; w: number } | null {
    const lane = view.fret && n.string >= 0 ? view.fret.stringLane(n.string) : null;
    if (!lane) return null;
    const pad = Math.max(2, Math.min(lane.w * 0.18, 14));
    return { x: lane.x + pad, w: lane.w - pad * 2 };
  }

  /** Hand/track or string colour, before the colour palette is applied. */
  private baseColor(n: PlayNote): string {
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

  /** Finger number in a badge inside the top of a long note, or just above a short one (`lift` px higher to clear a key label). */
  private drawFinger(finger: number, cx: number, yTop: number, height: number, headH: number, laneW: number, color: string, lift: number): void {
    const ctx = this.ctx;
    const r = Math.min(10, Math.max(6, laneW * 0.4));
    let by = height >= headH + r * 2 + 8 ? yTop + r + 3 : yTop - r - 3;
    if (by < yTop) by -= lift;
    if (by <= r) return;
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.font = `800 ${Math.round(r * 1.25)}px system-ui, sans-serif`;
    ctx.fillStyle = "#1e1b4b";
    ctx.fillText(String(finger), cx, by + 0.5);
  }

  /** Note colour in the chosen palette; gradient palettes depend on the height `y` (default: at the hit line). */
  private noteColor(n: PlayNote, y = this.h): string {
    if (this.palette === "auto") return this.baseColor(n);
    const k = Math.max(0, Math.min(1, y / Math.max(1, this.h)));
    return paletteColor(this.palette, this.baseColor(n), n.midi, n.string < 0 && isBlack(n.midi), k, this.colors);
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

  private laneOf(n: PlayNote, view: HighwayView, slot?: [number, number]): { x: number; w: number } | null {
    if (view.fret) {
      const col = n.fret < 0 ? null : view.fret.column(n.fret);
      if (!col) return null;
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
    this.palette = view.noteColor;
    this.colors = view.colors;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.backdrop!, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.animator.draw(ctx, this.w, this.h, view.background, now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.lanes!, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const level = view.effects ? view.effectLevel : 0;
    const glow = view.effects ? 0.3 + 0.7 * view.effectLevel : 0;

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

    this.stepParticles(dt);
    this.drawParticles(now, true);
    const approaching = view.approach === "off" ? [] : this.approaching(view, i0, i1, hitY, yOf);
    this.drawApproach(approaching, view.approach, hitY, now, dt, true);

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
      const col = this.laneOf(n, view, slots?.get(n.id));
      // A note with no fret column shown (open string at a hidden nut, or no neck) falls only in its string lane.
      const sl = this.stringLaneOf(n, view);
      const lane = col ?? sl;
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

      const color = this.noteColor(n, yBottom);
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

      const draw = {
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
        glow,
      };
      drawNote(ctx, view.noteStyle, draw);
      if (holdingNow) holdingLanes.push({ x: lane.x, w: lane.w, top: Math.max(0, yTop), color: fill });

      // Matching marker in the string lane above the strike zone, in the same style.
      if (sl && col) {
        drawNote(ctx, view.noteStyle, { ...draw, lane: sl, alpha: alpha * (brokenHold ? 0.6 : 1), target: false });
        if (holdingNow) holdingLanes.push({ x: sl.x, w: sl.w, top: Math.max(0, yTop), color: fill });
      }

      // Label on the head.
      ctx.globalAlpha = alpha;
      const headH = Math.min(height, labelHeight(view.noteStyle, lane.w, height, isLong));
      const headMid = yBottom - headH / 2;
      const ink = lightInk(view.noteStyle, holdingNow) ? "rgba(255,255,255,0.95)" : "rgba(10,12,30,0.9)";
      if (view.fret && lane.w >= 14) {
        const fs = Math.min(15, Math.max(10, lane.w * 0.42));
        ctx.font = `800 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = ink;
        ctx.fillText(String(n.fret), lane.x + lane.w / 2, headMid + 0.5);
      } else if (lane.w >= 13 && headH >= 14) {
        const key = view.keyLabels?.get(n.midi);
        const name = view.showNames ? noteName(n.midi, view.naming).replace("#", "♯") : null;
        const fs = Math.min(12, Math.max(8, lane.w * 0.5));
        const cx = lane.x + lane.w / 2;
        if (view.fingers && n.finger) this.drawFinger(n.finger, cx, yTop, height, headH, lane.w, color, key && name && headH < 26 ? fs * 1.5 : 0);
        ctx.fillStyle = ink;
        if (key && name && headH >= 26) {
          ctx.font = `800 ${fs + 1}px system-ui, sans-serif`;
          ctx.fillText(key, cx, headMid - fs * 0.55);
          ctx.font = `600 ${fs - 1}px system-ui, sans-serif`;
          ctx.fillText(name, cx, headMid + fs * 0.6);
        } else if (key && !name) {
          ctx.font = `800 ${fs + 1}px system-ui, sans-serif`;
          ctx.fillText(key, cx, headMid + 0.5);
        } else {
          if (name) {
            ctx.font = `700 ${fs}px system-ui, sans-serif`;
            ctx.fillText(name, cx, headMid + 0.5);
          }
          // No room for both in the head: the key rides just above the note.
          if (key && yTop > 10) {
            ctx.font = `800 ${fs}px system-ui, sans-serif`;
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.fillText(key, cx, yTop - fs * 0.7);
          }
        }
      } else if (view.fingers && n.finger && lane.w >= 10) {
        this.drawFinger(n.finger, lane.x + lane.w / 2, yTop, height, headH, lane.w, color, 0);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (level > 0) this.drawAuroras(view, hitY, now, i0, i1, glow);

    // Hit line.
    const lineGrad = ctx.createLinearGradient(0, hitY - 14, 0, hitY + 2);
    lineGrad.addColorStop(0, "rgba(167,139,250,0)");
    lineGrad.addColorStop(1, "rgba(167,139,250,0.35)");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, hitY - 14, this.w, 16);
    ctx.fillStyle = engine.waiting ? `rgba(250,204,21,${0.6 + 0.4 * pulse})` : COLORS.hitLine;
    ctx.fillRect(0, hitY - 1, this.w, 3);

    this.drawApproach(approaching, view.approach, hitY, now, dt, false);
    if (level > 0) this.spray(holdingLanes, hitY, dt, now, view.effectStyle, level);
    if (view.dust !== "off") this.dustHold(holdingLanes, hitY, dt, view.dust, view.dustLevel);
    this.consumeFx(view, hitY, level);
    this.drawParticles(now, false);
    this.drawPopups(now, hitY);
  }

  /** Pending notes close to the hit line, with how near they are (0 far … 1 at the line). */
  private approaching(
    view: HighwayView,
    i0: number,
    i1: number,
    hitY: number,
    yOf: (time: number) => number
  ): { lane: { x: number; w: number }; y: number; p: number; color: string }[] {
    const out: { lane: { x: number; w: number }; y: number; p: number; color: string }[] = [];
    const span = Math.min(view.fallSeconds * 0.6, 1.6 * this.engine.config.speed);
    const t = view.t;
    for (let i = i0; i < i1; i++) {
      const n = this.engine.notes[i];
      if (n.state !== NoteState.Pending) continue;
      const ahead = n.time - t;
      if (ahead > span) break;
      const p = Math.max(0, Math.min(1, 1 - ahead / span));
      const y = Math.min(hitY, yOf(n.time));
      const color = this.noteColor(n, y);
      const lane = this.laneOf(n, view);
      if (lane) out.push({ lane, y, p, color });
      const sl = this.stringLaneOf(n, view);
      if (sl) out.push({ lane: sl, y, p, color });
    }
    return out;
  }

  /** Lane effects leading a falling note to its key; `back` is the part drawn under the notes. */
  private drawApproach(
    list: { lane: { x: number; w: number }; y: number; p: number; color: string }[],
    style: ApproachStyle | "off",
    hitY: number,
    now: number,
    dt: number,
    back: boolean
  ): void {
    if (!list.length || style === "off") return;
    const { ctx } = this;
    ctx.globalCompositeOperation = "lighter";
    for (const a of list) {
      const { lane, y, p, color } = a;
      const cx = lane.x + lane.w / 2;
      if (back && style === "beam") {
        const g = ctx.createLinearGradient(0, y, 0, hitY);
        g.addColorStop(0, withAlpha(color, 0));
        g.addColorStop(1, withAlpha(color, 0.45 * p));
        ctx.fillStyle = g;
        ctx.fillRect(lane.x, y, lane.w, hitY - y);
        ctx.fillStyle = `rgba(255,255,255,${0.45 * p})`;
        ctx.fillRect(cx - 0.75, y, 1.5, hitY - y);
      } else if (back && style === "arrows") {
        const gap = 18;
        const off = (now * 0.12) % gap;
        const aw = Math.min(lane.w * 0.8, 22);
        for (let yy = y + 10 + off; yy < hitY - 4; yy += gap) {
          ctx.fillStyle = withAlpha(color, (0.15 + 0.5 * p) * ((yy - y) / Math.max(1, hitY - y)));
          ctx.beginPath();
          ctx.moveTo(cx - aw / 2, yy - 6);
          ctx.lineTo(cx, yy);
          ctx.lineTo(cx + aw / 2, yy - 6);
          ctx.lineTo(cx + aw / 2, yy - 3);
          ctx.lineTo(cx, yy + 3);
          ctx.lineTo(cx - aw / 2, yy - 3);
          ctx.closePath();
          ctx.fill();
        }
      } else if (back && style === "comet") {
        const n = 40 * p * dt;
        const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          this.emit({ kind: "dot", x: lane.x + Math.random() * lane.w, y: y - 4 - Math.random() * 10, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30, g: 0, max: 0.35 + Math.random() * 0.35, size: 4 + Math.random() * 6, color: Math.random() < 0.4 ? "#ffffff" : color });
        }
      } else if (!back && style === "ring") {
        const r = lane.w * (0.55 + 1.6 * (1 - p));
        ctx.strokeStyle = withAlpha(color, 0.2 + 0.7 * p);
        ctx.lineWidth = 1.5 + 1.5 * p;
        ctx.beginPath();
        ctx.ellipse(cx, hitY - 3, r, Math.max(4, r * 0.3), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (!back && style === "keyglow") {
        const beat = 0.75 + 0.25 * Math.sin(now / (60 + 140 * (1 - p)));
        const s = lane.w * (1.2 + 1.4 * p);
        ctx.globalAlpha = 0.25 + 0.6 * p * beat;
        ctx.drawImage(glowSprite(color, 64), cx - s / 2, hitY - s * 0.55, s, s * 0.7);
        ctx.globalAlpha = 1;
        ctx.fillStyle = withAlpha(color, 0.25 + 0.65 * p);
        ctx.fillRect(lane.x, hitY - 4, lane.w, 3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** Light pillars rising from keys/frets that are sounding. */
  private drawAuroras(view: HighwayView, hitY: number, now: number, i0: number, i1: number, glow: number): void {
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
        const color = this.noteColor(n);
        add(this.laneOf(n, view), color);
        add(this.stringLaneOf(n, view), color);
      }
    }
    for (const h of engine.held.values()) {
      const fake = { midi: h.midi, string: h.string, fret: h.fret, track: 0 } as PlayNote;
      if (view.fret && h.fret < 0) continue;
      const color = h.string >= 0 ? this.noteColor(fake) : "#a78bfa";
      add(this.laneOf(fake, view), color);
      add(this.stringLaneOf(fake, view), color);
    }
    if (!pillars.size) return;
    const height = Math.min(150, hitY * 0.4);
    ctx.globalCompositeOperation = "lighter";
    for (const p of pillars.values()) {
      const g = ctx.createLinearGradient(0, hitY, 0, hitY - height);
      g.addColorStop(0, withAlpha(p.color, 0.42 * glow));
      g.addColorStop(0.5, withAlpha(p.color, 0.14 * glow));
      g.addColorStop(1, withAlpha(p.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x - p.w * 0.15, hitY - height, p.w * 1.3, height);
      for (let k = 0; k < 5; k++) {
        const sx = p.x + p.w / 2 + Math.sin(now / 300 + k * 1.9 + p.x) * p.w * 0.35;
        const sy = hitY - 12 - ((now / 9 + k * 37) % (height * 0.8));
        ctx.fillStyle = `rgba(255,255,255,${0.5 * glow * (1 - (hitY - sy) / height)})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private fxLane(fx: { midi: number; string: number; fret: number }, view: HighwayView): { x: number; w: number } | null {
    if (view.fret) {
      const col = fx.fret < 0 ? null : view.fret.column(fx.fret);
      return col ? { x: col.x, w: col.w } : null;
    }
    const lane = view.piano?.lane(fx.midi);
    return lane ? { x: lane.x, w: lane.w } : null;
  }

  private emit(p: Omit<Particle, "life">): void {
    if (this.particles.length < MAX_PARTICLES) this.particles.push({ ...p, life: 0 });
  }

  /** Hit-effect particle, grown and lengthened by the effect intensity. */
  private emitFx(p: Omit<Particle, "life">): void {
    this.emit({ ...p, size: p.size * this.fxSize, max: p.max * this.fxLife });
  }

  /** Effect intensity 0.1–1 → particle count multiplier and launch power; also sets size / lifetime. */
  private amp(level: number): { count: number; power: number } {
    this.fxSize = 0.55 + 0.9 * level;
    this.fxLife = 0.65 + 0.7 * level;
    return { count: 0.12 + 1.9 * level * level, power: 0.6 + 0.75 * level };
  }

  /**
   * About `n` pieces of a dust cloud rising behind the notes from a lane, spread between the hit
   * line `y0` and `y1` above it (held notes fill their whole column).
   */
  private cloud(lane: { x: number; w: number }, color: string, y0: number, y1: number, n: number, style: DustStyle): void {
    const r = Math.random;
    const count = Math.floor(n) + (r() < n % 1 ? 1 : 0);
    const yAt = () => y0 - 4 - r() * Math.max(12, y0 - y1);
    const cx = lane.x + lane.w / 2;
    const light = mixHex(color, "#ffffff", 0.45);
    for (let i = 0; i < count; i++) {
      if (style === "sparkle") {
        const a = -Math.PI / 2 + (r() - 0.5) * 1.8;
        const sp = 40 + r() * 140;
        this.emit({ kind: "mote", x: lane.x + r() * lane.w, y: yAt(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: -6, drag: 1.6, wander: 50, max: 1.6 + r() * 2.2, size: 1.2 + r() * 2.2, color: r() < 0.3 ? "#ffffff" : color });
        if (r() < 0.12) this.emit({ kind: "haze", x: cx, y: yAt(), vx: (r() - 0.5) * 10, vy: -18 - r() * 14, g: 0, drag: 0.4, max: 1.8 + r() * 0.8, size: Math.max(70, lane.w * 3.5), color });
      } else if (style === "smoke") {
        this.emit({ kind: "puff", x: cx + (r() - 0.5) * lane.w * 1.3, y: yAt(), vx: (r() - 0.5) * 16, vy: -(10 + r() * 22), g: -2, drag: 0.3, wander: 18, max: 2.4 + r() * 2, size: Math.max(55, lane.w * (2 + r() * 1.8)), squash: 1.4, peak: 0.34, color });
        for (let k = 0; k < 3; k++) {
          this.emit({ kind: "mote", x: cx + (r() - 0.5) * lane.w * 2, y: yAt(), vx: (r() - 0.5) * 14, vy: -(6 + r() * 26), g: -3, drag: 0.6, wander: 30, max: 2 + r() * 2.5, size: 0.8 + r() * 1.2, color: r() < 0.4 ? light : color });
        }
        for (let k = 0; k < 2; k++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 1.2;
          const sp = 220 + r() * 260;
          this.emit({ kind: "jet", x: lane.x + r() * lane.w, y: y0 - 4 - r() * 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: -8, drag: 2.2, wander: 40, max: 2 + r() * 1.8, size: 0.7 + r() * 0.8, trail: 0.05, peak: 0.75, color: r() < 0.5 ? light : color });
        }
      } else if (style === "nebula") {
        const tint = r() < 0.4 ? color : NEBULA[Math.floor(r() * NEBULA.length)];
        this.emit({ kind: "puff", x: cx + (r() - 0.5) * lane.w * 2, y: yAt(), vx: (r() - 0.5) * 12, vy: -(5 + r() * 12), g: 0, drag: 0.2, wander: 10, max: 3.2 + r() * 2, size: Math.max(80, lane.w * (2.8 + r() * 2.2)), squash: 1, peak: 0.3, color: tint });
        if (r() < 0.5) this.emit({ kind: "twinkle", x: cx + (r() - 0.5) * lane.w * 2.4, y: yAt(), vx: 0, vy: -(4 + r() * 10), g: 0, max: 2 + r() * 2, size: 1.5 + r() * 2.5, color: "#ffffff" });
      } else if (style === "fog") {
        this.emit({ kind: "puff", x: cx + (r() - 0.5) * lane.w, y: y0 - 6 - r() * 26, vx: (r() - 0.5) * 70, vy: -(2 + r() * 7), g: 0, drag: 0.5, max: 3 + r() * 1.6, size: Math.max(90, lane.w * (3.5 + r() * 2)), squash: 0.32, peak: 0.24, color: mixHex(color, "#c7d2fe", 0.5) });
      } else if (style === "embers") {
        this.emit({ kind: "ember", x: lane.x + r() * lane.w, y: y0 - 4 - r() * Math.min(40, y0 - y1 + 12), vx: (r() - 0.5) * 30, vy: -(30 + r() * 60), g: -8, drag: 0.4, wander: 70, max: 1.5 + r() * 1.6, size: 1.4 + r() * 1.8, color: r() < 0.3 ? color : EMBERS[Math.floor(r() * EMBERS.length)] });
      } else if (style === "fountain") {
        // Jets shoot up out of the key, slow down and scatter into lingering dust.
        const wide = r() < 0.25;
        const a = -Math.PI / 2 + (r() - 0.5) * (wide ? 1.7 : 0.8);
        const sp = 280 + r() * 360;
        this.emit({ kind: "jet", x: lane.x + r() * lane.w, y: y0 - 4 - r() * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: -12, drag: 2.4, wander: 45, max: 2.2 + r() * 1.8, size: 0.9 + r() * 1.4, trail: 0.06, color: r() < 0.4 ? light : color });
        if (r() < 0.15) this.emit({ kind: "puff", x: cx + (r() - 0.5) * lane.w, y: y0 - 10, vx: (r() - 0.5) * 30, vy: -(30 + r() * 40), g: 0, drag: 0.8, wander: 12, max: 2 + r() * 1.5, size: Math.max(50, lane.w * 2), squash: 1.2, peak: 0.22, color });
      } else if (style === "plume") {
        // Billows of smoke thrown upwards, with fine streaks shooting ahead of them.
        this.emit({ kind: "puff", x: cx + (r() - 0.5) * lane.w * 0.6, y: y0 - 6, vx: (r() - 0.5) * 40, vy: -(140 + r() * 160), g: 0, drag: 1.6, wander: 25, max: 2.2 + r() * 1.6, size: Math.max(40, lane.w * (1.4 + r())), squash: 1.2, peak: 0.3, color });
        for (let k = 0; k < 2; k++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 1.1;
          const sp = 200 + r() * 220;
          this.emit({ kind: "jet", x: lane.x + r() * lane.w, y: y0 - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: -10, drag: 2, wander: 40, max: 1.8 + r() * 1.6, size: 0.8 + r() * 0.8, trail: 0.05, color: r() < 0.5 ? light : color });
        }
      } else if (style === "rays") {
        // Long thin rays fanning upwards that shrink into specks as they slow.
        const a = -Math.PI / 2 + (r() - 0.5) * 0.45;
        const sp = 420 + r() * 420;
        this.emit({ kind: "jet", x: lane.x + r() * lane.w, y: y0 - 4 - r() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: -5, drag: 1.5, wander: 15, max: 1.2 + r(), size: 0.7 + r() * 0.9, trail: 0.16, peak: 0.7, color: r() < 0.5 ? light : color });
      } else if (style === "stardust") {
        this.emit({ kind: "twinkle", x: cx + (r() - 0.5) * lane.w * 1.8, y: yAt(), vx: (r() - 0.5) * 16, vy: -(5 + r() * 18), g: 0, drag: 0.3, wander: 8, max: 2 + r() * 1.8, size: 1.6 + r() * 2.8, color: r() < 0.5 ? "#ffffff" : light });
      }
    }
  }

  /** Clouds keep gathering around held notes, from the hit line up their column. */
  private dustHold(lanes: SprayLane[], hitY: number, dt: number, style: DustStyle, level: number): void {
    const rate: Record<DustStyle, number> = { smoke: 7, fountain: 22, plume: 6, rays: 12, sparkle: 16, nebula: 3, fog: 3, embers: 18, stardust: 10 };
    for (const l of lanes) this.cloud(l, l.color, hitY, Math.max(l.top, hitY - 260), rate[style] * level * dt, style);
  }

  /** Throws `count` particles of the chosen style off a lane at the hit line. */
  private burst(lane: { x: number; w: number }, color: string, hitY: number, count: number, style: EffectStyle, power = 1): void {
    const r = Math.random;
    if (style === "notes") {
      for (let i = 0; i < Math.max(1, Math.round(count / 3)); i++) {
        const a = 1.1 + r() * 0.9;
        const sp = (90 + r() * 160) * power;
        const side = r() < 0.5 ? -1 : 1;
        this.emitFx({ kind: "glyph", x: lane.x + r() * lane.w, y: hitY - 6, vx: side * Math.cos(a) * sp, vy: -Math.sin(a) * sp, g: 60, drag: 1.2, wander: 30, max: 1 + r() * 0.8, size: 12 + r() * 10, rot: (r() - 0.5) * 0.6, vr: (r() - 0.5) * 2, text: NOTE_GLYPHS[Math.floor(r() * NOTE_GLYPHS.length)], color: r() < 0.35 ? "#ffffff" : color });
      }
      return;
    }
    if (style === "lightning") {
      const bolts = Math.max(1, Math.round(count / 12));
      for (let i = 0; i < bolts; i++) {
        const side = r() < 0.5 ? -1 : 1;
        this.emitFx({ kind: "bolt", x: lane.x + lane.w / 2 + side * lane.w * 0.3, y: hitY - 2, vx: 0, vy: 0, g: 0, max: 0.16 + r() * 0.1, size: (50 + r() * 90) * power, rot: -Math.PI / 2 + side * (0.2 + r() * 0.6), color: r() < 0.5 ? "#ffffff" : color });
      }
      count = Math.round(count / 3);
    }
    for (let i = 0; i < count; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const edgeX = side < 0 ? lane.x + 1 : lane.x + lane.w - 1;
      const midX = lane.x + r() * lane.w;
      if (style === "sparks" || style === "lightning") {
        const a = 0.3 + r() * 1.0;
        const sp = (170 + r() * 300) * power;
        this.emitFx({ kind: "streak", x: edgeX, y: hitY - 2 - r() * 10, vx: side * Math.cos(a) * sp, vy: -Math.sin(a) * sp, g: 260, max: 0.3 + r() * 0.45, size: 1.8 + r() * 2.2, color: r() < 0.45 ? "#ffffff" : color });
      } else if (style === "stars") {
        const a = 0.6 + r() * 0.9;
        const sp = (60 + r() * 130) * power;
        this.emitFx({ kind: "star", x: edgeX, y: hitY - 4 - r() * 12, vx: side * Math.cos(a) * sp, vy: -Math.sin(a) * sp, g: -30, max: 0.7 + r() * 0.8, size: 4 + r() * 6, color: r() < 0.5 ? "#ffffff" : color });
      } else if (style === "fire") {
        this.emitFx({ kind: "flame", x: midX, y: hitY - 2, vx: (r() - 0.5) * 60 + side * 30 * power, vy: -(120 + r() * 200) * power, g: -120, max: 0.35 + r() * 0.4, size: 8 + r() * 12, color: FIRE[Math.floor(r() * 2)] });
      } else if (style === "confetti") {
        const a = 0.9 + r() * 1.3;
        const sp = (200 + r() * 280) * power;
        this.emitFx({ kind: "confetti", x: midX, y: hitY - 4, vx: side * Math.cos(a) * sp * 0.6, vy: -Math.sin(a) * sp, g: 380, drag: 1.4, max: 1 + r() * 0.8, size: 5 + r() * 4, rot: r() * 6, vr: (r() - 0.5) * 18, color: CONFETTI[Math.floor(r() * CONFETTI.length)] });
      } else if (style === "bubbles") {
        this.emitFx({ kind: "bubble", x: midX, y: hitY - 4 - r() * 8, vx: (r() - 0.5) * 50, vy: -(50 + r() * 110) * power, g: -40, drag: 0.8, wander: 60, max: 0.9 + r() * 1.1, size: 3 + r() * 8, color: r() < 0.3 ? "#ffffff" : color });
      } else if (style === "petals") {
        const a = 1 + r() * 1.1;
        const sp = (120 + r() * 200) * power;
        this.emitFx({ kind: "petal", x: midX, y: hitY - 4, vx: side * Math.cos(a) * sp, vy: -Math.sin(a) * sp, g: 90, drag: 1.8, wander: 80, max: 1.4 + r() * 1, size: 5 + r() * 4, rot: r() * 6, vr: (r() - 0.5) * 6, color: r() < 0.25 ? color : PETALS[Math.floor(r() * PETALS.length)] });
      } else if (style === "pixels") {
        const a = 0.5 + r() * 2.1;
        const sp = (120 + r() * 240) * power;
        this.emitFx({ kind: "pixel", x: midX, y: hitY - 4, vx: Math.cos(a) * sp * (r() < 0.5 ? -1 : 1), vy: -Math.sin(a) * sp, g: 420, max: 0.5 + r() * 0.5, size: r() < 0.3 ? 6 : 4, color: r() < 0.35 ? "#ffffff" : color });
      }
    }
  }

  /** Held notes: a hot bloom where they meet the hit line and a steady stream of particles. */
  private spray(lanes: SprayLane[], hitY: number, dt: number, now: number, style: EffectStyle, level: number): void {
    if (!lanes.length) return;
    const { ctx } = this;
    ctx.globalCompositeOperation = "lighter";
    for (const l of lanes) {
      const cx = l.x + l.w / 2;
      const flicker = 0.8 + 0.2 * Math.sin(now / 37 + l.x);
      const tint = style === "fire" ? "#fb923c" : l.color;
      ctx.globalAlpha = (0.25 + 0.5 * level) * flicker;
      const cw = Math.max(60, l.w * (2.5 + 2 * level));
      ctx.drawImage(glowSprite(tint, 64), cx - cw / 2, hitY - cw * 0.5, cw, cw);
      ctx.globalAlpha = (0.4 + 0.55 * level) * flicker;
      const ww = Math.max(30, l.w * (1.4 + level));
      ctx.drawImage(glowSprite("#ffffff", 64), cx - ww / 2, hitY - ww * 0.4, ww, ww * 0.8);
      const a = this.amp(level);
      const n = SPRAY_RATE * a.count * SPRAY_SHARE[style] * dt;
      if (n > 0) this.burst(l, l.color, hitY, Math.floor(n) + (Math.random() < n % 1 ? 1 : 0), style, 0.85 * a.power);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private consumeFx(view: HighwayView, hitY: number, level: number): void {
    const list = this.engine.fx;
    for (const fx of list) {
      if (fx.at <= this.lastFxAt) continue;
      const col = this.fxLane(fx, view);
      const strLane = this.stringLaneOf(fx, view);
      const lane = col ?? strLane;
      if (!lane) continue;
      const x = lane.x + lane.w / 2;
      const color = JUDGEMENT_COLORS[fx.judgement] ?? "#ffffff";
      const sl = col ? strLane : null;
      if (fx.judgement !== "wrong" && !fx.auto) {
        // Guitar / violin: shown over the fret and over the struck string, so each hand sees how it did.
        for (const px of sl ? [x, sl.x + sl.w / 2] : [x]) {
          // Labels are wider than a key, so neighbours replace each other instead of piling up.
          this.popups = this.popups.filter((p) => Math.abs(p.x - px) > 70);
          this.popups.push({
            text: view.labels[fx.judgement] ?? fx.judgement,
            sub: fx.timing ? view.labels[fx.timing] : undefined,
            subColor: fx.timing === "early" ? "#7dd3fc" : "#fda4af",
            color,
            x: px,
            born: fx.at,
          });
        }
        while (this.popups.length > 8) this.popups.shift();
      }
      if (fx.judgement === "miss" || fx.judgement === "wrong") continue;
      const scale = fx.judgement === "perfect" ? 1 : fx.judgement === "great" ? 0.7 : 0.45;
      const lanes = [lane];
      if (sl) lanes.push(sl);
      if (view.dust !== "off") {
        const burst: Record<DustStyle, number> = { smoke: 5, fountain: 18, plume: 5, rays: 12, sparkle: 10, nebula: 4, fog: 3, embers: 12, stardust: 10 };
        const tint = this.fxColor(fx);
        const reach = view.dust === "smoke" || view.dust === "nebula" ? 90 : 40;
        for (const l of lanes) this.cloud(l, tint, hitY, hitY - reach, burst[view.dust] * scale * view.dustLevel * 2, view.dust);
      }
      if (level > 0) {
        const style = view.effectStyle;
        // Auto-play paints in the note's own colour; the player's hits in the judgement colour.
        const tint = fx.auto ? this.fxColor(fx) : color;
        const amp = this.amp(level);
        for (const l of lanes) {
          const lx = l.x + l.w / 2;
          // A ring flash for every style (two at high intensity); with a bloom it is all the "glow" style shows.
          this.emitFx({ kind: "ring", x: lx, y: hitY - 2, vx: 0, vy: 0, g: 0, max: 0.4, size: Math.max(24, l.w * 1.6), color: tint });
          if (level > 0.55) this.emitFx({ kind: "ring", x: lx, y: hitY - 2, vx: 0, vy: 0, g: 0, max: 0.5, size: Math.max(30, l.w * 1.9), color: mixHex(tint, "#ffffff", 0.6) });
          if (style === "glow") {
            this.emitFx({ kind: "dot", x: lx, y: hitY - 6, vx: 0, vy: -20, g: 0, max: 0.35, size: Math.max(40, l.w * 3) * (0.4 + level), color: tint });
            continue;
          }
          const dots = style === "sparks" || style === "stars" || style === "fire" ? Math.round(16 * scale * amp.count) : 0;
          for (let i = 0; i < dots; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
            const sp = (90 + Math.random() * 220) * amp.power;
            this.emitFx({ kind: "dot", x: lx + (Math.random() - 0.5) * 10, y: hitY - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 260, max: 0.35 + Math.random() * 0.45, size: 6 + Math.random() * 10, color: tint });
          }
          this.burst(l, tint, hitY, Math.max(1, Math.round(26 * scale * amp.count)), style, 1.15 * amp.power);
        }
      }
    }
    if (list.length) this.lastFxAt = Math.max(this.lastFxAt, list[list.length - 1].at);
  }

  private fxColor(fx: { midi: number; string: number }): string {
    return this.noteColor({ midi: fx.midi, string: fx.string, track: 0 } as PlayNote);
  }

  private stepParticles(dt: number): void {
    if (!this.particles.length) return;
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.max) continue;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      if (p.wander) p.vx += (Math.random() - 0.5) * p.wander * 20 * dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot = (p.rot ?? 0) + p.vr * dt;
      alive.push(p);
    }
    this.particles = alive;
  }

  /** Draws the particles behind the notes (`back`) or in front of them. */
  private drawParticles(now: number, back: boolean): void {
    const { ctx } = this;
    if (!this.particles.length) return;
    ctx.lineCap = "round";
    for (const p of this.particles) {
      if (BACK_KINDS.has(p.kind) !== back) continue;
      const k = 1 - p.life / p.max;
      ctx.globalCompositeOperation = SOLID_KINDS.has(p.kind) ? "source-over" : "lighter";
      ctx.globalAlpha = k;
      switch (p.kind) {
        case "streak": {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * (0.5 + 0.5 * k);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
          break;
        }
        case "star": {
          const tw = 0.6 + 0.4 * Math.sin(now / 60 + p.x);
          const s = p.size * (0.5 + 0.5 * k) * tw;
          ctx.drawImage(glowSprite(p.color, 32), p.x - s, p.y - s, s * 2, s * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(p.x - s, p.y - 0.5, s * 2, 1);
          ctx.fillRect(p.x - 0.5, p.y - s, 1, s * 2);
          break;
        }
        case "flame": {
          const age = 1 - k;
          const color = FIRE[Math.min(FIRE.length - 1, Math.floor(age * FIRE.length + (p.color === FIRE[1] ? 0.5 : 0)))];
          const s = p.size * (0.35 + 0.65 * k);
          ctx.drawImage(glowSprite(color, 32), p.x - s / 2, p.y - s * 0.7, s, s * 1.3);
          break;
        }
        case "ring": {
          const s = p.size * (0.4 + 0.9 * (1 - k));
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.min(3.5, Math.max(1.5, p.size / 18)) * k;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "mote": {
          // Fades in quickly, then lingers and thins out.
          const age = p.life / p.max;
          ctx.globalAlpha = Math.min(1, age * 8) * (1 - age) * 0.9;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          if (p.size > 2.6) ctx.drawImage(glowSprite(p.color, 32), p.x - p.size * 2, p.y - p.size * 2, p.size * 5, p.size * 5);
          break;
        }
        case "haze": {
          const age = p.life / p.max;
          ctx.globalAlpha = Math.min(1, age * 5) * (1 - age) * 0.3;
          const s = p.size * (0.7 + 0.6 * age);
          ctx.drawImage(glowSprite(p.color, 64), p.x - s / 2, p.y - s * 0.6, s, s * 1.2);
          break;
        }
        case "puff": {
          const age = p.life / p.max;
          ctx.globalAlpha = Math.min(1, age * 4) * (1 - age) * (p.peak ?? 0.2);
          const s = p.size * (0.6 + 0.9 * age);
          const sq = p.squash ?? 1;
          ctx.drawImage(softSprite(p.color, 64), p.x - s / 2, p.y - (s * sq) / 2, s, s * sq);
          break;
        }
        case "jet": {
          // A streak while it shoots up; as the drag slows it, it shrinks into a drifting speck of dust.
          const age = p.life / p.max;
          ctx.globalAlpha = Math.min(1, age * 12) * Math.pow(1 - age, 0.7) * (p.peak ?? 0.85);
          const len = Math.hypot(p.vx, p.vy) * (p.trail ?? 0.05);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          if (len > p.size) {
            const inv = len / Math.max(1e-3, Math.hypot(p.vx, p.vy));
            ctx.lineTo(p.x - p.vx * inv, p.y - p.vy * inv);
          } else ctx.lineTo(p.x + 0.01, p.y + p.size * 0.5);
          ctx.stroke();
          if (p.size > 1.8) ctx.drawImage(glowSprite(p.color, 32), p.x - p.size * 2.5, p.y - p.size * 2.5, p.size * 5, p.size * 5);
          break;
        }
        case "ember": {
          ctx.globalAlpha = k * (0.55 + 0.45 * Math.sin(now / 45 + p.x * 3));
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          ctx.drawImage(glowSprite(p.color, 32), p.x - p.size * 2.5, p.y - p.size * 2.5, p.size * 6, p.size * 6);
          break;
        }
        case "twinkle": {
          const age = p.life / p.max;
          const tw = 0.5 + 0.5 * Math.sin(now / 90 + p.x * 7);
          ctx.globalAlpha = Math.min(1, age * 5) * (1 - age) * (0.35 + 0.65 * tw);
          const s = p.size * (0.7 + 0.5 * tw);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - s, p.y - 0.5, s * 2, 1);
          ctx.fillRect(p.x - 0.5, p.y - s, 1, s * 2);
          ctx.drawImage(glowSprite(p.color, 32), p.x - s, p.y - s, s * 2, s * 2);
          break;
        }
        case "glyph": {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot ?? 0);
          ctx.font = `700 ${Math.round(p.size)}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? "♪", 0, 0);
          ctx.restore();
          break;
        }
        case "confetti": {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot ?? 0);
          ctx.scale(1, Math.cos((p.rot ?? 0) * 1.7));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
        }
        case "bubble": {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fillRect(p.x - p.size * 0.45, p.y - p.size * 0.45, Math.max(1, p.size * 0.3), Math.max(1, p.size * 0.3));
          break;
        }
        case "bolt": {
          const rot = p.rot ?? -Math.PI / 2;
          const segs = 6;
          let x = p.x;
          let y = p.y;
          const seed = Math.floor(now / 40) + Math.round(p.size);
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let i = 1; i <= segs; i++) {
            const jitter = (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1;
            const along = p.size / segs;
            x += Math.cos(rot) * along - Math.sin(rot) * jitter * 14;
            y += Math.sin(rot) * along + Math.cos(rot) * jitter * 14;
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = withAlpha(p.color, 0.45);
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.6;
          ctx.stroke();
          break;
        }
        case "petal": {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot ?? 0);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.5 * Math.abs(Math.cos((p.rot ?? 0) * 1.3)) + 1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "pixel": {
          ctx.globalAlpha = Math.ceil(k * 4) / 4;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3, p.size, p.size);
          break;
        }
        default: {
          const s = p.size * (0.6 + 0.4 * k);
          ctx.drawImage(glowSprite(p.color, 32), p.x - s / 2, p.y - s / 2, s, s);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private drawPopups(now: number, hitY: number): void {
    const { ctx } = this;
    if (!this.popups.length) return;
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
      // Kept whole on screen: the outermost string lanes sit right at the edge.
      const half = ctx.measureText(p.text).width / 2 + 6;
      const x = Math.max(half, Math.min(this.w - half, p.x));
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(7,10,26,0.85)";
      ctx.strokeText(p.text, x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, y);
      if (p.sub) {
        ctx.font = `800 ${Math.round(11 * scale)}px system-ui, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeText(p.sub, x, y + 16);
        ctx.fillStyle = p.subColor ?? "#ffffff";
        ctx.fillText(p.sub, x, y + 16);
      }
    }
    ctx.globalAlpha = 1;
    this.popups = keep;
  }
}
