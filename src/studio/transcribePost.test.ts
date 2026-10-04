import { describe, expect, it } from "vitest";
import type { RawNote } from "./midiFile";
import { buildTranscription, estimateTempo, modelParams, quantize, titleFromFileName, type DetectedNote } from "./transcribePost";

/** Notes on every beat at `bpm` (accent on the downbeat) plus off-beat eighths, starting at `start`. */
function pattern(bpm: number, start: number, beats: number): RawNote[] {
  const p = 60 / bpm;
  const out: RawNote[] = [];
  for (let i = 0; i < beats; i++) {
    out.push({ midi: 60, time: start + i * p, duration: p * 0.9, velocity: i % 4 === 0 ? 1 : 0.7 });
    if (i % 2 === 1) out.push({ midi: 67, time: start + i * p + p / 2, duration: p * 0.4, velocity: 0.35 });
  }
  return out.sort((a, b) => a.time - b.time);
}

const detected = (notes: RawNote[], amplitude = 0.6): DetectedNote[] =>
  notes.map((n) => ({ startTimeSeconds: n.time, durationSeconds: n.duration, pitchMidi: n.midi, amplitude }));

describe("estimateTempo", () => {
  it.each([72, 100, 128])("finds %i BPM", (bpm) => {
    const r = estimateTempo(pattern(bpm, 0.8, 48));
    expect(Math.abs(r.bpm - bpm)).toBeLessThanOrEqual(1.5);
  });

  it("lands on the tempo or its half / double for fast music", () => {
    const r = estimateTempo(pattern(150, 0.8, 48));
    expect([150, 75].some((c) => Math.abs(r.bpm - c) <= 1.5)).toBe(true);
  });

  it("finds the first beat", () => {
    const r = estimateTempo(pattern(100, 1.37, 40));
    expect(r.firstBeat).toBeCloseTo(1.37, 1);
  });

  it("falls back to 120 BPM for a handful of notes", () => {
    expect(estimateTempo(pattern(90, 0.5, 3)).bpm).toBe(120);
  });
});

describe("quantize", () => {
  it("snaps starts and ends to the grid with at least one step", () => {
    const q = quantize([{ midi: 60, time: 0.26, duration: 0.02, velocity: 1 }, { midi: 62, time: 0.49, duration: 0.52, velocity: 1 }], 0.125);
    expect(q[0]).toMatchObject({ time: 0.25, duration: 0.125 });
    expect(q[1].time).toBeCloseTo(0.5);
    expect(q[1].duration).toBeCloseTo(0.5);
  });
});

describe("modelParams", () => {
  it("lowers thresholds as sensitivity rises", () => {
    const lo = modelParams({ sensitivity: 0, instrument: "piano", quantize: false });
    const hi = modelParams({ sensitivity: 1, instrument: "piano", quantize: false });
    expect(hi.onsetThresh).toBeLessThan(lo.onsetThresh);
    expect(hi.frameThresh).toBeLessThan(lo.frameThresh);
    expect(hi.minNoteLenFrames).toBeLessThan(lo.minNoteLenFrames);
  });

  it("limits the frequency range per instrument", () => {
    const g = modelParams({ sensitivity: 0.5, instrument: "guitar", quantize: false });
    const v = modelParams({ sensitivity: 0.5, instrument: "violin", quantize: false });
    expect(g.minFreq).toBeLessThan(v.minFreq);
    expect(g.maxFreq).toBeLessThan(4200);
  });
});

describe("buildTranscription", () => {
  const opts = { sensitivity: 0.5, instrument: "piano" as const, quantize: false };

  it("drops faint, tiny and out-of-range notes", () => {
    const d: DetectedNote[] = [
      { startTimeSeconds: 0, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.6 },
      { startTimeSeconds: 0.5, durationSeconds: 0.5, pitchMidi: 62, amplitude: 0.05 },
      { startTimeSeconds: 1, durationSeconds: 0.01, pitchMidi: 64, amplitude: 0.9 },
      { startTimeSeconds: 1.5, durationSeconds: 0.5, pitchMidi: 110, amplitude: 0.9 },
    ];
    const r = buildTranscription(d, opts);
    expect(r.noteCount).toBe(1);
    expect(r.tracks[0].notes[0].midi).toBe(60);
  });

  it("merges doubled onsets of the same pitch", () => {
    const d: DetectedNote[] = [
      { startTimeSeconds: 1, durationSeconds: 0.3, pitchMidi: 60, amplitude: 0.6 },
      { startTimeSeconds: 1.03, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.6 },
    ];
    const r = buildTranscription(d, opts);
    expect(r.noteCount).toBe(1);
    expect(r.tracks[0].notes[0].duration).toBeCloseTo(0.53);
  });

  it("splits piano into hands, starts near zero and reports tempo", () => {
    const right = pattern(100, 2, 32);
    const left = right.filter((_, i) => i % 3 === 0).map((n) => ({ ...n, midi: 43 }));
    const r = buildTranscription(detected([...right, ...left].sort((a, b) => a.time - b.time)), opts);
    expect(r.tracks.map((t) => t.name)).toEqual(["Right hand", "Left hand"]);
    expect(Math.abs(r.bpm - 100)).toBeLessThanOrEqual(1.5);
    const first = Math.min(...r.tracks.flatMap((t) => t.notes.map((n) => n.time)));
    expect(first).toBeLessThan(0.05);
    expect(r.duration).toBeGreaterThan(15);
  });

  it("keeps one track for guitar and violin and can quantize", () => {
    const notes = pattern(120, 0.5, 16).map((n, i) => ({ ...n, time: n.time + (i % 2 ? 0.02 : -0.02) }));
    const g = buildTranscription(detected(notes), { ...opts, instrument: "guitar", quantize: true });
    expect(g.tracks).toHaveLength(1);
    expect(g.tracks[0].name).toBe("Guitar");
    const step = 60 / g.bpm / 4;
    for (const n of g.tracks[0].notes) expect(Math.abs(n.time / step - Math.round(n.time / step))).toBeLessThan(1e-6);
    expect(buildTranscription(detected(notes), { ...opts, instrument: "violin" }).tracks[0].name).toBe("Melody");
  });
});

describe("titleFromFileName", () => {
  it("drops the extension and bracketed tags", () => {
    expect(titleFromFileName("Yılan Hikayesi - Piyano Tutorial [Dizi Müziği].mp3")).toBe("Yılan Hikayesi - Piyano Tutorial");
    expect(titleFromFileName("my_song (live).wav")).toBe("my song");
  });
});
