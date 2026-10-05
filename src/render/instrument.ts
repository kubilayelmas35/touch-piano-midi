import type { Engine } from "../engine/engine";
import type { FretLayout, PianoLayout } from "../engine/layout";
import { NoteState, type PlayNote } from "../engine/types";
import { HAND_SPLIT } from "../midi/song";
import { isBlack, noteName, octaveOf, type NoteNaming } from "../lib/notes";
import { GUITAR_STRING_COLORS, TRACK_COLORS, VIOLIN_STRING_COLORS, glowSprite, roundRect, withAlpha } from "./theme";

export const BLACK_KEY_RATIO = 0.62;

interface Marks {
  /** midi → colour for notes sounding from the song (auto-play / hit). */
  sounding: Map<number, string>;
  /** midi → colour for notes the player should press now. */
  target: Map<number, string>;
  pressed: Set<number>;
  /** "string:fret" keys for fretted instruments. */
  soundingPos: Map<string, string>;
  targetPos: Map<string, string>;
  pressedPos: Set<string>;
}

function colorFor(engine: Engine, n: PlayNote): string {
  if (n.string >= 0) {
    const colors = engine.config.instrument === "violin" ? VIOLIN_STRING_COLORS : GUITAR_STRING_COLORS;
    return colors[n.string % colors.length];
  }
  const tracks = engine.config.playTracks;
  const idx = tracks.length > 1 ? Math.max(0, tracks.indexOf(n.track)) : n.midi >= HAND_SPLIT ? 0 : 1;
  return TRACK_COLORS[idx % TRACK_COLORS.length][0];
}

function collectMarks(engine: Engine, t: number): Marks {
  const marks: Marks = {
    sounding: new Map(),
    target: new Map(),
    pressed: new Set(),
    soundingPos: new Map(),
    targetPos: new Map(),
    pressedPos: new Set(),
  };
  for (const h of engine.held.values()) {
    marks.pressed.add(h.midi);
    if (h.string >= 0) marks.pressedPos.add(`${h.string}:${h.fret}`);
  }
  const win = Math.max(0.12, (engine.config.timingWindowMs / 1000) * engine.config.speed);
  const [i0, i1] = engine.visibleRange(t - 0.05, t + win);
  const notes = engine.notes;
  let waitGroup = -1;
  if (engine.waiting) {
    for (let i = i0; i < notes.length; i++) {
      if (notes[i].state === NoteState.Pending) {
        waitGroup = notes[i].group;
        break;
      }
    }
  }
  for (let i = i0; i < i1; i++) {
    const n = notes[i];
    const c = colorFor(engine, n);
    const pos = `${n.string}:${n.fret}`;
    const sounding = n.time <= t && t < n.time + n.duration;
    if (sounding && n.state === NoteState.Hit) {
      marks.sounding.set(n.midi, c);
      if (n.string >= 0) marks.soundingPos.set(pos, c);
    } else if (n.state === NoteState.Pending && (n.group === waitGroup || Math.abs(n.time - t) <= win)) {
      marks.target.set(n.midi, c);
      if (n.string >= 0) marks.targetPos.set(pos, c);
    }
  }
  return marks;
}

abstract class CanvasSurface {
  protected readonly ctx: CanvasRenderingContext2D;
  protected w = 0;
  protected h = 0;
  protected dpr = 1;

  constructor(
    protected readonly canvas: HTMLCanvasElement,
    protected readonly engine: Engine
  ) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(w: number, h: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
  }
}

export interface KeyboardView {
  layout: PianoLayout;
  t: number;
  naming: NoteNaming;
  showAllNames: boolean;
  keyLabels: Map<number, string> | null;
  /** Fretless piano with the keys hidden: one white surface. */
  bare?: boolean;
  /** x of each finger on the surface (bare mode). */
  fingers?: number[];
}

export class KeyboardRenderer extends CanvasSurface {
  draw(view: KeyboardView): void {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    const marks = collectMarks(this.engine, view.t);
    const L = view.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, w, h);
    if (view.bare) {
      this.drawBare(view, marks);
      return;
    }

