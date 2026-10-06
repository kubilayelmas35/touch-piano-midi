import { engine } from "../engine/engine";
import { midiAt } from "../engine/fretting";
import { NoteState } from "../engine/types";
import { glider } from "./glide";

type Source = number | string;

const strKey = (s: number) => `str:${s}`;
/** Finger speed (px/ms) below which a resting hand's drift doesn't count as bowing or scrubbing. */
const MIN_MOTION = 0.05;
/** String energy below which a string is inaudible and stops; muting any earlier is heard as a cut. */
const SILENT = 0.005;

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
  /** Fret each string is sounding at. */
  private sounding: number[] = [];
  /** performance.now() of the last strike per string, for the vibration animation. */
  readonly struckAt: number[] = [];
  /** 0–1 vibration per string; drives loudness and decays unless the string is kept moving. */
  private energy: number[] = [];
  /** Excitation gathered since the last tick (bow speed, vibrato, scrubbing the string). */
  private feed: number[] = [];
  /** Excitation smoothed over the turnarounds of a back-and-forth motion, so the loudness doesn't pump. */
  private drive: number[] = [];
  /** performance.now() of the last excitation per string. */
  private fedAt: number[] = [];
  /** Velocity of the last strike per string; harder plucks ring longer. */
  private hit: number[] = [];
  /** performance.now() of the last strike per string, where a held key's bow stroke starts. */
  private bowFrom: number[] = [];
  private lastTick = 0;
  /** How long a string rings once left alone, 0 short … 1 long. */
  sustain = 0.55;
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
    this.hit[string] = velocity;
    this.bowFrom[string] = performance.now();
    this.drive[string] = this.violin ? 0.4 : 0;
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
    const amount = Math.min(1, Math.max(0, speed - MIN_MOTION) * 0.9);
    for (const s of set) this.feed[s] = Math.max(this.feed[s] ?? 0, amount);
  }

  /** Vibrato on a neck finger keeps its strings alive (speed in px/ms). */
  vibrate(source: Source, speed: number): void {
    const p = this.neck.get(source);
    if (!p) return;
    const amount = Math.min(1, Math.max(0, speed - MIN_MOTION) * 1.4);
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
      // Computer keys and tap-to-play can't move: on violin a held one draws a single bow stroke of limited length,
      // a guitar string just rings out.
      if (violin && held && this.steadyBow(s) && now - (this.bowFrom[s] ?? 0) < this.bowSeconds() * 1000) feed = Math.max(feed, 0.8);
      let d = this.drive[s] ?? 0;
      if (feed > 0.02) {
        this.fedAt[s] = now;
        d += (feed - d) * (1 - Math.exp(-dt / (feed > d ? 0.08 : 0.3)));
        this.drive[s] = d;
      }
      // A string sounds while it is kept moving; the pauses where a back-and-forth turns around don't count as stopping.
      const moving = held && now - (this.fedAt[s] ?? -Infinity) < 140;
      if (moving) {
        const target = violin ? Math.min(1, 0.45 + d) : Math.min(1, 0.6 + d * 0.5);
        if (target > e) e += (target - e) * (1 - Math.exp(-dt / (violin ? 0.08 : 0.15)));
        else if (violin) e += (target - e) * (1 - Math.exp(-dt / 0.5));
      } else e *= Math.exp(-dt / this.ringTime(s, violin));
      this.feed[s] = 0;
      this.energy[s] = e;
      if (e < SILENT) {
        // A finger still resting on the string keeps its voice silent, so moving again brings the sound back.
        if (held) engine.setLevel(key, 0);
        else engine.mute(key);
        this.energy[s] = 0;
        this.struckAt[s] = -Infinity;
        continue;
      }
      engine.setLevel(key, violin ? e / 0.85 : e);
    }
  }

  /**
   * Seconds a left-alone string takes to fade by 1/e: longer with the sustain setting, a harder pluck or a stronger bow.
   * Sustain at 0 damps the string at once.
   */
  private ringTime(string: number, violin: boolean): number {
    const damp = Math.min(1, this.sustain / 0.25);
    const t = violin
      ? 0.45 * 4 ** this.sustain * (0.4 + 1.2 * (this.drive[string] ?? 0))
      : 0.45 * 6 ** this.sustain * (0.7 + 0.6 * (this.hit[string] ?? 0.8));
    return Math.max(0.03, t * damp);
  }

  /** Length of the bow stroke a held computer key or tap draws on violin, longer with the sustain setting. */
  private bowSeconds(): number {
    return 1.5 * 3 ** this.sustain;
  }

  private steadyBow(string: number): boolean {
    for (const [src, set] of this.striking) {
      if (typeof src === "string" && (src.startsWith("kb:") || src.startsWith("tap:")) && set.has(string)) return true;
    }
    return false;
  }

  private letGo(string: number): void {
    if (this.isStruck(string)) return;
    engine.release(strKey(string), true);
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
        if (this.violin) {
          // Nothing bows a ringing violin string, so lifting or moving a finger neither damps nor re-sounds it.
          this.sounding[s] = fret;
        } else if (fret > before) {
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
    this.drive = [];
    this.fedAt = [];
    this.hit = [];
    this.bowFrom = [];
    this.struckAt.fill(-Infinity);
  }
}

export const fretted = new FrettedController();
