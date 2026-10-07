import { describe, expect, it } from "vitest";
import { COVERED_GAP, FramePacer, IDLE_GAP } from "./pacer";

/** Drawn frames per second at a screen refresh rate and a minimum gap. */
function fps(hz: number, gap = 0, seconds = 3): number {
  const p = new FramePacer();
  let drawn = 0;
  const frames = hz * seconds;
  for (let i = 0; i < frames; i++) {
    const now = 1000 + (i * 1000) / hz;
    if (p.due(now, gap) && i >= hz) drawn++;
  }
  return drawn / (seconds - 1);
}

describe("FramePacer", () => {
  it("draws every frame on 60 and 90 Hz screens", () => {
    expect(fps(60)).toBe(60);
    expect(fps(90)).toBe(90);
  });

  it("draws every other frame on 120 and 144 Hz screens", () => {
    expect(fps(120)).toBe(60);
    expect(fps(144)).toBe(72);
  });

  it("slows down while idle, and further behind a dialog", () => {
    expect(fps(120, IDLE_GAP)).toBeGreaterThanOrEqual(29);
    expect(fps(120, IDLE_GAP)).toBeLessThanOrEqual(31);
    expect(fps(60, IDLE_GAP)).toBe(30);
    expect(fps(60, COVERED_GAP)).toBe(10);
  });

  it("draws at once when activity resumes after an idle stretch", () => {
    const p = new FramePacer();
    for (let i = 0; i < 60; i++) p.due(1000 + i * 16.7, COVERED_GAP);
    expect(p.due(1000 + 60 * 16.7 + 16.7, 0)).toBe(true);
  });
});
