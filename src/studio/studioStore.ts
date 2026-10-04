import { create } from "zustand";
import { canImport } from "../auth/account";
import { addUserMidi } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import { writeMidi } from "./midiFile";
import { DEFAULT_TRANSCRIBE, titleFromFileName, type TranscribeOptions, type Transcription } from "./transcribePost";
import type { TranscribeStage } from "./transcribe";

export type StudioTab = "record" | "audio" | "notes";
export type AudioError = "decode" | "tooLong" | "silent" | "model" | "other" | "noNotes";

interface StudioState {
  tab: StudioTab;
  file: File | null;
  title: string;
  opts: TranscribeOptions;
  stage: TranscribeStage | null;
  progress: number;
  result: Transcription | null;
  error: AudioError | null;
  notes: { title: string; bpm: number; timeSignature: [number, number]; right: string; left: string };
}

export const useStudio = create<StudioState>(() => ({
  tab: "record",
  file: null,
  title: "",
  opts: { ...DEFAULT_TRANSCRIBE },
  stage: null,
  progress: 0,
  result: null,
  error: null,
  notes: { title: "", bpm: 100, timeSignature: [4, 4], right: "", left: "" },
}));

let run = 0;

export function chooseAudio(file: File): void {
  run++;
  const instrument = useApp.getState().settings.instrument;
  useStudio.setState((s) => ({
    tab: "audio",
    file,
    title: titleFromFileName(file.name),
    opts: { ...s.opts, instrument },
    stage: null,
    progress: 0,
    result: null,
    error: null,
  }));
}

export function resetAudio(): void {
  run++;
  useStudio.setState({ file: null, title: "", stage: null, progress: 0, result: null, error: null });
}

export async function convertAudio(): Promise<void> {
  if (!canImport()) {
    setPanel("pro");
    return;
  }
  const { file, opts } = useStudio.getState();
  if (!file) return;
  const id = ++run;
  useStudio.setState({ stage: "decode", progress: 0, result: null, error: null });
  try {
    const { transcribeFile } = await import("./transcribe");
    const result = await transcribeFile(file, opts, (stage, progress) => {
      if (id === run) useStudio.setState({ stage, progress });
    });
    if (id !== run) return;
    useStudio.setState({ stage: null, result: result.noteCount ? result : null, error: result.noteCount ? null : "noNotes" });
  } catch (err) {
    if (id !== run) return;
    console.warn("[studio] transcription failed", err);
    const kind = (err as { kind?: string }).kind;
    const known: AudioError[] = ["decode", "tooLong", "silent", "model"];
    useStudio.setState({ stage: null, error: known.includes(kind as AudioError) ? (kind as AudioError) : "other" });
  }
}

export async function saveTranscription(): Promise<void> {
  const { result, title } = useStudio.getState();
  if (!result) return;
  const name = title.trim() || "MIDI";
  const data = writeMidi({ title: name, bpm: result.bpm, timeSignature: [4, 4], tracks: result.tracks });
  await addUserMidi(name, data);
  resetAudio();
  setPanel(null);
}
