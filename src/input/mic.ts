import { audioCtx, setAudioSession, unlockAudio } from "../audio/context";
import { requirePro } from "../auth/account";
import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { reportError } from "../lib/errors";
import { updateSettings } from "../state/actions";
import { toast, useApp } from "../state/store";
import { KeyOnsets } from "./onsets";
import { NoteTracker, decimate, detectPitch, rmsOf } from "./pitch";

const KEY = "mic";
/** Detection trails the sound by about this much (analysis window, debounce and input latency). */
const DETECT_LAG_SEC = 0.05;
/** The targeted detection waits for a clear rise in a long window, so it trails a little more. */
const TARGET_LAG_SEC = 0.07;
const HOP_MS = 12;

let stream: MediaStream | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let spectrum: AnalyserNode | null = null;
let onsets: KeyOnsets | null = null;
/** Keys the targeted detection is holding down → their strength when struck. */
const struckKeys = new Map<number, number>();
let timer = 0;
let tracker: NoteTracker | null = null;
let unsub: (() => void) | null = null;
let level = 0;

export const micSupported = (): boolean => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** Recent input loudness (0–1) and the note being heard, for the on-screen meter. */
export function micState(): { level: number; midi: number | null } {
  return { level, midi: tracker?.current ?? null };
}

export interface MicDevice {
  id: string;
  label: string;
}

/** Microphones on this device; their names only show once microphone access has been given. */
export async function listMics(): Promise<MicDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")
      .map((d, i) => ({
        id: d.deviceId,
        // Windows appends the USB vendor:product id, e.g. "Mikrofon (Headset) (1532:057d)".
        label: d.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, "").trim() || tNow("micDeviceN", { n: i + 1 }),
      }));
  } catch {
    return [];
  }
}

function openStream(deviceId: string): Promise<MediaStream> {
  // No voice processing at all: echo cancellation puts phones into call mode, whose noise suppression and gain
  // treat a ringing piano note as noise. The backing track is told apart with engine.echoOf instead.
  const audio: MediaTrackConstraints & { voiceIsolation?: boolean } = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    voiceIsolation: false,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
  return navigator.mediaDevices.getUserMedia({ audio });
}

/** Pitch class → when it was last heard; the two detectors must not count one note twice. */
const recent = new Map<number, number>();
const SAME_NOTE_SEC = 0.3;

function heardLately(midi: number, now: number): boolean {
  return now - (recent.get(((midi % 12) + 12) % 12) ?? -Infinity) < SAME_NOTE_SEC;
}

function markHeard(midi: number, now: number): void {
  recent.set(((midi % 12) + 12) % 12, now);
}

export async function startMic(): Promise<boolean> {
  if (stream) return true;
  if (!micSupported()) return false;
  useApp.setState({ mic: "starting" });
  await unlockAudio();
  setAudioSession(true);
  const device = useApp.getState().settings.micDevice;
  try {
    try {
      stream = await openStream(device);
    } catch (err) {
      // A chosen microphone that's gone (unplugged headset) falls back to the default one.
      if (!device || (err as Error)?.name === "NotAllowedError") throw err;
      stream = await openStream("");
      updateSettings({ micDevice: "" });
      toast(tNow("micDeviceFailed"), "info");
    }
  } catch (err) {
    console.warn("[mic] access denied", err);
    reportError("error", `Microphone failed: ${(err as Error)?.name ?? "Error"}: ${(err as Error)?.message ?? err}`);
    setAudioSession(false);
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
  // A long window resolves neighbouring keys down in the bass, for the targeted detection.
  spectrum = ctx.createAnalyser();
  spectrum.fftSize = 8192;
  spectrum.smoothingTimeConstant = 0;
  source.connect(spectrum);
  const db = new Float32Array(spectrum.frequencyBinCount);
  onsets = new KeyOnsets(spectrum.frequencyBinCount, ctx.sampleRate / spectrum.fftSize);
  const raw = new Float32Array(analyser.fftSize);
  const half = ctx.sampleRate > 30000;
  const rate = half ? ctx.sampleRate / 2 : ctx.sampleRate;
  tracker = new NoteTracker(useApp.getState().settings.micSensitivity);
  unsub = useApp.subscribe((s, prev) => {
    if (tracker && s.settings.micSensitivity !== prev.settings.micSensitivity) tracker.sensitivity = s.settings.micSensitivity;
  });
  timer = window.setInterval(() => {
    if (!analyser || !spectrum || !tracker || !onsets) return;
    const now = performance.now() / 1000;
    analyser.getFloatTimeDomainData(raw);
    const buf = half ? decimate(raw) : raw;
    const rms = rmsOf(buf);
    level = Math.max(rms * 5, level * 0.85);
    const pitch = rms > 0.002 ? detectPitch(buf, rate) : null;
    for (const ev of tracker.update({ rms, pitch })) {
      if (ev.type === "off") engine.unhear(KEY);
      else if (heardLately(ev.midi, now) || engine.echoOf(ev.midi, DETECT_LAG_SEC)) continue;
      else {
        markHeard(ev.midi, now);
        engine.hear(KEY, ev.midi, ev.velocity, DETECT_LAG_SEC);
      }
    }
    spectrum.getFloatFrequencyData(db);
    onsets.pushDb(db);
    listenForTargets(rms, now);
  }, HOP_MS);
  useApp.setState({ mic: "on" });
  return true;
}

/** Targeted detection: an expected key whose harmonics just jumped counts as played, even under ringing notes. */
function listenForTargets(rms: number, now: number): void {
  if (!onsets || !tracker) return;
  for (const [midi, peak] of struckKeys) {
    if (rms < tracker.gateLevel || onsets.strength(midi) < peak * 0.25) {
      struckKeys.delete(midi);
      engine.unhear(`${KEY}:${midi}`);
    }
  }
  if (rms < tracker.gateLevel) return;
  for (const midi of engine.listenTargets(TARGET_LAG_SEC)) {
    if (struckKeys.has(midi) || heardLately(midi, now) || !onsets.struck(midi) || engine.echoOf(midi, TARGET_LAG_SEC)) continue;
    markHeard(midi, now);
    struckKeys.set(midi, onsets.strength(midi));
    engine.hear(`${KEY}:${midi}`, midi, Math.max(0.2, Math.min(1, rms * 6)), TARGET_LAG_SEC);
  }
}

export function stopMic(): void {
  window.clearInterval(timer);
  timer = 0;
  tracker?.reset();
  tracker = null;
  engine.unhear(KEY);
  for (const midi of struckKeys.keys()) engine.unhear(`${KEY}:${midi}`);
  struckKeys.clear();
  recent.clear();
  onsets = null;
  spectrum = null;
  unsub?.();
  unsub = null;
  source?.disconnect();
  source = null;
  analyser = null;
  if (stream) setAudioSession(false);
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  level = 0;
  if (useApp.getState().mic !== "denied") useApp.setState({ mic: "off" });
}

/** Switches to another microphone, re-opening it right away if listening. */
export async function setMicDevice(id: string): Promise<void> {
  updateSettings({ micDevice: id });
  if (!stream) return;
  stopMic();
  await startMic();
}

export async function toggleMic(): Promise<void> {
  if (stream) stopMic();
  else if (requirePro() && (await startMic())) toast(tNow("micOn"), "info", 6000);
}
