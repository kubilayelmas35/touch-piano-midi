import { finalizeSong, parseMidi, type Beat, type Song, type SongNote, type SongTrack } from "./song";
import MUTOPIA_LIST from "./mutopia.json";
import { SONGBOOK } from "./songbook";

/**
 * Tiny melody notation used for the bundled public-domain songs.
 * Tokens: `E4:1` (note:beats), `C3+E3+G3:2` (chord), `-:1` (rest), `E4:1/3` (triplet). Beats are quarter notes.
 */
const PITCH = /^([A-G])(#|b)?(-?\d)$/;
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchToMidi(p: string): number {
  const m = PITCH.exec(p);
  if (!m) throw new Error(`Bad pitch ${p}`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + SEMI[m[1]] + acc;
}

function duration(s: string | undefined): number {
  const [a, b] = (s ?? "").split("/");
  return b === undefined ? Number(a) : Number(a) / Number(b);
}

/** Total length of a voice in quarter notes. */
function length(src: string): number {
  return src
    .trim()
    .split(/\s+/)
    .filter((t) => t && t !== "|")
    .reduce((sum, t) => sum + duration(t.split(":")[1]), 0);
}

/**
 * Spreads a held chord into a repeating figure (low–high, or Alberti low–high–mid–high for triads),
 * used to vary the accompaniment on repeated verses.
 */
function broken(midis: number[], dur: number, step: number): { midi: number; at: number; dur: number }[] {
  const sorted = [...midis].sort((a, b) => a - b);
  const figure = sorted.length >= 3 ? [sorted[0], sorted[sorted.length - 1], sorted[1], sorted[sorted.length - 1]] : sorted;
  const out: { midi: number; at: number; dur: number }[] = [];
  for (let at = 0, i = 0; at < dur - 1e-6; at += step, i++) {
    out.push({ midi: figure[i % figure.length], at, dur: Math.min(step, dur - at) });
  }
  return out;
}

function voice(src: string, track: number, spb: number, startBeat = 0, velocity = 0.75, brokenStep = 0): SongNote[] {
  const out: SongNote[] = [];
  let beat = startBeat;
  for (const token of src.trim().split(/\s+/)) {
    if (token === "|") continue;
    const [pitches, durStr] = token.split(":");
    const dur = duration(durStr);
    if (!Number.isFinite(dur)) throw new Error(`Bad duration in ${token}`);
    if (pitches !== "-") {
      const midis = pitches.split("+").map(pitchToMidi);
      const parts =
        brokenStep && midis.length >= 2 && dur >= brokenStep * 2
          ? broken(midis, dur, brokenStep)
          : midis.map((midi) => ({ midi, at: 0, dur }));
      for (const p of parts) {
        out.push({
          midi: p.midi,
          time: (beat + p.at) * spb,
          duration: p.dur * spb * 0.94,
          velocity,
          track,
        });
      }
    }
    beat += dur;
  }
  return out;
}

export type BuiltinCategory = "kids" | "classical" | "folk" | "holiday" | "study" | "ragtime" | "guitar";
export const BUILTIN_CATEGORIES: BuiltinCategory[] = ["kids", "folk", "holiday", "classical", "study", "ragtime", "guitar"];

export interface BuiltinSpec {
  id: string;
  title: string;
  /** Name the song is known by in Turkish, when different. */
  titleTr?: string;
  composer: string;
  level: 1 | 2 | 3;
  category: BuiltinCategory;
  bpm: number;
  /**
   * Beats per measure and the beat length in quarter notes (0.5 for x/8, 1.5 for compound 6/8).
   * Every line break or `|` is a bar line; the first right-hand bar holds just the pickup.
   */
  meter: [number, number];
  pickup?: number;
  right: string;
  left?: string;
  /** How many times the tune is played; by default enough verses (up to 3) to last about a minute. */
  verses?: number;
}

const TARGET_SECONDS = 60;
const MAX_VERSES = 3;

function verseCount(spec: BuiltinSpec): number {
  if (spec.verses) return spec.verses;
  const seconds = (length(spec.right) * 60) / spec.bpm;
  return Math.max(1, Math.min(MAX_VERSES, Math.ceil(TARGET_SECONDS / seconds - 0.15)));
}

function makeBeats(totalQuarters: number, spb: number, meter: [number, number], pickup: number): Beat[] {
  const [perMeasure, unit] = meter;
  const beats: Beat[] = [];
  let measure = 0;
  let i = 0;
  for (let q = pickup; q <= totalQuarters + 0.001; q += unit) {
    beats.push({ time: q * spb, downbeat: i % perMeasure === 0, measure });
    i++;
    if (i % perMeasure === 0) measure++;
  }
  return beats;
}

function build(spec: BuiltinSpec): Song {
  const spb = 60 / spec.bpm;
  const pickup = spec.pickup ?? 0;
  const measure = spec.meter[0] * spec.meter[1];
  // Each verse starts on a bar line so the pickup of the next verse falls in the rest after the last note.
  const verseLen = Math.ceil(length(spec.right) / measure - 1e-6) * measure;
  const brokenStep = spec.bpm >= 100 ? 1 : 0.5;
  const right: SongNote[] = [];
  const left: SongNote[] = [];
  for (let v = 0, n = verseCount(spec); v < n; v++) {
    const start = v * verseLen;
    right.push(...voice(spec.right, 0, spb, start, 0.78));
    if (spec.left) left.push(...voice(spec.left, 1, spb, start + pickup, 0.6, v % 2 ? brokenStep : 0));
  }
  const notes = [...right, ...left];
  const range = (arr: SongNote[]) => ({
    low: Math.min(...arr.map((n) => n.midi)),
    high: Math.max(...arr.map((n) => n.midi)),
  });
  const tracks: SongTrack[] = [
    { index: 0, name: "Right hand", instrument: "piano", isDrum: false, noteCount: right.length, ...range(right) },
  ];
  if (left.length) {
    tracks.push({ index: 1, name: "Left hand", instrument: "piano", isDrum: false, noteCount: left.length, ...range(left) });
  }
  const totalQuarters = notes.reduce((m, n) => Math.max(m, (n.time + n.duration) / spb), 0);
  const beats = makeBeats(totalQuarters, spb, spec.meter, pickup);
  return finalizeSong(spec.title, notes, tracks, beats, spec.bpm, spec.meter[0]);
}

const SPECS: BuiltinSpec[] = [
  {
    id: "twinkle",
    title: "Twinkle, Twinkle, Little Star",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 96,
    meter: [4, 1],
    right: `C4:1 C4:1 G4:1 G4:1 | A4:1 A4:1 G4:2 | F4:1 F4:1 E4:1 E4:1 | D4:1 D4:1 C4:2
      G4:1 G4:1 F4:1 F4:1 | E4:1 E4:1 D4:2 | G4:1 G4:1 F4:1 F4:1 | E4:1 E4:1 D4:2
      C4:1 C4:1 G4:1 G4:1 | A4:1 A4:1 G4:2 | F4:1 F4:1 E4:1 E4:1 | D4:1 D4:1 C4:2`,
    left: `C3:4 | F3:2 C3:2 | F3:2 C3:2 | G2:2 C3:2
      C3:2 F3:2 | C3:2 G2:2 | C3:2 F3:2 | C3:2 G2:2
      C3:4 | F3:2 C3:2 | F3:2 C3:2 | G2:2 C3:2`,
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    composer: "L. van Beethoven",
    level: 1,
    category: "classical",
    bpm: 108,
    meter: [4, 1],
    right: `E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | E4:1.5 D4:0.5 D4:2
      E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | D4:1.5 C4:0.5 C4:2
      D4:1 D4:1 E4:1 C4:1 | D4:1 E4:0.5 F4:0.5 E4:1 C4:1 | D4:1 E4:0.5 F4:0.5 E4:1 D4:1 | C4:1 D4:1 G3:2
      E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | D4:1.5 C4:0.5 C4:2`,
    left: `C3+G3:4 | G2+G3:4 | C3+G3:4 | G2+G3:4
      C3+G3:4 | G2+G3:4 | C3+G3:4 | G2:2 C3:2
      G2+G3:4 | C3+G3:4 | G2+G3:4 | C3:2 G2:2
      C3+G3:4 | G2+G3:4 | C3+G3:4 | G2:2 C3+E3:2`,
  },
  {
    id: "jingle-bells",
    title: "Jingle Bells",
    composer: "J. L. Pierpont",
    level: 1,
    category: "holiday",
    bpm: 120,
    meter: [4, 1],
    right: `E4:1 E4:1 E4:2 | E4:1 E4:1 E4:2 | E4:1 G4:1 C4:1.5 D4:0.5 | E4:4
      F4:1 F4:1 F4:1.5 F4:0.5 | F4:1 E4:1 E4:1 E4:0.5 E4:0.5 | E4:1 D4:1 D4:1 E4:1 | D4:2 G4:2
      E4:1 E4:1 E4:2 | E4:1 E4:1 E4:2 | E4:1 G4:1 C4:1.5 D4:0.5 | E4:4
      F4:1 F4:1 F4:1.5 F4:0.5 | F4:1 E4:1 E4:1 E4:0.5 E4:0.5 | G4:1 G4:1 F4:1 D4:1 | C4:4`,
    left: `C3+G3:4 | C3+G3:4 | C3+G3:4 | C3+G3:4
      F2+C3:4 | C3+G3:4 | G2+D3:4 | G2+B2:4
      C3+G3:4 | C3+G3:4 | C3+G3:4 | C3+G3:4
      F2+C3:4 | C3+G3:4 | G2+D3:4 | C3+E3:4`,
  },
  {
    id: "minuet-g",
    title: "Minuet in G",
    composer: "C. Petzold",
    level: 2,
    category: "classical",
    bpm: 112,
    meter: [3, 1],
    right: `D5:1 G4:0.5 A4:0.5 B4:0.5 C5:0.5 | D5:1 G4:1 G4:1 | E5:1 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 | G5:1 G4:1 G4:1
      C5:1 D5:0.5 C5:0.5 B4:0.5 A4:0.5 | B4:1 C5:0.5 B4:0.5 A4:0.5 G4:0.5 | F#4:1 G4:0.5 A4:0.5 B4:0.5 G4:0.5 | A4:3
      D5:1 G4:0.5 A4:0.5 B4:0.5 C5:0.5 | D5:1 G4:1 G4:1 | E5:1 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 | G5:1 G4:1 G4:1
      C5:1 D5:0.5 C5:0.5 B4:0.5 A4:0.5 | B4:1 C5:0.5 B4:0.5 A4:0.5 G4:0.5 | A4:1 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 | G4:3`,
    left: `G3+B3:2 A3:1 | B3:3 | C4:3 | B3:3
      A3:3 | G3:3 | D4:1 B3:1 G3:1 | D4:1 D3:1 C4:1
      B3:2 A3:1 | G3:3 | C4:3 | B3:3
      A3:3 | G3:3 | D3:3 | G2:3`,
  },
  {
    id: "greensleeves",
    title: "Greensleeves",
    composer: "Traditional",
    level: 2,
    category: "folk",
    bpm: 132,
    meter: [3, 1],
    pickup: 1,
    right: `A4:1 | C5:2 D5:1 | E5:1.5 F5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1
      C5:2 A4:1 | A4:1.5 G#4:0.5 A4:1 | B4:2 G#4:1 | E4:2 A4:1
      C5:2 D5:1 | E5:1.5 F5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1
      C5:1.5 B4:0.5 A4:1 | G#4:1.5 F#4:0.5 G#4:1 | A4:3`,
    left: `A2+E3:3 | C3+G3:3 | G2+D3:3 | E2+B2:3
      A2+E3:3 | E2+B2:3 | E2+B2:3 | A2+E3:3
      A2+E3:3 | C3+G3:3 | G2+D3:3 | E2+B2:3
      A2+E3:3 | E2+B2:3 | A2+E3:3`,
  },
  {
    id: "fur-elise",
    title: "Für Elise (theme)",
    composer: "L. van Beethoven",
    level: 3,
    category: "classical",
    bpm: 66,
    meter: [3, 0.5],
    pickup: 0.5,
    right: `E5:0.25 D#5:0.25 | E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25
      A4:0.5 -:0.25 C4:0.25 E4:0.25 A4:0.25 | B4:0.5 -:0.25 E4:0.25 G#4:0.25 B4:0.25
      C5:0.5 -:0.25 E4:0.25 E5:0.25 D#5:0.25 | E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25
      A4:0.5 -:0.25 C4:0.25 E4:0.25 A4:0.25 | B4:0.5 -:0.25 E4:0.25 C5:0.25 B4:0.25
      A4:0.5 -:0.5 E5:0.25 D#5:0.25 | E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25
      A4:0.5 -:0.25 C4:0.25 E4:0.25 A4:0.25 | B4:0.5 -:0.25 E4:0.25 G#4:0.25 B4:0.25
      C5:0.5 -:0.25 E4:0.25 E5:0.25 D#5:0.25 | E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25
      A4:0.5 -:0.25 C4:0.25 E4:0.25 A4:0.25 | B4:0.5 -:0.25 E4:0.25 C5:0.25 B4:0.25 | A4:1.5`,
    left: `-:1.5
      A2:0.25 E3:0.25 A3:0.25 -:0.75 | E2:0.25 E3:0.25 G#3:0.25 -:0.75
      A2:0.25 E3:0.25 A3:0.25 -:0.75 | -:1.5
      A2:0.25 E3:0.25 A3:0.25 -:0.75 | E2:0.25 E3:0.25 G#3:0.25 -:0.75
      A2:0.25 E3:0.25 A3:0.25 -:0.75 | -:1.5
      A2:0.25 E3:0.25 A3:0.25 -:0.75 | E2:0.25 E3:0.25 G#3:0.25 -:0.75
      A2:0.25 E3:0.25 A3:0.25 -:0.75 | -:1.5
      A2:0.25 E3:0.25 A3:0.25 -:0.75 | E2:0.25 E3:0.25 G#3:0.25 -:0.75 | A2+E3:1.5`,
  },
];

SPECS.push(...SONGBOOK);

export interface BuiltinInfo {
  id: string;
  title: string;
  titleTr?: string;
  composer: string;
  level: 1 | 2 | 3;
  category: BuiltinCategory;
  /** Length in seconds at normal speed. */
  seconds: number;
  /** Notes per second (both hands), the finer difficulty measure within a level. */
  nps: number;
}

/** Song length without building it: last verse start plus the longer hand. */
function specSeconds(spec: BuiltinSpec): number {
  const measure = spec.meter[0] * spec.meter[1];
  const right = length(spec.right);
  const left = spec.left ? (spec.pickup ?? 0) + length(spec.left) : 0;
  const verseLen = Math.ceil(right / measure - 1e-6) * measure;
  return Math.round((((verseCount(spec) - 1) * verseLen + Math.max(right, left)) * 60) / spec.bpm);
}

/** Complete pieces shipped as unmodified Mutopia Project MIDI files (see tools/mutopia.mjs for the credits). */
const MUTOPIA = MUTOPIA_LIST as (Omit<BuiltinInfo, "nps"> & { m: number; notes: number })[];

const round2 = (v: number) => Math.round(v * 100) / 100;

export const BUILTIN_SONGS: BuiltinInfo[] = [
  ...SPECS.map((s) => {
    const seconds = specSeconds(s);
    const { id, title, titleTr, composer, level, category } = s;
    return { id, title, titleTr, composer, level, category, seconds, nps: round2(build(s).notes.length / Math.max(1, seconds)) };
  }),
  { id: "bach-846", title: "Prelude in C major, BWV 846", composer: "J. S. Bach", level: 3, category: "classical", seconds: 115, nps: round2(549 / 115) },
  ...MUTOPIA.map(({ id, title, titleTr, composer, level, category, seconds, notes }) => ({
    id,
    title,
    titleTr,
    composer,
    level,
    category,
    seconds,
    nps: round2(notes / Math.max(1, seconds)),
  })),
];

/** Easy → medium → hard as labelled, calmer pieces (fewer notes a second) first within a level. */
export function byDifficulty(a: BuiltinInfo, b: BuiltinInfo): number {
  return a.level - b.level || a.nps - b.nps;
}

/** Songs arranged in-app (melody in the right hand, simple left hand): the learning path's material. */
export function isArranged(id: string): boolean {
  return SPECS.some((s) => s.id === id);
}

export const BUILTIN_BY_DIFFICULTY: BuiltinInfo[] = [...BUILTIN_SONGS].sort(byDifficulty);

export function builtinTitle(id: string, lang: "tr" | "en"): string {
  const s = BUILTIN_SONGS.find((x) => x.id === id);
  if (!s) return id;
  return lang === "tr" && s.titleTr ? s.titleTr : s.title;
}

export function isBuiltin(id: string): boolean {
  return BUILTIN_SONGS.some((s) => s.id === id);
}

/** Names a file's tracks "Right hand" / "Left hand" by average pitch so the usual defaults apply. */
function nameHands(song: Song, title: string, guitar: boolean): Song {
  const pitched = song.tracks.filter((t) => !t.isDrum && t.noteCount > 0);
  const avg = new Map<number, number>();
  for (const t of pitched) {
    const own = song.notes.filter((n) => n.track === t.index);
    avg.set(t.index, own.reduce((s, n) => s + n.midi, 0) / Math.max(1, own.length));
  }
  const byPitch = [...pitched].sort((a, b) => avg.get(b.index)! - avg.get(a.index)!);
  const tracks = song.tracks.map((t) => {
    if (pitched.length === 1 && t === pitched[0]) return { ...t, name: guitar ? "Guitar" : "Melody" };
    if (pitched.length === 2) return { ...t, name: t === byPitch[0] ? "Right hand" : "Left hand" };
    return t;
  });
  return { ...song, title, tracks };
}

export async function loadBuiltin(id: string): Promise<Song> {
  const spec = SPECS.find((s) => s.id === id);
  if (spec) return build(spec);
  const piece = MUTOPIA.find((s) => s.id === id);
  if (piece) {
    const res = await fetch(`${import.meta.env.BASE_URL}songs/mutopia/${id}.mid`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return nameHands(parseMidi(await res.arrayBuffer(), piece.title), piece.title, piece.category === "guitar");
  }
  if (id === "bach-846") {
    const res = await fetch(`${import.meta.env.BASE_URL}songs/bach_846.mid`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const full = parseMidi(await res.arrayBuffer(), "Prelude in C major, BWV 846");
    // The file also contains the fugue (tracks "Fuga 1–4"); keep only the prelude's two hands.
    const kept = full.tracks.filter((t) => /piano (right|left)/i.test(t.name));
    const tracks = kept.map((t, i) => ({ ...t, index: i, name: /right/i.test(t.name) ? "Right hand" : "Left hand" }));
    const remap = new Map(kept.map((t, i) => [t.index, i]));
    const notes = full.notes.filter((n) => remap.has(n.track)).map((n) => ({ ...n, track: remap.get(n.track)! }));
    const end = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0) + 0.5;
    const beats = full.beats.filter((b) => b.time <= end);
    return finalizeSong("Prelude in C major, BWV 846", notes, tracks, beats, full.bpm, full.beatsPerMeasure);
  }
  throw new Error(`Unknown builtin ${id}`);
}

export const __test = { voice, pitchToMidi, build, duration, verseCount, nameHands, specSeconds, SPECS, MUTOPIA };
