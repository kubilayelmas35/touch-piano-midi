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
let model: { mod: BasicPitchModule; bp: InstanceType<BasicPitchModule["BasicPitch"]> } | null = null;

async function loadModel() {
  if (model) return model;
  const [mod, tf] = await Promise.all([import("@spotify/basic-pitch"), import("@tensorflow/tfjs")]);
  try {
    await tf.setBackend("webgl");
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  const bp = new mod.BasicPitch(`${import.meta.env.BASE_URL}models/basic-pitch/model.json`);
  try {
    await bp.model;
  } catch {
    throw new TranscribeError("model");
  }
  model = { mod, bp };
  return model;
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
  const { mod, bp } = await loadModel();
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  onProgress("analyze", 0);
  await bp.evaluateModel(
    samples,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p) => onProgress("analyze", p)
  );
  onProgress("notes", 1);
  const p = modelParams(opts);
  const events = mod.outputToNotesPoly(
    frames,
    onsets,
    p.onsetThresh,
    p.frameThresh,
    p.minNoteLenFrames,
    true,
    p.maxFreq,
    p.minFreq,
    true,
    11
  );
  const detected: DetectedNote[] = mod.noteFramesToTime(mod.addPitchBendsToNoteEvents(contours, events));
  return buildTranscription(detected, opts);
}
