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

    const blackH = h * BLACK_KEY_RATIO;
    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // White keys.
    for (let m = L.low; m <= L.high; m++) {
      if (isBlack(m)) continue;
      const lane = L.lane(m)!;
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
      if ((view.showAllNames || m % 12 === 0) && kw >= 11) {
        ctx.font = `${m % 12 === 0 ? 700 : 600} ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = sound || pressed ? "rgba(255,255,255,0.9)" : m % 12 === 0 ? "#4b4f86" : "rgba(75,79,134,0.7)";
        const label = noteName(m, view.naming) + (m % 12 === 0 ? octaveOf(m) : "");
        ctx.fillText(label, x + kw / 2, ly);
      }
    }

    // Black keys.
    for (let m = L.low; m <= L.high; m++) {
      if (!isBlack(m)) continue;
      const lane = L.lane(m)!;
      const pressed = marks.pressed.has(m);
      const sound = marks.sounding.get(m);
      const target = marks.target.get(m);
      const bh = blackH + (pressed ? 2 : 0);
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
      if (keyLabel && lane.w >= 12) {
        const fs = Math.max(8, Math.min(11, lane.w * 0.45));
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(220,224,255,0.8)";
        ctx.fillText(keyLabel.toUpperCase(), lane.x + lane.w / 2, bh - 6);
      }
    }

    // Top shadow to separate from the highway.
    const shade = ctx.createLinearGradient(0, 0, 0, 10);
    shade.addColorStop(0, "rgba(0,0,0,0.55)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, 10);
  }
}

export interface FretboardView {
  layout: FretLayout;
  t: number;
  naming: NoteNaming;
  violin: boolean;
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

  draw(view: FretboardView): void {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    const L = view.layout;
    const spec = L.spec;
    const count = spec.tuning.length;
    const rowH = h / count;
    const marks = collectMarks(this.engine, view.t);
    const colors = view.violin ? VIOLIN_STRING_COLORS : GUITAR_STRING_COLORS;
    const now = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Wood.
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
    ctx.fillRect(0, 0, w, h);
    // Open-string area.
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, L.colW, h);

    // Inlays / position markers.
    const inlays = view.violin ? [2, 4, 5, 7, 9, 12] : [3, 5, 7, 9, 15];
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
    if (!view.violin && 12 < L.columns) {
      const cx = 12 * L.colW + L.colW / 2;
      ctx.fillStyle = "rgba(235,225,205,0.22)";
      for (const y of [h * 0.3, h * 0.7]) {
        ctx.beginPath();
        ctx.arc(cx, y, Math.min(7, L.colW * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Frets + nut.
    for (let f = 1; f < L.columns + 1; f++) {
      const x = Math.round(f * L.colW);
      if (f === 1) {
        ctx.fillStyle = "#e8e0cc";
        ctx.fillRect(x - 2, 0, 4, h);
      } else if (!view.violin) {
        ctx.fillStyle = "rgba(200,200,215,0.55)";
        ctx.fillRect(x - 1, 0, 2, h);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(x, 0, 1, h);
      }
    }

    // Fret numbers.
    ctx.font = "600 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let f = 1; f < L.columns; f++) {
      if (L.colW < 22 && f % 2 === 0 && f !== 12) continue;
      ctx.fillText(String(f), f * L.colW + L.colW / 2, 2);
    }

    // Strings.
    for (let s = 0; s < count; s++) {
      const row = this.rowOf(s, count);
      const y = row * rowH + rowH / 2;
      const thick = view.violin ? 1.2 + (count - 1 - s) * 0.45 : 1 + (count - 1 - s) * 0.5;
      const ring = [...marks.pressedPos].some((p) => p.startsWith(`${s}:`));
      ctx.fillStyle = ring ? withAlpha(colors[s], 0.95) : "rgba(225,225,235,0.75)";
      const wobble = ring ? Math.sin(now / 18) * 0.8 : 0;
      ctx.fillRect(L.colW, y - thick / 2 + wobble, w - L.colW, thick);
      // Open-string label.
      ctx.font = `800 ${Math.max(10, Math.min(15, rowH * 0.5))}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors[s];
      const label = view.naming === "solfege" ? noteName(spec.tuning[s], "solfege") : spec.labels[s];
      ctx.fillText(label, L.colW / 2, y);
    }

    // Markers.
    const radius = Math.max(7, Math.min(rowH * 0.36, L.colW * 0.34));
    const drawDot = (s: number, f: number, fill: string, ring: string | null, glow: boolean) => {
      const row = this.rowOf(s, count);
      const cx = f * L.colW + L.colW / 2;
      const cy = row * rowH + rowH / 2;
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
      ctx.fillText(String(f), cx, cy + 0.5);
    };

    for (const [pos, c] of marks.targetPos) {
      const [s, f] = pos.split(":").map(Number);
      ctx.globalAlpha = 0.45 + 0.4 * pulse;
      drawDot(s, f, withAlpha(c, 0.55), "rgba(255,255,255,0.9)", false);
      ctx.globalAlpha = 1;
    }
    for (const [pos, c] of marks.soundingPos) {
      const [s, f] = pos.split(":").map(Number);
      drawDot(s, f, c, null, true);
    }
    for (const pos of marks.pressedPos) {
      const [s, f] = pos.split(":").map(Number);
      drawDot(s, f, "#ffffff", colors[s], true);
    }

    const shade = ctx.createLinearGradient(0, 0, 0, 10);
    shade.addColorStop(0, "rgba(0,0,0,0.6)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, 10);
  }
}
