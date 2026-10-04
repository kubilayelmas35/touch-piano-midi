import type { NoteNaming } from "../lib/notes";
import type { GuitarTone, InstrumentKind } from "../engine/types";
import { readLegacySettings } from "../storage/migrate";
import { defaultKeymaps, sanitizeKeymaps, type FretKeyMode, type Keymaps } from "../input/keyboard";
import {
  APPROACH_STYLES,
  BACKGROUNDS,
  EFFECT_STYLES,
  NOTE_STYLES,
  oneOf,
  type ApproachStyle,
  type Background,
  type EffectStyle,
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
  /** Hits leave a slowly drifting cloud of dust behind the notes. */
  dustTrail: boolean;
  approach: ApproachStyle;
  noteStyle: NoteStyle;
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
  midiInput: string;
  /** Instrument panel height as a fraction of the game area. */
  instrumentHeight: number;
  onboarded: boolean;
}

export const INSTRUMENT_HEIGHT_RANGE: [number, number] = [0.16, 0.65];

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
    dustTrail: true,
    approach: "beam",
    noteStyle: "gem",
    background: "night",
    keyboardOctave: 4,
    keymaps: defaultKeymaps(),
    fretKeyMode: "strings",
    autoFret: false,
    tapToPlay: false,
    midiInput: "all",
    instrumentHeight: 0.3,
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

function sanitize(s: Settings): Settings {
  const num = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
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
    dustTrail: s.dustTrail !== false,
    approach: oneOf(APPROACH_STYLES, s.approach, d.approach),
    noteStyle: oneOf(NOTE_STYLES, s.noteStyle, d.noteStyle),
    background: oneOf(BACKGROUNDS, s.background, d.background),
    keyboardOctave: Math.round(num(s.keyboardOctave, 1, 7, d.keyboardOctave)),
    keymaps: sanitizeKeymaps(s.keymaps),
    fretKeyMode: s.fretKeyMode === "chromatic" ? "chromatic" : "strings",
    autoFret: s.autoFret === true,
    tapToPlay: s.tapToPlay === true,
    instrumentHeight: num(s.instrumentHeight, ...INSTRUMENT_HEIGHT_RANGE, d.instrumentHeight),
  };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / private mode */
  }
}
