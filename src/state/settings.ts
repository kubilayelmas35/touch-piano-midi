import type { NoteNaming } from "../lib/notes";
import type { GuitarTone, InstrumentKind } from "../engine/types";
import { readLegacySettings } from "../storage/migrate";

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
  /** Octave of the computer-keyboard "A" key (C of that octave). */
  keyboardOctave: number;
  midiInput: string;
  /** Instrument panel height as a fraction of the game area. */
  instrumentHeight: number;
  onboarded: boolean;
}

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
    keyboardOctave: 4,
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
    keyboardOctave: Math.round(num(s.keyboardOctave, 1, 7, d.keyboardOctave)),
    instrumentHeight: num(s.instrumentHeight, 0.16, 0.5, d.instrumentHeight),
  };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / private mode */
  }
}
