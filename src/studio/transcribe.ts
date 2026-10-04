import { buildTranscription, modelParams, type DetectedNote, type TranscribeOptions, type Transcription } from "./transcribePost";

export const SAMPLE_RATE = 22050;
/** Longer files take minutes and a lot of memory on phones. */
export const MAX_SECONDS = 12 * 60;

export type TranscribeStage = "decode" | "model" | "analyze" | "notes";

export class TranscribeError extends Error {
  constructor(readonly kind: "decode" | "tooLong" | "silent" | "model") {
    super(kind);
  }
}

/** Decodes any audio the browser understands (mp3, wav, m4a, ogg, flac…) into mono 22.05 kHz samples. */
async function decodeMono(file: Blob): Promise<Float32Array> {
  const data = await file.arrayBuffer();
  let decoded: AudioBuffer;
  try {
    decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
  } catch {
    throw new TranscribeError("decode");
  }
  if (decoded.duration > MAX_SECONDS) throw new TranscribeError("tooLong");
  const length = Math.ceil(decoded.duration * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(1, length, SAMPLE_RATE);
  const src = ctx.createBufferSource();
  src.buffer = decoded;
  src.connect(ctx.destination);
  src.start();
  const out = (await ctx.startRendering()).getChannelData(0);
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak < 1e-3) throw new TranscribeError("silent");
  if (peak < 0.5) for (let i = 0; i < out.length; i++) out[i] /= peak * 1.25;
  return out;
}

type BasicPitchModule = typeof import("@spotify/basic-pitch");
type Tf = typeof import("@tensorflow/tfjs");
type GraphModel = import("@tensorflow/tfjs").GraphModel;
let model: { mod: BasicPitchModule; tf: Tf; graph: GraphModel } | null = null;

async function loadModel() {
  if (model) return model;
  const [mod, tf] = await Promise.all([import("@spotify/basic-pitch"), import("@tensorflow/tfjs")]);
  try {
    await tf.setBackend("webgl");
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  let graph: GraphModel;
  try {
    graph = await tf.loadGraphModel(`${import.meta.env.BASE_URL}models/basic-pitch/model.json`);
  } catch {
    throw new TranscribeError("model");
  }
  model = { mod, tf, graph };
  return model;
}

/** Basic Pitch windowing: 2 s windows (minus one hop) overlapping by 30 frames, half an overlap of silence in front. */
const FFT_HOP = 256;
const WINDOW = SAMPLE_RATE * 2 - FFT_HOP;
const OVERLAP_FRAMES = 30;
const WINDOW_HOP = WINDOW - OVERLAP_FRAMES * FFT_HOP;
const LEAD = (OVERLAP_FRAMES / 2) * FFT_HOP;

/**
 * Splits the audio into model windows on the CPU. The library does this with GPU concat/frame ops, which fail
 * to compile for some input lengths on WebGL.
 */
function frameAudio(audio: Float32Array): { data: Float32Array; count: number } {
  const total = audio.length + LEAD;
  const count = Math.max(1, Math.ceil(total / WINDOW_HOP));
  const data = new Float32Array(count * WINDOW);
  for (let i = 0; i < count; i++) {
    const start = i * WINDOW_HOP;
    const from = Math.max(0, start - LEAD);
    const to = Math.min(audio.length, start + WINDOW - LEAD);
    if (to > from) data.set(audio.subarray(from, to), i * WINDOW + from + LEAD - start);
  }
  return { data, count };
}

export interface ModelOutput {
  frames: number[][];
  onsets: number[][];
  contours: number[][];
}

/** Runs the network window by window, freeing GPU memory as it goes (the library version leaks every window). */
export async function analyzeAudio(samples: Float32Array, onProgress: (fraction: number) => void): Promise<ModelOutput> {
  const { tf, graph } = await loadModel();
  const { data, count } = frameAudio(samples);
  const wanted = Math.floor(samples.length * (Math.floor(SAMPLE_RATE / FFT_HOP) / SAMPLE_RATE));
  const out: ModelOutput = { frames: [], onsets: [], contours: [] };
  const trim = OVERLAP_FRAMES / 2;
  for (let i = 0; i < count && out.frames.length < wanted; i++) {
    onProgress(i / count);
    const results = tf.tidy(() => {
      const input = tf.tensor3d(data.subarray(i * WINDOW, (i + 1) * WINDOW), [1, WINDOW, 1]);
      const raw = graph.execute(input, ["Identity_1", "Identity_2", "Identity"]) as import("@tensorflow/tfjs").Tensor[];
      return raw.map((t) => {
        const kept = t.slice([0, trim, 0], [-1, t.shape[1]! - 2 * trim, -1]);
        return kept.reshape([kept.shape[1]!, kept.shape[2]!]);
      });
    });
    const [f, o, c] = (await Promise.all(results.map((t) => t.array()))) as number[][][];
    tf.dispose(results);
    const take = Math.min(f.length, wanted - out.frames.length);
    for (let k = 0; k < take; k++) {
      out.frames.push(f[k]);
      out.onsets.push(o[k]);
      out.contours.push(c[k]);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  onProgress(1);
  return out;
}

/** Audio file → playable tracks, with Spotify's Basic Pitch model running on the device. */
export async function transcribeFile(
  file: Blob,
  opts: TranscribeOptions,
  onProgress: (stage: TranscribeStage, fraction: number) => void
): Promise<Transcription> {
  onProgress("decode", 0);
  const samples = await decodeMono(file);
  onProgress("model", 0);
  const { mod } = await loadModel();
  onProgress("analyze", 0);
  const { frames, onsets, contours } = await analyzeAudio(samples, (p) => onProgress("analyze", p));
  onProgress("notes", 1);
  const p = modelParams(opts);
  const events = mod.outputToNotesPoly(
    frames,
    onsets,
    p.onsetThresh,
    p.frameThresh,
    p.minNoteLenFrames,
    p.inferOnsets,
    p.maxFreq,
    p.minFreq,
    p.melodiaTrick,
    11
  );
  const detected: DetectedNote[] = mod.noteFramesToTime(mod.addPitchBendsToNoteEvents(contours, events));
  return buildTranscription(detected, opts);
}
