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

function buildImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
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

export function getBus(): MasterBus {
  if (bus) return bus;
  // iOS treats Web Audio as "ambient" (silenced by the ring/silent switch) unless the page asks for playback.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  const ctx = new AudioContext({ latencyHint: "interactive" });

  const input = ctx.createGain();
  const dryInput = ctx.createGain();
  const master = ctx.createGain();
  master.gain.value = 0.9;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 3.5;
  compressor.attack.value = 0.006;
  compressor.release.value = 0.22;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;

  const reverb = ctx.createConvolver();
  reverb.buffer = buildImpulse(ctx, 2.2, 3.2);
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.18;
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.9;

  input.connect(compressor);
  input.connect(reverbSend);
  reverbSend.connect(reverb);
  reverb.connect(reverbReturn);
  reverbReturn.connect(compressor);
  dryInput.connect(compressor);
  compressor.connect(master);
  master.connect(limiter);
  limiter.connect(ctx.destination);

  bus = { ctx, input, dryInput, master, reverbSend };
  return bus;
}

export function audioCtx(): AudioContext {
  return getBus().ctx;
}

/** Must be called from a user gesture at least once (autoplay policy). */
export async function unlockAudio(): Promise<void> {
  const { ctx } = getBus();
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {
      /* resumed on next gesture */
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
