import { create } from "zustand";
import type { Song } from "../midi/song";
import type { SongMeta, SongPrefs } from "../storage/db";
import { emptyStats, type LoopRange, type Stats, type Status } from "../engine/types";
import { loadSettings, type Settings } from "./settings";
import type { Progress } from "../progress/progress";
import { loadProgress } from "../progress/storage";

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
  /** Achievement ids this run unlocked. */
  achievements: string[];
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "success" | "error";
}

export type Panel = "library" | "settings" | "setup" | "account" | "pro" | "admin" | "progress" | null;

export interface Account {
  /** "disabled" when no Supabase project is configured. */
  status: "disabled" | "loading" | "signedOut" | "signedIn";
  email: string | null;
  username: string | null;
  pro: boolean;
  /** Cloud MIDI storage, switched on per member by an admin. */
  cloud: boolean;
  cloudQuotaMb: number;
  isAdmin: boolean;
  /** Arrived from a password-reset e-mail; asks for a new password. */
  recovery: boolean;
  /** OAuth providers switched on in the Supabase dashboard. */
  providers: { google: boolean; apple: boolean };
}

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
  account: Account;
  /** Ids of library songs that also live in the member's cloud. */
  cloudIds: string[];
  cloudBytes: number;
  cloudBusy: boolean;
  /** Which part of a zoomed piano is on screen (0 left … 1 right). */
  keyPan: number;
  progress: Progress;
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
  account: {
    status: "disabled",
    email: null,
    username: null,
    pro: false,
    cloud: false,
    cloudQuotaMb: 0,
    isAdmin: false,
    recovery: false,
    providers: { google: false, apple: false },
  },
  cloudIds: [],
  cloudBytes: 0,
  cloudBusy: false,
  keyPan: 0.5,
  progress: loadProgress(),
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
