import { engine } from "../engine/engine";
import type { Settings } from "../state/settings";
import { fitKeyboardBase, keymapSpan, songKeyMap } from "./keyboard";

let baseCache: { notes: unknown; piano: unknown; base: number } | null = null;
let songCache: { notes: unknown; map: Map<string, number> } | null = null;
let fixedCache: { piano: unknown; base: number; map: Map<string, number> } | null = null;

/** MIDI note the piano keymap's offset 0 plays right now (follows the song when the octave is automatic). */
export function keyboardBase(s: Settings): number {
  const manual = (s.keyboardOctave + 1) * 12;
  if (!s.autoOctave || !engine.notes.length) return manual;
  if (!baseCache || baseCache.notes !== engine.notes || baseCache.piano !== s.keymaps.piano) {
    const midis = engine.notes.map((n) => n.midi);
    baseCache = { notes: engine.notes, piano: s.keymaps.piano, base: fitKeyboardBase(midis, keymapSpan(s.keymaps.piano)) };
  }
  return baseCache.base;
}

/** The C octave number of the current keyboard base (C4 = 4). */
export function keyboardOctaveNow(s: Settings): number {
  return keyboardBase(s) / 12 - 1;
}

/** Whether the keys follow the open song right now (rather than the player's own keymap). */
export function songKeysActive(s: Settings): boolean {
  return s.songKeys && engine.notes.length > 0;
}

/** Key code → MIDI note the computer keyboard plays right now. */
export function pianoKeyMap(s: Settings): Map<string, number> {
  if (songKeysActive(s)) {
    if (!songCache || songCache.notes !== engine.notes) songCache = { notes: engine.notes, map: songKeyMap(engine.notes.map((n) => n.midi)) };
    return songCache.map;
  }
  const base = keyboardBase(s);
  if (!fixedCache || fixedCache.piano !== s.keymaps.piano || fixedCache.base !== base) {
    fixedCache = { piano: s.keymaps.piano, base, map: new Map(Object.entries(s.keymaps.piano).map(([c, o]) => [c, base + o])) };
  }
  return fixedCache.map;
}
