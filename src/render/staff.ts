import type { Engine } from "../engine/engine";
import { NoteState } from "../engine/types";
import { isBlack } from "../lib/notes";
import { HAND_SPLIT } from "../midi/song";
import { HAND_INK, STAFF_THEMES, type StaffStyle } from "./staffThemes";

/** Diatonic step of each pitch class (sharps spelling: C♯ sits on C). */
const STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const TREBLE = [37, 39, 41, 43, 45]; // E4 G4 B4 D5 F5
const BASS = [25, 27, 29, 31, 33]; // G2 B2 D3 F3 A3
const MIDDLE_C = 35;
/** Ledger lines kept on screen beyond the outer staff lines (in diatonic steps). */
const MAX_LEDGER = 6;

export type Clefs = "treble" | "bass" | "grand";

export function diatonic(midi: number): number {
  return Math.floor(midi / 12) * 7 + STEP[((midi % 12) + 12) % 12];
}

export interface StaffMetrics {
  clefs: Clefs;
  /** Visible diatonic range, low → high. */
  lo: number;
  hi: number;
  /** Space between staff lines (px). */
  gap: number;
  height: number;
}

/** Which staves the song needs, and the line spacing that fits them in `maxHeight` px. */
export function staffMetrics(midis: readonly number[], maxHeight: number): StaffMetrics {
  const ds = midis.map(diatonic);
  const min = ds.length ? Math.min(...ds) : MIDDLE_C;
  const max = ds.length ? Math.max(...ds) : MIDDLE_C;
  const clefs: Clefs = min >= 33 ? "treble" : max <= 37 ? "bass" : "grand";
  const lines = staffLines(clefs);
  const top = lines[lines.length - 1];
  const bottom = lines[0];
  const hi = Math.min(top + MAX_LEDGER, Math.max(top, max)) + 2;
  const lo = Math.max(bottom - MAX_LEDGER, Math.min(bottom, min)) - 2;
  const gap = Math.max(4.5, Math.min(8, maxHeight / ((hi - lo) / 2 + 1)));
  return { clefs, lo, hi, gap, height: Math.round(((hi - lo) * gap) / 2 + gap) };
}

function staffLines(clefs: Clefs): number[] {
  return clefs === "treble" ? TREBLE : clefs === "bass" ? BASS : [...BASS, ...TREBLE];
}

/** Ledger lines a note at diatonic step `d` needs. */
export function ledgersFor(d: number, clefs: Clefs): number[] {
  const lines = staffLines(clefs);
  const top = lines[lines.length - 1];
  const bottom = lines[0];
  const out: number[] = [];
  if (d > top) for (let k = top + 2; k <= d; k += 2) out.push(k);
  else if (d < bottom) for (let k = bottom - 2; k >= d; k -= 2) out.push(k);
  else if (clefs === "grand" && d === MIDDLE_C) out.push(MIDDLE_C);
  return out;
}

export interface StaffView {
  t: number;
  metrics: StaffMetrics;
  fingers: boolean;
  style: StaffStyle;
}

/** Song seconds per pixel are fixed so rhythms keep their shape at any tempo. */
const PX_PER_SEC = 150;
/** Note lengths in beats; played notes run a little short of their written value. */
const HALF_BEATS = 1.6;
const WHOLE_BEATS = 3.2;
const EIGHTH_BEATS = 0.7;
const SIXTEENTH_BEATS = 0.35;
/** The next notes start to swell this long (song s) before the playhead. */
const APPROACH_SEC = 0.3;
const RING_MS = 420;

