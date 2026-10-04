import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as { key: string; pitch: number; settled: boolean }[]);

vi.mock("../engine/engine", () => ({
  engine: { glide: (key: string, pitch: number, settled: boolean) => calls.push({ key, pitch, settled }) },
}));

import { glider } from "./glide";
import { PianoLayout } from "../engine/layout";

let now = 0;
const run = (ms: number) => {
  for (let t = 0; t < ms; t += 16) {
    now += 16;
    glider.tick(now);
  }
};

beforeEach(() => {
  now = 1000;
  calls.length = 0;
  glider.clear();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  glider.tick(now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("glide", () => {
  it("follows the finger while moving, then settles on the nearest note", () => {
    glider.snap = true;
    glider.start("k", 60);
    glider.move("k", 61.4);
    run(32);
    expect(calls.at(-1)?.pitch).toBeCloseTo(61.4);
    expect(calls.at(-1)?.settled).toBe(false);
    run(600);
    expect(calls.at(-1)?.pitch).toBe(61);
    expect(calls.at(-1)?.settled).toBe(true);
  });

  it("free tuning keeps the exact pitch", () => {
    glider.snap = false;
    glider.start("k", 60.3);
    run(600);
    expect(calls.at(-1)?.pitch).toBeCloseTo(60.3);
    expect(calls.at(-1)?.settled).toBe(true);
    glider.snap = true;
  });

  it("piano pitch runs continuously across white and black keys", () => {
    const L = new PianoLayout(60, 72, 800);
    const c = L.lane(60)!;
    const d = L.lane(62)!;
    const cx = c.x + c.w / 2;
    const dx = d.x + d.w / 2;
    expect(L.pitchAt(cx)).toBeCloseTo(60);
    expect(L.pitchAt(dx)).toBeCloseTo(62);
    const mid = L.pitchAt((cx + dx) / 2);
    expect(mid).toBeGreaterThan(60.5);
    expect(mid).toBeLessThan(61.5);
  });
});
