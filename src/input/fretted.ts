import { engine } from "../engine/engine";
import { midiAt } from "../engine/fretting";
import { NoteState } from "../engine/types";
import { glider } from "./glide";

type Source = number | string;

const strKey = (s: number) => `str:${s}`;

/**
 * Guitar / violin playing model: the left hand frets (touching the neck or holding fret keys sets the pitch
 * of a string without sounding it), the right hand strikes strings in the pluck zone (several at once,
 * strumming by sliding across). A string keeps sounding only while it is kept moving (scrubbing / bowing in
 * the strike zone or vibrato on the neck) and dies away once it is left still; violin gets louder with bow speed.
 */
class FrettedController {
  /** Fingers on the neck: the string under the fingertip, the strings it frets and the strings it has touched. */
  private neck = new Map<Source, { string: number; fret: number; strings: Set<number>; touched: Set<number>; pos?: number }>();
  /** Fret keys held on the computer keyboard; they fret every string (like a barre). */
  private kbFrets = new Map<string, number>();
  /** Strings each source is currently striking. */
  private striking = new Map<Source, Set<number>>();
  /** Touched string → string actually struck, per source (differs only when strike-only play redirects). */
  private routes = new Map<Source, Map<number, number>>();
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
  /** A finger frets (and with tap-to-play, sounds) every string it covers or slides across. */
  multiNote = false;
  /** A finger frets its whole fret column (barre); tap-to-play sounds the notes due in that column. */
  columnPress = false;
  /** Fretless: a neck finger slides the pitch continuously instead of stepping fret by fret. */
  glide = false;

  private get spec() {
    return engine.fretSpec;
  }

  private get violin(): boolean {
    return engine.config.instrument === "violin";
  }

  /** Fret the left hand holds on a string (0 = open). */
  fretOf(string: number): number {
    let f = -1;
    for (const p of this.neck.values()) if (p.strings.has(string)) f = Math.max(f, p.fret);
    for (const k of this.kbFrets.values()) f = Math.max(f, k);
    if (f < 0 && this.autoFret) {
      const auto = this.autoFretFor(string);
      if (auto != null) return auto;
    }
    return Math.max(0, f);
  }

  /** Frets held by fingers (for drawing finger dots); auto-fret positions included, fretless fingers exact. */
  heldFrets(): Map<number, number> {
    const out = new Map<number, number>();
    const spec = this.spec;
    if (!spec) return out;
    for (let s = 0; s < spec.tuning.length; s++) {
      const f = this.fretOf(s);
      if (f > 0) out.set(s, f);
    }
    if (this.glide) {
      for (const p of this.neck.values()) {
        if (p.pos === undefined) continue;
        for (const s of p.strings) if (out.get(s) === p.fret) out.set(s, p.pos);
      }
    }
    return out;
  }

  isStruck(string: number): boolean {
    for (const set of this.striking.values()) if (set.has(string)) return true;
    return false;
  }

  /** A note on `string` that is due right now (within the timing window, or the one wait mode waits for). */
  private dueOn(string: number | null, exclude: Set<number>): number | null {
    const t = engine.time;
    const win = Math.max(0.2, (engine.config.timingWindowMs / 1000) * engine.config.speed * 1.5);
    const [i0, i1] = engine.visibleRange(t - win, t + win);
    for (let i = i0; i < i1; i++) {
      const n = engine.notes[i];
      if (n.state !== NoteState.Pending || n.string < 0 || exclude.has(n.string)) continue;
      if (string === null || n.string === string) return n.string;
    }
    if (engine.waiting) {
      for (const n of engine.notes) {
        if (n.state !== NoteState.Pending) continue;
        if (!exclude.has(n.string) && (string === null || n.string === string)) return n.string;
        break;
      }
    }
    return null;
  }

  /** Strings with a note due right now at `fret` (all strings of a chord in that column). */
  private dueAtFret(fret: number): number[] {
    const out = new Set<number>();
    const t = engine.time;
    const win = Math.max(0.2, (engine.config.timingWindowMs / 1000) * engine.config.speed * 1.5);
    const [i0, i1] = engine.visibleRange(t - win, t + win);
    for (let i = i0; i < i1; i++) {
      const n = engine.notes[i];
      if (n.state === NoteState.Pending && n.string >= 0 && n.fret === fret) out.add(n.string);
    }
    if (!out.size && engine.waiting) {
      let group: number | null = null;
      for (const n of engine.notes) {
        if (n.state !== NoteState.Pending) continue;
        group ??= n.group;
        if (n.group !== group) break;
        if (n.string >= 0 && n.fret === fret) out.add(n.string);
      }
    }
    return [...out];
  }

