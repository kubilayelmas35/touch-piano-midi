import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({
  currentTime: 0,
  played: [] as { midi: number; when?: number }[],
  stops: [] as { midi: number; release?: number }[],
  bends: [] as number[],
}));

vi.mock("../audio/context", () => ({
  getBus: () => ({ ctx: { currentTime: audio.currentTime } }),
  unlockAudio: async () => {},
}));
vi.mock("../audio/click", () => ({ scheduleClick: vi.fn() }));
vi.mock("../audio/sampler", () => ({
  isLoaded: () => true,
  loadInstrument: async () => {},
  playNote: (_id: string, midi: number, _vel: number, opts: { when?: number } = {}) => {
    audio.played.push({ midi, when: opts.when });
    const stop = (release?: number) => void audio.stops.push({ midi, release });
    const bend = (cents: number) => void audio.bends.push(cents);
    return { midi, done: false, stop, bend, kill: () => {}, setLevel: () => {} };
  },
}));

import { Engine } from "./engine";
import { NoteState } from "./types";
import { finalizeSong, type Song, type SongNote } from "../midi/song";

let now = 0;

function advance(sec: number, engine: Engine, step = 1 / 60): number {
  let t = engine.time;
  for (let s = 0; s < sec; s += step) {
    now += step * 1000;
    audio.currentTime += step;
    t = engine.frame();
  }
  return t;
}

/** One beat per second, melody C4 D4 E4 F4 G4 in track 0, bass C3 on beats 0 and 2 in track 1. */
function makeSong(): Song {
  const melody: SongNote[] = [60, 62, 64, 65, 67].map((midi, i) => ({ midi, time: i, duration: 0.9, velocity: 0.8, track: 0 }));
  const bass: SongNote[] = [0, 2].map((time) => ({ midi: 48, time, duration: 1.8, velocity: 0.7, track: 1 }));
  const beats = Array.from({ length: 6 }, (_, i) => ({ time: i, downbeat: i % 4 === 0, measure: Math.floor(i / 4) }));
  return finalizeSong(
    "test",
    [...melody, ...bass],
    [
      { index: 0, name: "Right hand", instrument: "piano", isDrum: false, noteCount: 5, low: 60, high: 67 },
      { index: 1, name: "Left hand", instrument: "piano", isDrum: false, noteCount: 2, low: 48, high: 48 },
    ],
    beats,
    60,
    4
  );
}

async function startEngine(cfg: Partial<Engine["config"]> = {}): Promise<Engine> {
  const engine = new Engine();
  engine.load(makeSong(), { playTracks: [0], countIn: false, ...cfg });
  await engine.play();
  return engine;
}

