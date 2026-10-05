import type { NoteNaming } from "../lib/notes";
import type { GuitarTone, InstrumentKind } from "../engine/types";
import { readLegacySettings } from "../storage/migrate";
import { isNativeApp } from "../lib/platform";
import { STAFF_STYLES, type StaffStyle } from "../render/staffThemes";
import type { Goal, Skill } from "../coach/path";
import { defaultKeymaps, isPianoPreset, PIANO_PRESETS, sanitizeKeymaps, type FretKeyMode, type Keymaps } from "../input/keyboard";
import {
  APPROACH_STYLES,
  BACKGROUNDS,
  DUST_STYLES,
  EFFECT_STYLES,
  HEX_RE,
  NOTE_COLORS,
  NOTE_STYLES,
  oneOf,
  type ApproachStyle,
  type Background,
  type DustStyle,
  type EffectStyle,
  type NoteColor,
  type NoteStyle,
} from "../render/appearance";

export type Language = "tr" | "en";

export const DUET_SOUNDS = ["auto", "live", "off"] as const;
export type DuetSound = (typeof DUET_SOUNDS)[number];

export interface Settings {
  language: Language;
  noteNaming: NoteNaming;
  instrument: InstrumentKind;
  guitarTone: GuitarTone;
  volume: number;
  reverb: number;
  accompVolume: number;
  clickVolume: number;
  metronome: boolean;
  countIn: boolean;
  timingWindowMs: number;
  fallSeconds: number;
  showNoteNames: boolean;
  showKeyLabels: boolean;
  effects: boolean;
  /** 0.1–1: how many particles / how bright the glows are. */
  effectLevel: number;
  effectStyle: EffectStyle;
  /** Cloud left floating behind the notes after hits and around held notes. */
  dust: DustStyle;
  /** 0.1–1 density of the dust cloud. */
  dustLevel: number;
  approach: ApproachStyle;
  noteStyle: NoteStyle;
  noteColor: NoteColor;
  /** The "one colour" palette's colour. */
  solidColor: string;
  /** The custom gradient: top of the screen → hit line. */
  gradFrom: string;
  gradTo: string;
  background: Background;
  /** Octave of the computer-keyboard "A" key (C of that octave). */
  keyboardOctave: number;
  /** Piano: the computer-keyboard octave follows the open song so its notes land on the keys. */
  autoOctave: boolean;
  /** Computer keys follow the open song: its white notes along the home row, black notes along the row above. */
  songKeys: boolean;
  keymaps: Keymaps;
  /** Version of the default keymap the stored keymaps have been migrated to. */
  keymapRev: number;
  /** Guitar/violin on the computer keyboard: string + fret keys, or piano-style chromatic keys. */
  fretKeyMode: FretKeyMode;
  /** Guitar/violin: frets the next song note automatically, so only the strings need to be struck. */
  autoFret: boolean;
  /** Guitar/violin: touching the neck also sounds the note (one-handed play). */
  tapToPlay: boolean;
  /** Guitar/violin touch: a finger presses every string it covers or slides across on the neck. */
  multiNote: boolean;
  /** Guitar/violin touch: a finger presses its whole fret column (barre). */
  columnPress: boolean;
  midiInput: string;
  /** Microphone listening: 0 only loud notes … 1 picks up quiet playing. */
  micSensitivity: number;
  /** Microphone to listen with (a MediaDevices id); "" is the system default. */
  micDevice: string;
  /** Live duet: the partner's hand played here by the app, their real playing sent over, or silent. */
  duetSound: DuetSound;
  /** Instrument panel height as a fraction of the game area. */
  instrumentHeight: number;
  /** Hides the drag handle so the panel can't be resized by accident while playing. */
  lockHeight: boolean;
  /** Piano width as a multiple of the screen (1–3); wider keys, the rest scrolls off screen. */
  keyZoom: number;
  /** Piano shows only the keys the song uses. */
  compactKeys: boolean;
  /** Minutes of practice a day that count as the daily goal. */
  dailyGoalMin: number;
  /** App: a notification on days without practice yet, at `reminderAt` (minutes after midnight). */
  reminder: boolean;
  reminderAt: number;
  /** Phones in portrait: suggest turning the device sideways. */
  rotateHint: boolean;
  /** App: keep the screen in landscape. */
  landscapeLock: boolean;
  /** Piano: let go keys keep ringing softly, as with the sustain pedal. */
  pianoPedal: boolean;
  /** Piano: how long held and pedalled notes ring, 0 short … 1 long. */
  pianoSustain: number;
  /** Falling notes also show the computer key that plays them. */
  noteKeyLabels: boolean;
  /** Piano: suggested finger numbers (1 thumb … 5 little finger) on the falling notes. */
  fingerNumbers: boolean;
  /** Piano: a scrolling staff with the notes above the falling notes. */
  staffView: boolean;
  /** Look of the scrolling staff. */
  staffStyle: StaffStyle;
  /** Fretless play per instrument: sliding a finger glides the pitch instead of stepping key by key. */
  glidePiano: boolean;
  glideGuitar: boolean;
  glideViolin: boolean;
  /** Fretless: a resting finger settles on the nearest note (false = pitch stays exactly where the finger is). */
  glideSnap: boolean;
  /** Fretless guitar / violin: hide the fret wires, numbers and inlays. */
  hideFrets: boolean;
  /** Answers from the welcome questions; they shape the learning path. */
  skill: Skill;
  goal: Goal;
  onboarded: boolean;
}

