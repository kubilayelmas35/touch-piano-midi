import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GUITAR_SOUNDS, INSTRUMENTS, PIANO_SOUNDS, VIOLIN_SOUNDS, soundIdFor, soundProgram, type InstrumentId } from "./instruments";

const base = { instrument: "piano", pianoSound: "grand", guitarTone: "steel", violinSound: "classic" } as const;

describe("instrument sounds", () => {
  it("maps every choice to its own sampled sound", () => {
    const ids = [
      ...PIANO_SOUNDS.map((v) => soundIdFor({ ...base, pianoSound: v })),
      ...GUITAR_SOUNDS.map((v) => soundIdFor({ ...base, instrument: "guitar", guitarTone: v })),
      ...VIOLIN_SOUNDS.map((v) => soundIdFor({ ...base, instrument: "violin", violinSound: v })),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual((Object.keys(INSTRUMENTS) as InstrumentId[]).sort());
    expect(soundIdFor(base)).toBe("piano");
    expect(soundIdFor({ ...base, instrument: "violin" })).toBe("violin");
  });

  it("has every sample file in place", () => {
    for (const def of Object.values(INSTRUMENTS)) {
      for (const m of def.notes) expect(existsSync(`public/samples/${def.samples ?? def.id}/${m}.mp3`), `${def.id} ${m}`).toBe(true);
    }
  });

  it("writes the matching General MIDI program", () => {
    expect(soundProgram(base)).toBe(0);
    expect(soundProgram({ ...base, instrument: "guitar", guitarTone: "nylon" })).toBe(24);
    expect(soundProgram({ ...base, instrument: "violin", violinSound: "cello" })).toBe(42);
  });
});
