export const NOTE_LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_SOLFEGE = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

const BLACK = new Set([1, 3, 6, 8, 10]);

export type NoteNaming = "letters" | "solfege";

export function isBlack(midi: number): boolean {
  return BLACK.has(((midi % 12) + 12) % 12);
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function noteName(midi: number, naming: NoteNaming = "letters", withOctave = false): string {
  const pc = ((midi % 12) + 12) % 12;
  const base = naming === "solfege" ? NOTE_SOLFEGE[pc] : NOTE_LETTERS[pc];
  return withOctave ? `${base}${octaveOf(midi)}` : base;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Expands a [low, high] range so it starts on a C (or F) and ends on a B/E to keep keyboard edges natural. */
export function niceKeyboardRange(low: number, high: number, minKeys = 25): [number, number] {
  let lo = Math.max(21, Math.min(low, high));
  let hi = Math.min(108, Math.max(low, high));
  while (hi - lo + 1 < minKeys) {
    if (lo > 21) lo--;
    if (hi - lo + 1 < minKeys && hi < 108) hi++;
    if (lo === 21 && hi === 108) break;
  }
  while (lo > 21 && lo % 12 !== 0 && lo % 12 !== 5) lo--;
  while (hi < 108 && hi % 12 !== 11 && hi % 12 !== 4) hi++;
  if (isBlack(lo)) lo--;
  if (isBlack(hi)) hi++;
  return [lo, hi];
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
