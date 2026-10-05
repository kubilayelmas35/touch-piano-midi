import { reportError } from "../lib/errors";
import { isNativeApp, SITE_URL } from "../lib/platform";
import { getBus } from "./context";
import { INSTRUMENTS, sampleUrl, type InstrumentDef, type InstrumentId } from "./instruments";

export interface PlayOptions {
  /** AudioContext time to start; defaults to now. */
  when?: number;
  /** If set, the note is released automatically after this many seconds. */
  duration?: number;
  /** Release seconds used when the note stops. */
  release?: number;
  /** Output gain multiplier (e.g. accompaniment volume). */
  volume?: number;
  /** Start this many seconds into the sample, past its attack (continuing a note at a new pitch). */
  offset?: number;
}

export interface Voice {
  readonly id: number;
  readonly midi: number;
  readonly instrument: InstrumentId;
  stop(release?: number, when?: number): void;
  /** Pitch bend in cents relative to the note (vibrato / slides). */
  bend(cents: number): void;
  /** Scales the note's loudness (0–1 of its attack level): bow pressure, string energy. */
  setLevel(level: number, smoothing?: number): void;
  readonly done: boolean;
}

interface Sample {
  buffer: AudioBuffer;
  /** Seconds where the loop restarts (it runs to the end of the buffer); null plays once. */
  loopStart: number | null;
  /** Variant for notes held by the player (no fixed duration). */
  held?: Sample;
}

interface LoadedInstrument {
  def: InstrumentDef;
  buffers: Map<number, Sample>;
}

const loaded = new Map<InstrumentId, LoadedInstrument>();
const loading = new Map<InstrumentId, Promise<LoadedInstrument>>();
const active = new Set<VoiceImpl>();
const MAX_VOICES = 72;
let nextId = 1;

function makeLoopBuffer(ctx: BaseAudioContext, src: AudioBuffer, def: InstrumentDef): AudioBuffer {
  const loop = def.loop;
  if (!loop) return src;
  const rate = src.sampleRate;
  const end = Math.min(src.length - 1, Math.floor(loop.end * rate));
  const start = Math.floor(loop.start * rate);
  const xf = Math.min(Math.floor(loop.crossfade * rate), start, end - start - 1);
  if (xf <= 0 || end <= start) return src;
  const out = ctx.createBuffer(src.numberOfChannels, end, rate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const a = src.getChannelData(ch);
    const b = out.getChannelData(ch);
    b.set(a.subarray(0, end));
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      const gIn = Math.sin((t * Math.PI) / 2);
      const gOut = Math.cos((t * Math.PI) / 2);
      b[end - xf + i] = a[end - xf + i] * gOut + a[start - xf + i] * gIn;
    }
  }
  return out;
}

/** Loudness of a sample in 20 ms windows. */
function envelope(src: AudioBuffer) {
  const rate = src.sampleRate;
  const win = Math.max(1, Math.floor(rate * 0.02));
  const nWin = Math.floor(src.length / win);
  const env = new Float32Array(nWin);
  const first = src.getChannelData(0);
  for (let w = 0; w < nWin; w++) {
    let s = 0;
    for (let i = w * win; i < (w + 1) * win; i++) s += first[i] * first[i];
    env[w] = Math.sqrt(s / win);
  }
  const smooth = (w: number) => {
    const a = env[Math.max(0, w - 1)];
    const b = env[Math.min(nWin - 1, w + 1)];
    return Math.max(1e-6, (a + 2 * env[w] + b) / 4);
  };
  let peak = 0;
  for (let w = 1; w < Math.min(nWin, 8); w++) if (env[w] > env[peak]) peak = w;
  return { win, nWin, smooth, peak };
}

/**
 * Turns a decaying pluck into one that can sustain: the slice right after the attack (until it has dropped to
 * about a third) is levelled to a constant loudness and crossfade-looped.
 */
function makePluckLoop(ctx: BaseAudioContext, src: AudioBuffer): Sample {
  const { win, nWin, smooth, peak } = envelope(src);
  const startW = Math.min(nWin - 20, Math.max(peak + 3, 5));
  const startLevel = smooth(startW);
  let endW = startW + 12;
  while (endW < nWin - 2 && endW - startW < 60 && smooth(endW) > startLevel * 0.32) endW++;
  if (startW < 2 || endW >= nWin) return { buffer: src, loopStart: null };
  return levelledLoop(ctx, src, win, nWin, smooth, startW, endW);
}

/**
 * A held piano key: the note decays naturally until it is `dropDb` quieter than its attack, from there a slowly
 * changing gain holds it up so it only fades by `slopeDb` a second. No loop, so the tone never pulses.
 */
