import { create } from "zustand";
import type { Song } from "../midi/song";
import type { SongMeta, SongPrefs } from "../storage/db";
import { emptyStats, type LoopRange, type Stats, type Status } from "../engine/types";
import { loadSettings, type Settings } from "./settings";

export interface Session {
  playTracks: number[];
  mutedTracks: number[];
  hand: "both" | "right" | "left";
  speed: number;
  waitMode: boolean;
  autoPlay: boolean;
  loop: LoopRange;
}

export interface Results {
  stats: Stats;
  accuracy: number;
  stars: number;
  dirty: boolean;
  newBest: boolean;
  bestScore: number | null;
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "success" | "error";
}

export type Panel = "library" | "settings" | "setup" | null;

export interface MidiDevice {
  id: string;
  name: string;
}

export interface AppState {
  settings: Settings;
  userSongs: SongMeta[];
  prefs: Record<string, SongPrefs>;
  currentId: string | null;
  song: Song | null;
  songLoading: boolean;
  session: Session;
  status: Status;
  waiting: boolean;
  stats: Stats;
  audioLoading: boolean;
  audioProgress: number;
  audioError: string | null;
  runDirty: boolean;
  time: number;
  startTime: number;
  endTime: number;
  results: Results | null;
  panel: Panel;
  welcomeOpen: boolean;
  toasts: Toast[];
  midiSupported: boolean;
  /** "idle" until access is requested, then "ready" or "denied". */
  midiAccess: "idle" | "ready" | "denied";
  midiDevices: MidiDevice[];
  dragOver: boolean;
  audioLocked: boolean;
}

export const DEFAULT_SESSION: Session = {
  playTracks: [],
  mutedTracks: [],
  hand: "both",
  speed: 1,
  waitMode: false,
  autoPlay: false,
  loop: { a: -1, b: -1, enabled: false },
};

const initialSettings = loadSettings();

export const useApp = create<AppState>(() => ({
  settings: initialSettings,
  userSongs: [],
  prefs: {},
  currentId: null,
  song: null,
  songLoading: true,
  session: { ...DEFAULT_SESSION, loop: { ...DEFAULT_SESSION.loop } },
  status: "empty",
  waiting: false,
  stats: emptyStats(),
  audioLoading: false,
  audioProgress: 1,
  audioError: null,
  runDirty: false,
  time: 0,
  startTime: 0,
  endTime: 0,
  results: null,
  panel: null,
  welcomeOpen: !initialSettings.onboarded,
  toasts: [],
  midiSupported: typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
  midiAccess: "idle",
  midiDevices: [],
  dragOver: false,
  audioLocked: false,
}));

let toastId = 1;

export function toast(text: string, kind: Toast["kind"] = "info", ms = 3200): void {
  const id = toastId++;
  useApp.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
  window.setTimeout(() => {
    useApp.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, ms);
}

export function setPanel(panel: Panel): void {
  useApp.setState({ panel });
}