export const INSTRUMENT_HEIGHT_RANGE: [number, number] = [0.16, 0.65];
export const KEY_ZOOM_MAX = 3;

const KEY = "staveflow-settings-v2";

function detectLanguage(): Language {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith("tr")) ? "tr" : "en";
}

/** A device with a precise pointer usually has a keyboard too; phones, tablets and the phone app don't. */
export function hasKeyboard(): boolean {
  if (isNativeApp) return false;
  return typeof matchMedia !== "function" || matchMedia("(any-pointer: fine)").matches;
}

export function defaultSettings(): Settings {
  return {
    language: detectLanguage(),
    noteNaming: "letters",
    instrument: "piano",
    guitarTone: "steel",
    volume: 0.9,
    reverb: 0.18,
    accompVolume: 0.65,
    clickVolume: 0.6,
    metronome: false,
    countIn: true,
    timingWindowMs: 150,
    fallSeconds: 3,
    showNoteNames: true,
    showKeyLabels: hasKeyboard(),
    effects: true,
    effectLevel: 0.5,
    effectStyle: "sparks",
    dust: "smoke",
    dustLevel: 0.5,
    approach: "beam",
    noteStyle: "gem",
    noteColor: "auto",
    solidColor: "#8b5cf6",
    gradFrom: "#22d3ee",
    gradTo: "#f43f5e",
    background: "night",
    keyboardOctave: 3,
    autoOctave: true,
    songKeys: true,
    keymaps: defaultKeymaps(),
    keymapRev: KEYMAP_REV,
    fretKeyMode: "strings",
    autoFret: false,
    tapToPlay: false,
    multiNote: false,
    columnPress: false,
    midiInput: "all",
    micSensitivity: 0.5,
    micDevice: "",
    duetSound: "auto",
    instrumentHeight: 0.3,
    lockHeight: false,
    keyZoom: 1,
    compactKeys: false,
    dailyGoalMin: 10,
    reminder: false,
    reminderAt: 19 * 60,
    rotateHint: true,
    landscapeLock: false,
    pianoPedal: true,
    pianoSustain: 0.7,
    noteKeyLabels: hasKeyboard(),
    fingerNumbers: false,
    staffView: false,
    staffStyle: "night",
    glidePiano: false,
    glideGuitar: false,
    glideViolin: false,
    glideSnap: true,
    hideFrets: false,
    skill: "some",
    goal: "songs",
    onboarded: false,
  };
}

export function loadSettings(): Settings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize({ ...base, ...migrate(JSON.parse(raw)) });
    const legacy = readLegacySettings();
    if (legacy) {
      if (legacy.locale === "tr" || legacy.locale === "en") base.language = legacy.locale;
      const inst = legacy.playMode ?? legacy.instrumentId;
      if (inst === "guitar" || inst === "violin" || inst === "piano") base.instrument = inst;
      if (typeof legacy.timingWindow === "number") base.timingWindowMs = Math.max(60, Math.min(300, legacy.timingWindow));
      if (legacy.labelMode === "solfege") base.noteNaming = "solfege";
      base.onboarded = true;
    }
  } catch {
    /* defaults */
  }
  return base;
}

/** Settings from an untrusted source (e.g. the account copy), filled up with defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const obj = raw && typeof raw === "object" ? migrate(raw as Partial<Settings>) : {};
  return sanitize({ ...defaultSettings(), ...obj });
}

const KEYMAP_REV = 3;

/**
 * Anyone still on an earlier default piano keymap moves to the current one. Rev 3: computer-key labels used to be
 * on everywhere; devices without a keyboard turn them off once.
 */
function migrate(s: Partial<Settings>): Partial<Settings> {
  if (!s || typeof s !== "object" || (s.keymapRev ?? 0) >= KEYMAP_REV) return s;
  const piano = s.keymaps?.piano;
  const rev = s.keymapRev ?? 0;
  const old =
    rev < 2 &&
    !!piano &&
    typeof piano === "object" &&
    (isPianoPreset(piano, "classic") || (rev >= 1 && isPianoPreset(piano, "twoRow")));
  return {
    ...s,
    keymapRev: KEYMAP_REV,
    ...(old && s.keymaps ? { keymaps: { ...s.keymaps, piano: { ...PIANO_PRESETS.home } } } : {}),
    ...(rev < 3 && !hasKeyboard() ? { showKeyLabels: false, noteKeyLabels: false } : {}),
  };
}