function makeHoldSample(ctx: BaseAudioContext, src: AudioBuffer, hold: NonNullable<InstrumentDef["holdSustain"]>): Sample {
  const { win, nWin, smooth, peak } = envelope(src);
  const rate = src.sampleRate;
  if (nWin < 40) return { buffer: src, loopStart: null };
  // Loudness averaged over 0.6 s, so the gain follows the decay but not the beating of the strings.
  const span = 15;
  const sums = new Float64Array(nWin + 1);
  for (let w = 0; w < nWin; w++) sums[w + 1] = sums[w] + smooth(w) ** 2;
  const level = (w: number) => {
    const a = Math.max(0, w - span);
    const b = Math.min(nWin, w + span + 1);
    return Math.max(1e-6, Math.sqrt((sums[b] - sums[a]) / (b - a)));
  };
  let top = 0;
  for (let w = 0; w < Math.min(nWin, 20); w++) top = Math.max(top, level(w));
  const floor = top * Math.pow(10, -hold.dropDb / 20);
  let from = peak;
  while (from < nWin && level(from) > floor) from++;
  const maxBoost = Math.pow(10, hold.maxBoostDb / 20);
  const fadeW = Math.round(0.4 / (win / rate));
  const gain = new Float32Array(nWin);
  for (let w = 0; w < nWin; w++) {
    let g = 1;
    if (w > from) {
      const want = floor * Math.pow(10, (-hold.slopeDb * (w - from) * win) / rate / 20);
      g = Math.max(1, Math.min(maxBoost, want / level(w)));
    }
    if (w > nWin - fadeW) g *= Math.max(0, (nWin - w) / fadeW);
    gain[w] = g;
  }
  const out = ctx.createBuffer(src.numberOfChannels, nWin * win, rate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const a = src.getChannelData(ch);
    const b = out.getChannelData(ch);
    for (let i = 0; i < b.length; i++) {
      const fw = i / win - 0.5;
      const w0 = Math.max(0, Math.floor(fw));
      const k = Math.min(1, Math.max(0, fw - w0));
      b[i] = a[i] * (gain[w0] * (1 - k) + gain[Math.min(nWin - 1, w0 + 1)] * k);
    }
  }
  return { buffer: out, loopStart: null };
}

function levelledLoop(
  ctx: BaseAudioContext,
  src: AudioBuffer,
  win: number,
  nWin: number,
  smooth: (w: number) => number,
  startW: number,
  endW: number
): Sample {
  const rate = src.sampleRate;
  const start = startW * win;
  const end = endW * win;
  const xf = Math.min(Math.floor(rate * 0.08), Math.floor((end - start) / 3));
  const p0 = start - xf;
  const ref = smooth(Math.floor(p0 / win));
  const out = ctx.createBuffer(src.numberOfChannels, end, rate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const a = src.getChannelData(ch);
    const b = out.getChannelData(ch);
    b.set(a.subarray(0, end));
    for (let i = p0; i < end; i++) {
      const fw = i / win - 0.5;
      const w0 = Math.max(0, Math.floor(fw));
      const k = Math.min(1, Math.max(0, fw - w0));
      const e = smooth(w0) * (1 - k) + smooth(Math.min(nWin - 1, w0 + 1)) * k;
      b[i] *= Math.min(40, ref / e);
    }
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      b[end - xf + i] = b[end - xf + i] * Math.cos((t * Math.PI) / 2) + b[start - xf + i] * Math.sin((t * Math.PI) / 2);
    }
  }
  return { buffer: out, loopStart: start / rate };
}

function prepare(ctx: BaseAudioContext, decoded: AudioBuffer, def: InstrumentDef): Sample {
  if (def.sustained && def.loop) return { buffer: makeLoopBuffer(ctx, decoded, def), loopStart: Math.max(0, def.loop.start) };
  if (def.pluckSustain) return makePluckLoop(ctx, decoded);
  if (def.holdSustain) return { buffer: decoded, loopStart: null, held: makeHoldSample(ctx, decoded, def.holdSustain) };
  return { buffer: decoded, loopStart: null };
}

export function isLoaded(id: InstrumentId): boolean {
  return loaded.has(id);
}

