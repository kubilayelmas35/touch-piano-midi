import { engine } from "../engine/engine";
import type { Settings } from "../state/settings";
import { fitKeyboardBase, keymapSpan } from "./keyboard";

let cache: { notes: unknown; piano: unknown; base: number } | null = null;

/** MIDI note the piano keymap's offset 0 plays right now (follows the song when the octave is automatic). */
export function keyboardBase(s: Settings): number {
  const manual = (s.keyboardOctave + 1) * 12;
  if (!s.autoOctave || !engine.notes.length) return manual;
  if (!cache || cache.notes !== engine.notes || cache.piano !== s.keymaps.piano) {
    const midis = engine.notes.map((n) => n.midi);
    cache = { notes: engine.notes, piano: s.keymaps.piano, base: fitKeyboardBase(midis, keymapSpan(s.keymaps.piano)) };
  }
  return cache.base;
}

/** The C octave number of the current keyboard base (C4 = 4). */
export function keyboardOctaveNow(s: Settings): number {
  return keyboardBase(s) / 12 - 1;
}
