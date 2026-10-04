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

/**
 * Turns a decaying pluck into one that can sustain: the slice right after the attack (until it has dropped to
 * about a third) is levelled to a constant loudness and crossfade-looped.
 */
function makePluckLoop(ctx: BaseAudioContext, src: AudioBuffer): Sample {
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
  const startW = Math.min(nWin - 20, Math.max(peak + 3, 5));
  const startLevel = smooth(startW);
  let endW = startW + 12;
  while (endW < nWin - 2 && endW - startW < 60 && smooth(endW) > startLevel * 0.32) endW++;
  if (startW < 2 || endW >= nWin) return { buffer: src, loopStart: null };

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
  return { buffer: decoded, loopStart: null };
}

export function isLoaded(id: InstrumentId): boolean {
  return loaded.has(id);
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
  const { ctx } = getBus();
  let done = 0;
  const promise = (async () => {
    const buffers = new Map<number, Sample>();
    const queue = [...def.notes];
    const worker = async () => {
      while (queue.length) {
        const midi = queue.shift()!;
        try {
          const res = await fetch(sampleUrl(id, midi));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
          buffers.set(midi, prepare(ctx, decoded, def));
        } catch (err) {
          console.warn(`[sampler] ${id} ${midi} failed`, err);
        }
        done++;
        onProgress?.(done, def.notes.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (!buffers.size) throw new Error(`No samples loaded for ${id}`);
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
  const [sampleMidi, sample] = nearestSample(inst, midi);
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

export function activeVoiceCount(): number {
  return active.size;
}
