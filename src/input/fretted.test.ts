import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const held = new Set<string>();
  const ringing = new Set<string>();
  const levels = new Map<string, number>();
  return {
    held,
    ringing,
    levels,
    engine: {
      config: { instrument: "guitar" as "guitar" | "violin", timingWindowMs: 150, speed: 1 },
      fretSpec: { tuning: [40, 45, 50, 55, 59, 64], maxFret: 19, labels: [] },
      time: 0,
      notes: [],
      waiting: false,
      visibleRange: () => [0, 0],
      press: (key: string) => {
        held.add(key);
        ringing.delete(key);
        levels.set(key, 1);
      },
      release: (key: string, ring: boolean) => {
        held.delete(key);
        if (ring) ringing.add(key);
      },
      mute: (key: string) => {
        ringing.delete(key);
        levels.delete(key);
      },
      setLevel: (key: string, level: number) => levels.set(key, level),
      isHeld: (key: string) => held.has(key),
      isRinging: (key: string) => ringing.has(key),
      bend: () => {},
    },
  };
});

vi.mock("../engine/engine", () => ({ engine: fake.engine }));
vi.mock("./glide", () => ({ glider: { touch: () => {}, end: () => {}, has: () => false, clear: () => {}, move: () => {}, start: () => {} } }));

import { fretted } from "./fretted";

const KEY = "str:1";
let now = 0;

/** Advances the string physics in 16 ms frames, calling `each` before every frame; returns the levels seen. */
function run(ms: number, each?: (frame: number) => void): number[] {
  const out: number[] = [];
  for (let i = 0; i < ms / 16; i++) {
    now += 16;
    each?.(i);
    fretted.tick(now);
    out.push(fake.levels.get(KEY) ?? 0);
  }
  return out;
}

/** Back-and-forth motion, 4 strokes a second; the finger rests ~80 ms at every turnaround, sending no moves. */
const backAndForth = (frame: number) => {
  const phase = (frame * 16) % 250;
  if (phase >= 80) fretted.stroke("p", 0.3 + 0.5 * Math.sin(((phase - 80) / 170) * Math.PI));
};

/** Seconds a string keeps sounding after it is let go. */
function ringSeconds(): number {
  let ms = 0;
  while (fake.ringing.has(KEY) && ms < 20000) {
    run(16);
    ms += 16;
  }
  return ms / 1000;
}

