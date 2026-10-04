import { describe, expect, it } from "vitest";
import {
  BLACK_ROW,
  LOW_WHITE_ROW,
  PIANO_PRESETS,
  WHITE_ROW,
  defaultKeymaps,
  fitKeyboardBase,
  isPianoPreset,
  keymapSpan,
  songKeyMap,
} from "./keyboard";
import { sanitizeSettings } from "../state/settings";

describe("default piano keymap", () => {
  it("puts white keys on the home row and black keys in order on the row above", () => {
    const piano = defaultKeymaps().piano;
    expect(WHITE_ROW.map((c) => piano[c])).toEqual([0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19]);
    expect(["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT"].map((c) => piano[c])).toEqual([1, 3, 6, 8, 10]);
  });

  it("moves users still on an old default to the current one once", () => {
    const classic = sanitizeSettings({ keymaps: { piano: { ...PIANO_PRESETS.classic } } });
    expect(isPianoPreset(classic.keymaps.piano, "home")).toBe(true);
    const lastDefault = sanitizeSettings({ keymapRev: 1, keymaps: { piano: { ...PIANO_PRESETS.twoRow } } });
    expect(isPianoPreset(lastDefault.keymaps.piano, "home")).toBe(true);
    const chosen = sanitizeSettings({ keymapRev: 2, keymaps: { piano: { ...PIANO_PRESETS.twoRow } } });
    expect(isPianoPreset(chosen.keymaps.piano, "twoRow")).toBe(true);
    const custom = sanitizeSettings({ keymaps: { piano: { KeyA: 0, KeyS: 2 } } });
    expect(custom.keymaps.piano).toEqual({ KeyA: 0, KeyS: 2 });
  });
});

describe("songKeyMap", () => {
  it("gives every note of a small song a key: whites on A S D…, blacks on Q W E…", () => {
    const m = songKeyMap([60, 62, 64, 65, 67, 69, 66, 70, 60, 62]);
    expect([...m.entries()].sort((a, b) => a[1] - b[1])).toEqual([
      ["KeyA", 60],
      ["KeyS", 62],
      ["KeyD", 64],
      ["KeyF", 65],
      ["KeyQ", 66],
      ["KeyG", 67],
      ["KeyH", 69],
      ["KeyW", 70],
    ]);
  });

  it("moves the lowest white notes to the bottom row when the home row is full", () => {
    const whites = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71];
    const m = songKeyMap(whites);
    expect(m.get(LOW_WHITE_ROW[0])).toBe(48);
    expect(m.get(LOW_WHITE_ROW[1])).toBe(50);
    expect(m.get(WHITE_ROW[0])).toBe(52);
    expect(m.get(WHITE_ROW[11])).toBe(71);
    expect(new Set(m.values()).size).toBe(whites.length);
  });

  it("keeps the busiest stretch when a song has more notes than keys", () => {
    const whites: number[] = [];
    for (let m = 24; m <= 108; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) whites.push(m);
    const busy = [60, 62, 64, 65, 67].flatMap((m) => [m, m, m, m]);
    const map = songKeyMap([...whites, ...busy, 61, 61]);
    const notes = new Set(map.values());
    expect(notes.size).toBeLessThanOrEqual(WHITE_ROW.length + LOW_WHITE_ROW.length + BLACK_ROW.length * 2);
    for (const m of [60, 61, 62, 64, 65, 67]) expect(notes.has(m)).toBe(true);
  });
});

describe("fitKeyboardBase", () => {
  const span = keymapSpan(PIANO_PRESETS.twoRow);

  it("puts every note on a key when the song fits", () => {
    for (const song of [[60, 64, 67, 72, 79], [48, 55, 60, 67, 79], [62, 69, 74, 86, 91]]) {
      const base = fitKeyboardBase(song, span);
      expect(song.every((m) => m >= base + span[0] && m <= base + span[1])).toBe(true);
    }
  });

  it("covers the most notes when the song is wider than the keys", () => {
    expect(fitKeyboardBase([55, 60, 62, 64, 65, 67, 84], span)).toBe(48);
    expect(fitKeyboardBase([55, 72, 74, 76, 79, 81, 84], span)).toBe(60);
  });
});
