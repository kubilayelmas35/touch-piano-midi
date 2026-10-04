import { audioCtx, unlockAudio } from "../audio/context";
import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { toast, useApp } from "../state/store";
import { NoteTracker, decimate, detectPitch, rmsOf } from "./pitch";

const KEY = "mic";
/** Detection trails the sound by about this much (analysis window, debounce and input latency). */
const DETECT_LAG_SEC = 0.05;
const HOP_MS = 12;

let stream: MediaStream | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let timer = 0;
let tracker: NoteTracker | null = null;
let unsub: (() => void) | null = null;
let level = 0;

export const micSupported = (): boolean => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** Recent input loudness (0–1) and the note being heard, for the on-screen meter. */
export function micState(): { level: number; midi: number | null } {
  return { level, midi: tracker?.current ?? null };
}

export async function startMic(): Promise<boolean> {
  if (stream) return true;
  if (!micSupported()) return false;
  useApp.setState({ mic: "starting" });
  await unlockAudio();
  try {
    // The app's own backing track is echo-cancelled away; the instrument's tone is left untouched otherwise.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    console.warn("[mic] access denied", err);
    useApp.setState({ mic: "denied" });
    toast(tNow("micDenied"), "error");
    return false;
  }
  const ctx = audioCtx();
  source = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  const raw = new Float32Array(analyser.fftSize);
  const half = ctx.sampleRate > 30000;
  const rate = half ? ctx.sampleRate / 2 : ctx.sampleRate;
  tracker = new NoteTracker(useApp.getState().settings.micSensitivity);
  unsub = useApp.subscribe((s, prev) => {
    if (tracker && s.settings.micSensitivity !== prev.settings.micSensitivity) tracker.sensitivity = s.settings.micSensitivity;
  });
  timer = window.setInterval(() => {
    if (!analyser || !tracker) return;
    analyser.getFloatTimeDomainData(raw);
    const buf = half ? decimate(raw) : raw;
    const rms = rmsOf(buf);
    level = Math.max(rms * 5, level * 0.85);
    const pitch = rms > 0.002 ? detectPitch(buf, rate) : null;
    for (const ev of tracker.update({ rms, pitch })) {
      if (ev.type === "on") engine.hear(KEY, ev.midi, ev.velocity, DETECT_LAG_SEC);
      else engine.unhear(KEY);
    }
  }, HOP_MS);
  useApp.setState({ mic: "on" });
  return true;
}

export function stopMic(): void {
  window.clearInterval(timer);
  timer = 0;
  tracker?.reset();
  tracker = null;
  engine.unhear(KEY);
  unsub?.();
  unsub = null;
  source?.disconnect();
  source = null;
  analyser = null;
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  level = 0;
  if (useApp.getState().mic !== "denied") useApp.setState({ mic: "off" });
}

export async function toggleMic(): Promise<void> {
  if (stream) stopMic();
  else if (await startMic()) toast(tNow("micOn"), "info", 6000);
}