    const blackH = h * BLACK_KEY_RATIO;
    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // White keys (in compact mode every key is a full-height column; black ones are drawn below).
    for (const m of L.keys) {
      if (isBlack(m)) continue;
      const lane = L.lane(m)!;
      if (lane.x + lane.w < 0 || lane.x > w) continue;
      const pressed = marks.pressed.has(m);
      const sound = marks.sounding.get(m);
      const target = marks.target.get(m);
      const x = lane.x + 0.5;
      const kw = lane.w - 1;
      const top = pressed ? 2 : 0;
      const grad = ctx.createLinearGradient(0, top, 0, h);
      if (sound || pressed) {
        const c = sound ?? "#a78bfa";
        grad.addColorStop(0, withAlpha(c, 0.75));
        grad.addColorStop(1, c);
      } else {
        grad.addColorStop(0, "#f4f6ff");
        grad.addColorStop(0.85, "#e3e7f7");
        grad.addColorStop(1, "#c9cee4");
      }
      ctx.fillStyle = grad;
      roundRect(ctx, x, top - 6, kw, h - top + 6 - 1, Math.min(6, kw * 0.18));
      ctx.fill();
      if (target && !sound && !pressed) {
        ctx.fillStyle = withAlpha(target, 0.25 + 0.3 * pulse);
        roundRect(ctx, x + 2, blackH * 0.6, kw - 4, h - blackH * 0.6 - 4, 4);
        ctx.fill();
      }
      // Labels.
      const fs = Math.max(8, Math.min(12, kw * 0.36));
      let ly = h - 7;
      const keyLabel = view.keyLabels?.get(m);
      if (keyLabel && kw >= 16) {
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = sound || pressed ? "rgba(255,255,255,0.95)" : "rgba(60,64,110,0.75)";
        ctx.fillText(keyLabel.toUpperCase(), x + kw / 2, ly);
        ly -= fs + 4;
      }
      if ((view.showAllNames || L.compact || m % 12 === 0) && kw >= 11) {
        ctx.font = `${m % 12 === 0 ? 700 : 600} ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = sound || pressed ? "rgba(255,255,255,0.9)" : m % 12 === 0 ? "#4b4f86" : "rgba(75,79,134,0.7)";
        ctx.fillText(this.keyName(m, view, kw), x + kw / 2, ly);
      }
    }

    // Black keys.
    for (const m of L.keys) {
      if (!isBlack(m)) continue;
      const lane = L.lane(m)!;
      if (lane.x + lane.w < 0 || lane.x > w) continue;
      const pressed = marks.pressed.has(m);
      const sound = marks.sounding.get(m);
      const target = marks.target.get(m);
      const bh = (L.compact ? h - 1 : blackH) + (pressed ? 2 : 0);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, lane.x + 1, -4, lane.w, bh + 6, 4);
      ctx.fill();
      const grad = ctx.createLinearGradient(0, 0, 0, bh);
      if (sound || pressed) {
        const c = sound ?? "#8b5cf6";
        grad.addColorStop(0, withAlpha(c, 0.7));
        grad.addColorStop(1, c);
      } else {
        grad.addColorStop(0, "#1d2033");
        grad.addColorStop(0.8, "#2b2f48");
        grad.addColorStop(1, "#3a3f5e");
      }
      ctx.fillStyle = grad;
      roundRect(ctx, lane.x, -4, lane.w, bh + 4, Math.min(4, lane.w * 0.2));
      ctx.fill();
      if (target && !sound && !pressed) {
        ctx.fillStyle = withAlpha(target, 0.4 + 0.4 * pulse);
        roundRect(ctx, lane.x + 2, bh * 0.45, lane.w - 4, bh * 0.5, 3);
        ctx.fill();
      }
      const keyLabel = view.keyLabels?.get(m);
      if (L.compact) {
        // Same order as the white keys: computer key at the bottom, note name above it.
        const fs = Math.max(8, Math.min(12, lane.w * 0.36));
        let ly = h - 7;
        if (keyLabel && lane.w >= 16) {
          ctx.font = `700 ${fs}px system-ui, sans-serif`;
          ctx.fillStyle = sound || pressed ? "rgba(255,255,255,0.95)" : "rgba(225,229,255,0.85)";
          ctx.fillText(keyLabel.toUpperCase(), lane.x + lane.w / 2, ly);
          ly -= fs + 4;
        }
        if (lane.w >= 11) {
          ctx.font = `600 ${fs}px system-ui, sans-serif`;
          ctx.fillStyle = sound || pressed ? "rgba(255,255,255,0.9)" : "rgba(200,205,240,0.6)";
          ctx.fillText(this.keyName(m, view, lane.w), lane.x + lane.w / 2, ly);
        }
      } else if (keyLabel && lane.w >= 12) {
        const fs = Math.max(8, Math.min(11, lane.w * 0.45));
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(220,224,255,0.8)";
        ctx.fillText(keyLabel.toUpperCase(), lane.x + lane.w / 2, bh - 6);
      }
    }

    this.topShade();
  }

  /** Note name for a key; with only the song's keys shown neighbours can be octaves apart, so it carries the octave when it fits. */
  private keyName(m: number, view: KeyboardView, width: number): string {
    const base = noteName(m, view.naming);
    if (m % 12 !== 0 && !view.layout.compact) return base;
    const full = base + octaveOf(m);
    return m % 12 === 0 || this.ctx.measureText(full).width <= width - 4 ? full : base;
  }

  private drawBare(view: KeyboardView, marks: Marks): void {
    const { ctx, w, h } = this;
    const L = view.layout;
    const first = L.lane(L.keys[0])!;
    const last = L.lane(L.keys[L.keys.length - 1])!;
    const x0 = Math.max(0, first.x) + 0.5;
    const x1 = Math.min(w, last.x + last.w) - 0.5;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#f4f6ff");
    grad.addColorStop(0.85, "#e3e7f7");
    grad.addColorStop(1, "#c9cee4");
    ctx.fillStyle = grad;
    roundRect(ctx, x0, -6, x1 - x0, h + 5, 6);
    ctx.fill();

    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    const bw = Math.max(6, L.whiteW * 0.7);
    const fingers = view.fingers ?? [];
    for (const m of L.keys) {
      const lane = L.lane(m)!;
      const c = lane.x + lane.w / 2;
      if (c + bw < 0 || c - bw > w) continue;
      const sound = marks.sounding.get(m);
      const target = marks.target.get(m);
      const pressed = marks.pressed.has(m) && fingers.length === 0;
      const col = sound ?? (pressed ? "#a78bfa" : target);
      if (!col) continue;
      const a = sound || pressed ? 0.75 : 0.25 + 0.3 * pulse;
      const band = ctx.createLinearGradient(0, 0, 0, h);
      band.addColorStop(0, withAlpha(col, a * 0.35));
      band.addColorStop(1, withAlpha(col, a));
      ctx.fillStyle = band;
      roundRect(ctx, c - bw / 2, 0, bw, h - 4, Math.min(6, bw * 0.3));
      ctx.fill();
    }

    for (const fx of fingers) {
      const r = Math.max(14, Math.min(34, h * 0.22));
      const glow = ctx.createRadialGradient(fx, h * 0.6, 0, fx, h * 0.6, r * 1.8);
      glow.addColorStop(0, "rgba(139,92,246,0.85)");
      glow.addColorStop(0.45, "rgba(139,92,246,0.35)");
      glow.addColorStop(1, "rgba(139,92,246,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(fx - r * 2, 0, r * 4, h);
      ctx.fillStyle = "rgba(139,92,246,0.9)";
      ctx.fillRect(fx - 1, 0, 2, h - 4);
    }
    this.topShade();
  }

  /** Top shadow to separate from the highway. */
  private topShade(): void {
    const shade = this.ctx.createLinearGradient(0, 0, 0, 10);
    shade.addColorStop(0, "rgba(0,0,0,0.55)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = shade;
    this.ctx.fillRect(0, 0, this.w, 10);
  }
}

export interface FretboardView {
  layout: FretLayout;
  t: number;
  naming: NoteNaming;
  violin: boolean;
  /** string → fret held by the left hand. */
  fingers: Map<number, number>;
  /** performance.now() of the last strike per string. */
  struckAt: number[];
  isStruck: (string: number) => boolean;
  /** 0–1 vibration per string (from the playing model). */
  energyOf: (string: number) => number;
  /** Computer-keyboard labels per string and per fret (from fret 1), when string mode is on. */
  keyLabels: { strings: string[]; frets: string[] } | null;
  /** Fretless: no fret wires, numbers or inlays (the nut stays). */
  hideFrets?: boolean;
}

export class FretboardRenderer extends CanvasSurface {
  /** Row index (0 = top) for a string (0 = lowest pitch). Highest string is drawn on top. */
  rowOf(string: number, count: number): number {
    return count - 1 - string;
  }

  stringAt(y: number, count: number): number {
    const row = Math.max(0, Math.min(count - 1, Math.floor((y / this.h) * count)));
    return count - 1 - row;
  }

  /** Auto-play: strings the song is sounding right now (string → fret and 0–1 energy). */
  private autoStrings(t: number, violin: boolean): Map<number, { fret: number; e: number; start: number }> {
    const out = new Map<number, { fret: number; e: number; start: number }>();
    const engine = this.engine;
    if (!engine.config.autoPlay) return out;
    const [i0, i1] = engine.visibleRange(t, t + 0.0001);
    for (let i = i0; i < i1; i++) {
      const n = engine.notes[i];
      if (n.string < 0 || n.state !== NoteState.Hit || t < n.time || t >= n.time + n.duration) continue;
      const age = (t - n.time) / engine.config.speed;
      const e = violin ? 0.8 : Math.max(0.35, Math.exp(-age / 1.1));
      const prev = out.get(n.string);
      if (!prev || n.time > prev.start) out.set(n.string, { fret: n.fret, e, start: n.time });
    }
    return out;
  }

  /** 0..1 vibration of a string, for drawing. */
  private energy(view: FretboardView, s: number, auto: Map<number, { e: number }>): number {
    const a = auto.get(s)?.e ?? 0;
    const e = view.energyOf(s);
    if (view.violin) return view.isStruck(s) ? Math.max(0.1, e * 0.7) : a * 0.7;
    return Math.max(e * e, a * a);
  }

  draw(view: FretboardView): void {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    const L = view.layout;
    const spec = L.spec;
    const count = spec.tuning.length;
    const rowH = h / count;
    const neckW = L.width;
    const marks = collectMarks(this.engine, view.t);
    const auto = this.autoStrings(view.t, view.violin);
    let fingers = view.fingers;
    if (auto.size) {
      fingers = new Map(fingers);
      for (const [s, a] of auto) if (!fingers.has(s)) fingers.set(s, a.fret);
    }
    const colors = view.violin ? VIOLIN_STRING_COLORS : GUITAR_STRING_COLORS;
    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = "center";

    // Neck wood.
    const wood = ctx.createLinearGradient(0, 0, 0, h);
    if (view.violin) {
      wood.addColorStop(0, "#15110f");
      wood.addColorStop(0.5, "#221a16");
      wood.addColorStop(1, "#120e0c");
    } else {
      wood.addColorStop(0, "#2a1a12");
      wood.addColorStop(0.5, "#3a2418");
      wood.addColorStop(1, "#24160f");
    }
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, neckW, h);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, L.colW, h);

    // Inlays / position markers.
    const bare = !!view.hideFrets;
    const inlays = bare ? [] : view.violin ? [2, 4, 5, 7, 9, 12] : [3, 5, 7, 9, 15];
    for (const f of inlays) {
      if (f >= L.columns) continue;
      const cx = f * L.colW + L.colW / 2;
      ctx.fillStyle = view.violin ? "rgba(255,255,255,0.05)" : "rgba(235,225,205,0.22)";
      if (view.violin) ctx.fillRect(f * L.colW, 0, L.colW, h);
      else {
        ctx.beginPath();
        ctx.arc(cx, h / 2, Math.min(7, L.colW * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (!bare && !view.violin && 12 < L.columns) {
      const cx = 12 * L.colW + L.colW / 2;
      ctx.fillStyle = "rgba(235,225,205,0.22)";
      for (const y of [h * 0.3, h * 0.7]) {
        ctx.beginPath();
        ctx.arc(cx, y, Math.min(7, L.colW * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Frets + nut.
    for (let f = 1; f <= L.columns; f++) {
      const x = Math.round(f * L.colW);
      if (f === 1) {
        ctx.fillStyle = "#e8e0cc";
        ctx.fillRect(x - 2, 0, 4, h);
      } else if (bare) {
        continue;
      } else if (!view.violin) {
        ctx.fillStyle = "rgba(200,200,215,0.55)";
        ctx.fillRect(x - 1, 0, 2, h);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(x, 0, 1, h);
      }
    }

    // Fret numbers, plus the fret key when it differs from the number.
    ctx.textBaseline = "top";
    for (let f = 1; f < (bare ? 0 : L.columns); f++) {
      if (L.colW < 22 && f % 2 === 0 && f !== 12) continue;
      const cx = f * L.colW + L.colW / 2;
      ctx.font = "600 9px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(String(f), cx, 2);
      const key = view.keyLabels?.frets[f - 1];
      if (key && key !== String(f)) {
        ctx.font = "700 9px system-ui, sans-serif";
        ctx.fillStyle = "rgba(196,181,253,0.8)";
        ctx.fillText(key, cx, 12);
      }
    }

    // Strike zone (pick area for guitar, bow area for violin).
    const px = L.pluckX;
    const pw = L.pluckW;
    if (pw > 0) {
      const zone = ctx.createLinearGradient(px, 0, px + pw, 0);
      if (view.violin) {
        zone.addColorStop(0, "#3a2414");
        zone.addColorStop(0.12, "#24170e");
        zone.addColorStop(1, "#140d08");
      } else {
        zone.addColorStop(0, "#161a2c");
        zone.addColorStop(1, "#0b0d18");
      }
      ctx.fillStyle = zone;
      ctx.fillRect(px, 0, pw, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, 0, pw, h);
      ctx.clip();
      if (view.violin) {
        // Bridge.
        ctx.fillStyle = "rgba(222,190,140,0.55)";
        ctx.fillRect(px + 6, 0, 5, h);
      } else {
        // Sound hole with rosette.
        const cx = px + pw * 0.62;
        const r = Math.min(pw * 0.42, h * 0.42);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.arc(cx, h / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(196,181,253,0.18)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, h / 2, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(px, 0, 2, h);

      // Strings to strike now, and strings just struck.
      const targetStrings = new Map<number, string>();
      for (const [pos, c] of marks.targetPos) targetStrings.set(Number(pos.split(":")[0]), c);
      for (let s = 0; s < count; s++) {
        const top = this.rowOf(s, count) * rowH;
        const e = this.energy(view, s, auto);
        const target = targetStrings.get(s);
        if (target) {
          ctx.fillStyle = withAlpha(target, 0.14 + 0.2 * pulse);
          roundRect(ctx, px + 4, top + 3, pw - 8, rowH - 6, 8);
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = withAlpha(target, 0.5 + 0.4 * pulse);
          ctx.stroke();
        }
        if (e > 0.03) {
          ctx.fillStyle = withAlpha(colors[s], 0.22 * e);
          roundRect(ctx, px + 4, top + 3, pw - 8, rowH - 6, 8);
          ctx.fill();
        }
      }
    }

    // Strings; the part between the finger and the bridge vibrates after a strike.
    for (let s = 0; s < count; s++) {
      const y = this.rowOf(s, count) * rowH + rowH / 2;
      const thick = view.violin ? 1.2 + (count - 1 - s) * 0.45 : 1 + (count - 1 - s) * 0.5;
      const e = this.energy(view, s, auto);
      const finger = fingers.get(s) ?? 0;
      const xv = finger > 0 ? Math.min(neckW, (finger + 1) * L.colW) : L.colW;
      const color = e > 0.03 ? colors[s] : "rgba(225,225,235,0.75)";
      ctx.fillStyle = "rgba(225,225,235,0.75)";
      if (xv > L.colW) ctx.fillRect(L.colW, y - thick / 2, xv - L.colW, thick);
      if (e > 0.03) {
        const amp = e * rowH * 0.16;
        const phase = Math.sin(now * (view.violin ? 0.11 : 0.09) + s * 1.7);
        const span = w - xv;
        ctx.beginPath();
        for (let x = xv; x <= w; x += 4) {
          const yy = y + Math.sin((Math.PI * (x - xv)) / span) * amp * phase;
          if (x === xv) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.lineCap = "round";
        ctx.strokeStyle = withAlpha(colors[s], 0.3 * e);
        ctx.lineWidth = thick + 6;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = thick + 0.5;
        ctx.stroke();
      } else {
        ctx.fillRect(xv, y - thick / 2, w - xv, thick);
      }

      // Labels: open-string name at the nut; name + key in the strike zone.
      ctx.textBaseline = "middle";
      const name = view.naming === "solfege" ? noteName(spec.tuning[s], "solfege") : spec.labels[s];
      ctx.font = `800 ${Math.max(10, Math.min(15, rowH * 0.5))}px system-ui, sans-serif`;
      ctx.fillStyle = colors[s];
      ctx.fillText(name, L.colW / 2, y);
      if (pw > 0) {
        const key = view.keyLabels?.strings[s];
        if (key && rowH >= 18) {
          const fs = Math.max(10, Math.min(13, rowH * 0.42));
          const kw = Math.max(fs * 1.7, ctx.measureText(key).width + 10);
          const kx = px + pw - kw / 2 - 8;
          ctx.fillStyle = "rgba(10,12,30,0.75)";
          roundRect(ctx, kx - kw / 2, y - fs * 0.85, kw, fs * 1.7, 6);
          ctx.fill();
          ctx.strokeStyle = withAlpha(colors[s], 0.6);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.font = `800 ${fs}px system-ui, sans-serif`;
          ctx.fillStyle = "#eef0ff";
          ctx.fillText(key, kx, y + 0.5);
        }
      }
    }

    // Markers.
    const radius = Math.max(7, Math.min(rowH * 0.36, L.colW * 0.34));
    const drawDot = (s: number, f: number, fill: string, ring: string | null, glow: boolean, text: string) => {
      if (f >= L.columns) return;
      const cx = f * L.colW + L.colW / 2;
      const cy = this.rowOf(s, count) * rowH + rowH / 2;
      if (glow) {
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(glowSprite(fill, 64), cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (ring) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = ring;
        ctx.stroke();
      }
      ctx.font = `800 ${Math.max(9, radius * 0.95)}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(10,12,30,0.9)";
      ctx.fillText(text, cx, cy + 0.5);
    };

    for (const [pos, c] of marks.targetPos) {
      const [s, f] = pos.split(":").map(Number);
      ctx.globalAlpha = 0.45 + 0.4 * pulse;
      drawDot(s, f, withAlpha(c, 0.55), "rgba(255,255,255,0.9)", false, String(f));
      ctx.globalAlpha = 1;
    }
    for (const [s, f] of view.fingers) drawDot(s, f, withAlpha(colors[s], 0.92), "rgba(255,255,255,0.85)", false, String(Math.round(f)));
    for (const [pos, c] of marks.soundingPos) {
      const [s, f] = pos.split(":").map(Number);
      drawDot(s, f, c, null, true, String(f));
    }
    for (const pos of marks.pressedPos) {
      const [s, f] = pos.split(":").map(Number);
      drawDot(s, f, "#ffffff", colors[s], true, String(f));
    }

    const shade = ctx.createLinearGradient(0, 0, 0, 10);
    shade.addColorStop(0, "rgba(0,0,0,0.6)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, 10);
  }
}
