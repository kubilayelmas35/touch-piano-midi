import { engine } from "../engine/engine";
import { midiAt } from "../engine/fretting";
import { NoteState } from "../engine/types";

type Source = number | string;

const strKey = (s: number) => `str:${s}`;

/**
 * Guitar / violin playing model: the left hand frets (touching the neck or holding fret keys sets the pitch
 * of a string without sounding it), the right hand strikes strings in the pluck zone (several at once,
 * strumming by sliding across). A string keeps sounding only while it is kept moving (scrubbing / bowing in
 * the strike zone or vibrato on the neck) and dies away once it is left still; violin gets louder with bow speed.
 */
class FrettedController {
  /** Fingers on the neck. */
  private neck = new Map<Source, { string: number; fret: number }>();
  /** Fret keys held on the computer keyboard; they fret every string (like a barre). */
  private kbFrets = new Map<string, number>();
  /** Strings each source is currently striking. */
  private striking = new Map<Source, Set<number>>();
  /** Fret each string is sounding at. */
  private sounding: number[] = [];
  /** performance.now() of the last strike per string, for the vibration animation. */
  readonly struckAt: number[] = [];
  /** 0–1 vibration per string; drives loudness and decays unless the string is kept moving. */
  private energy: number[] = [];
  /** Excitation gathered since the last tick (bow speed, vibrato, scrubbing the string). */
  private feed: number[] = [];
  private lastTick = 0;
  autoFret = false;
  tapToPlay = false;

  private get spec() {
    return engine.fretSpec;
  }

  private get violin(): boolean {
    return engine.config.instrument === "violin";
  }

  /** Fret the left hand holds on a string (0 = open). */
  fretOf(string: number): number {
    let f = -1;
    for (const p of this.neck.values()) if (p.string === string) f = Math.max(f, p.fret);
    for (const k of this.kbFrets.values()) f = Math.max(f, k);
    if (f < 0 && this.autoFret) {
      const auto = this.autoFretFor(string);
      if (auto != null) return auto;
    }
    return Math.max(0, f);
  }

  /** Frets held by fingers (for drawing finger dots); auto-fret positions included. */
  heldFrets(): Map<number, number> {
    const out = new Map<number, number>();
    const spec = this.spec;
    if (!spec) return out;
    for (let s = 0; s < spec.tuning.length; s++) {
      const f = this.fretOf(s);
      if (f > 0) out.set(s, f);
    }
    return out;
  }

  isStruck(string: number): boolean {
    for (const set of this.striking.values()) if (set.has(string)) return true;
    return false;
  }

  private autoFretFor(string: number): number | null {
    const t = engine.time;
    const [i0, i1] = engine.visibleRange(t - 0.25, t + 2);
    for (let i = i0; i < i1; i++) {
      const n = engine.notes[i];
      if (n.state === NoteState.Pending && n.string === string) return n.fret;
    }
    return null;
  }

  // ------------------------------------------------------------- strings

  private strike(string: number, velocity: number): void {
    const spec = this.spec;
    if (!spec) return;
    const fret = this.fretOf(string);
    this.sounding[string] = fret;
    this.struckAt[string] = performance.now();
    this.energy[string] = this.violin ? 0.85 : 1;
    engine.press(strKey(string), midiAt(spec, string, fret), velocity, { string, fret });
  }

  energyOf(string: number): number {
    return this.energy[string] ?? 0;
  }

  /** Bow / scrub motion over the strings a source is touching in the strike zone (speed in px/ms). */
  stroke(source: Source, speed: number): void {
    const set = this.striking.get(source);
    if (!set) return;
    const amount = Math.min(1, speed * 0.9);
    for (const s of set) this.feed[s] = Math.max(this.feed[s] ?? 0, amount);
  }

  /** Vibrato on a neck finger keeps its string alive (speed in px/ms). */
  vibrate(source: Source, speed: number): void {
    const p = this.neck.get(source);
    if (p) this.feed[p.string] = Math.max(this.feed[p.string] ?? 0, Math.min(1, speed * 1.4));
  }

  /** Per-frame string physics: decay, bow pressure and the loudness that follows. */
  tick(now: number): void {
    const spec = this.spec;
    const dt = this.lastTick ? Math.min(0.1, (now - this.lastTick) / 1000) : 0;
    this.lastTick = now;
    if (!spec || !dt) return;
    const violin = this.violin;
    for (let s = 0; s < spec.tuning.length; s++) {
      const key = strKey(s);
      const held = engine.isHeld(key);
      if (!held && !engine.isRinging(key)) {
        this.energy[s] = 0;
        this.feed[s] = 0;
        continue;
      }
      let e = this.energy[s] ?? 0;
      let feed = this.feed[s] ?? 0;
      // Computer keys and tap-to-play can't move, so they play steadily while held.
      if (held && this.steadyBow(s)) feed = Math.max(feed, 0.8);
      // Both instruments sound only while the string is kept moving; a still string dies away (guitar a bit slower).
      if (feed > 0.02) {
        const target = violin ? Math.min(1, 0.45 + feed) : Math.min(1, 0.6 + feed * 0.6);
        e += (Math.max(e, target) - e) * (1 - Math.exp(-dt / (violin ? 0.06 : 0.04)));
      } else e *= Math.exp(-dt / (violin ? 0.45 : 0.6));
      this.feed[s] = 0;
      this.energy[s] = e;
      if (!violin && e < 0.04) {
        engine.mute(key);
        this.energy[s] = 0;
        this.struckAt[s] = -Infinity;
        continue;
      }
      engine.setLevel(key, violin ? e / 0.85 : e);
    }
  }

