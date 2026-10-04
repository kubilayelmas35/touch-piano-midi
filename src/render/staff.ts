import type { Engine } from "../engine/engine";
import { NoteState } from "../engine/types";
import { isBlack } from "../lib/notes";
import { JUDGEMENT_COLORS } from "./theme";

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
}

/** Song seconds per pixel are fixed so rhythms keep their shape at any tempo. */
const PX_PER_SEC = 150;

export class StaffRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private clefGlyphs: boolean | null = null;

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

  draw(view: StaffView): void {
    const { ctx, w, h, engine } = this;
    const { metrics: m, t } = view;
    const g = m.gap;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(9,7,22,0.92)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, h - 1, w, 1);

    const yOf = (d: number) => g / 2 + ((m.hi - d) * g) / 2;
    const clefW = g * 5;
    const playX = Math.round(Math.min(w * 0.28, clefW + 90));
    const xOf = (time: number) => playX + (time - t) * PX_PER_SEC;
    const lines = staffLines(m.clefs);

    // Staff lines.
    ctx.fillStyle = "rgba(226,232,255,0.38)";
    for (const d of lines) ctx.fillRect(0, Math.round(yOf(d)), w, 1);

    // Bar lines across the staves.
    const top = yOf(lines[lines.length - 1]);
    const bottom = yOf(lines[0]);
    const tFrom = t - (playX - clefW) / PX_PER_SEC;
    const tTo = t + (w - playX) / PX_PER_SEC;
    ctx.fillStyle = "rgba(226,232,255,0.3)";
    for (const b of engine.grid) {
      if (!b.downbeat || b.time < tFrom || b.time > tTo) continue;
      ctx.fillRect(Math.round(xOf(b.time)), top, 1, bottom - top);
    }

    // Notes.
    const headW = g * 1.3;
    const headH = g * 0.9;
    const [i0, i1] = engine.visibleRange(tFrom - 4, tTo);
    const notes = engine.notes;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = i0; i < i1; i++) {
      const n = notes[i];
      const x = xOf(n.time);
      const xEnd = xOf(n.time + n.duration);
      if (xEnd < clefW || x > w + headW) continue;
      const d = Math.max(m.lo + 1, Math.min(m.hi - 1, diatonic(n.midi)));
      const y = yOf(d);
      const done = n.state === NoteState.Hit || (n.state === NoteState.Missed && n.rejoined);
      const color =
        n.state === NoteState.Missed && !n.rejoined
          ? JUDGEMENT_COLORS.miss
          : done
            ? JUDGEMENT_COLORS[n.judgement ?? "good"]
            : n.state === NoteState.Skipped
              ? "rgba(255,255,255,0.3)"
              : "#ffffff";

      // Duration tail, like a piano-roll bar behind the head.
      if (xEnd - x > headW) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x, y - g * 0.18, xEnd - x, g * 0.36);
        ctx.globalAlpha = 1;
      }
      if (x < clefW - headW) continue;

      ctx.fillStyle = "rgba(226,232,255,0.55)";
      for (const l of ledgersFor(d, m.clefs)) ctx.fillRect(x - headW * 0.85, Math.round(yOf(l)), headW * 1.7, 1);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.33);
      ctx.beginPath();
      ctx.ellipse(0, 0, headW / 2, headH / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();

      if (isBlack(n.midi)) {
        ctx.font = `700 ${Math.round(g * 1.6)}px system-ui, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText("♯", x - headW * 1.05, y);
      }
      if (view.fingers && n.finger && g >= 6) {
        ctx.font = `800 ${Math.round(g * 1.25)}px system-ui, sans-serif`;
        ctx.fillStyle = "#c4b5fd";
        ctx.fillText(String(n.finger), x, y - g * 1.35);
      }
    }

    // Clefs over a solid panel so notes slide under them.
    ctx.fillStyle = "rgb(12,10,28)";
    ctx.fillRect(0, 0, clefW, h - 1);
    ctx.fillStyle = "rgba(226,232,255,0.38)";
    for (const d of lines) ctx.fillRect(0, Math.round(yOf(d)), clefW, 1);
    ctx.fillStyle = "rgba(226,232,255,0.85)";
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
    if (m.clefs === "grand") ctx.fillRect(2, top, 2, bottom - top);

    // Playhead.
    const grad = ctx.createLinearGradient(playX - 8, 0, playX + 8, 0);
    grad.addColorStop(0, "rgba(139,92,246,0)");
    grad.addColorStop(0.5, "rgba(167,139,250,0.35)");
    grad.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(playX - 8, 0, 16, h - 1);
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(playX - 1, 0, 2, h - 1);
  }
}
