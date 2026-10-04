import { engine, type PressPos } from "../engine/engine";

/** A finger that hasn't moved for this long (ms) is resting. */
const REST_MS = 90;
/** How quickly a resting pitch slides onto the nearest note (time constant, seconds). */
const SNAP_TAU = 0.05;

interface Glide {
  /** Pitch under the finger (fractional MIDI). */
  target: number;
  /** Pitch currently sounding. */
  shown: number;
  movedAt: number;
  /** Last pitch / settled state handed to the engine. */
  sent: number;
  sentSettled: boolean;
  place?: (pitch: number) => PressPos | undefined;
}

/**
 * Fretless play: a source's pitch follows the finger continuously instead of stepping from key to key. With
 * `snap` the pitch settles on the nearest semitone once the finger rests, so slides are smooth but notes in tune.
 */
class GlideController {
  snap = true;
  private items = new Map<string, Glide>();
  private last = 0;

  /** The finger landed at `pitch`; with snap it starts in tune. */
  start(key: string, pitch: number, place?: Glide["place"]): void {
    const shown = this.snap ? Math.round(pitch) : pitch;
    // With snap a fresh press counts as resting, so it sounds in tune instead of scooping up to the note.
    const movedAt = performance.now() - (this.snap ? REST_MS + 1 : 0);
    this.items.set(key, { target: pitch, shown, movedAt, sent: NaN, sentSettled: false, place });
  }

  move(key: string, pitch: number): void {
    const g = this.items.get(key);
    if (!g) return;
    g.target = pitch;
    g.movedAt = performance.now();
  }

  has(key: string): boolean {
    return this.items.has(key);
  }

  /** The source's note was struck again; re-apply the pitch on the next tick. */
  touch(key: string): void {
    const g = this.items.get(key);
    if (g) g.sent = NaN;
  }

  end(key: string): void {
    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }

  tick(now: number): void {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    for (const [key, g] of this.items) {
      const resting = now - g.movedAt > REST_MS;
      const goal = this.snap && resting ? Math.round(g.target) : g.target;
      if (!this.snap || !resting) g.shown = goal;
      else {
        g.shown += (goal - g.shown) * (1 - Math.exp(-dt / SNAP_TAU));
        if (Math.abs(goal - g.shown) < 0.01) g.shown = goal;
      }
      const settled = resting && g.shown === goal;
      if (g.shown === g.sent && settled === g.sentSettled) continue;
      g.sent = g.shown;
      g.sentSettled = settled;
      engine.glide(key, g.shown, settled, g.place?.(g.shown));
    }
  }
}

export const glider = new GlideController();
