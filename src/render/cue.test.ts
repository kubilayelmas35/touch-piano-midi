import { describe, expect, it } from "vitest";
import { cueProgress, cueSwatch } from "./cue";
import { lampSpot } from "./keyLamp";

describe("cueProgress", () => {
  it("loads as the note approaches and flashes in the press window", () => {
    expect(cueProgress(2, 4, 1, 0.12)).toBeNull();
    const far = cueProgress(0.9, 4, 1, 0.12);
    const near = cueProgress(0.02, 4, 1, 0.12);
    expect(far && far.p).toBeGreaterThan(0);
    expect(far?.flash).toBe(false);
    expect(near?.flash).toBe(true);
    expect(near?.p).toBeGreaterThan(0.95);
  });

  it("names the preset colours", () => {
    expect(cueSwatch("gold")).toBe("#f5c451");
    expect(cueSwatch("custom", "#112233")).toBe("#112233");
  });
});

describe("lampSpot", () => {
  it("keeps a full-width row on the key and can shrink it toward the middle", () => {
    expect(lampSpot({ x: 100, w: 40 }, 0, 1000, 1, 0)).toEqual({ x: 100, w: 40 });
    const shrunk = lampSpot({ x: 100, w: 40 }, 0, 1000, 0.5, 0);
    expect(shrunk.w).toBe(20);
    expect(shrunk.x).toBeGreaterThan(100);
  });
});
