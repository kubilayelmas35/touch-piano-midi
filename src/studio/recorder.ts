import type { PlayerInput } from "../engine/engine";
import type { RawNote } from "./midiFile";

/** A plucked string left ringing is cut off after this long in the recording unless it's damped earlier. */
export const RING_MAX = 2.5;
export const MAX_NOTES = 50000;

interface Open {
  midi: number;
  velocity: number;
  start: number;
}

/**
 * Turns the player's live input into notes. Times come from the caller (seconds), so it can be driven by
 * performance.now() in the app and by a fake clock in tests.
 */
export class Recorder {
  private held = new Map<string, Open>();
  private ringing = new Map<string, Open & { until: number }>();
  private pedaled: Open[] = [];
  private sustain = false;
  private done: RawNote[] = [];

  constructor(private readonly t0: number) {}

  get noteCount(): number {
    return this.done.length + this.held.size + this.ringing.size + this.pedaled.length;
  }

  private close(n: Open, end: number): void {
    if (this.done.length >= MAX_NOTES) return;
    const time = n.start - this.t0;
    this.done.push({ midi: n.midi, time, duration: Math.max(0.05, end - n.start), velocity: n.velocity });
  }

  input(e: PlayerInput, now: number): void {
    if (e.type === "on") {
      const prev = this.held.get(e.key);
      if (prev) this.close(prev, now);
      const ring = this.ringing.get(e.key);
      if (ring) {
        this.close(ring, Math.min(now, ring.until));
        this.ringing.delete(e.key);
      }
      this.held.set(e.key, { midi: e.midi, velocity: e.velocity, start: now });
    } else if (e.type === "off") {
      const n = this.held.get(e.key);
      if (!n) return;
      this.held.delete(e.key);
      if (e.ring) this.ringing.set(e.key, { ...n, until: now + RING_MAX });
      else if (this.sustain) this.pedaled.push(n);
      else this.close(n, now);
    } else if (e.type === "mute") {
      const n = this.ringing.get(e.key);
      if (!n) return;
      this.ringing.delete(e.key);
      this.close(n, Math.min(now, n.until));
    } else {
      this.sustain = e.on;
      if (!e.on) {
        for (const n of this.pedaled) this.close(n, now);
        this.pedaled = [];
      }
    }
  }

  /** Ends every sounding note and returns the take, shifted so the first note starts at 0. */
  finish(now: number): RawNote[] {
    for (const n of this.held.values()) this.close(n, now);
    for (const n of this.ringing.values()) this.close(n, Math.min(now, n.until));
    for (const n of this.pedaled) this.close(n, now);
    this.held.clear();
    this.ringing.clear();
    this.pedaled = [];
    const notes = this.done.sort((a, b) => a.time - b.time || a.midi - b.midi);
    const first = notes.length ? notes[0].time : 0;
    return notes.map((n) => ({ ...n, time: n.time - first }));
  }
}