  /**
   * Strike-only play (auto fret): hitting a string with nothing due on it plays the note that is due on another
   * string instead, so just strumming in time is enough.
   */
  private route(raw: number): number {
    if (!this.autoFret || this.tapToPlay) return raw;
    const busy = new Set<number>();
    for (const set of this.striking.values()) for (const s of set) busy.add(s);
    if (this.dueOn(raw, new Set()) !== null) return raw;
    return this.dueOn(null, busy) ?? raw;
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
    glider.touch(strKey(string));
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

  /** Vibrato on a neck finger keeps its strings alive (speed in px/ms). */
  vibrate(source: Source, speed: number): void {
    const p = this.neck.get(source);
    if (!p) return;
    const amount = Math.min(1, speed * 1.4);
    for (const s of p.touched) this.feed[s] = Math.max(this.feed[s] ?? 0, amount);
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
    const prevRoutes = this.routes.get(source);
    const routes = new Map<number, number>();
    for (const raw of strings) routes.set(raw, prevRoutes?.get(raw) ?? this.route(raw));
    this.routes.set(source, routes);
    const next = new Set(routes.values());
    this.striking.set(source, next);
    for (const s of next) if (!prev.has(s)) this.strike(s, velocity);
    for (const s of prev) if (!next.has(s)) this.letGo(s);
  }

  strikeEnd(source: Source): void {
    const prev = this.striking.get(source);
    if (!prev) return;
    this.striking.delete(source);
    this.routes.delete(source);
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

  private fretsFor(touched: Set<number>): Set<number> {
    const count = this.spec?.tuning.length ?? 0;
    return this.columnPress ? new Set(Array.from({ length: count }, (_, i) => i)) : new Set(touched);
  }

  /** Tap-to-play: sound what the finger plays, without re-striking strings another finger is holding. */
  private tapStrike(source: Source, velocity: number): void {
    const p = this.neck.get(source);
    if (!p || !this.tapToPlay) return;
    let targets: number[];
    if (this.columnPress) {
      const due = this.dueAtFret(p.fret);
      targets = due.length ? due : [p.string];
    } else targets = [...p.touched];
    const key = `tap:${source}`;
    const own = this.striking.get(key);
    this.strikeSync(key, targets.filter((s) => own?.has(s) || !engine.isHeld(strKey(s))), velocity);
  }

  /**
   * Fretless: the strings this finger decides the pitch of follow `pos` (fractional fret) without restriking;
   * they're marked as already sounding at `fret` so refresh() leaves them alone.
   */
  private glideStrings(source: Source, pos: number): void {
    const p = this.neck.get(source);
    const spec = this.spec;
    if (!p || !spec) return;
    p.pos = pos;
    for (const s of p.strings) {
      const key = strKey(s);
      if (this.fretOf(s) !== p.fret) {
        glider.end(key);
        continue;
      }
      this.sounding[s] = p.fret;
      const pitch = spec.tuning[s] + pos;
      if (glider.has(key)) glider.move(key, pitch);
      else glider.start(key, pitch, (at) => ({ string: s, fret: Math.max(0, Math.round(at - spec.tuning[s])) }));
    }
  }

  /**
   * `under`: every string beneath the fingertip (several with multi-note play), `string` the one at its centre.
   * `pos`: exact position in frets, for fretless play.
   */
  neckDown(source: Source, string: number, fret: number, under: number[] = [string], pos?: number): void {
    const touched = new Set(this.multiNote ? [string, ...under] : [string]);
    this.neck.set(source, { string, fret, strings: this.fretsFor(touched), touched });
    this.refresh();
    if (this.glide && pos !== undefined) this.glideStrings(source, pos);
    this.tapStrike(source, 0.75);
  }

  /** Slide along the neck to another fret (fretless: to the exact position `pos`). */
  neckMove(source: Source, fret: number, pos?: number): void {
    const p = this.neck.get(source);
    if (!p) return;
    if (this.glide && pos !== undefined) {
      const changed = p.fret !== fret;
      p.fret = fret;
      this.glideStrings(source, pos);
      if (!changed) return;
      this.refresh();
      if (this.columnPress) this.tapStrike(source, 0.6);
      return;
    }
    if (p.fret === fret) return;
    p.fret = fret;
    this.refresh();
    if (this.columnPress) this.tapStrike(source, 0.6);
  }

  /** Multi-note play: the finger slid onto more strings; they join (a strum across the neck with tap-to-play). */
  neckTouch(source: Source, under: number[]): void {
    const p = this.neck.get(source);
    if (!p || !this.multiNote) return;
    const before = p.touched.size;
    for (const s of under) p.touched.add(s);
    if (p.touched.size === before) return;
    p.strings = this.fretsFor(p.touched);
    this.refresh();
    if (!this.columnPress) this.tapStrike(source, 0.65);
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
    for (const s of p.strings) glider.end(strKey(s));
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
    glider.clear();
    const spec = this.spec;
    if (spec) for (let s = 0; s < 6; s++) engine.mute(strKey(s));
    this.sounding = [];
    this.energy = [];
    this.feed = [];
    this.struckAt.fill(-Infinity);
  }
}

export const fretted = new FrettedController();