  private steadyBow(string: number): boolean {
    for (const [src, set] of this.striking) {
      if (typeof src === "string" && (src.startsWith("kb:") || src.startsWith("tap:")) && set.has(string)) return true;
    }
    return false;
  }

  private letGo(string: number): void {
    if (this.isStruck(string)) return;
    engine.release(strKey(string), !this.violin);
  }

  /** The set of strings a source touches in the pluck zone changed. */
  strikeSync(source: Source, strings: number[], velocity = 0.8): void {
    const prev = this.striking.get(source) ?? new Set<number>();
    const next = new Set(strings);
    this.striking.set(source, next);
    for (const s of next) if (!prev.has(s)) this.strike(s, velocity);
    for (const s of prev) if (!next.has(s)) this.letGo(s);
  }

  strikeEnd(source: Source): void {
    const prev = this.striking.get(source);
    if (!prev) return;
    this.striking.delete(source);
    for (const s of prev) this.letGo(s);
  }

  // ---------------------------------------------------------------- neck

  /** Re-pitches strings whose fret changed while they sound (hammer-ons, slides, violin finger changes). */
  private refresh(): void {
    const spec = this.spec;
    if (!spec) return;
    for (let s = 0; s < spec.tuning.length; s++) {
      const fret = this.fretOf(s);
      const before = this.sounding[s];
      if (before === undefined || fret === before) continue;
      const key = strKey(s);
      if (engine.isHeld(key)) {
        this.sounding[s] = fret;
        engine.press(key, midiAt(spec, s, fret), this.violin ? 0.75 : 0.5, { string: s, fret });
        engine.setLevel(key, this.violin ? (this.energy[s] ?? 0.85) / 0.85 : this.energy[s] ?? 1);
      } else if (engine.isRinging(key)) {
        if (fret > before) {
          // Hammer-on: the ringing string jumps to the new fret.
          this.sounding[s] = fret;
          engine.press(key, midiAt(spec, s, fret), 0.45, { string: s, fret });
          engine.release(key, true);
          engine.setLevel(key, this.energy[s] ?? 0.6);
        } else {
          // Lifting the finger damps the string.
          engine.mute(key);
          this.sounding[s] = fret;
          this.struckAt[s] = -Infinity;
        }
      } else {
        this.sounding[s] = fret;
      }
    }
  }

  neckDown(source: Source, string: number, fret: number): void {
    this.neck.set(source, { string, fret });
    this.refresh();
    if (this.tapToPlay && !engine.isHeld(strKey(string))) {
      this.strikeSync(`tap:${source}`, [string], 0.75);
    }
  }

  neckMove(source: Source, string: number, fret: number): void {
    const p = this.neck.get(source);
    if (!p || (p.string === string && p.fret === fret)) return;
    if (this.tapToPlay && p.string !== string) {
      this.strikeEnd(`tap:${source}`);
      this.neck.set(source, { string, fret });
      this.refresh();
      this.strikeSync(`tap:${source}`, [string], 0.6);
      return;
    }
    this.neck.set(source, { string, fret });
    this.refresh();
  }

  /** Vibrato / bend on the string under a neck finger. */
  neckBend(source: Source, cents: number): void {
    const p = this.neck.get(source);
    if (p) engine.bend(strKey(p.string), cents);
  }

  neckUp(source: Source): void {
    const p = this.neck.get(source);
    if (!p) return;
    engine.bend(strKey(p.string), 0);
    this.neck.delete(source);
    this.strikeEnd(`tap:${source}`);
    this.refresh();
  }

  // ------------------------------------------------------------ keyboard

  fretKeyDown(code: string, fret: number): void {
    this.kbFrets.set(code, fret);
    this.refresh();
  }

  fretKeyUp(code: string): void {
    if (!this.kbFrets.delete(code)) return;
    this.refresh();
  }

  stringKeyDown(code: string, string: number): void {
    this.strikeSync(`kb:${code}`, [string], 0.8);
  }

  stringKeyUp(code: string): void {
    this.strikeEnd(`kb:${code}`);
  }

  /** Lets go of everything (instrument switch, window blur). */
  reset(): void {
    for (const source of [...this.striking.keys()]) this.strikeEnd(source);
    this.neck.clear();
    this.kbFrets.clear();
    const spec = this.spec;
    if (spec) for (let s = 0; s < 6; s++) engine.mute(strKey(s));
    this.sounding = [];
    this.energy = [];
    this.feed = [];
    this.struckAt.fill(-Infinity);
  }
}

export const fretted = new FrettedController();
