import { describe, expect, it } from "vitest";
import { PIANO_PRESETS, defaultKeymaps, fitKeyboardBase, isPianoPreset, keymapSpan } from "./keyboard";
import { sanitizeSettings } from "../state/settings";

describe("default piano keymap", () => {
  it("binds every slot from 0 to 31", () => {
    const offs = new Set(Object.values(defaultKeymaps().piano));
    for (let i = 0; i < 32; i++) expect(offs.has(i)).toBe(true);
  });

  it("moves users still on the old one-row default to the full map once", () => {
    const old = sanitizeSettings({ keymaps: { piano: { ...PIANO_PRESETS.classic } } });
    expect(isPianoPreset(old.keymaps.piano, "twoRow")).toBe(true);
    const chosen = sanitizeSettings({ keymapRev: 1, keymaps: { piano: { ...PIANO_PRESETS.classic } } });
    expect(isPianoPreset(chosen.keymaps.piano, "classic")).toBe(true);
    const custom = sanitizeSettings({ keymaps: { piano: { KeyA: 0, KeyS: 2 } } });
    expect(custom.keymaps.piano).toEqual({ KeyA: 0, KeyS: 2 });
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
    const base = fitKeyboardBase([36, 60, 96], span);
    expect(base).toBeGreaterThanOrEqual(36);
    expect(base).toBeLessThanOrEqual(72);
  });
});
