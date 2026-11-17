import { foldIntoSpan, isBlack } from "../lib/notes";

export const BLACK_KEY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Letters in the typed order, then any missing letters in A-to-Z order. */
export function normalizeBlackKeyOrder(raw: unknown): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const src = typeof raw === "string" ? raw.toUpperCase() : "";
  for (const ch of src) {
    if (ch >= "A" && ch <= "Z" && !seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  for (const ch of BLACK_KEY_ALPHABET) if (!seen.has(ch)) out.push(ch);
  return out.join("");
}

/** Label for the black key at this left-to-right index (0 = leftmost). */
export function blackKeyMark(index: number, order: string): string {
  const abc = order.length ? order : BLACK_KEY_ALPHABET;
  if (index < abc.length) return abc[index] ?? "A";
  const extra = index - abc.length;
  const hi = Math.floor(extra / abc.length) % abc.length;
  const lo = extra % abc.length;
  return `${abc[hi] ?? "A"}${abc[lo] ?? "A"}`;
}

/** White keys are 1, 2, 3 from the left. Black keys take the letter order, also from the left. */
export function keyIndexMarks(midis: readonly number[], blackOrder: string): Map<number, string> {
  const order = normalizeBlackKeyOrder(blackOrder);
  const out = new Map<number, string>();
  let white = 0;
  let black = 0;
  for (const midi of [...midis].sort((a, b) => a - b)) {
    if (isBlack(midi)) out.set(midi, blackKeyMark(black++, order));
    else out.set(midi, String(++white));
  }
  return out;
}

/** Every pitch from `lo` through `hi`, the keys of a fixed keyboard. */
export function keysBetween(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = Math.round(lo); m <= Math.round(hi); m++) out.push(m);
  return out;
}

/**
 * Marks for these keys. With a MIDI span and folding, a pitch outside the keyboard
 * takes the mark of the key it lands on.
 */
export function keyMarkLookup(midis: readonly number[], order: string, span: [number, number] | null, fold: boolean): Map<number, string> {
  const marks = keyIndexMarks(midis, order);
  if (!span || !fold) return marks;
  const out = new Map(marks);
  for (let m = 0; m < 128; m++) {
    if (out.has(m)) continue;
    const label = marks.get(foldIntoSpan(m, span[0], span[1]));
    if (label) out.set(m, label);
  }
  return out;
}