beforeEach(() => {
  fretted.reset();
  fake.held.clear();
  fake.ringing.clear();
  fake.levels.clear();
  fake.engine.config.instrument = "guitar";
  fretted.sustain = 0.55;
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  fretted.tick(now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fretted string physics", () => {
  it("keeps a scrubbed guitar string steady instead of pumping at every turnaround", () => {
    fretted.strikeSync("p", [1], 0.8);
    const levels = run(2000, backAndForth).slice(20);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(0.03);
  });

  it("keeps a bowed violin string steady through bow changes", () => {
    fake.engine.config.instrument = "violin";
    fretted.strikeSync("p", [1], 0.8);
    const levels = run(2000, backAndForth).slice(40);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(0.1);
  });

  it("lets a plucked guitar string ring for several seconds, longer with the sustain setting", () => {
    const ring = (sustain: number) => {
      fretted.reset();
      fretted.sustain = sustain;
      fretted.strikeSync("p", [1], 0.8);
      fretted.strikeEnd("p");
      return ringSeconds();
    };
    const short = ring(0);
    const normal = ring(0.55);
    const long = ring(1);
    expect(normal).toBeGreaterThan(4);
    expect(short).toBeLessThan(normal);
    expect(long).toBeGreaterThan(normal * 1.8);
  });

  it("damps a string at once with the sustain setting at 0", () => {
    fretted.sustain = 0;
    fretted.strikeSync("p", [1], 1);
    fretted.strikeEnd("p");
    expect(ringSeconds()).toBeLessThan(0.25);
    fake.engine.config.instrument = "violin";
    fretted.reset();
    fretted.strikeSync("p", [1], 1);
    run(500, () => fretted.stroke("p", 1));
    fretted.strikeEnd("p");
    expect(ringSeconds()).toBeLessThan(0.25);
  });

  it("rings longer after a harder pluck", () => {
    const ring = (velocity: number) => {
      fretted.reset();
      fretted.strikeSync("p", [1], velocity);
      fretted.strikeEnd("p");
      return ringSeconds();
    };
    expect(ring(1)).toBeGreaterThan(ring(0.45) * 1.2);
  });

  it("keeps a bowed violin string ringing for a while after the bow is lifted", () => {
    fake.engine.config.instrument = "violin";
    fretted.strikeSync("p", [1], 0.8);
    run(1000, backAndForth);
    fretted.strikeEnd("p");
    run(300);
    expect(fake.ringing.has(KEY)).toBe(true);
    expect(fake.levels.get(KEY)).toBeGreaterThan(0.2);
  });

  it("falls fully silent when a finger rests on the string without moving, and sounds again once it moves", () => {
    for (const instrument of ["guitar", "violin"] as const) {
      fretted.reset();
      fake.engine.config.instrument = instrument;
      fretted.strikeSync("p", [1], 0.8);
      run(1000, backAndForth);
      run(12000);
      expect(fake.held.has(KEY)).toBe(true);
      expect(fake.levels.get(KEY)).toBe(0);
      run(300, backAndForth);
      expect(fake.levels.get(KEY)).toBeGreaterThan(0.5);
    }
  });

  it("lets a held computer key play one bow stroke on violin and ring out on guitar, then fall silent", () => {
    for (const instrument of ["guitar", "violin"] as const) {
      fretted.reset();
      fake.engine.config.instrument = instrument;
      fretted.stringKeyDown("KeyA", 1);
      const early = run(1500);
      expect(early[early.length - 1]).toBeGreaterThan(0.25);
      run(14000);
      expect(fake.held.has(KEY)).toBe(true);
      expect(fake.levels.get(KEY)).toBe(0);
      fretted.stringKeyUp("KeyA");
    }
  });

  it("keeps a plucked or bowed string ringing when the finger leaves the fret", () => {
    const afterLift = (instrument: "guitar" | "violin") => {
      fretted.reset();
      fake.engine.config.instrument = instrument;
      fretted.fretKeyDown("KeyQ", 3);
      fretted.stringKeyDown("KeyA", 1);
      run(300);
      fretted.stringKeyUp("KeyA");
      fretted.fretKeyUp("KeyQ");
      run(200);
      return fake.ringing.has(KEY);
    };
    expect(afterLift("violin")).toBe(true);
    expect(afterLift("guitar")).toBe(true);
  });

  it("moves a still-vibrating violin string to the note of a finger pressed after the bow left it", () => {
    fake.engine.config.instrument = "violin";
    fretted.strikeSync("p", [1], 0.8);
    run(600, backAndForth);
    fretted.strikeEnd("p");
    run(100);
    expect(fake.ringing.has(KEY)).toBe(true);
    const press = vi.spyOn(fake.engine, "press");
    fretted.neckDown("n", 1, 4);
    expect(press).toHaveBeenCalledWith(KEY, 45 + 4, expect.any(Number), { string: 1, fret: 4 });
    expect(fake.ringing.has(KEY)).toBe(true);
    expect(fake.levels.get(KEY)).toBeGreaterThan(0.2);
    press.mockClear();
    fretted.neckUp("n");
    expect(press).toHaveBeenCalledWith(KEY, 45, expect.any(Number), { string: 1, fret: 0 });
  });

  it("lets a violin string ring on after a strong bow stroke longer than after a gentle one", () => {
    fake.engine.config.instrument = "violin";
    const ring = (speed: number) => {
      fretted.reset();
      fretted.strikeSync("p", [1], 0.8);
      run(800, () => fretted.stroke("p", speed));
      fretted.strikeEnd("p");
      return ringSeconds();
    };
    const gentle = ring(0.15);
    const strong = ring(1);
    expect(gentle).toBeGreaterThan(0.3);
    expect(strong).toBeGreaterThan(gentle * 1.5);
  });
});
