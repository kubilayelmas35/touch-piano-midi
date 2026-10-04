/** Computer-keyboard bindings, by physical key code (layout independent). */

export interface FretKeymap {
  /** Key per string, lowest string first ("" = unbound). */
  strings: string[];
  /** Key per fret, starting at fret 1 ("" = unbound). */
  frets: string[];
}

export interface Keymaps {
  /** Key code → semitones above the C of the keyboard octave. */
  piano: Record<string, number>;
  guitar: FretKeymap;
  violin: FretKeymap;
}

export type PianoPreset = "home" | "classic" | "twoRow";
export type FretKeyMode = "strings" | "chromatic";

export const FRET_KEY_COUNT = 12;

/** Song keys: white notes go left → right along the home row, black notes along the row above. */
export const WHITE_ROW = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Backslash"];
export const BLACK_ROW = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"];
/** When a song has more: its lowest white notes move to the bottom row, its highest black notes to the digits. */
export const LOW_WHITE_ROW = ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"];
export const HIGH_BLACK_ROW = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"];

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const isBlackKey = (midi: number) => BLACK_PCS.has(((midi % 12) + 12) % 12);

/** The `size` consecutive entries of a sorted note list that the song plays most often. */
function busiest(notes: number[], size: number, count: Map<number, number>): number[] {
  let best = 0;
  let bestSum = -1;
  for (let i = 0; i + size <= notes.length; i++) {
    let sum = 0;
    for (let j = i; j < i + size; j++) sum += count.get(notes[j]) ?? 0;
    if (sum > bestSum) {
      bestSum = sum;
      best = i;
    }
  }
  return notes.slice(best, best + size);
}

/** Key code → MIDI note for a song: every note it uses gets a key, in order, white and black on their own rows. */
export function songKeyMap(midis: number[]): Map<string, number> {
  const count = new Map<number, number>();
  for (const m of midis) count.set(m, (count.get(m) ?? 0) + 1);
  const notes = [...count.keys()].sort((a, b) => a - b);
  const maxWhite = WHITE_ROW.length + LOW_WHITE_ROW.length;
  const maxBlack = BLACK_ROW.length + HIGH_BLACK_ROW.length;
  let whites = notes.filter((m) => !isBlackKey(m));
  const cut = whites.length > maxWhite;
  if (cut) whites = busiest(whites, maxWhite, count);
  let blacks = notes.filter((m) => isBlackKey(m) && (!cut || (m > whites[0] && m < whites[whites.length - 1])));
  if (blacks.length > maxBlack) blacks = busiest(blacks, maxBlack, count);

  const out = new Map<string, number>();
  const low = Math.max(0, whites.length - WHITE_ROW.length);
  whites.slice(0, low).forEach((m, i) => out.set(LOW_WHITE_ROW[i], m));
  whites.slice(low).forEach((m, i) => out.set(WHITE_ROW[i], m));
  blacks.forEach((m, i) => out.set(i < BLACK_ROW.length ? BLACK_ROW[i] : HIGH_BLACK_ROW[i - BLACK_ROW.length], m));
  return out;
}

export const PIANO_PRESETS: Record<PianoPreset, Record<string, number>> = {
  // White keys along the home row, black keys in order along the row above.
  home: {
    KeyA: 0, KeyS: 2, KeyD: 4, KeyF: 5, KeyG: 7, KeyH: 9, KeyJ: 11, KeyK: 12, KeyL: 14, Semicolon: 16, Quote: 17,
    Backslash: 19,
    KeyQ: 1, KeyW: 3, KeyE: 6, KeyR: 8, KeyT: 10, KeyY: 13, KeyU: 15, KeyI: 18,
  },
  // One and a half octaves on the home row, sharps on the row above (Synthesia style).
  classic: {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
    KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
  },
  // Two and a half octaves: bottom rows for the lower octave, top rows for the upper (DAW style).
  twoRow: {
    KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
    Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
    KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21,
    Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29, Equal: 30,
    BracketRight: 31,
  },
};

const FRET_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"];

export function isPianoPreset(piano: Record<string, number>, preset: PianoPreset): boolean {
  const p = PIANO_PRESETS[preset];
  const codes = Object.keys(p);
  return codes.length === Object.keys(piano).length && codes.every((c) => piano[c] === p[c]);
}

/** Lowest and highest offset of the piano keymap. */
export function keymapSpan(piano: Record<string, number>): [number, number] {
  const offs = Object.values(piano);
  return offs.length ? [Math.min(...offs), Math.max(...offs)] : [0, 0];
}

/**
 * C (MIDI) the keymap's offset 0 should sit on so as many of the song's notes as possible land on keys;
 * ties go to the octave closest to the middle of the song.
 */
