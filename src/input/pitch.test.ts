import { describe, expect, it } from "vitest";
import { NoteTracker, decimate, detectPitch, hzToMidi, rmsOf, type TrackEvent } from "./pitch";

const SR = 24000;

function tone(hz: number, n = 1024, harmonics = 1, amp = 0.3, phase = 0): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let h = 1; h <= harmonics; h++) v += Math.sin((2 * Math.PI * hz * h * i) / SR + phase * h) / h;
    out[i] = v * amp;
  }
  return out;
}

const midiOf = (hz: number) => Math.round(hzToMidi(hz));

describe("pitch detection", () => {
  it("finds a pure tone", () => {
    const p = detectPitch(tone(440), SR)!;
    expect(Math.abs(p.hz - 440)).toBeLessThan(2);
    expect(p.clarity).toBeGreaterThan(0.95);
  });

  it("finds the fundamental of a harmonic-rich tone, not an overtone", () => {
    for (const hz of [82.4, 110, 196, 261.6, 659.3, 1046.5]) {
      expect(midiOf(detectPitch(tone(hz, 1024, 8), SR)!.hz)).toBe(midiOf(hz));
    }
  });

  it("finds a tone with a weak fundamental (like a low piano string)", () => {
    const n = 1024;
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const w = (2 * Math.PI * 130.8 * i) / SR;
      buf[i] = 0.05 * Math.sin(w) + 0.3 * Math.sin(2 * w) + 0.2 * Math.sin(3 * w) + 0.1 * Math.sin(4 * w);
    }
    expect(midiOf(detectPitch(buf, SR)!.hz)).toBe(48);
  });

  it("rejects noise", () => {
    let seed = 7;
    const buf = new Float32Array(1024).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.5);
    const p = detectPitch(buf, SR);
    expect(p === null || p.clarity < 0.8).toBe(true);
  });

  it("decimates and measures level", () => {
    const d = decimate(tone(440, 2048, 1, 0.3));
    expect(d.length).toBe(1024);
    expect(rmsOf(tone(440, 2048, 1, 0.3))).toBeCloseTo(0.3 / Math.SQRT2, 2);
  });
});

describe("note tracker", () => {
  const frame = (hz: number | null, rms = 0.1) => ({ rms, pitch: hz ? { hz, clarity: 0.97 } : null });
  const run = (tr: NoteTracker, frames: ReturnType<typeof frame>[]) => frames.flatMap((f) => tr.update(f));
  const ons = (ev: TrackEvent[]) => ev.filter((e) => e.type === "on").map((e) => (e as { midi: number }).midi);

  it("starts a note once the pitch is stable and ends it on silence", () => {
    const tr = new NoteTracker();
    const ev = run(tr, [frame(440), frame(440), frame(440), frame(null, 0), frame(null, 0), frame(null, 0)]);
    expect(ons(ev)).toEqual([69]);
    expect(ev[ev.length - 1].type).toBe("off");
    expect(tr.current).toBeNull();
  });

  it("ignores a one-frame glitch and follows a melody", () => {
    const tr = new NoteTracker();
    const ev = run(tr, [frame(440), frame(440), frame(880), frame(440), frame(494), frame(494), frame(523), frame(523)]);
    expect(ons(ev)).toEqual([69, 71, 72]);
  });

  it("re-strikes the same pitch when the level jumps after a dip", () => {
    const tr = new NoteTracker();
    const levels = [0.2, 0.2, 0.18, 0.15, 0.12, 0.09, 0.07, 0.2, 0.2];
    const ev = run(tr, levels.map((r) => frame(440, r)));
    expect(ons(ev)).toEqual([69, 69]);
  });

  it("does not re-strike while a note swells", () => {
    const tr = new NoteTracker();
    const ev = run(tr, [0.02, 0.04, 0.08, 0.12, 0.16, 0.2, 0.2, 0.19].map((r) => frame(440, r)));
    expect(ons(ev)).toEqual([69]);
  });
});
