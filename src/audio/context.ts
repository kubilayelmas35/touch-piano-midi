import { reportError } from "../lib/errors";

/** Shared AudioContext with a master bus: voices → dry/reverb → compressor → limiter → destination. */

export interface MasterBus {
  ctx: AudioContext;
  /** Instrument voices connect here. */
  input: GainNode;
  /** Separate input for clicks / UI sounds that should skip the reverb. */
  dryInput: GainNode;
  master: GainNode;
  reverbSend: GainNode;
}

let bus: MasterBus | null = null;

function buildImpulse(ctx: AudioContext, seconds: number, decay: number, rate = ctx.sampleRate): AudioBuffer {
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const early = i < rate * 0.012 ? 0 : 1;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early;
    }
  }
  return buf;
}

/** Peaks of up to 0.98 in the curve's input range (±2). */
export function softClipCurve(size = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const knee = 0.7;
  const room = 0.98 - knee;
  for (let i = 0; i < size; i++) {
    const u = ((i / (size - 1)) * 2 - 1) * 2;
    const a = Math.abs(u);
    curve[i] = Math.sign(u) * (a <= knee ? a : knee + room * Math.tanh((a - knee) / room));
  }
  return curve;
}

/**
 * Last stage before the speakers: untouched below 0.7, rounded off above, never past 0.98. Whatever the limiter
 * lets through would otherwise be cut flat by the device, which is the harsh crackle.
 */
function softClipper(ctx: AudioContext): { input: AudioNode; output: AudioNode } {
  const pre = ctx.createGain();
  pre.gain.value = 0.5;
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve();
  shaper.oversample = "4x";
  pre.connect(shaper);
  return { input: pre, output: shaper };
}

/**
 * iOS treats Web Audio as "ambient" (silenced by the ring/silent switch) unless the page asks for playback,
 * but a "playback" session refuses the microphone outright, without even asking for permission.
 */
export function setAudioSession(recording: boolean): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = recording ? "play-and-record" : "playback";
}

export function getBus(): MasterBus {
  if (bus) return bus;
  setAudioSession(false);
  const ctx = new AudioContext({ latencyHint: "interactive" });

  const input = ctx.createGain();
  const dryInput = ctx.createGain();
  const master = ctx.createGain();
  master.gain.value = 0.9;

  // Rumble below hearing only eats headroom and makes small speakers rattle.
  const rumble = ctx.createBiquadFilter();
  rumble.type = "highpass";
  rumble.frequency.value = 28;
  rumble.Q.value = 0.6;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.25;

  // A fast release makes the limiter ride the waveform itself, which is heard as crackle on loud chords.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.25;

  const ceiling = softClipper(ctx);

  const reverb = ctx.createConvolver();
  // iOS can report one sample rate and then reject a buffer made at it ("does not match the context rate"), after
  // the audio hardware switched between 44.1 and 48 kHz. Try the other rate, then go without reverb.
  for (const rate of new Set([ctx.sampleRate, 48000, 44100])) {
    try {
      reverb.buffer = buildImpulse(ctx, 2.2, 3.2, rate);
      break;
    } catch (err) {
      console.warn(`[audio] reverb at ${rate} Hz rejected`, err);
    }
  }
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.18;
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.9;

  input.connect(rumble);
  input.connect(reverbSend);
  reverbSend.connect(reverb);
  reverb.connect(reverbReturn);
  reverbReturn.connect(rumble);
  dryInput.connect(rumble);
  rumble.connect(compressor);
  compressor.connect(master);
  master.connect(limiter);
  limiter.connect(ceiling.input);
  ceiling.output.connect(ctx.destination);

  bus = { ctx, input, dryInput, master, reverbSend };
  return bus;
}

export function audioCtx(): AudioContext {
  return getBus().ctx;
}

let stuckReported = false;

/** Must be called from a user gesture at least once (autoplay policy). */
export async function unlockAudio(): Promise<void> {
  const { ctx } = getBus();
  if (ctx.state !== "running") {
    // WebKit only counts the context as started by a gesture once something plays inside that gesture.
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blip.connect(ctx.destination);
    blip.start();
    try {
      await ctx.resume();
    } catch {
      /* resumed on next gesture */
    }
    const state = ctx.state as AudioContextState;
    if (state !== "running" && !stuckReported) {
      stuckReported = true;
      reportError("error", `Audio context stays ${state} after a gesture (${ctx.sampleRate} Hz)`);
    }
  }
}

export function setMasterVolume(v: number): void {
  const { master, ctx } = getBus();
  master.gain.setTargetAtTime(Math.max(0, Math.min(1.5, v)), ctx.currentTime, 0.02);
}

export function setReverbAmount(v: number): void {
  const { reverbSend, ctx } = getBus();
  reverbSend.gain.setTargetAtTime(Math.max(0, Math.min(0.6, v)), ctx.currentTime, 0.05);
}
