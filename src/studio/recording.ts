import { canImport } from "../auth/account";
import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { addUserMidi, openFreePlay } from "../state/actions";
import { setPanel, toast, useApp } from "../state/store";
import { soundProgram } from "../audio/instruments";
import { midiFileName, splitHands, writeMidi, type MidiTrackSpec } from "./midiFile";
import { Recorder } from "./recorder";
import { shareMidi } from "./share";
import { beginVoice, endVoice } from "./voiceTake";
import { clearVoice } from "./voicePlay";

let recorder: Recorder | null = null;
let ticker = 0;
let voiceT0 = 0;
const now = () => performance.now() / 1000;

/** Starts recording what the player plays (any input); with `freePlay` on an empty stage. Pro only. */
export function startRecording(freePlay: boolean): void {
  if (!canImport()) {
    setPanel("pro");
    return;
  }
  if (recorder) return;
  clearVoice();
  engine.releaseAll();
  if (freePlay) openFreePlay();
  else if (engine.status === "playing") engine.pause();
  const t0 = now();
  voiceT0 = t0;
  recorder = new Recorder(t0);
  const rec = recorder;
  const { settings } = useApp.getState();
  if (settings.recordVoice) beginVoice(settings.micDevice, settings.recordVoiceHear, settings.recordVoiceGain);
  engine.onInput = (e) => rec.input(e, now());
  useApp.setState({ recording: { startedAt: Date.now(), notes: 0, voice: settings.recordVoice }, panel: null, take: null });
  ticker = window.setInterval(() => {
    useApp.setState((s) => (s.recording ? { recording: { ...s.recording, notes: rec.noteCount } } : {}));
  }, 250);
}

/** Stops recording; a take with notes opens the "name your song" dialog. */
export function stopRecording(): void {
  const rec = recorder;
  if (!rec) return;
  recorder = null;
  window.clearInterval(ticker);
  engine.onInput = null;
  const notes = rec.finish(now());
  const lead = rec.lead;
  useApp.setState({ recording: null });
  void finishTake(notes, lead, voiceT0);
}

async function finishTake(notes: ReturnType<Recorder["finish"]>, lead: number, t0: number): Promise<void> {
  const voice = await endVoice();
  if (!notes.length) {
    toast(tNow("recordEmpty"), "info");
    return;
  }
  const { settings } = useApp.getState();
  const instrument = settings.instrument;
  const program = soundProgram(settings);
  const seconds = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
  const sung = voice ? { blob: voice.blob, lead: lead - (voice.startedAt - t0) } : null;
  if (settings.recordVoice && !sung) toast(tNow("recordVoiceDenied"), "info");
  useApp.setState({ take: { notes, instrument, program, seconds, voice: sung?.blob, voiceLead: sung?.lead } });
}

export function discardTake(): void {
  useApp.setState({ take: null });
}

export function takeTracks(take: NonNullable<ReturnType<typeof useApp.getState>["take"]>): MidiTrackSpec[] {
  if (take.instrument === "piano") return splitHands(take.notes, take.program);
  return [{ name: take.instrument === "guitar" ? "Guitar" : "Melody", program: take.program, notes: take.notes }];
}

/** Saves the take to the library (and opens it); optionally shares the file right away. */
export async function saveTake(title: string, share: boolean): Promise<void> {
  const take = useApp.getState().take;
  if (!take) return;
  const data = writeMidi({ title, bpm: 120, timeSignature: [4, 4], tracks: takeTracks(take) });
  useApp.setState({ take: null });
  await addUserMidi(title, data, take.voice ? { blob: take.voice, lead: take.voiceLead ?? 0 } : undefined);
  toast(tNow("recordSaved", { title }), "success");
  if (share) {
    try {
      await shareMidi(data, midiFileName(title), title);
    } catch {
      toast(tNow("exportFailed"), "error");
    }
  }
}
