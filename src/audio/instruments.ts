export const PIANO_SOUNDS = [
  "grand",
  "bright",
  "honky",
  "epiano",
  "epiano2",
  "harpsichord",
  "clavinet",
  "musicbox",
  "vibraphone",
  "organ",
  "church",
  "accordion",
] as const;
export const GUITAR_SOUNDS = [
  "steel",
  "nylon",
  "electric",
  "clean",
  "jazz",
  "muted",
  "distortion",
  "harmonics",
  "banjo",
  "sitar",
] as const;
export const VIOLIN_SOUNDS = [
  "classic",
  "electric",
  "fiddle",
  "viola",
  "cello",
  "tremolo",
  "ensemble",
  "synth",
] as const;

export type PianoSound = (typeof PIANO_SOUNDS)[number];
export type GuitarSound = (typeof GUITAR_SOUNDS)[number];
export type ViolinSound = (typeof VIOLIN_SOUNDS)[number];

export type InstrumentId =
  | "piano"
  | `piano-${Exclude<PianoSound, "grand">}`
  | `guitar-${GuitarSound}`
  | "violin"
  | `violin-${Exclude<ViolinSound, "classic">}`;

export interface InstrumentDef {
  id: InstrumentId;
  /** Folder under samples/ when the sound reuses another instrument's samples. */
  samples?: InstrumentId;
  /** General MIDI program written to exported MIDI files. */
  gm: number;
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
  /** Amp-style distortion: input boost into a soft clipper, a speaker-like lowpass (Hz), then the output level. */
  drive?: { boost: number; cutoff: number; level: number };
}

const range = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
};

const KEYS = range(21, 108, 3);
const STRINGS = range(40, 88);
const BOWED = range(55, 100);

/** Struck / plucked keyboard sounds: they ring while the key is held, like the piano. */
const keys = (id: InstrumentId, gm: number, gain: number): InstrumentDef => ({
  id,
  gm,
  notes: KEYS,
  gain,
  attack: 0.003,
  minRelease: 0.3,
  sustained: false,
  holdSustain: { dropDb: 12, slopeDb: 0, maxBoostDb: 18 },
  maxRing: 6,
  velocityTone: true,
});

/** Organs and reeds: a steady tone for as long as the key is down. */
const organ = (id: InstrumentId, gm: number, gain: number): InstrumentDef => ({
  id,
  gm,
  notes: KEYS,
  gain,
  attack: 0.01,
  minRelease: 0.12,
  sustained: true,
  loop: { start: 0.7, end: 2.7, crossfade: 0.35 },
  maxRing: 1,
  velocityTone: false,
});

const plucked = (
  id: InstrumentId,
  gm: number,
  gain: number,
  decay: number,
  velocityTone = true,
): InstrumentDef => ({
  id,
  gm,
  notes: STRINGS,
  gain,
  attack: 0.002,
  minRelease: 0.12,
  sustained: false,
  pluckSustain: { decay },
  maxRing: 6,
  velocityTone,
});

const bowed = (
  id: InstrumentId,
  gm: number,
  gain: number,
  attack = 0.06,
): InstrumentDef => ({
  id,
  gm,
  notes: BOWED,
  gain,
  attack,
  minRelease: 0.16,
  sustained: true,
  loop: { start: 0.7, end: 2.7, crossfade: 0.35 },
  maxRing: 1.2,
  velocityTone: false,
});

export const INSTRUMENTS: Record<InstrumentId, InstrumentDef> = {
  piano: {
    ...keys("piano", 0, 1.15),
    minRelease: 0.5,
    holdSustain: { dropDb: 12, slopeDb: 0, maxBoostDb: 24 },
    maxRing: 10,
  },
  "piano-bright": keys("piano-bright", 1, 4.2),
  "piano-honky": keys("piano-honky", 3, 3.9),
  "piano-epiano": keys("piano-epiano", 4, 2.0),
  "piano-epiano2": keys("piano-epiano2", 5, 3.7),
  "piano-harpsichord": keys("piano-harpsichord", 6, 4.1),
  "piano-clavinet": keys("piano-clavinet", 7, 4.1),
  "piano-musicbox": keys("piano-musicbox", 10, 4.5),
  "piano-vibraphone": keys("piano-vibraphone", 11, 3.8),
  "piano-organ": organ("piano-organ", 16, 1.9),
  "piano-church": organ("piano-church", 19, 1.25),
  "piano-accordion": organ("piano-accordion", 21, 3.4),
  "guitar-steel": plucked("guitar-steel", 25, 1.25, 1.1),
  "guitar-nylon": plucked("guitar-nylon", 24, 1.35, 1.3),
  "guitar-electric": {
    ...plucked("guitar-electric", 29, 0.55, 1.8, false),
    minRelease: 0.1,
  },
  "guitar-clean": plucked("guitar-clean", 27, 2.1, 1.4),
  "guitar-jazz": plucked("guitar-jazz", 26, 0.92, 1.0),
  "guitar-muted": plucked("guitar-muted", 28, 3.0, 0.35),
  "guitar-distortion": {
    ...plucked("guitar-distortion", 30, 0.8, 1.8, false),
    minRelease: 0.1,
  },
  "guitar-harmonics": plucked("guitar-harmonics", 31, 1.0, 1.6),
  "guitar-banjo": plucked("guitar-banjo", 105, 2.0, 0.5),
  "guitar-sitar": plucked("guitar-sitar", 104, 2.2, 1.6),
  violin: bowed("violin", 40, 1.0),
  "violin-electric": {
    ...bowed("violin-electric", 40, 1.0, 0.03),
    samples: "violin",
    drive: { boost: 60, cutoff: 4800, level: 0.02 },
  },
  "violin-fiddle": bowed("violin-fiddle", 110, 0.53, 0.04),
  "violin-viola": bowed("violin-viola", 41, 1.0),
  "violin-cello": bowed("violin-cello", 42, 0.7),
  "violin-tremolo": bowed("violin-tremolo", 44, 0.65),
  "violin-ensemble": bowed("violin-ensemble", 48, 0.36, 0.08),
  "violin-synth": bowed("violin-synth", 50, 0.8, 0.08),
};

export function sampleUrl(id: InstrumentId, midi: number): string {
  return `${import.meta.env.BASE_URL}samples/${INSTRUMENTS[id].samples ?? id}/${midi}.mp3`;
}

export interface SoundChoice {
  instrument: "piano" | "guitar" | "violin";
  pianoSound: PianoSound;
  guitarTone: GuitarSound;
  violinSound: ViolinSound;
}

/** The sampled sound the player hears for the chosen instrument. */
export function soundIdFor(s: SoundChoice): InstrumentId {
  if (s.instrument === "guitar") return `guitar-${s.guitarTone}`;
  if (s.instrument === "violin")
    return s.violinSound === "classic" ? "violin" : `violin-${s.violinSound}`;
  return s.pianoSound === "grand" ? "piano" : `piano-${s.pianoSound}`;
}

/** General MIDI program for a recording made with the chosen sound. */
export function soundProgram(s: SoundChoice): number {
  return INSTRUMENTS[soundIdFor(s)].gm;
}