export function fitKeyboardBase(midis: number[], span: [number, number]): number {
  const [a, b] = span;
  if (!midis.length) return 60;
  let lo = 127;
  let hi = 0;
  for (const m of midis) {
    if (m < lo) lo = m;
    if (m > hi) hi = m;
  }
  const mid = (lo + hi) / 2 - (a + b) / 2;
  let best = 60;
  let bestScore = -1;
  for (let base = 24; base <= 96; base += 12) {
    let score = 0;
    for (const m of midis) if (m >= base + a && m <= base + b) score++;
    if (score > bestScore || (score === bestScore && Math.abs(base - mid) < Math.abs(best - mid))) {
      best = base;
      bestScore = score;
    }
  }
  return best;
}

export function defaultKeymaps(): Keymaps {
  return {
    piano: { ...PIANO_PRESETS.home },
    guitar: { strings: ["KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"], frets: [...FRET_KEYS] },
    violin: { strings: ["KeyJ", "KeyK", "KeyL", "Semicolon"], frets: [...FRET_KEYS] },
  };
}

/** Keys that keep their app meaning and can't be bound to notes. */
export function isReservedKey(code: string): boolean {
  return (
    /^(Space|Escape|Tab|Enter|NumpadEnter|Backspace|Delete|Home|End|PageUp|PageDown|CapsLock|ContextMenu)$/.test(code) ||
    /^(Arrow|Shift|Control|Alt|Meta|F\d)/.test(code)
  );
}

function sanitizeCodes(v: unknown, len: number, fallback: string[]): string[] {
  if (!Array.isArray(v)) return [...fallback];
  const out = Array.from({ length: len }, (_, i) => (typeof v[i] === "string" && !isReservedKey(v[i]) ? (v[i] as string) : ""));
  return out;
}

export function sanitizeKeymaps(v: unknown): Keymaps {
  const d = defaultKeymaps();
  if (!v || typeof v !== "object") return d;
  const src = v as Partial<Keymaps>;
  const piano: Record<string, number> = {};
  if (src.piano && typeof src.piano === "object") {
    for (const [code, off] of Object.entries(src.piano)) {
      if (typeof off === "number" && Number.isInteger(off) && off >= -12 && off <= 48 && !isReservedKey(code)) piano[code] = off;
    }
  }
  return {
    piano: Object.keys(piano).length ? piano : d.piano,
    guitar: {
      strings: sanitizeCodes(src.guitar?.strings, 6, d.guitar.strings),
      frets: sanitizeCodes(src.guitar?.frets, FRET_KEY_COUNT, d.guitar.frets),
    },
    violin: {
      strings: sanitizeCodes(src.violin?.strings, 4, d.violin.strings),
      frets: sanitizeCodes(src.violin?.frets, FRET_KEY_COUNT, d.violin.frets),
    },
  };
}

// ------------------------------------------------------------------ labels

interface KeyboardLayoutMap {
  get(code: string): string | undefined;
}

let layoutMap: KeyboardLayoutMap | null = null;
/** Upper-casing locale matching the physical layout ("i" → "İ" on Turkish keyboards). */
let layoutLocale: string | undefined;
let labelRev = 0;

const PUNCT: Record<string, string> = {
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  IntlBackslash: "<",
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
};

/** Uses the Keyboard Map API (Chromium) to show the real characters, e.g. Ş / İ on Turkish layouts. */
export async function detectKeyLabels(): Promise<void> {
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<KeyboardLayoutMap> } }).keyboard;
  if (!kb?.getLayoutMap) return;
  try {
    layoutMap = await kb.getLayoutMap();
    const turkish = ["Semicolon", "BracketLeft", "BracketRight", "Quote"].some((c) => /[şğüi]/.test(layoutMap?.get(c) ?? ""));
    layoutLocale = turkish ? "tr" : undefined;
    labelRev++;
  } catch {
    /* keep fallback */
  }
}

/** Changes when the detected layout changes, for memoised label maps. */
export function keyLabelRevision(): number {
  return labelRev;
}

export function keyLabel(code: string): string {
  if (!code) return "";
  const mapped = layoutMap?.get(code);
  if (mapped) return mapped.toLocaleUpperCase(layoutLocale);
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (m) return m[1];
  return PUNCT[code] ?? code;
}

/** midi → key label for a key code → midi map (first key wins when two keys share a note). */
export function keyLabelMap(keys: Map<string, number>): Map<number, string> {
  const out = new Map<number, string>();
  for (const [code, midi] of keys) if (!out.has(midi)) out.set(midi, keyLabel(code));
  return out;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