beforeEach(() => {
  now = 1000;
  audio.currentTime = 0;
  audio.played = [];
  audio.stops = [];
  audio.bends = [];
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("engine", () => {
  it("starts with a lead-in before the first note", async () => {
    const engine = await startEngine();
    expect(engine.startTime).toBeLessThan(0);
    expect(engine.time).toBeCloseTo(engine.startTime, 3);
  });

  it("scores an on-time press and misses unplayed notes", async () => {
    const engine = await startEngine();
    advance(-engine.startTime, engine);
    engine.press("k", 60);
    engine.release("k");
    expect(engine.stats.perfect).toBe(1);
    expect(engine.stats.score).toBeGreaterThan(0);
    advance(1.5, engine);
    expect(engine.notes[1].state).toBe(NoteState.Missed);
    expect(engine.stats.miss).toBe(1);
    expect(engine.stats.combo).toBe(0);
  });

  it("credits holding a long note, not just tapping it", async () => {
    const tapped = await startEngine();
    advance(-tapped.startTime, tapped);
    tapped.press("k", 60);
    tapped.release("k");
    advance(1, tapped);
    expect(tapped.stats.holdPossible).toBeGreaterThan(0);
    expect(tapped.stats.holdEarned).toBe(0);

    const held = await startEngine();
    advance(-held.startTime, held);
    held.press("k", 60);
    advance(1, held);
    held.release("k");
    expect(held.stats.holdEarned).toBeCloseTo(held.stats.holdPossible, 2);
    expect(held.stats.score).toBeGreaterThan(tapped.stats.score);
  });

  it("accepts a slightly late press and doesn't count a late retry as wrong", async () => {
    const engine = await startEngine();
    advance(-engine.startTime + 0.2, engine);
    engine.press("k", 60);
    expect(engine.notes[0].state).toBe(NoteState.Hit);
    advance(0.5, engine);
    expect(engine.notes[1].state).toBe(NoteState.Pending);
    advance(0.6, engine);
    expect(engine.notes[1].state).toBe(NoteState.Missed);
    engine.press("j", 62);
    expect(engine.stats.wrong).toBe(0);
  });

  it("picks a missed long note back up when caught in its tail", async () => {
    const engine = await startEngine();
    advance(-engine.startTime + 0.4, engine);
    expect(engine.notes[0].state).toBe(NoteState.Missed);
    const possible = engine.stats.holdPossible;
    const before = engine.stats.score;
    engine.press("k", 60);
    expect(engine.stats.wrong).toBe(0);
    expect(engine.notes[0].rejoined).toBe(true);
    expect(engine.notes[0].holding).toBe(true);
    advance(0.6, engine);
    engine.release("k");
    expect(engine.stats.score).toBeGreaterThan(before);
    expect(engine.stats.holdEarned).toBeGreaterThan(0);
    expect(engine.stats.holdEarned).toBeLessThan(possible * 0.7);
    expect(engine.stats.holdPossible).toBeCloseTo(possible, 5);
  });

  it("lands an early press that is held until the note arrives, tagged early", async () => {
    const engine = await startEngine();
    advance(-engine.startTime - 0.45, engine);
    engine.press("k", 60);
    expect(engine.notes[0].state).toBe(NoteState.Pending);
    expect(engine.stats.wrong).toBe(0);
    advance(0.4, engine);
    expect(engine.notes[0].state).toBe(NoteState.Hit);
    expect(engine.notes[0].judgement).toBe("good");
    expect(engine.fx[engine.fx.length - 1].timing).toBe("early");
    expect(engine.stats.wrong).toBe(0);
  });

  it("counts an early tap that was let go as a wrong note", async () => {
    const engine = await startEngine();
    advance(-engine.startTime - 0.45, engine);
    engine.press("k", 60);
    engine.release("k");
    advance(0.4, engine);
    expect(engine.stats.wrong).toBe(1);
    expect(engine.notes[0].state).toBe(NoteState.Pending);
  });

  it("tags off-beat hits as late", async () => {
    const engine = await startEngine();
    advance(-engine.startTime + 0.2, engine);
    engine.press("k", 60);
    expect(engine.fx[engine.fx.length - 1].timing).toBe("late");
  });

  it("counts a wrong key without consuming a note", async () => {
    const engine = await startEngine();
    advance(-engine.startTime, engine);
    engine.press("k", 61);
    expect(engine.stats.wrong).toBe(1);
    expect(engine.notes[0].state).toBe(NoteState.Pending);
  });

  it("plays accompaniment for tracks the player is not playing", async () => {
    const engine = await startEngine();
    advance(-engine.startTime + 0.1, engine);
    expect(audio.played.some((p) => p.midi === 48)).toBe(true);
    expect(audio.played.some((p) => p.midi === 60)).toBe(false);
  });

  it("wait mode freezes at the next note until it is played", async () => {
    const engine = await startEngine({ waitMode: true });
    advance(-engine.startTime + 2, engine);
    expect(engine.waiting).toBe(true);
    expect(engine.time).toBeCloseTo(0, 3);
    expect(engine.notes[0].state).toBe(NoteState.Pending);

    engine.press("k", 60);
    expect(engine.notes[0].state).toBe(NoteState.Hit);
    expect(engine.notes[0].judgement).toBe("perfect");
    const t = advance(0.5, engine);
    expect(engine.waiting).toBe(false);
    expect(t).toBeGreaterThan(0.4);
    advance(2, engine);
    expect(engine.waiting).toBe(true);
    expect(engine.time).toBeCloseTo(1, 3);
    expect(engine.stats.miss).toBe(0);
  });

  it("turning wait mode off mid-run resumes and marks the run as practice", async () => {
    const engine = await startEngine({ waitMode: true });
    advance(-engine.startTime + 1, engine);
    expect(engine.waiting).toBe(true);
    engine.configure({ waitMode: false });
    expect(engine.runDirty).toBe(true);
    const t = advance(0.5, engine);
    expect(engine.waiting).toBe(false);
    expect(t).toBeGreaterThan(0.4);
  });

  it("a segment end leaves out later notes and finishes the run there", async () => {
    const engine = await startEngine({ segmentEnd: 2.5 });
    expect(engine.notes.map((n) => n.midi)).toEqual([60, 62, 64]);
    expect(engine.stats.total).toBe(3);
    let done = false;
    engine.onComplete = () => (done = true);
    advance(3, engine);
    expect(done).toBe(false);
    advance(3, engine);
    expect(done).toBe(true);
    expect(engine.time).toBeLessThan(6);
    engine.configure({ segmentEnd: 0 });
    expect(engine.notes).toHaveLength(5);
  });

  it("A–B loop jumps back with a pre-roll and marks the run dirty", async () => {
    const engine = await startEngine({ loop: { a: 1, b: 3, enabled: true } });
    let maxT = -Infinity;
    for (let i = 0; i < 6 * 60; i++) maxT = Math.max(maxT, advance(1 / 60, engine));
    expect(maxT).toBeLessThan(3.05);
    expect(engine.time).toBeLessThan(3.05);
    expect(engine.runDirty).toBe(true);
    expect(engine.status).toBe("playing");
  });

  it("completes and reports results", async () => {
    const engine = await startEngine();
    const done = vi.fn();
    engine.onComplete = done;
    advance(-engine.startTime + 7, engine);
    expect(engine.status).toBe("complete");
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0].stats.miss).toBe(5);
    expect(done.mock.calls[0][0].dirty).toBe(false);
  });

  it("seeking marks a started run as dirty", async () => {
    const engine = await startEngine();
    advance(-engine.startTime + 0.01, engine);
    engine.press("k", 60);
    engine.seek(3);
    expect(engine.runDirty).toBe(true);
    expect(engine.notes[1].state).toBe(NoteState.Skipped);
    expect(engine.notes[3].state).toBe(NoteState.Pending);
  });

  it("speed scales song time", async () => {
    const engine = await startEngine({ speed: 0.5 });
    const t0 = engine.time;
    const t1 = advance(1, engine);
    expect(t1 - t0).toBeCloseTo(0.5, 1);
  });

  it("auto-play hits every note and never shows wrong presses", async () => {
    const engine = await startEngine({ autoPlay: true });
    advance(-engine.startTime + 5, engine);
    expect(engine.notes.every((n) => n.state === NoteState.Hit)).toBe(true);
    expect(audio.played.filter((p) => p.midi >= 60).length).toBe(5);
    expect(engine.fx.filter((f) => f.auto && f.judgement === "perfect").length).toBe(5);
  });

  it("piano pedal mode lets released keys fade slowly and damps them when struck again", async () => {
    const engine = new Engine();
    engine.press("k", 60);
    engine.release("k");
    expect(audio.stops.at(-1)?.release).toBeUndefined();

    engine.configure({ pianoPedal: true });
    engine.press("k", 60);
    engine.release("k");
    expect(audio.stops.at(-1)?.release).toBeGreaterThan(1);
    const before = audio.stops.length;
    engine.press("j", 60);
    expect(audio.stops.length).toBe(before + 1);
    expect(audio.stops.at(-1)?.release).toBeUndefined();
  });

  it("holds the sustain pedal while any source keeps it down", async () => {
    const engine = new Engine();
    engine.setSustain(true);
    engine.setSustain(true, "shift");
    engine.press("k", 60);
    engine.release("k");
    engine.setSustain(false, "shift");
    expect(audio.stops.length).toBe(0);
    engine.setSustain(false);
    expect(audio.stops.length).toBe(1);
  });

  it("glides to the next note without restriking and only judges where it settles", async () => {
    const engine = await startEngine();
    advance(-engine.startTime, engine);
    engine.press("k", 60);
    expect(engine.notes[0].state).toBe(NoteState.Hit);
    advance(1, engine);
    const struck = audio.played.length;
    engine.glide("k", 61);
    engine.glide("k", 61.6);
    expect(engine.stats.wrong).toBe(0);
    engine.glide("k", 62, true);
    expect(audio.bends.at(-1)).toBeCloseTo(200);
    expect(audio.played.length).toBe(struck);
    expect(engine.notes[1].state).toBe(NoteState.Hit);
    expect(engine.stats.wrong).toBe(0);
  });

  it("carries a long glide on from a fresh sample instead of bending one too far", async () => {
    const engine = new Engine();
    engine.press("k", 60);
    engine.glide("k", 70);
    expect(audio.played.at(-1)?.midi).toBe(70);
    expect(audio.bends.at(-1)).toBeCloseTo(0);
  });

  it("guitar mode assigns every note a string and fret", async () => {
    const engine = await startEngine({ instrument: "guitar" });
    expect(engine.notes.length).toBe(5);
    for (const n of engine.notes) {
      expect(n.string).toBeGreaterThanOrEqual(0);
      expect(n.fret).toBeGreaterThanOrEqual(0);
    }
  });
});
