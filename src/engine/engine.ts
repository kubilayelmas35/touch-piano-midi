import { getBus, unlockAudio } from "../audio/context";
import { scheduleClick } from "../audio/click";
import type { InstrumentId } from "../audio/instruments";
import { isLoaded, loadInstrument, playNote, type Voice } from "../audio/sampler";
import { HAND_SPLIT, handOfNote, handTracks, selectAccompanimentNotes, selectPlayerNotes, type Song, type SongNote } from "../midi/song";
import { assignPianoFingers } from "./fingering";
import { GUITAR, VIOLIN, assignFingerings, foldIntoRange, type FrettedSpec } from "./fretting";
import {
  EARLY_FACTOR,
  EARLY_HOLD_SEC,
  HOLD_POINTS_PER_SEC,
  JUDGEMENT_POINTS,
  LATE_FACTOR,
  NoteState,
  comboMultiplier,
  emptyStats,
  holdWeight,
  judge,
  type EngineConfig,
  type Fx,
  type Judgement,
  type PlayNote,
  type Stats,
  type Status,
} from "./types";

const GROUP_EPS = 0.035;
const SCHEDULE_AHEAD = 0.25;
/** Output latency compensated at most (s); some devices report wild values. */
const MAX_OUTPUT_LAG = 0.3;
/** Semitones of the white keys within an octave. */
const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];

export interface PressPos {
  string: number;
  fret: number;
}

export interface HeldNote {
  midi: number;
  string: number;
  fret: number;
}

interface GridBeat {
  time: number;
  downbeat: boolean;
}

export const DEFAULT_CONFIG: EngineConfig = {
  instrument: "piano",
  guitarTone: "steel",
  playTracks: [],
  mutedTracks: [],
  hand: "both",
  speed: 1,
  waitMode: false,
  autoPlay: false,
  metronome: false,
  countIn: true,
  timingWindowMs: 150,
  accompVolume: 0.7,
  playerVolume: 1,
  pianoPedal: false,
  pianoSustain: 0.7,
  compactKeys: false,
  loop: { a: -1, b: -1, enabled: false },
  segmentEnd: 0,
};

/** Fade of a key let go with the piano pedal mode on (seconds to silence), from shortest to longest sustain. */
const PEDAL_TAIL = [1.5, 7.5];
/** A gliding note bends its sample at most this many semitones, then carries on from a sample nearer the pitch. */
const GLIDE_RANGE = 6;
/** Where the carried-on sample starts, past its attack (seconds). */
const GLIDE_OFFSET = 0.15;

export function fretSpecFor(kind: EngineConfig["instrument"]): FrettedSpec | null {
  return kind === "guitar" ? GUITAR : kind === "violin" ? VIOLIN : null;
}

export function instrumentIdFor(cfg: Pick<EngineConfig, "instrument" | "guitarTone">): InstrumentId {
  if (cfg.instrument === "guitar") return cfg.guitarTone === "nylon" ? "guitar-nylon" : "guitar-steel";
  return cfg.instrument === "violin" ? "violin" : "piano";
}

