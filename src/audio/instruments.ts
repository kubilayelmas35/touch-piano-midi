export type InstrumentId = "piano" | "guitar-steel" | "guitar-nylon" | "violin";

export interface InstrumentDef {
  id: InstrumentId;
  /** Sampled MIDI notes available under samples/<id>/<midi>.mp3 */
  notes: number[];
  /** Linear output gain. */
  gain: number;
  /** Attack fade-in seconds (avoids clicks; longer = softer bow). */
  attack: number;
  /** Minimum release seconds when a note is let go. */
  minRelease: number;
  /** Whether the sample sustains while held (looped). */
  sustained: boolean;
  /** Loop window inside the sample, seconds (only for sustained instruments). */
  loop?: { start: number; end: number; crossfade: number };
  /**
   * Plucked samples that should keep sounding while the player keeps the string moving: an early slice of
   * the decaying sample is levelled out and looped. Scheduled (autoplay) notes still decay with this time constant.
   */
  pluckSustain?: { decay: number };
  /**
   * Struck strings that keep ringing while the key is held: after decaying by `dropDb` the note only fades by
   * `slopeDb` a second, boosted by at most `maxBoostDb`.
   */
  holdSustain?: { dropDb: number; slopeDb: number; maxBoostDb: number };
  /** Natural decay is inside the sample; cap ring time after release. */
  maxRing: number;
  /** Whether velocity also darkens the tone (lowpass). */
  velocityTone: boolean;
}

const range = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
};

export const INSTRUMENTS: Record<InstrumentId, InstrumentDef> = {
  piano: {
    id: "piano",
    notes: range(21, 108, 3),
    gain: 1.15,
    attack: 0.003,
    minRelease: 0.5,
    sustained: false,
    holdSustain: { dropDb: 12, slopeDb: 0, maxBoostDb: 24 },
    maxRing: 10,
    velocityTone: true,
  },
  "guitar-steel": {
    id: "guitar-steel",
    notes: range(40, 88),
    gain: 1.25,
    attack: 0.002,
    minRelease: 0.12,
    sustained: false,
    pluckSustain: { decay: 1.1 },
    maxRing: 6,
    velocityTone: true,
  },
  "guitar-nylon": {
    id: "guitar-nylon",
    notes: range(40, 88),
    gain: 1.35,
    attack: 0.002,
    minRelease: 0.12,
    sustained: false,
    pluckSustain: { decay: 1.3 },
    maxRing: 6,
    velocityTone: true,
  },
  violin: {
    id: "violin",
    notes: range(55, 100),
    gain: 1.0,
    attack: 0.06,
    minRelease: 0.16,
    sustained: true,
    loop: { start: 0.7, end: 2.7, crossfade: 0.35 },
    maxRing: 1.2,
    velocityTone: false,
  },
};

export function sampleUrl(id: InstrumentId, midi: number): string {
  return `${import.meta.env.BASE_URL}samples/${id}/${midi}.mp3`;
}
