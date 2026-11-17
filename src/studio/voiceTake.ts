import { getBus } from "../audio/context";

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

/** Records the microphone from the moment `start` resolves. */
export class VoiceCapture {
  /** Wall-clock seconds when the recorder actually began. 0 if it never started. */
  startedAt = 0;
  private generation = 0;
  private chunks: Blob[] = [];
  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private gain: GainNode | null = null;

  async start(deviceId: string, hear: boolean, gain: number): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
    const gen = ++this.generation;
    try {
      const audio: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      };
      if (deviceId) audio.deviceId = { exact: deviceId };
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      if (gen !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      this.stream = stream;
      const mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size) this.chunks.push(e.data);
      };
      rec.onstart = () => {
        this.startedAt = performance.now() / 1000;
      };
      rec.start(250);
      this.rec = rec;
      if (!this.startedAt) this.startedAt = performance.now() / 1000;
      if (hear) this.monitor(gain);
      return true;
    } catch (err) {
      console.warn("[voice] microphone unavailable", err);
      this.close();
      return false;
    }
  }

  private monitor(gain: number): void {
    if (!this.stream) return;
    const { ctx, dryInput } = getBus();
    const src = ctx.createMediaStreamSource(this.stream);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(dryInput);
    this.src = src;
    this.gain = g;
  }

  setGain(v: number): void {
    if (this.gain) this.gain.gain.value = v;
  }

  async stop(): Promise<Blob | null> {
    this.generation++;
    const rec = this.rec;
    this.rec = null;
    if (!rec || rec.state === "inactive") {
      this.close();
      return null;
    }
    const blob = await new Promise<Blob | null>((resolve) => {
      rec.onstop = () => {
        const b = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
        this.chunks = [];
        resolve(b.size > 800 ? b : null);
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
    this.close();
    return blob;
  }

  private close(): void {
    this.src?.disconnect();
    this.gain?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.src = null;
    this.gain = null;
    this.stream = null;
  }
}

let live: VoiceCapture | null = null;

export function beginVoice(deviceId: string, hear: boolean, gain: number): VoiceCapture {
  void live?.stop();
  live = new VoiceCapture();
  void live.start(deviceId, hear, gain);
  return live;
}

export function setVoiceMonitor(gain: number): void {
  live?.setGain(gain);
}

export async function endVoice(): Promise<{ blob: Blob; startedAt: number } | null> {
  const cap = live;
  live = null;
  if (!cap) return null;
  const blob = await cap.stop();
  if (!blob || !cap.startedAt) return null;
  return { blob, startedAt: cap.startedAt };
}