function lowerBound<T extends { time: number }>(arr: T[], t: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface RunResult {
  stats: Stats;
  dirty: boolean;
  config: EngineConfig;
}

type Listener = () => void;

/** How one pass through the loop went: notes inside it hit / missed, stray presses during the pass. */
export interface LoopPass {
  hit: number;
  miss: number;
  wrong: number;
}

/** What the player did, for recording: note on/off (`ring` = left to decay), damping a string, the sustain pedal. */
export type PlayerInput =
  | { type: "on"; key: string; midi: number; velocity: number }
  | { type: "off"; key: string; ring: boolean }
  | { type: "mute"; key: string }
  | { type: "sustain"; on: boolean };

export class Engine {
  song: Song | null = null;
  notes: PlayNote[] = [];
  accomp: SongNote[] = [];
  status: Status = "empty";
  stats: Stats = emptyStats();
  config: EngineConfig = { ...DEFAULT_CONFIG, loop: { ...DEFAULT_CONFIG.loop } };
  waiting = false;
  fx: Fx[] = [];
  loading = false;
  loadProgress = 1;
  loadError: string | null = null;
  runDirty = false;
  startTime = 0;
  endTime = 0;
  maxNoteDuration = 0;
  /** Held notes by input source key (for highlighting). */
  readonly held = new Map<string, HeldNote>();
  onComplete: ((r: RunResult) => void) | null = null;
  onInput: ((e: PlayerInput) => void) | null = null;
  private inputListeners = new Set<(e: PlayerInput) => void>();
  /** A live duet partner's notes, by their source key. */
  private remote = new Map<string, Voice>();
  /** A pass through the A–B loop just ended (called before jumping back). */
  onLoopPass: ((p: LoopPass) => void) | null = null;
  /** Song times of presses that matched no note, this run. */
  wrongTimes: number[] = [];
  private loopWrongBase = 0;

  private anchorPerf = 0;
  private anchorSong = 0;
  private anchorCtx = 0;
  private accIdx = 0;
  private autoIdx = 0;
  private beatIdx = 0;
  private scheduledUntil = 0;
  private scheduled: Voice[] = [];
  private pendingIdx = 0;
  private voices = new Map<string, Voice>();
  /** Released strings that keep ringing until re-plucked or muted. */
  private ringing = new Map<string, Voice>();
  private sustain = false;
  /** What is holding the sustain pedal down (a MIDI pedal, the Shift key). */
  private sustainBy = new Set<string>();
  private sustained: Voice[] = [];
  /** Voices kept alive by the sustain pedal, by the key that played them. */
  private pedaled = new Map<string, Voice>();
  /** Piano notes fading out under pedal mode, by pitch, so striking the key again damps the old one. */
  private tails = new Map<number, Voice>();
  /** Fretless play: notes re-pitched without restriking, by source (sample pitch, judged note, offset in cents). */
  private glides = new Map<string, { base: number; note: number; offset: number }>();
  /** Vibrato / bend per source in cents, added on top of a glide. */
  private bends = new Map<string, number>();
  /** Loudness set through setLevel (string energy / bow pressure). */
  private levels = new Map<string, number>();
  /** Long notes that were hit and are still running. */
  private holds: PlayNote[] = [];
  private holdScore = 0;
  /** Presses that came before their note's window; they count once the note arrives if still held. */
  private preHolds: { src: string; note: PlayNote; pos?: PressPos; forgiving?: boolean }[] = [];
  /** Microphone notes by source key: the pitches each one is credited with. */
  private heard = new Map<string, Set<number>>();
  private lastFrameT = 0;
  private lastHoldEmit = 0;
  private beats: GridBeat[] = [];
  private firstNoteTime = 0;
  private countInActive = false;
  private listeners = new Set<Listener>();
  private loadToken = 0;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  get instrumentId(): InstrumentId {
    return instrumentIdFor(this.config);
  }

  get fretSpec(): FrettedSpec | null {
    return fretSpecFor(this.config.instrument);
  }

  /** Current song position in seconds (negative during lead-in). */
  get time(): number {
    if (this.status !== "playing") return this.anchorSong;
    return this.anchorSong + ((performance.now() - this.anchorPerf) / 1000) * this.config.speed;
  }

  get isRunStart(): boolean {
    return this.anchorSong <= this.startTime + 0.001 && this.notes.every((n) => n.state === NoteState.Pending);
  }

  // ---------------------------------------------------------------- loading

  async ensureAudio(): Promise<boolean> {
    const ids = Array.from(new Set<InstrumentId>([this.instrumentId, "piano"]));
    const missing = ids.filter((id) => !isLoaded(id));
    if (!missing.length) return true;
    const token = ++this.loadToken;
    this.loading = true;
    this.loadError = null;
    this.loadProgress = 0;
    this.emit();
    const progress = new Map<InstrumentId, number>();
    try {
      await Promise.all(
        missing.map((id) =>
          loadInstrument(id, (done, total) => {
            progress.set(id, done / total);
            let sum = 0;
            for (const v of progress.values()) sum += v;
            this.loadProgress = sum / missing.length;
            this.emit();
          })
        )
      );
      return true;
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : String(err);
      return false;
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
        this.loadProgress = 1;
        this.emit();
      }
    }
  }

  load(song: Song, cfg: Partial<EngineConfig>): void {
    this.hardStop();
    this.song = song;
    this.config = { ...this.config, ...cfg, loop: { ...(cfg.loop ?? DEFAULT_CONFIG.loop) } };
    this.rebuild();
    this.resetRun();
    this.status = "ready";
    this.emit();
  }

  unload(): void {
    this.hardStop();
    this.song = null;
    this.notes = [];
    this.accomp = [];
    this.status = "empty";
    this.emit();
  }

  private rebuild(): void {
    const song = this.song;
    if (!song) return;
    const cfg = this.config;
    const spec = this.fretSpec;
    const cut = cfg.segmentEnd > 0 ? (n: SongNote) => n.time < cfg.segmentEnd : null;
    let raw = selectPlayerNotes(song, cfg.playTracks, cfg.hand);
    this.accomp = selectAccompanimentNotes(song, cfg.playTracks, cfg.hand, cfg.mutedTracks);
    if (cut) {
      raw = raw.filter(cut);
      this.accomp = this.accomp.filter(cut);
    }

    // Group simultaneous notes, fold into instrument range, drop duplicates.
    const groups: SongNote[][] = [];
    for (const n of raw) {
      const last = groups[groups.length - 1];
      if (last && n.time - last[0].time <= GROUP_EPS) last.push(n);
      else groups.push([n]);
    }

    const notes: PlayNote[] = [];
    let id = 0;
    const maxPerGroup = spec ? (cfg.instrument === "violin" ? 2 : spec.tuning.length) : 10;
    const kept: SongNote[][] = groups.map((g) => {
      const seen = new Map<number, SongNote>();
      for (const n of g) {
        const midi = spec ? foldIntoRange(n.midi, spec) : n.midi;
        const prev = seen.get(midi);
        if (!prev || prev.duration < n.duration) seen.set(midi, { ...n, midi });
      }
      return [...seen.values()].sort((a, b) => b.midi - a.midi).slice(0, maxPerGroup);
    });
    const fingerings = spec ? assignFingerings(kept.map((g) => g.map((n) => n.midi)), spec) : null;
    kept.forEach((g, gi) => {
      g.forEach((n, ni) => {
        const f = fingerings?.[gi][ni];
        if (fingerings && (!f || f.string < 0)) return;
        notes.push({
          ...n,
          id: id++,
          group: gi,
          string: f ? f.string : -1,
          fret: f ? f.fret : -1,
          state: NoteState.Pending,
          judgement: null,
          resolvedAt: 0,
          holdSrc: null,
          holdStart: 0,
          held: 0,
          holding: false,
          rejoined: false,
          offsetMs: null,
          finger: 0,
        });
      });
    });
    notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
    this.notes = notes;
    this.assignFingers();
    this.maxNoteDuration = notes.reduce((m, n) => Math.max(m, n.duration), 0);

    const firstPlayer = notes.length ? notes[0].time : Infinity;
    const firstAcc = this.accomp.length ? this.accomp[0].time : Infinity;
    this.firstNoteTime = Math.min(firstPlayer, firstAcc, song.duration);
    if (!Number.isFinite(this.firstNoteTime)) this.firstNoteTime = 0;
    // Count-in: one measure, halved for slow songs so the first notes are on screen before play.
    let countBeats = song.beatsPerMeasure;
    while (countBeats > 2 && countBeats % 2 === 0 && countBeats * song.firstBeatSec > 2.6) countBeats /= 2;
    const lead = cfg.countIn ? Math.max(countBeats * song.firstBeatSec, 1.2) : 1.6 * cfg.speed;
    this.startTime = Math.min(0, this.firstNoteTime - lead);
    const lastPlayer = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
    const lastAcc = this.accomp.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
    this.endTime = Math.max(lastPlayer, lastAcc) + 0.6;

    // Beat grid extended backwards for the count-in.
    const grid: GridBeat[] = song.beats.map((b) => ({ time: b.time, downbeat: b.downbeat }));
    const first = grid.length ? grid[0].time : 0;
    const pre: GridBeat[] = [];
    for (let k = 1; first - k * song.firstBeatSec >= this.startTime - 0.001; k++) {
      pre.unshift({ time: first - k * song.firstBeatSec, downbeat: k % song.beatsPerMeasure === 0 });
    }
    this.beats = [...pre, ...grid];
  }

  /** Suggested piano fingers for the player's notes. */
  private assignFingers(): void {
    const { song, notes, config: cfg } = this;
    if (!song || cfg.instrument !== "piano" || !notes.length) return;
    let hand = handOfNote(song);
    const lo = Math.min(...notes.map((n) => n.midi));
    const hi = Math.max(...notes.map((n) => n.midi));
    // A single narrow line (no hand tracks) is one hand's, even where it dips below middle C.
    if (cfg.hand !== "both") hand = () => cfg.hand as "left" | "right";
    else if (!handTracks(song) && hi - lo < 19) {
      const side = (lo + hi) / 2 < HAND_SPLIT - 6 ? "left" : "right";
      hand = () => side;
    }
    // With only the song's keys on screen, neighbouring columns are fingered like neighbouring white keys.
    const used = cfg.compactKeys ? [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b) : [];
    const column = new Map(used.map((m, i) => [m, Math.floor(i / 7) * 12 + WHITE_STEPS[i % 7]]));
    const fingers = assignPianoFingers(
      notes.map((n) => ({ midi: column.get(n.midi) ?? n.midi, time: n.time, duration: n.duration, group: n.group, hand: hand(n) }))
    );
    notes.forEach((n, i) => (n.finger = fingers[i]));
  }

  /** Song beat grid (including count-in beats) for drawing measure lines. */
  get grid(): readonly GridBeat[] {
    return this.beats;
  }

  // ------------------------------------------------------------- transport

  private reanchor(songT: number): void {
    const ctx = getBus().ctx;
    this.anchorSong = songT;
    this.anchorPerf = performance.now();
    // Audio reaches the speakers this much after its scheduled time, so it is scheduled that much earlier
    // and sounds the moment its note crosses the hit line.
    const lag = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    this.anchorCtx = ctx.currentTime + 0.01 - Math.min(MAX_OUTPUT_LAG, Math.max(0, lag));
  }

  private ctxAt(songT: number): number {
    return this.anchorCtx + (songT - this.anchorSong) / this.config.speed;
  }

  async play(): Promise<void> {
    if (!this.song || this.status === "playing") return;
    if (this.transportHook?.("play")) return;
    await this.start();
  }

  private async start(): Promise<void> {
    if (!this.song || this.status === "playing") return;
    await unlockAudio();
    const ok = await this.ensureAudio();
    if (!ok || !this.song) return;
    if (this.status === "complete") this.resetRun();
    if (this.isRunStart) {
      this.stats = emptyStats(this.notes.length);
      this.wrongTimes = [];
      this.loopWrongBase = 0;
      this.runDirty = false;
      this.countInActive = this.config.countIn;
    }
    this.reanchor(this.anchorSong);
    this.resetScheduling(this.anchorSong);
    this.status = "playing";
    this.emit();
  }

  /**
   * Starts so that song time `songT` falls on `perfAt` (a performance.now() time), catching up if that moment has
   * passed: two devices given the same moment play in step. Bypasses the transport hook.
   */
  async startAt(songT: number, perfAt: number): Promise<void> {
    if (!this.song) return;
    if (this.status === "playing") this.halt();
    if (this.status === "complete" || songT <= this.startTime + 0.001) this.resetRun();
    else this.anchorSong = Math.max(this.startTime, Math.min(this.endTime, songT));
    const ok = await this.ensureAudio();
    if (!ok || !this.song) return;
    const wait = perfAt - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    await this.start();
    if (this.status !== "playing") return;
    const late = (performance.now() - perfAt) / 1000;
    if (late > 0.002) this.seekInternalKeepNotes(this.anchorSong + late * this.config.speed);
  }

  /** Asked before a user's play / pause / seek / restart; returning true takes the action over (live duet). */
  transportHook: ((action: "play" | "pause" | "seek" | "stop") => boolean) | null = null;

  pause(): void {
    if (this.status !== "playing") return;
    if (this.transportHook?.("pause")) return;
    this.halt();
  }

  /** Pauses without asking the transport hook. */
  halt(): void {
    if (this.status !== "playing") return;
    this.anchorSong = this.time;
    this.status = "paused";
    this.waiting = false;
    this.killScheduled();
    this.emit();
  }

  toggle(): void {
    if (this.status === "playing") this.pause();
    else void this.play();
  }

  /** Back to the beginning, keeping the song loaded. */
  stop(): void {
    if (!this.song) return;
    if (this.transportHook?.("stop")) return;
    this.rewind();
  }

  /** Back to the beginning without asking the transport hook. */
  rewind(): void {
    if (!this.song) return;
    this.killScheduled();
    this.resetRun();
    this.status = "ready";
    this.emit();
  }

  private hardStop(): void {
    this.killScheduled();
    this.waiting = false;
    this.status = this.song ? "ready" : "empty";
  }

  seek(t: number): void {
    if (!this.song) return;
    if (this.transportHook?.("seek")) return;
    const target = Math.max(this.startTime, Math.min(this.endTime, t));
    if (this.notes.some((n) => n.state === NoteState.Hit || n.state === NoteState.Missed)) this.runDirty = true;
    this.countInActive = false;
    this.loopWrongBase = this.stats.wrong;
    this.seekInternal(target);
    if (this.status === "complete") this.status = "paused";
    this.emit();
  }

  private resetHold(n: PlayNote): void {
    n.holdSrc = null;
    n.holdStart = 0;
    n.held = 0;
    n.holding = false;
    n.rejoined = false;
    n.offsetMs = null;
  }

  private seekInternal(t: number): void {
    this.killScheduled();
    for (const n of this.notes) {
      if (n.time >= t - 0.0005) {
        n.state = NoteState.Pending;
        n.judgement = null;
        this.resetHold(n);
      } else if (n.state === NoteState.Pending) {
        n.state = NoteState.Skipped;
      }
    }
    for (const n of this.holds) n.holding = false;
    this.holds = [];
    this.preHolds = [];
    this.pendingIdx = 0;
    this.advancePending();
    this.waiting = false;
    this.reanchor(t);
    this.resetScheduling(t);
  }

  private resetRun(): void {
    for (const n of this.notes) {
      n.state = NoteState.Pending;
      n.judgement = null;
      n.resolvedAt = 0;
      this.resetHold(n);
    }
    this.holds = [];
    this.preHolds = [];
    this.holdScore = 0;
    this.stats = emptyStats(this.notes.length);
    this.wrongTimes = [];
    this.loopWrongBase = 0;
    this.runDirty = false;
    this.fx = [];
    this.pendingIdx = 0;
    this.waiting = false;
    this.anchorSong = this.startTime;
    this.resetScheduling(this.startTime);
  }

  private resetScheduling(t: number): void {
    this.accIdx = lowerBound(this.accomp, t - 0.0005);
    this.autoIdx = lowerBound(this.notes, t - 0.0005);
    this.beatIdx = lowerBound(this.beats, t - 0.0005);
    this.scheduledUntil = t;
  }

  private killScheduled(): void {
    for (const v of this.scheduled) v.stop(0.06);
    this.scheduled = [];
    for (const v of this.remote.values()) v.stop(0.08);
    this.remote.clear();
  }

  /** Hears what the player does, next to `onInput`; returns the unsubscribe. */
  addInputListener(fn: (e: PlayerInput) => void): () => void {
    this.inputListeners.add(fn);
    return () => this.inputListeners.delete(fn);
  }

  private emitInput(e: PlayerInput): void {
    this.onInput?.(e);
    for (const fn of this.inputListeners) fn(e);
  }

  /**
   * A live duet partner's note, sounded at its song time plus `bufferSec` so their rhythm survives network
   * jitter; one arriving later than that sounds at once. `midi` null lets the key go.
   */
  remoteNote(key: string, midi: number | null, velocity: number, songT: number, bufferSec: number): void {
    const now = getBus().ctx.currentTime;
    const when = this.status === "playing" ? Math.max(now, this.ctxAt(songT) + bufferSec) : now;
    const prev = this.remote.get(key);
    if (prev) {
      prev.stop(midi === null && this.config.pianoPedal ? this.pedalTail : undefined, when);
      this.remote.delete(key);
    }
    if (midi === null) return;
    const v = playNote("piano", midi, velocity, { when, volume: this.config.playerVolume * 0.85 });
    if (v) this.remote.set(key, v);
  }

  configure(patch: Partial<EngineConfig>): void {
    const prev = this.config;
    const t = this.time;
    const next: EngineConfig = { ...prev, ...patch, loop: { ...(patch.loop ?? prev.loop) } };
    const notesChanged =
      next.instrument !== prev.instrument ||
      next.guitarTone !== prev.guitarTone ||
      next.hand !== prev.hand ||
      next.countIn !== prev.countIn ||
      next.segmentEnd !== prev.segmentEnd ||
      next.playTracks.join() !== prev.playTracks.join() ||
      next.mutedTracks.join() !== prev.mutedTracks.join();
    const fingersChanged = next.compactKeys !== prev.compactKeys;
    const timingChanged = next.speed !== prev.speed || next.autoPlay !== prev.autoPlay;
    const audioChanged = instrumentIdFor(next) !== instrumentIdFor(prev);
    this.config = next;
    if (!this.song) {
      this.emit();
      return;
    }

    const wasPlaying = this.status === "playing";
    if (next.waitMode !== prev.waitMode && !this.isRunStart && this.status !== "ready") this.runDirty = true;
    if (notesChanged) {
      const atStart = this.isRunStart;
      this.rebuild();
      if (atStart || this.status === "ready" || this.status === "complete") {
        this.resetRun();
        if (this.status === "complete") this.status = "ready";
      } else {
        this.runDirty = true;
        this.stats = { ...this.stats, total: this.notes.length };
        this.seekInternal(Math.max(this.startTime, t));
      }
    } else if (timingChanged && this.status !== "ready") {
      if (next.autoPlay !== prev.autoPlay) this.runDirty = true;
      this.seekInternalKeepNotes(t);
    }
    if (fingersChanged && !notesChanged) this.assignFingers();

    if (audioChanged && wasPlaying && !isLoaded(this.instrumentId)) {
      this.pause();
      void this.ensureAudio().then((ok) => {
        if (ok) void this.play();
      });
      return;
    }
    if (audioChanged) void this.ensureAudio();
    this.emit();
  }

  /** Re-anchors at t without touching note states (speed / autoplay changes). */
  private seekInternalKeepNotes(t: number): void {
    this.killScheduled();
    this.reanchor(t);
    this.resetScheduling(t);
  }

  setLoop(loop: EngineConfig["loop"]): void {
    this.config = { ...this.config, loop: { ...loop } };
    this.emit();
  }

  // -------------------------------------------------------------- per frame

  private advancePending(): void {
    while (this.pendingIdx < this.notes.length && this.notes[this.pendingIdx].state !== NoteState.Pending) {
      this.pendingIdx++;
    }
  }

  private nextPendingTime(): number | null {
    this.advancePending();
    return this.pendingIdx < this.notes.length ? this.notes[this.pendingIdx].time : null;
  }

  /** Advances the game; call once per animation frame. Returns the song time to render. */
  frame(): number {
    if (this.status !== "playing" || !this.song) return this.anchorSong;
    const cfg = this.config;
    let t = this.time;

    if (cfg.waitMode && !cfg.autoPlay) {
      const g = this.nextPendingTime();
      if (g !== null && t >= g) {
        this.reanchor(g);
        t = g;
        if (!this.waiting) {
          this.waiting = true;
          this.emit();
        }
      } else if (this.waiting) {
        this.waiting = false;
        this.emit();
      }
    } else if (this.waiting) {
      this.waiting = false;
      this.emit();
    }

    const loop = cfg.loop;
    if (loop.enabled && loop.b - loop.a > 0.25 && t >= loop.b) {
      if (this.onLoopPass) {
        if (!cfg.waitMode && !cfg.autoPlay) this.scanMisses(t);
        const pass: LoopPass = { hit: 0, miss: 0, wrong: this.stats.wrong - this.loopWrongBase };
        for (const n of this.notes) {
          if (n.time < loop.a || n.time >= loop.b) continue;
          if (n.state === NoteState.Hit) pass.hit++;
          else if (n.state === NoteState.Missed) pass.miss++;
        }
        this.onLoopPass(pass);
      }
      this.loopWrongBase = this.stats.wrong;
      this.runDirty = true;
      this.countInActive = false;
      const pre = Math.min(this.song.firstBeatSec, 1);
      this.seekInternal(Math.max(this.startTime, loop.a - pre));
      t = this.anchorSong;
      this.emit();
    }

    const dt = t - this.lastFrameT;
    this.lastFrameT = t;
    if (cfg.autoPlay) this.markAutoHits(t);
    else {
      this.settlePreHolds(t);
      if (!cfg.waitMode) this.scanMisses(t);
      this.trackHolds(t, dt > 0 && dt < 0.25 ? dt : 0);
    }

    this.schedule(t);

    if (!loop.enabled && t >= this.endTime && this.nextPendingTime() === null) {
      this.complete();
    } else if (!loop.enabled && t >= this.endTime + 1.5) {
      this.scanMisses(Infinity);
      this.complete();
    }
    return t;
  }

  private markAutoHits(t: number): void {
    let changed = false;
    for (let i = this.pendingIdx; i < this.notes.length && this.notes[i].time <= t; i++) {
      const n = this.notes[i];
      if (n.state === NoteState.Pending) {
        n.state = NoteState.Hit;
        n.judgement = "perfect";
        n.resolvedAt = performance.now();
        if (t - n.time < 0.25 * this.config.speed) this.pushFx(n, "perfect", null, true);
        changed = true;
      }
    }
    if (changed) this.advancePending();
  }

  /** Credits long notes for as long as their key/string keeps sounding. */
  private trackHolds(t: number, dt: number): void {
    if (!this.holds.length) return;
    const s = this.stats;
    let finished = false;
    const keep: PlayNote[] = [];
    for (const n of this.holds) {
      const end = n.time + n.duration;
      const on = !!n.holdSrc && this.isSounding(n.holdSrc, n.midi);
      if (on && dt > 0) {
        const gained = Math.max(0, Math.min(t, end) - Math.max(t - dt, n.holdStart));
        n.held += gained;
        this.holdScore += (gained / this.config.speed) * HOLD_POINTS_PER_SEC * comboMultiplier(s.combo);
      }
      n.holding = on && t < end;
      if (t < end) {
        keep.push(n);
        continue;
      }
      const w = holdWeight(n.duration);
      if (n.rejoined) {
        // The miss already counted the full hold as possible; credit the share of the whole note that was held.
        s.holdEarned += w * Math.min(1, n.held / (n.duration * 0.92));
      } else {
        const span = Math.max(0.05, end - n.holdStart);
        s.holdEarned += w * Math.min(1, n.held / (span * 0.92));
        s.holdPossible += w;
      }
      finished = true;
    }
    this.holds = keep;
    const whole = Math.floor(this.holdScore);
    if (whole > 0) {
      s.score += whole;
      this.holdScore -= whole;
    }
    const now = performance.now();
    if (finished || (whole > 0 && now - this.lastHoldEmit > 120)) {
      this.lastHoldEmit = now;
      this.stats = { ...s };
      this.emit();
    }
  }

  /** Early presses: still held when their note comes into range → an early hit; let go before → a wrong note. */
  private settlePreHolds(t: number): void {
    if (!this.preHolds.length) return;
    const early = (this.config.timingWindowMs / 1000) * this.config.speed * EARLY_FACTOR;
    const keep: typeof this.preHolds = [];
    let changed = false;
    for (const p of this.preHolds) {
      const n = p.note;
      if (n.state !== NoteState.Pending) continue;
      const sounding = this.isSounding(p.src, n.midi);
      if (sounding && t < n.time - early) {
        keep.push(p);
        continue;
      }
      if (sounding) this.hitNote(n, p.src, this.config.waitMode ? "perfect" : "good", this.config.waitMode ? null : "early");
      else if (!p.forgiving) {
        this.stats = { ...this.stats, wrong: this.stats.wrong + 1 };
        this.wrongTimes.push(t);
        this.pushFx({ midi: n.midi, string: p.pos?.string ?? -1, fret: p.pos?.fret ?? -1 }, "wrong");
      }
      changed = true;
    }
    this.preHolds = keep;
    if (changed) this.emit();
  }

  private scanMisses(t: number): void {
    const win = (this.config.timingWindowMs / 1000) * this.config.speed * LATE_FACTOR;
    let changed = false;
    for (let i = this.pendingIdx; i < this.notes.length && this.notes[i].time < t - win; i++) {
      const n = this.notes[i];
      if (n.state !== NoteState.Pending) continue;
      n.state = NoteState.Missed;
      n.judgement = "miss";
      n.resolvedAt = performance.now();
      this.stats.miss++;
      this.stats.holdPossible += holdWeight(n.duration);
      this.stats.combo = 0;
      this.pushFx(n, "miss");
      changed = true;
    }
    if (changed) {
      this.advancePending();
      this.stats = { ...this.stats };
      this.emit();
    }
  }

  private schedule(t: number): void {
    const cfg = this.config;
    let horizon = t + SCHEDULE_AHEAD * cfg.speed;
    if (cfg.waitMode && !cfg.autoPlay) {
      const g = this.nextPendingTime();
      if (g !== null) horizon = Math.min(horizon, g - 0.0005);
    }
    if (horizon <= this.scheduledUntil) return;
    const ctx = getBus().ctx;
    const late = ctx.currentTime - 0.04;

    while (this.accIdx < this.accomp.length && this.accomp[this.accIdx].time < horizon) {
      const n = this.accomp[this.accIdx++];
      const when = this.ctxAt(n.time);
      if (when < late || cfg.accompVolume <= 0) continue;
      const v = playNote("piano", n.midi, n.velocity, {
        when,
        duration: n.duration / cfg.speed,
        volume: cfg.accompVolume,
      });
      if (v) this.scheduled.push(v);
    }

    if (cfg.autoPlay) {
      const inst = this.instrumentId;
      while (this.autoIdx < this.notes.length && this.notes[this.autoIdx].time < horizon) {
        const n = this.notes[this.autoIdx++];
        const when = this.ctxAt(n.time);
        if (when < late) continue;
        const v = playNote(inst, n.midi, Math.max(0.55, n.velocity), {
          when,
          duration: n.duration / cfg.speed,
          volume: cfg.playerVolume,
        });
        if (v) this.scheduled.push(v);
      }
    } else {
      this.autoIdx = lowerBound(this.notes, horizon);
    }

    while (this.beatIdx < this.beats.length && this.beats[this.beatIdx].time < horizon) {
      const b = this.beats[this.beatIdx++];
      const inCountIn = this.countInActive && b.time < this.firstNoteTime - 0.01;
      if (cfg.metronome || inCountIn) {
        const when = this.ctxAt(b.time);
        if (when >= late) scheduleClick(when, b.downbeat);
      }
    }

    this.scheduledUntil = horizon;
    if (this.scheduled.length > 256) this.scheduled = this.scheduled.filter((v) => !v.done);
  }

  private complete(): void {
    const t = this.time;
    this.status = "complete";
    this.waiting = false;
    this.anchorSong = Math.min(t, this.endTime);
    this.scheduled = this.scheduled.filter((v) => !v.done);
    this.emit();
    this.onComplete?.({ stats: { ...this.stats }, dirty: this.runDirty, config: { ...this.config } });
  }

  // ------------------------------------------------------------------ input

  private pushFx(n: { midi: number; string: number; fret: number }, j: Judgement | "wrong", timing: Fx["timing"] = null, auto = false): void {
    this.fx.push({ midi: n.midi, string: n.string, fret: n.fret, judgement: j, timing, auto, at: performance.now() });
    if (this.fx.length > 64) this.fx.splice(0, this.fx.length - 64);
  }

  /** A note was pressed by the player (touch, keyboard or MIDI). */
  press(sourceKey: string, midi: number, velocity = 0.8, pos?: PressPos): void {
    const prev = this.voices.get(sourceKey);
    if (prev) prev.stop();
    this.mute(sourceKey, 0.04);
    this.pedaled.get(sourceKey)?.stop();
    this.pedaled.delete(sourceKey);
    this.tails.get(midi)?.stop();
    this.tails.delete(midi);
    this.levels.delete(sourceKey);
    this.glides.delete(sourceKey);
    this.bends.delete(sourceKey);
    const voice = playNote(this.instrumentId, midi, velocity, { volume: this.config.playerVolume });
    if (voice) this.voices.set(sourceKey, voice);
    const spec = this.fretSpec;
    let place = pos;
    if (!place && spec) {
      const s = spec.tuning.findIndex((open, i) => midi >= open && (i === spec.tuning.length - 1 || midi < spec.tuning[i + 1]));
      if (s >= 0 && midi - spec.tuning[s] <= spec.maxFret) place = { string: s, fret: midi - spec.tuning[s] };
    }
    this.held.set(sourceKey, { midi, string: place?.string ?? -1, fret: place?.fret ?? -1 });
    this.emitInput({ type: "on", key: sourceKey, midi, velocity });
    this.judgePress(sourceKey, midi, place);
  }

  /** Lets go of a note; with `ring` the voice decays naturally (a plucked string) instead of stopping. */
  release(sourceKey: string, ring = false): void {
    const tail = !ring && !this.sustain && this.config.pianoPedal && this.instrumentId === "piano";
    if (this.held.delete(sourceKey)) this.emitInput({ type: "off", key: sourceKey, ring: ring || tail });
    const v = this.voices.get(sourceKey);
    if (!v) return;
    this.voices.delete(sourceKey);
    if (ring) {
      this.mute(sourceKey, 0.04);
      this.ringing.set(sourceKey, v);
    } else if (this.sustain) {
      this.sustained.push(v);
      this.pedaled.set(sourceKey, v);
      this.levels.delete(sourceKey);
    } else if (tail) {
      v.stop(this.pedalTail);
      this.tails.get(v.midi)?.stop();
      this.tails.set(v.midi, v);
      this.levels.delete(sourceKey);
    } else {
      v.stop();
      this.levels.delete(sourceKey);
    }
  }

  /** Damps a ringing string. */
  mute(sourceKey: string, release = 0.12): void {
    const v = this.ringing.get(sourceKey);
    if (!v) return;
    this.ringing.delete(sourceKey);
    this.levels.delete(sourceKey);
    this.glides.delete(sourceKey);
    v.stop(release);
    this.emitInput({ type: "mute", key: sourceKey });
  }

  /** Loudness of a held or ringing note (0–1), e.g. bow pressure or string energy. */
  setLevel(sourceKey: string, level: number): void {
    const v = this.voices.get(sourceKey) ?? this.ringing.get(sourceKey);
    if (!v) return;
    this.levels.set(sourceKey, level);
    v.setLevel?.(level);
  }

  /** Whether the note a source played is still audibly going (held, ringing or pedaled). */
  isSounding(sourceKey: string, midi: number): boolean {
    if (this.heard.get(sourceKey)?.has(midi)) return true;
    const v = this.voices.get(sourceKey) ?? this.ringing.get(sourceKey) ?? this.pedaled.get(sourceKey);
    const note = this.glides.get(sourceKey)?.note ?? v?.midi;
    return !!v && !v.done && note === midi && (this.levels.get(sourceKey) ?? 1) > 0.15;
  }

  isHeld(sourceKey: string): boolean {
    return this.voices.has(sourceKey);
  }

  isRinging(sourceKey: string): boolean {
    const v = this.ringing.get(sourceKey);
    return !!v && !v.done;
  }

  /** Vibrato / slide for a held note, in cents. */
  bend(sourceKey: string, cents: number): void {
    this.bends.set(sourceKey, cents);
    (this.voices.get(sourceKey) ?? this.ringing.get(sourceKey))?.bend((this.glides.get(sourceKey)?.offset ?? 0) + cents);
  }

  /**
   * Fretless play: moves a source's sounding note to a continuous `pitch` (fractional MIDI) without restriking.
   * Only a `settled` pitch close to a semitone becomes the played note, so sliding past notes doesn't judge them.
   */
  glide(sourceKey: string, pitch: number, settled = false, pos?: PressPos): void {
    const held = this.voices.get(sourceKey);
    let v = held ?? this.ringing.get(sourceKey);
    if (!v) return;
    const g = this.glides.get(sourceKey) ?? { base: v.midi, note: v.midi, offset: 0 };
    if (Math.abs(pitch - g.base) > GLIDE_RANGE) {
      const base = Math.round(pitch);
      const next = playNote(this.instrumentId, base, 0.7, { volume: this.config.playerVolume, offset: GLIDE_OFFSET });
      if (next) {
        const level = this.levels.get(sourceKey);
        if (level !== undefined) next.setLevel?.(level, 0.01);
        v.stop(0.08);
        if (held) this.voices.set(sourceKey, next);
        else this.ringing.set(sourceKey, next);
        v = next;
        g.base = base;
      }
    }
    g.offset = (pitch - g.base) * 100;
    v.bend(g.offset + (this.bends.get(sourceKey) ?? 0));
    this.glides.set(sourceKey, g);

    const nearest = Math.round(pitch);
    if (!settled || nearest === g.note || Math.abs(pitch - nearest) > 0.3) return;
    g.note = nearest;
    if (held && this.held.has(sourceKey)) {
      this.emitInput({ type: "off", key: sourceKey, ring: false });
      this.held.set(sourceKey, { midi: nearest, string: pos?.string ?? -1, fret: pos?.fret ?? -1 });
      this.emitInput({ type: "on", key: sourceKey, midi: nearest, velocity: 0.7 });
    }
    this.judgePress(sourceKey, nearest, pos);
  }

  private get pedalTail(): number {
    return PEDAL_TAIL[0] + (PEDAL_TAIL[1] - PEDAL_TAIL[0]) * this.config.pianoSustain;
  }

  /** Sustain pedal from one source; the pedal is down while any source holds it. */
  setSustain(down: boolean, source = "pedal"): void {
    if (down) this.sustainBy.add(source);
    else this.sustainBy.delete(source);
    const on = this.sustainBy.size > 0;
    if (this.sustain !== on) this.emitInput({ type: "sustain", on });
    this.sustain = on;
    if (!on) {
      const fade = this.config.pianoPedal && this.instrumentId === "piano" ? this.pedalTail : 0.35;
      for (const v of this.sustained) v.stop(fade);
      this.sustained = [];
      this.pedaled.clear();
    }
  }

  releaseAll(): void {
    for (const key of [...this.voices.keys()]) this.release(key);
    for (const key of [...this.ringing.keys()]) this.mute(key);
    for (const key of [...this.heard.keys()]) this.unhear(key);
    this.held.clear();
  }

  /**
   * A note heard from a real instrument (microphone). Nothing is synthesised; pitch trackers slip octaves and
   * hear one note of a chord, so a matching pitch class counts and one heard note plays its whole chord.
   * Misdetections never count as wrong notes.
   */
  hear(sourceKey: string, midi: number, velocity = 0.8, lagSec = 0): void {
    if (this.heard.has(sourceKey)) this.unhear(sourceKey);
    const m = this.heardTarget(midi);
    const set = new Set([m]);
    this.heard.set(sourceKey, set);
    this.held.set(sourceKey, { midi: m, string: -1, fret: -1 });
    this.emitInput({ type: "on", key: sourceKey, midi: m, velocity });
    const hit = this.judgePress(sourceKey, m, undefined, true, lagSec);
    if (!hit) return;
    for (let i = this.pendingIdx; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.time > hit.time + 0.05) break;
      if (n.group !== hit.group || n.state !== NoteState.Pending) continue;
      set.add(n.midi);
      this.hitNote(n, sourceKey, hit.judgement ?? "good", null, hit.offsetMs);
    }
  }

  unhear(sourceKey: string): void {
    if (!this.heard.delete(sourceKey)) return;
    if (this.held.delete(sourceKey)) this.emitInput({ type: "off", key: sourceKey, ring: false });
  }

  /** The pending note a heard pitch most likely means: the same pitch, else the nearest octave of it in the window. */
  private heardTarget(midi: number): number {
    if (this.status !== "playing" || this.config.autoPlay) return midi;
    const win = (this.config.timingWindowMs / 1000) * this.config.speed;
    const t = this.time;
    let best = midi;
    let bestD = Infinity;
    const waitGroup = this.waiting && this.pendingIdx < this.notes.length ? this.notes[this.pendingIdx].group : -1;
    for (let i = this.pendingIdx; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.time > t + win * EARLY_FACTOR) break;
      if (n.state !== NoteState.Pending || (t - n.time > win * LATE_FACTOR && n.group !== waitGroup)) continue;
      const d = Math.abs(n.midi - midi);
      if (d === 0) return midi;
      if (d % 12 === 0 && d <= 24 && d < bestD) {
        best = n.midi;
        bestD = d;
      }
    }
    return best;
  }

  /** `lagSec`: the press really happened that long ago (slow detectors such as the microphone). */
  private judgePress(sourceKey: string, midi: number, pos?: PressPos, forgiving = false, lagSec = 0): PlayNote | null {
    if (this.status !== "playing" || this.config.autoPlay) return null;
    const cfg = this.config;
    const t = this.time - lagSec * cfg.speed;
    const win = (cfg.timingWindowMs / 1000) * cfg.speed;
    const early = win * EARLY_FACTOR;
    const late = win * LATE_FACTOR;
    let best: PlayNote | null = null;
    let bestDelta = Infinity;
    const waitGroup = this.waiting && this.pendingIdx < this.notes.length ? this.notes[this.pendingIdx].group : -1;
    for (let i = this.pendingIdx; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.time > t + early) break;
      if (n.state !== NoteState.Pending || n.midi !== midi) continue;
      const delta = Math.abs(n.time - t);
      const inWindow = n.time - t <= early && t - n.time <= late;
      if ((inWindow || n.group === waitGroup) && delta < bestDelta) {
        best = n;
        bestDelta = delta;
      }
    }
    if (!best) {
      // Catching a long note somewhere in its tail (after missing its head or letting go) picks the hold back up.
      const tail = this.tailNote(midi, t);
      if (tail) {
        if (tail.state === NoteState.Missed && !tail.rejoined) {
          tail.rejoined = true;
          tail.holdStart = t;
          tail.held = 0;
        }
        tail.holdSrc = sourceKey;
        tail.holding = true;
        if (!this.holds.includes(tail)) this.holds.push(tail);
        this.emit();
        return null;
      }
      // A press just after a note slipped past is a late attempt, not a stray key; the miss already counted.
      const [m0, m1] = this.visibleRange(t - late - 0.35, t);
      for (let i = m0; i < m1; i++) {
        const n = this.notes[i];
        if (n.state === NoteState.Missed && n.midi === midi && t - n.time <= late + 0.35) return null;
      }
      // Too early for the window, but if it's still held when the note arrives it counts (as early).
      const ahead = early + EARLY_HOLD_SEC * cfg.speed;
      for (let i = this.pendingIdx; i < this.notes.length; i++) {
        const n = this.notes[i];
        if (n.time > t + ahead) break;
        if (n.state !== NoteState.Pending || n.midi !== midi || this.preHolds.some((p) => p.note === n)) continue;
        this.preHolds.push({ src: sourceKey, note: n, pos, forgiving });
        return null;
      }
      if (forgiving) return null;
      this.stats = { ...this.stats, wrong: this.stats.wrong + 1 };
      this.wrongTimes.push(t);
      this.pushFx({ midi, string: pos?.string ?? -1, fret: pos?.fret ?? -1 }, "wrong");
      this.emit();
      return null;
    }
    const deltaMs = ((t - best.time) / cfg.speed) * 1000;
    // Wait mode is about playing the right notes, not timing; wrong presses still cost accuracy.
    const j: Judgement = cfg.waitMode ? "perfect" : (judge(deltaMs, cfg.timingWindowMs) ?? "good");
    const timing = cfg.waitMode || j === "perfect" ? null : deltaMs < 0 ? "early" : "late";
    this.hitNote(best, sourceKey, j, timing, cfg.waitMode ? null : deltaMs);
    return best;
  }

  private hitNote(n: PlayNote, sourceKey: string, j: Judgement, timing: Fx["timing"], offsetMs: number | null = null): void {
    const t = this.time;
    n.state = NoteState.Hit;
    n.judgement = j;
    n.resolvedAt = performance.now();
    n.offsetMs = offsetMs;
    if (holdWeight(n.duration) > 0) {
      n.holdSrc = sourceKey;
      n.holdStart = Math.max(n.time, Math.min(t, n.time + n.duration));
      n.held = 0;
      n.holding = true;
      this.holds.push(n);
    }
    const s = { ...this.stats };
    s[j]++;
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.score += JUDGEMENT_POINTS[j] * comboMultiplier(s.combo);
    this.stats = s;
    this.pushFx(n, j, timing);
    this.advancePending();
    this.emit();
  }

  /** A long note of this pitch whose tail is passing the hit line, preferring one nobody is holding. */
  private tailNote(midi: number, t: number): PlayNote | null {
    const [i0, i1] = this.visibleRange(t, t + 0.0001);
    let found: PlayNote | null = null;
    for (let i = i0; i < i1; i++) {
      const n = this.notes[i];
      if (n.midi !== midi || (n.state !== NoteState.Hit && n.state !== NoteState.Missed)) continue;
      if (holdWeight(n.duration) <= 0 || t < n.time || t > n.time + n.duration - 0.08) continue;
      if (!found || (found.holding && !n.holding)) found = n;
    }
    return found;
  }

  // --------------------------------------------------------------- queries

  /** Index range of notes visible between t0 and t1 (accounts for long notes). */
  visibleRange(t0: number, t1: number): [number, number] {
    const start = lowerBound(this.notes, t0 - this.maxNoteDuration);
    const end = lowerBound(this.notes, t1);
    return [start, end];
  }
}

export const engine = new Engine();