function sanitize(s: Settings): Settings {
  const num = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  const hex = (v: unknown, d: string) => (typeof v === "string" && HEX_RE.test(v) ? v.toLowerCase() : d);
  const d = defaultSettings();
  return {
    ...s,
    language: s.language === "tr" || s.language === "en" ? s.language : d.language,
    noteNaming: s.noteNaming === "solfege" ? "solfege" : "letters",
    instrument: ["piano", "guitar", "violin"].includes(s.instrument) ? s.instrument : "piano",
    guitarTone: s.guitarTone === "nylon" ? "nylon" : "steel",
    volume: num(s.volume, 0, 1, d.volume),
    reverb: num(s.reverb, 0, 0.6, d.reverb),
    accompVolume: num(s.accompVolume, 0, 1, d.accompVolume),
    clickVolume: num(s.clickVolume, 0, 1, d.clickVolume),
    timingWindowMs: num(s.timingWindowMs, 60, 300, d.timingWindowMs),
    fallSeconds: num(s.fallSeconds, 1, 8, d.fallSeconds),
    effectLevel: num(s.effectLevel, 0.1, 1, d.effectLevel),
    effectStyle: oneOf(EFFECT_STYLES, s.effectStyle, d.effectStyle),
    dust: oneOf(DUST_STYLES, s.dust, d.dust),
    dustLevel: num(s.dustLevel, 0.1, 1, d.dustLevel),
    approach: oneOf(APPROACH_STYLES, s.approach, d.approach),
    noteColor: (s.noteColor as string) === "violet" ? "solid" : oneOf(NOTE_COLORS, s.noteColor, d.noteColor),
    solidColor: hex(s.solidColor, d.solidColor),
    gradFrom: hex(s.gradFrom, d.gradFrom),
    gradTo: hex(s.gradTo, d.gradTo),
    noteStyle: oneOf(NOTE_STYLES, s.noteStyle, d.noteStyle),
    background: oneOf(BACKGROUNDS, s.background, d.background),
    keyboardOctave: Math.round(num(s.keyboardOctave, 1, 7, d.keyboardOctave)),
    autoOctave: s.autoOctave !== false,
    songKeys: s.songKeys !== false,
    keymaps: sanitizeKeymaps(s.keymaps),
    keymapRev: KEYMAP_REV,
    fretKeyMode: s.fretKeyMode === "chromatic" ? "chromatic" : "strings",
    autoFret: s.autoFret === true,
    tapToPlay: s.tapToPlay === true,
    multiNote: s.multiNote === true,
    columnPress: s.columnPress === true,
    instrumentHeight: num(s.instrumentHeight, ...INSTRUMENT_HEIGHT_RANGE, d.instrumentHeight),
    lockHeight: s.lockHeight === true,
    keyZoom: num(s.keyZoom, 1, KEY_ZOOM_MAX, d.keyZoom),
    compactKeys: s.compactKeys === true,
    dailyGoalMin: Math.round(num(s.dailyGoalMin, 5, 60, d.dailyGoalMin)),
    reminder: s.reminder === true,
    reminderAt: Math.round(num(s.reminderAt, 0, 24 * 60 - 1, d.reminderAt)),
    rotateHint: s.rotateHint !== false,
    landscapeLock: s.landscapeLock === true,
    pianoPedal: s.pianoPedal !== false,
    pianoSustain: num(s.pianoSustain, 0, 1, d.pianoSustain),
    micSensitivity: num(s.micSensitivity, 0, 1, d.micSensitivity),
    micDevice: typeof s.micDevice === "string" ? s.micDevice.slice(0, 200) : "",
    duetSound: oneOf(DUET_SOUNDS, s.duetSound, d.duetSound),
    noteKeyLabels: typeof s.noteKeyLabels === "boolean" ? s.noteKeyLabels : d.noteKeyLabels,
    fingerNumbers: s.fingerNumbers === true,
    staffView: s.staffView === true,
    staffStyle: oneOf(STAFF_STYLES, s.staffStyle, d.staffStyle),
    glidePiano: s.glidePiano === true,
    glideGuitar: s.glideGuitar === true,
    glideViolin: s.glideViolin === true,
    glideSnap: s.glideSnap !== false,
    hideFrets: s.hideFrets === true,
    skill: s.skill === "new" || s.skill === "good" ? s.skill : "some",
    goal: s.goal === "learn" || s.goal === "free" ? s.goal : "songs",
  };
}

const AT_KEY = "staveflow-settings-at";

/** When the settings were last changed on this device (ms), for picking the newer copy on sign-in. */
export function settingsChangedAt(): number {
  try {
    return Number(localStorage.getItem(AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function markSettingsChanged(at = Date.now()): void {
  try {
    localStorage.setItem(AT_KEY, String(at));
  } catch {
    /* */
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / private mode */
  }
}
