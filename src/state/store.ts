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
  /** Learning path: the run stops here (song seconds); 0 = the whole song. */
  segmentEnd: number;
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
  /** Set when the run was a learning-path step. */
  coach?: CoachOutcome;
  /** Where the run went wrong, for the coach notes. */
  insights?: import("../coach/insights").RunInsights;
  /** This run completed today's daily song. */
  daily?: boolean;
  /** A full, fair run of a built-in song: it counts for friends and can be sent as a challenge. */
  social?: boolean;
  /** Friends' best on this song this week (arrives after the results open). */
  friendScores?: import("../social/social").SongScore[];
  /** This run answered a friend's challenge. */
  duel?: { friend: string | null; mine: number; theirs: number };
  /** A live duet: my hand's run and the partner's (theirs arrives a moment later). */
  duet?: import("../social/live").DuetResult;
}

/** Drilling a hard stretch: it loops, a notch faster after each clean pass, until it is clean at `target` speed. */
export interface Drill {
  from: number;
  to: number;
  measureFrom: number;
  measureTo: number;
  target: number;
}

/** A learning-path step being played. */
export interface CoachRun {
  step: number;
}

export interface CoachOutcome {
  verdict: import("../coach/path").Verdict;
  /** The step played and the one the next attempt will be. */
  played: import("../coach/path").PathStep;
  next: import("../coach/path").PathStep;
  speed: number;
  wait: boolean;
  total: number;
  stepIndex: number;
  /** Seconds of the song the next attempt plays; null = the whole song. */
  partSec: number | null;
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "success" | "error";
}

export type Panel =
  | "library"
  | "settings"
  | "setup"
  | "account"
  | "pro"
  | "admin"
  | "progress"
  | "studio"
  | "editor"
  | "feedback"
  | "path"
  | "friends"
  | "duet"
  | null;

export type VideoKind = "tutorial" | "promo";

/** A finished recording waiting to be named and saved. */
export interface Take {
  notes: import("../studio/midiFile").RawNote[];
  instrument: import("../engine/types").InstrumentKind;
  program: number;
  seconds: number;
}

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
  /** Video player on top of everything; `first` = shown right after the welcome screen. */
  video: { kind: VideoKind; first: boolean } | null;
  toasts: Toast[];
  midiSupported: boolean;
  /** "idle" until access is requested, then "ready" or "denied". */
  midiAccess: "idle" | "ready" | "denied";
  midiDevices: MidiDevice[];
  /** Listening to a real instrument through the microphone. */
  mic: "off" | "starting" | "on" | "denied";
  social: import("../social/social").SocialOverview | null;
  socialLoading: boolean;
  /** A friend's challenge being played: the next full run of its song answers it. */
  activeDuel: import("../social/social").Duel | null;
  /** Username from an invite link, waiting to be sent as a friend request. */
  friendInvite: string | null;
  /** Live duet room this device is in. */
  duet: import("../social/live").DuetRoom | null;
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
  /** Live recording of the player's notes (Pro). */
  recording: { startedAt: number; notes: number } | null;
  take: Take | null;
  coach: CoachRun | null;
  drill: Drill | null;
}

export const DEFAULT_SESSION: Session = {
  playTracks: [],
  mutedTracks: [],
  hand: "both",
  speed: 1,
  waitMode: false,
  autoPlay: false,
  loop: { a: -1, b: -1, enabled: false },
  segmentEnd: 0,
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
  video: null,
  toasts: [],
  midiSupported: typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
  midiAccess: "idle",
  midiDevices: [],
  mic: "off",
  social: null,
  socialLoading: false,
  activeDuel: null,
  friendInvite: null,
  duet: null,
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
  recording: null,
  take: null,
  coach: null,
  drill: null,
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

export function openVideo(kind: VideoKind, first = false): void {
  useApp.setState({ video: { kind, first }, panel: null });
}