async function fetchSample(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  // Capacitor's iOS file handler answers media files without an HTTP status, so a packaged sample arrives as status 0.
  if (!res.ok && res.status !== 0) throw new Error(`HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) throw new Error(`HTTP ${res.status}, empty body`);
  return bytes;
}

let offline: OfflineAudioContext | null = null;

function decodeWith(ctx: BaseAudioContext, data: ArrayBuffer, timeoutMs: number): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`decode timed out (${ctx.constructor.name})`)), timeoutMs);
    const ok = (b: AudioBuffer) => {
      clearTimeout(timer);
      resolve(b);
    };
    const fail = (e: unknown) => {
      clearTimeout(timer);
      reject(e instanceof Error ? e : new Error(`decode failed (${ctx.constructor.name})`));
    };
    // Callback form as well: older WebKit only calls these, and a rejection would otherwise go unseen.
    const p = ctx.decodeAudioData(data, ok, fail) as Promise<AudioBuffer> | undefined;
    p?.then(ok, fail);
  });
}

/** Decodes on the live context; if that fails or stalls (WebKit before the first touch), on an offline one. */
async function decodeSample(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  try {
    return await decodeWith(ctx, bytes.slice(0), 8000);
  } catch (err) {
    offline ??= new OfflineAudioContext(2, 1, ctx.sampleRate);
    try {
      return await decodeWith(offline, bytes, 8000);
    } catch {
      throw err;
    }
  }
}

export function loadInstrument(
  id: InstrumentId,
  onProgress?: (done: number, total: number) => void
): Promise<LoadedInstrument> {
  const ready = loaded.get(id);
  if (ready) return Promise.resolve(ready);
  const pending = loading.get(id);
  if (pending) return pending;

  const def = INSTRUMENTS[id];
  let done = 0;
  const promise = (async () => {
    const { ctx } = getBus();
    const buffers = new Map<number, Sample>();
    const queue = [...def.notes];
    let firstError = "";
    let failed = 0;
    const worker = async () => {
      while (queue.length) {
        const midi = queue.shift()!;
        try {
          const url = sampleUrl(id, midi);
          let bytes: ArrayBuffer;
          try {
            bytes = await fetchSample(url);
          } catch (err) {
            if (!isNativeApp) throw err;
            bytes = await fetchSample(SITE_URL + url.replace(/^\.?\//, ""));
          }
          const decoded = await decodeSample(ctx, bytes);
          buffers.set(midi, prepare(ctx, decoded, def));
        } catch (err) {
          failed++;
          firstError ||= err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          console.warn(`[sampler] ${id} ${midi} failed`, err);
        }
        done++;
        onProgress?.(done, def.notes.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (failed) {
      reportError("error", `Sampler ${id}: ${failed}/${def.notes.length} failed (${firstError}); context ${ctx.state} ${ctx.sampleRate} Hz`);
    }
    if (!buffers.size) throw new Error(`No samples loaded for ${id}: ${firstError}`);
    const inst = { def, buffers };
    loaded.set(id, inst);
    loading.delete(id);
    return inst;
  })();
  promise.catch(() => loading.delete(id));
  loading.set(id, promise);
  return promise;
}

function nearestSample(inst: LoadedInstrument, midi: number): [number, Sample] {
  let best = -1;
  let bestDist = Infinity;
  for (const m of inst.buffers.keys()) {
    const d = Math.abs(m - midi);
    if (d < bestDist || (d === bestDist && m > best)) {
      best = m;
      bestDist = d;
    }
  }
  return [best, inst.buffers.get(best)!];
}

function velocityGain(v: number): number {
  const x = Math.max(0.05, Math.min(1, v));
  return 0.12 + 0.88 * Math.pow(x, 1.5);
}

class VoiceImpl implements Voice {
  readonly id = nextId++;
  done = false;
  private releaseEnd = Infinity;
  private readonly baseDetune: number;
  private readonly startedAt: number;
  private readonly level: GainNode;

  constructor(
    readonly midi: number,
    readonly instrument: InstrumentId,
    private readonly source: AudioBufferSourceNode,
    private readonly env: GainNode,
    private readonly nodes: AudioNode[],
    private readonly def: InstrumentDef,
    baseDetune: number,
    when: number,
    level: GainNode
  ) {
    this.baseDetune = baseDetune;
    this.startedAt = when;
    this.level = level;
    source.onended = () => this.cleanup();
  }

  setLevel(level: number, smoothing = 0.05): void {
    if (this.done) return;
    const ctx = this.env.context as AudioContext;
    this.level.gain.setTargetAtTime(Math.max(0, Math.min(1.2, level)), ctx.currentTime, smoothing);
  }

  stop(release?: number, when?: number): void {
    if (this.done) return;
    const ctx = this.env.context as AudioContext;
    const t = Math.max(when ?? ctx.currentTime, this.startedAt + 0.005);
    const rel = Math.max(this.def.minRelease, Math.min(this.def.maxRing, release ?? this.def.minRelease));
    // A later stop may only shorten the fade (re-striking a ringing key), never stretch it.
    if (t + rel >= this.releaseEnd) return;
    this.releaseEnd = t + rel;
    const g = this.env.gain;
    if (typeof g.cancelAndHoldAtTime === "function") {
      g.cancelAndHoldAtTime(t);
    } else {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
    }
    g.setTargetAtTime(0, t, rel / 4.5);
    try {
      this.source.stop(t + rel + 0.05);
    } catch {
      /* already stopped */
    }
  }

  bend(cents: number): void {
    if (this.done) return;
    const ctx = this.env.context as AudioContext;
    this.source.detune.setTargetAtTime(this.baseDetune + cents, ctx.currentTime, 0.012);
  }

  kill(): void {
    if (this.done) return;
    const ctx = this.env.context as AudioContext;
    const t = ctx.currentTime;
    this.env.gain.cancelScheduledValues(t);
    this.env.gain.setTargetAtTime(0, t, 0.008);
    try {
      this.source.stop(t + 0.04);
    } catch {
      /* */
    }
  }

  private cleanup(): void {
    if (this.done) return;
    this.done = true;
    active.delete(this);
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* */
      }
    }
  }
}

export function playNote(id: InstrumentId, midi: number, velocity: number, opts: PlayOptions = {}): Voice | null {
  const inst = loaded.get(id);
  if (!inst) return null;
  const { ctx, input } = getBus();
  const def = inst.def;
  const when = Math.max(ctx.currentTime, opts.when ?? ctx.currentTime);
  const [sampleMidi, base] = nearestSample(inst, midi);
  const sample = opts.duration == null && base.held ? base.held : base;
  const buffer = sample.buffer;

  if (active.size >= MAX_VOICES) {
    let oldest: VoiceImpl | null = null;
    for (const v of active) {
      oldest = v;
      break;
    }
    oldest?.kill();
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const detune = (midi - sampleMidi) * 100;
  source.detune.value = detune;
  if (sample.loopStart !== null) {
    source.loop = true;
    source.loopStart = sample.loopStart;
    source.loopEnd = buffer.duration;
  }

  const env = ctx.createGain();
  const peak = velocityGain(velocity) * def.gain * (opts.volume ?? 1);
  const offset = Math.max(0, Math.min(buffer.duration - 0.05, opts.offset ?? 0));
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(peak, when + (offset ? Math.max(def.attack, 0.04) : def.attack));
  // Scheduled plucks have nobody keeping the string alive, so they fade like a real string.
  if (def.pluckSustain && sample.loopStart !== null && opts.duration != null) {
    env.gain.setTargetAtTime(0, when + def.attack + sample.loopStart, def.pluckSustain.decay);
  }
  // Held piano keys: the sample itself barely fades, the sustain setting decides how fast they do.
  if (def.holdSustain && sample === base.held && holdFadeDb > 0) {
    env.gain.setTargetAtTime(0, when + def.attack, (20 / Math.LN10) / holdFadeDb);
  }
  const level = ctx.createGain();
  const nodes: AudioNode[] = [source, env, level];
  let tail: AudioNode = level;
  source.connect(env);
  env.connect(level);

  if (def.velocityTone) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200 + Math.pow(Math.max(0.05, velocity), 1.2) * 16000;
    filter.Q.value = 0.4;
    tail.connect(filter);
    tail = filter;
    nodes.push(filter);
  }

  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-0.45, Math.min(0.45, ((midi - 64) / 44) * 0.45));
  tail.connect(pan);
  pan.connect(input);
  nodes.push(pan);

  source.start(when, offset);
  const voice = new VoiceImpl(midi, id, source, env, nodes, def, detune, when, level);
  active.add(voice);
  if (opts.duration != null) {
    voice.stop(opts.release ?? def.minRelease, when + Math.max(0.03, opts.duration));
  }
  return voice;
}

export function stopAllVoices(): void {
  for (const v of [...active]) v.kill();
}

/** Fade of a held piano key in dB a second; set from the sustain setting. */
let holdFadeDb = sustainFadeDb(0.7);

/** 0 short … 1 long → how fast a held piano key fades (dB a second; 0 = it never fades). */
export function sustainFadeDb(sustain: number): number {
  return 3 * (1 - Math.max(0, Math.min(1, sustain))) ** 2;
}

export function setPianoSustain(sustain: number): void {
  holdFadeDb = sustainFadeDb(sustain);
}

export function activeVoiceCount(): number {
  return active.size;
}

export const __test = { makeHoldSample };
