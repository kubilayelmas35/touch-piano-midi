import { finalizeSong, parseMidi, type Beat, type Song, type SongNote, type SongTrack } from "./song";

/**
 * Tiny melody notation used for the bundled public-domain songs.
 * Tokens: `E4:1` (note:beats), `C3+E3+G3:2` (chord), `-:1` (rest). Beats are quarter notes.
 */
const PITCH = /^([A-G])(#|b)?(-?\d)$/;
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchToMidi(p: string): number {
  const m = PITCH.exec(p);
  if (!m) throw new Error(`Bad pitch ${p}`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + SEMI[m[1]] + acc;
}

function voice(src: string, track: number, spb: number, startBeat = 0, velocity = 0.75): SongNote[] {
  const out: SongNote[] = [];
  let beat = startBeat;
  for (const token of src.trim().split(/\s+/)) {
    if (token === "|") continue;
    const [pitches, durStr] = token.split(":");
    const dur = Number(durStr);
    if (!Number.isFinite(dur)) throw new Error(`Bad duration in ${token}`);
    if (pitches !== "-") {
      for (const p of pitches.split("+")) {
        out.push({
          midi: pitchToMidi(p),
          time: beat * spb,
          duration: dur * spb * 0.94,
          velocity,
          track,
        });
      }
    }
    beat += dur;
  }
  return out;
}

interface BuiltinSpec {
  id: string;
  title: string;
  composer: string;
  level: 1 | 2 | 3;
  bpm: number;
  /** Beats per measure and the beat length in quarter notes (0.5 for x/8). */
  meter: [number, number];
  pickup?: number;
  right: string;
  left?: string;
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
  const right = voice(spec.right, 0, spb, 0, 0.78);
  const left = spec.left ? voice(spec.left, 1, spb, spec.pickup ?? 0, 0.6) : [];
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
  const beats = makeBeats(totalQuarters, spb, spec.meter, spec.pickup ?? 0);
  return finalizeSong(spec.title, notes, tracks, beats, spec.bpm, spec.meter[0]);
}

const SPECS: BuiltinSpec[] = [
  {
    id: "twinkle",
    title: "Twinkle, Twinkle, Little Star",
    composer: "Traditional",
    level: 1,
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

export interface BuiltinInfo {
  id: string;
  title: string;
  composer: string;
  level: 1 | 2 | 3;
}

export const BUILTIN_SONGS: BuiltinInfo[] = [
  ...SPECS.map(({ id, title, composer, level }) => ({ id, title, composer, level })),
  { id: "bach-846", title: "Prelude in C major, BWV 846", composer: "J. S. Bach", level: 3 },
];

export function isBuiltin(id: string): boolean {
  return BUILTIN_SONGS.some((s) => s.id === id);
}

export async function loadBuiltin(id: string): Promise<Song> {
  const spec = SPECS.find((s) => s.id === id);
  if (spec) return build(spec);
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

export const __test = { voice, pitchToMidi, build, SPECS };
