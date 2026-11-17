import { getBus } from "../audio/context";
import { engine } from "../engine/engine";
import { useApp } from "../state/store";

let buffer: AudioBuffer | null = null;
let lead = 0;
let node: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let anchorCtx = 0;
let anchorSong = 0;
let rate = 1;

function stopNode(): void {
  if (!node) return;
  try {
    node.stop();
  } catch {
    /* already stopped */
  }
  node.disconnect();
  node = null;
}

export function clearVoice(): void {
  stopNode();
  buffer = null;
  lead = 0;
}

/** `lead` is the buffer position that lines up with song time 0. Negative means the voice starts after the first note. */
export async function loadVoice(blob: Blob, voiceLead: number): Promise<void> {
  clearVoice();
  try {
    const ctx = getBus().ctx;
    buffer = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    lead = voiceLead;
    syncVoice();
  } catch (err) {
    console.warn("[voice] could not play the recording", err);
    buffer = null;
  }
}

export function setVoiceGain(v: number): void {
  if (gain) gain.gain.value = Math.max(0, Math.min(1, v));
}

/** Keeps the sung track on the song clock. Call whenever the engine moves. */
export function syncVoice(): void {
  if (!buffer) return;
  const playing = engine.status === "playing";
  const speed = engine.config.speed || 1;
  const t = engine.time;
  const pos = t + lead;
  if (!playing || pos >= buffer.duration - 0.05) {
    stopNode();
    return;
  }
  if (node) {
    const predicted = anchorSong + (getBus().ctx.currentTime - anchorCtx) * rate;
    if (Math.abs(predicted - t) < 0.12 && Math.abs(rate - speed) < 0.02) return;
    stopNode();
  }
  const ctx = getBus().ctx;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = speed;
  if (!gain) {
    gain = ctx.createGain();
    gain.connect(getBus().dryInput);
  }
  gain.gain.value = useApp.getState().settings.recordVoiceGain;
  src.connect(gain);
  const delay = pos < 0 ? -pos / speed : 0;
  src.start(ctx.currentTime + delay, Math.max(0, pos));
  node = src;
  anchorCtx = ctx.currentTime;
  anchorSong = t;
  rate = speed;
  src.onended = () => {
    if (node === src) node = null;
  };
}
