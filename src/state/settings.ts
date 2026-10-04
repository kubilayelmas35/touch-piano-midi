import type { NoteNaming } from "../lib/notes";
import type { GuitarTone, InstrumentKind } from "../engine/types";
import { readLegacySettings } from "../storage/migrate";
import { defaultKeymaps, sanitizeKeymaps, type FretKeyMode, type Keymaps } from "../input/keyboard";
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
  keymaps: Keymaps;
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
  /** Instrument panel height as a fraction of the game area. */
  instrumentHeight: number;
  /** Piano width as a multiple of the screen (1–3); wider keys, the rest scrolls off screen. */
  keyZoom: number;
  /** Piano shows only the keys the song uses. */
  compactKeys: boolean;
  /** Minutes of practice a day that count as the daily goal. */
  dailyGoalMin: number;
  onboarded: boolean;
}

export const INSTRUMENT_HEIGHT_RANGE: [number, number] = [0.16, 0.65];
export const KEY_ZOOM_MAX = 3;

const KEY = "staveflow-settings-v2";

function detectLanguage(): Language {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith("tr")) ? "tr" : "en";
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
    showKeyLabels: true,
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
    keyboardOctave: 4,
    keymaps: defaultKeymaps(),
    fretKeyMode: "strings",
    autoFret: false,
    tapToPlay: false,
    multiNote: false,
    columnPress: false,
    midiInput: "all",
    instrumentHeight: 0.3,
    keyZoom: 1,
    compactKeys: false,
    dailyGoalMin: 10,
    onboarded: false,
  };
}

export function loadSettings(): Settings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize({ ...base, ...JSON.parse(raw) });
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
  const obj = raw && typeof raw === "object" ? (raw as Partial<Settings>) : {};
  return sanitize({ ...defaultSettings(), ...obj });
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
    keymaps: sanitizeKeymaps(s.keymaps),
    fretKeyMode: s.fretKeyMode === "chromatic" ? "chromatic" : "strings",
    autoFret: s.autoFret === true,
    tapToPlay: s.tapToPlay === true,
    multiNote: s.multiNote === true,
    columnPress: s.columnPress === true,
    instrumentHeight: num(s.instrumentHeight, ...INSTRUMENT_HEIGHT_RANGE, d.instrumentHeight),
    keyZoom: num(s.keyZoom, 1, KEY_ZOOM_MAX, d.keyZoom),
    compactKeys: s.compactKeys === true,
    dailyGoalMin: Math.round(num(s.dailyGoalMin, 5, 60, d.dailyGoalMin)),
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