export class StaffRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private clefGlyphs: boolean | null = null;
  private beatGrid: unknown = null;
  private beatLen = 0.5;
  /** Measure number of each downbeat, by its time. */
  private measures = new Map<number, number>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly engine: Engine
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

  /** Musical-symbol fonts are missing on some phones; fall back to letter clefs there. */
  private hasClefGlyphs(): boolean {
    if (this.clefGlyphs === null) {
      const g = this.ctx;
      g.font = "40px 'Noto Music', 'Segoe UI Symbol', 'Apple Symbols', serif";
      const clef = g.measureText("\u{1D11E}").width;
      const missing = g.measureText("\u{10FFFD}").width;
      this.clefGlyphs = clef > 0 && Math.abs(clef - missing) > 0.5;
    }
    return this.clefGlyphs;
  }

  /** Average beat length of the song (s), for telling quarter, half and eighth notes apart. */
  private beatSec(): number {
    const grid = this.engine.grid;
    if (grid !== this.beatGrid) {
      this.beatGrid = grid;
      const song = grid.filter((b) => b.time >= 0);
      this.beatLen = song.length > 1 ? (song[song.length - 1].time - song[0].time) / (song.length - 1) : 0.5;
      let bar = 0;
      this.measures = new Map(song.filter((b) => b.downbeat).map((b) => [b.time, ++bar]));
    }
    return this.beatLen || 0.5;
  }

  draw(view: StaffView): void {
    const { ctx, w, h, engine } = this;
    const { metrics: m, t } = view;
    const th = STAFF_THEMES[view.style];
    const g = m.gap;
    const now = performance.now();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, th.bg[0]);
    bg.addColorStop(1, th.bg[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const yOf = (d: number) => g / 2 + ((m.hi - d) * g) / 2;
    const clefW = g * 5;
    const playX = Math.round(Math.min(w * 0.28, clefW + 90));
    const xOf = (time: number) => playX + (time - t) * PX_PER_SEC;
    const lines = staffLines(m.clefs);
    const top = yOf(lines[lines.length - 1]);
    const bottom = yOf(lines[0]);
    const beat = this.beatSec();

    // "Now" band behind the playhead.
    const band = ctx.createLinearGradient(playX - 26, 0, playX + 26, 0);
    band.addColorStop(0, "rgba(0,0,0,0)");
    band.addColorStop(0.5, th.playheadGlow);
    band.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = band;
    ctx.fillRect(playX - 26, 0, 52, h);
    ctx.globalAlpha = 1;

    ctx.fillStyle = th.line;
    for (const d of lines) ctx.fillRect(0, Math.round(yOf(d)), w, 1);

    // Bar lines across the staves, with the measure number on top.
    const tFrom = t - (playX - clefW) / PX_PER_SEC;
    const tTo = t + (w - playX) / PX_PER_SEC;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `italic 600 ${Math.max(8, Math.round(g * 1.05))}px system-ui, sans-serif`;
    for (const b of engine.grid) {
      if (!b.downbeat || b.time < tFrom || b.time > tTo) continue;
      const x = Math.round(xOf(b.time));
      ctx.fillStyle = th.bar;
      ctx.fillRect(x, top, 1, bottom - top);
      const bar = this.measures.get(b.time);
      if (bar) {
        ctx.fillStyle = th.measure;
        ctx.fillText(String(bar), x + 3, 2);
      }
    }

    // Notes: gathered first so chords can share a stem.
    const headW = g * 1.32;
    const headH = g * 0.92;
    const [i0, i1] = engine.visibleRange(tFrom - 4, tTo);
    const notes = engine.notes;
    const tracks = engine.config.playTracks;
    interface Drawn {
      n: (typeof notes)[number];
      x: number;
      y: number;
      d: number;
      color: string;
      alpha: number;
      scale: number;
      beats: number;
      treble: boolean;
    }
    const drawn: Drawn[] = [];
    for (let i = i0; i < i1; i++) {
      const n = notes[i];
      const x = xOf(n.time);
      const xEnd = xOf(n.time + n.duration);
      if (xEnd < clefW || x > w + headW * 2) continue;
      const d = Math.max(m.lo + 1, Math.min(m.hi - 1, diatonic(n.midi)));
      const done = n.state === NoteState.Hit || (n.state === NoteState.Missed && n.rejoined);
      const hand = tracks.length > 1 ? Math.max(0, tracks.indexOf(n.track)) % 2 : n.midi >= HAND_SPLIT ? 0 : 1;
      const color =
        n.state === NoteState.Missed && !n.rejoined
          ? th.judged.miss
          : done
            ? th.judged[n.judgement ?? "good"]
            : n.state === NoteState.Skipped
              ? th.skipped
              : th.handColors
                ? HAND_INK[hand]
                : th.ink;
      // Played notes step back; the next ones swell a little as they reach the playhead.
      const ahead = n.time - t;
      const scale = n.state === NoteState.Pending && ahead >= 0 && ahead < APPROACH_SEC ? 1 + 0.22 * (1 - ahead / APPROACH_SEC) : 1;
      const alpha = x < playX - 2 ? 0.6 : 1;
      const treble = m.clefs === "treble" || (m.clefs === "grand" && n.midi >= 60);
      drawn.push({ n, x, y: yOf(d), d, color, alpha, scale, beats: n.duration / beat, treble });
    }

    // Duration tails, like piano-roll bars behind the heads.
    for (const o of drawn) {
      const len = o.n.duration * PX_PER_SEC;
      if (len <= headW) continue;
      ctx.globalAlpha = 0.2 * o.alpha;
      ctx.fillStyle = o.color;
      roundedBar(ctx, o.x, o.y - g * 0.2, len, g * 0.4);
      ctx.globalAlpha = 1;
    }

    // Ledger lines.
    ctx.fillStyle = th.ledger;
    for (const o of drawn) {
      if (o.x < clefW - headW) continue;
      for (const l of ledgersFor(o.d, m.clefs)) ctx.fillRect(o.x - headW * 0.85, Math.round(yOf(l)), headW * 1.7, 1);
    }

    // Stems and flags, one per chord and staff.
    const chords = new Map<string, Drawn[]>();
    for (const o of drawn) {
      if (o.beats >= WHOLE_BEATS || o.x < clefW - headW) continue;
      const key = `${o.n.group}:${o.treble ? "t" : "b"}`;
      const list = chords.get(key);
      if (list) list.push(o);
      else chords.set(key, [o]);
    }
    const stemUp = new Map<Drawn, boolean>();
    ctx.lineCap = "round";
    for (const list of chords.values()) {
      const mid = list[0].treble ? (m.clefs === "bass" ? 29 : 41) : 29;
      const avg = list.reduce((s, o) => s + o.d, 0) / list.length;
      const up = avg < mid;
      const ys = list.map((o) => o.y);
      const yTop = Math.min(...ys);
      const yBottom = Math.max(...ys);
      const head = list[0];
      const sx = head.x + (up ? headW * 0.48 : -headW * 0.48);
      const y0 = up ? yBottom : yTop;
      const y1 = up ? yTop - g * 3.4 : yBottom + g * 3.4;
      ctx.globalAlpha = head.alpha;
      ctx.strokeStyle = head.color;
      ctx.lineWidth = Math.max(1, g * 0.16);
      ctx.beginPath();
      ctx.moveTo(sx, y0);
      ctx.lineTo(sx, y1);
      ctx.stroke();
      const shortest = Math.min(...list.map((o) => o.beats));
      const flags = shortest <= SIXTEENTH_BEATS ? 2 : shortest <= EIGHTH_BEATS ? 1 : 0;
      ctx.lineWidth = Math.max(1.2, g * 0.24);
      for (let f = 0; f < flags; f++) {
        const fy = y1 + (up ? 1 : -1) * f * g * 0.85;
        ctx.beginPath();
        ctx.moveTo(sx, fy);
        ctx.bezierCurveTo(sx + g * 0.2, fy + (up ? g : -g) * 0.9, sx + g * 1.2, fy + (up ? g : -g) * 1.2, sx + g * 0.9, fy + (up ? g : -g) * 2.1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const o of list) stemUp.set(o, up);
    }

    // Heads, sharps and fingers.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const o of drawn) {
      const { n, x, y, color } = o;
      if (x < clefW - headW) continue;
      ctx.globalAlpha = o.alpha;
      // A hit note sends a ring out from the playhead.
      const since = now - n.resolvedAt;
      if (n.state === NoteState.Hit && n.resolvedAt > 0 && since < RING_MS) {
        const k = since / RING_MS;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * (1 - k);
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.beginPath();
        ctx.arc(x, y, headW * (0.6 + k * 1.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = o.alpha;
      }
      if (th.glow || o.scale > 1) {
        ctx.shadowColor = color;
        ctx.shadowBlur = (th.glow ? 8 : 0) + (o.scale - 1) * 40;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.33);
      ctx.scale(o.scale, o.scale);
      ctx.beginPath();
      ctx.ellipse(0, 0, headW / 2, headH / 2, 0, 0, Math.PI * 2);
      if (o.beats >= HALF_BEATS) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.3, g * 0.26);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.restore();
      ctx.shadowBlur = 0;

      if (isBlack(n.midi)) {
        ctx.font = `700 ${Math.round(g * 1.6)}px system-ui, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText("♯", x - headW * 1.1, y);
      }
      if (view.fingers && n.finger && g >= 6) {
        // On the side away from the stem.
        const fy = stemUp.get(o) === false ? y - g * 1.5 : y + g * 1.5;
        ctx.font = `800 ${Math.round(g * 1.2)}px system-ui, sans-serif`;
        ctx.fillStyle = th.finger;
        ctx.fillText(String(n.finger), x, fy);
      }
      ctx.globalAlpha = 1;
    }

    // Notes fade in on the right.
    const fadeR = ctx.createLinearGradient(w - 36, 0, w, 0);
    fadeR.addColorStop(0, "rgba(0,0,0,0)");
    fadeR.addColorStop(1, th.bg[1]);
    ctx.fillStyle = fadeR;
    ctx.fillRect(w - 36, 0, 36, h);

    // Clefs over a solid panel so notes slide under them, softened at its edge.
    ctx.fillStyle = th.panel;
    ctx.fillRect(0, 0, clefW, h);
    const edge = ctx.createLinearGradient(clefW, 0, clefW + 22, 0);
    edge.addColorStop(0, th.panel);
    edge.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = edge;
    ctx.fillRect(clefW, 0, 22, h);
    ctx.fillStyle = th.line;
    for (const d of lines) ctx.fillRect(0, Math.round(yOf(d)), clefW + 22, 1);
    ctx.fillStyle = th.clef;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glyphs = this.hasClefGlyphs();
    const clef = (sym: string, letter: string, centre: number, size: number) => {
      if (glyphs) {
        ctx.font = `${Math.round(size)}px 'Noto Music', 'Segoe UI Symbol', 'Apple Symbols', serif`;
        ctx.fillText(sym, clefW * 0.45, yOf(centre));
      } else {
        ctx.font = `800 ${Math.round(g * 2.4)}px Georgia, serif`;
        ctx.fillText(letter, clefW * 0.45, yOf(centre));
      }
    };
    if (m.clefs !== "bass") clef("\u{1D11E}", "G", 40.5, g * 6.4);
    if (m.clefs !== "treble") clef("\u{1D122}", "F", 30, g * 3.6);
    if (m.clefs === "grand") {
      ctx.fillRect(2, top, 2, bottom - top);
      // Brace joining the two staves.
      ctx.strokeStyle = th.clef;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(1, top);
      ctx.quadraticCurveTo(-4, (top + bottom) / 2, 1, bottom);
      ctx.stroke();
    }

    // Playhead: glow, line and a marker at both ends.
    const grad = ctx.createLinearGradient(playX - 9, 0, playX + 9, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, th.playheadGlow);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(playX - 9, 0, 18, h);
    if (th.glow) {
      ctx.shadowColor = th.playhead;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = th.playhead;
    ctx.fillRect(playX - 1, 0, 2, h);
    ctx.shadowBlur = 0;
    const tri = Math.max(4, g * 0.8);
    ctx.beginPath();
    ctx.moveTo(playX - tri, 0);
    ctx.lineTo(playX + tri, 0);
    ctx.lineTo(playX, tri * 1.1);
    ctx.closePath();
    ctx.moveTo(playX - tri, h);
    ctx.lineTo(playX + tri, h);
    ctx.lineTo(playX, h - tri * 1.1);
    ctx.closePath();
    ctx.fill();
  }
}

function roundedBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.fill();
}
