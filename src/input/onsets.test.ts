import { describe, expect, it } from "vitest";
import { KeyOnsets, midiHz } from "./onsets";

const BIN_HZ = 48000 / 8192;
const BINS = 4096;

function frame(notes: number[], level = 0.1): Float32Array {
  const f = new Float32Array(BINS).fill(0.001);
  for (const midi of notes) {
    for (let h = 1; h <= 8; h++) {
      const b = Math.round((midiHz(midi) * h) / BIN_HZ);
      if (b < BINS) f[b] += level / h;
    }
  }
  return f;
}

function listen(before: number[], after: number[]): KeyOnsets {
  const k = new KeyOnsets(BINS, BIN_HZ);
  for (let i = 0; i < 9; i++) k.push(frame(before));
  k.push(frame([...before, ...after]));
  return k;
}

describe("KeyOnsets", () => {
  it("hears the struck key and not its neighbours or a fifth", () => {
    const k = listen([], [60]);
    expect(k.struck(60)).toBe(true);
    expect(k.struck(61)).toBe(false);
    expect(k.struck(62)).toBe(false);
    expect(k.struck(67)).toBe(false);
  });

  it("hears low notes by their harmonics, without taking a fifth above for them", () => {
    const k = listen([], [48]);
    expect(k.struck(48)).toBe(true);
    expect(k.struck(55)).toBe(false);
  });

  it("hears a new note over one still ringing, but not the ringing one again", () => {
    const k = listen([60], [64]);
    expect(k.struck(64)).toBe(true);
    expect(k.struck(60)).toBe(false);
  });

  it("needs some history and a real rise above the noise", () => {
    const fresh = new KeyOnsets(BINS, BIN_HZ);
    fresh.push(frame([60]));
    expect(fresh.struck(60)).toBe(false);
    expect(listen([], [60]).struck(60)).toBe(true);
    const faint = new KeyOnsets(BINS, BIN_HZ);
    for (let i = 0; i < 9; i++) faint.push(frame([]));
    faint.push(frame([60], 0.002));
    expect(faint.struck(60)).toBe(false);
  });
});
