import { describe, expect, it } from "vitest";
import { pickVictim } from "./sampler";

describe("pickVictim", () => {
  it("cuts the note that finishes fading first", () => {
    const voices = [{ endsAt: Infinity }, { endsAt: 4.2 }, { endsAt: 1.5 }, { endsAt: Infinity }];
    expect(pickVictim(voices)).toBe(voices[2]);
  });

  it("cuts the oldest when every note is still held", () => {
    const voices = [{ endsAt: Infinity }, { endsAt: Infinity }];
    expect(pickVictim(voices)).toBe(voices[0]);
    expect(pickVictim([])).toBeNull();
  });
});
