import type { BuiltinSpec } from "./builtin";

/**
 * Bundled songs, transcribed by hand from public-domain melodies (traditional tunes and composers who died more
 * than 70 years ago). Arrangements are simplified: melody in the right hand, plain chords or bass in the left.
 */

const rep = (s: string, n: number) => Array.from({ length: n }, () => s).join(" ");
/** Octave "oom-pah" bass: four low/high eighth pairs filling a 4/4 bar. */
const pump = (lo: string, hi: string) => rep(`${lo}:0.5 ${hi}:0.5`, 4);

const turca = `C5:0.5 -:0.5 D5:0.25 C5:0.25 B4:0.25 C5:0.25 | E5:0.5 -:0.5 F5:0.25 E5:0.25 D#5:0.25 E5:0.25
  B5:0.25 A5:0.25 G#5:0.25 A5:0.25 B5:0.25 A5:0.25 G#5:0.25 A5:0.25 | C6:1 A5:0.5 B5:0.5
  C6:0.5 B5:0.5 A5:0.5 G#5:0.5 | A5:0.5 E5:0.5 F5:0.5 D5:0.5 | C5:1 B4:1`;
const turcaLeft = `A2:0.5 C3+E3:0.5 A2:0.5 C3+E3:0.5 | A2:0.5 C3+E3:0.5 A2:0.5 C3+E3:0.5
  A2:0.5 C3+E3:0.5 A2:0.5 C3+E3:0.5 | A2:0.5 C3+E3:0.5 A2:0.5 C3+E3:0.5
  A2:0.5 C3+E3:0.5 E2:0.5 G#2+D3:0.5 | A2:0.5 C3+E3:0.5 D2:0.5 D3+F3:0.5 | E2:0.5 A2+C3:0.5 E2:0.5 G#2+D3:0.5`;

const korobeiniki = `E5:1 B4:0.5 C5:0.5 D5:1 C5:0.5 B4:0.5 | A4:1 A4:0.5 C5:0.5 E5:1 D5:0.5 C5:0.5 | B4:1.5 C5:0.5 D5:1 E5:1 | C5:1 A4:1 A4:2
  D5:1.5 F5:0.5 A5:1 G5:0.5 F5:0.5 | E5:1.5 C5:0.5 E5:1 D5:0.5 C5:0.5 | B4:1 B4:0.5 C5:0.5 D5:1 E5:1 | C5:1 A4:1 A4:2`;
const korobeinikiLeft = `${pump("E2", "E3")} | ${pump("A2", "A3")} | ${pump("E2", "E3")} | ${pump("A2", "A3")}
  ${pump("D2", "D3")} | ${pump("C2", "C3")} | ${pump("E2", "E3")} | ${pump("A2", "A3")}`;

const canonBass = "D3:2 A2:2 | B2:2 F#2:2 | G2:2 D2:2 | G2:2 A2:2";

const moon = (a: string, b: string, c: string) => rep(`${a}:1/3 ${b}:1/3 ${c}:1/3`, 2);

export const SONGBOOK: BuiltinSpec[] = [
  // ---------------------------------------------------------------- kids
  {
    id: "mary-lamb",
    title: "Mary Had a Little Lamb",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 100,
    meter: [4, 1],
    right: `E4:1 D4:1 C4:1 D4:1 | E4:1 E4:1 E4:2 | D4:1 D4:1 D4:2 | E4:1 G4:1 G4:2
      E4:1 D4:1 C4:1 D4:1 | E4:1 E4:1 E4:1 E4:1 | D4:1 D4:1 E4:1 D4:1 | C4:4`,
    left: `C3+G3:4 | C3+G3:4 | G2+G3:4 | C3+G3:4
      C3+G3:4 | C3+G3:4 | G2+G3:4 | C3+E3:4`,
  },
  {
    id: "row-boat",
    title: "Row, Row, Row Your Boat",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 100,
    meter: [2, 1.5],
    right: `C4:1.5 C4:1.5 | C4:1 D4:0.5 E4:1.5 | E4:1 D4:0.5 E4:1 F4:0.5 | G4:3
      C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 | E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 | G4:1 F4:0.5 E4:1 D4:0.5 | C4:3`,
    left: `C3+G3:3 | C3+G3:3 | C3+G3:3 | C3+E3:3
      C3+G3:3 | C3+G3:3 | G2+F3:3 | C3+E3:3`,
  },
  {
    id: "frere-jacques",
    title: "Frère Jacques",
    titleTr: "Tembel Çocuk",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 104,
    meter: [4, 1],
    right: `C4:1 D4:1 E4:1 C4:1 | C4:1 D4:1 E4:1 C4:1 | E4:1 F4:1 G4:2 | E4:1 F4:1 G4:2
      G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 C4:1 | G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 C4:1 | C4:1 G3:1 C4:2 | C4:1 G3:1 C4:2`,
    left: `C3:4 | C3:4 | C3:4 | C3:4
      C3:4 | C3:4 | C3:2 G2:2 | C3:2 G2:2`,
  },
  {
    id: "old-macdonald",
    title: "Old MacDonald Had a Farm",
    titleTr: "Ali Baba'nın Çiftliği",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 112,
    meter: [4, 1],
    right: `C4:1 C4:1 C4:1 G3:1 | A3:1 A3:1 G3:2 | E4:1 E4:1 D4:1 D4:1 | C4:3 G3:1
      C4:1 C4:1 C4:1 G3:1 | A3:1 A3:1 G3:2 | E4:1 E4:1 D4:1 D4:1 | C4:4
      G3:0.5 G3:0.5 C4:1 C4:1 C4:1 | G3:0.5 G3:0.5 C4:1 C4:1 C4:1 | C4:0.5 C4:0.5 C4:1 C4:0.5 C4:0.5 C4:1 | C4:0.5 C4:0.5 C4:0.5 C4:0.5 C4:1 C4:1
      C4:1 C4:1 C4:1 G3:1 | A3:1 A3:1 G3:2 | E4:1 E4:1 D4:1 D4:1 | C4:4`,
    left: `C3:4 | F2:2 C3:2 | G2:4 | C3:4
      C3:4 | F2:2 C3:2 | G2:4 | C3:4
      C3:4 | C3:4 | C3:4 | C3:4
      C3:4 | F2:2 C3:2 | G2:4 | C3:4`,
  },
  {
    id: "london-bridge",
    title: "London Bridge Is Falling Down",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 108,
    meter: [4, 1],
    right: `G4:1.5 A4:0.5 G4:1 F4:1 | E4:1 F4:1 G4:2 | D4:1 E4:1 F4:2 | E4:1 F4:1 G4:2
      G4:1.5 A4:0.5 G4:1 F4:1 | E4:1 F4:1 G4:2 | D4:2 G4:2 | E4:1 C4:3`,
    left: `C3+E3:4 | C3+E3:4 | G2+B2:4 | C3+E3:4
      C3+E3:4 | C3+E3:4 | G2+B2:4 | C3+E3:4`,
  },
  {
    id: "hot-cross-buns",
    title: "Hot Cross Buns",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 100,
    meter: [4, 1],
    right: `E4:1 D4:1 C4:2 | E4:1 D4:1 C4:2 | C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 | E4:1 D4:1 C4:2
      E4:1 D4:1 C4:2 | E4:1 D4:1 C4:2 | C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 | E4:1 D4:1 C4:2`,
    left: `C3:4 | C3:4 | C3:2 G2:2 | C3:4
      C3:4 | C3:4 | C3:2 G2:2 | C3:4`,
  },
  {
    id: "lightly-row",
    title: "Lightly Row (Hänschen klein)",
    titleTr: "Daha Dün Annemizin",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 112,
    meter: [4, 1],
    right: `G4:1 E4:1 E4:2 | F4:1 D4:1 D4:2 | C4:1 D4:1 E4:1 F4:1 | G4:1 G4:1 G4:2
      G4:1 E4:1 E4:2 | F4:1 D4:1 D4:2 | C4:1 E4:1 G4:1 G4:1 | C4:4
      D4:1 D4:1 D4:1 D4:1 | D4:1 E4:1 F4:2 | E4:1 E4:1 E4:1 E4:1 | E4:1 F4:1 G4:2
      G4:1 E4:1 E4:2 | F4:1 D4:1 D4:2 | C4:1 E4:1 G4:1 G4:1 | C4:4`,
    left: `C3+G3:4 | G2+G3:4 | C3+G3:4 | C3+E3:4
      C3+G3:4 | G2+G3:4 | C3+G3:4 | C3+E3:4
      G2+G3:4 | G2+G3:4 | C3+G3:4 | C3+G3:4
      C3+G3:4 | G2+G3:4 | C3+G3:4 | C3+E3:4`,
  },
  {
    id: "alle-meine-entchen",
    title: "Alle meine Entchen",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 104,
    meter: [4, 1],
    right: `C4:1 D4:1 E4:1 F4:1 | G4:2 G4:2 | A4:1 A4:1 A4:1 A4:1 | G4:4
      A4:1 A4:1 A4:1 A4:1 | G4:4 | F4:1 F4:1 F4:1 F4:1 | E4:2 E4:2
      D4:1 D4:1 D4:1 D4:1 | C4:4`,
    left: `C3:4 | C3+E3:4 | F2+C3:4 | C3+E3:4
      F2+C3:4 | C3+E3:4 | F2+C3:4 | C3+G3:4
      G2+B2:4 | C3+E3:4`,
  },
  {
    id: "au-clair-de-la-lune",
    title: "Au clair de la lune",
    composer: "Traditional",
    level: 1,
    category: "kids",
    bpm: 96,
    meter: [4, 1],
    right: `C4:1 C4:1 C4:1 D4:1 | E4:2 D4:2 | C4:1 E4:1 D4:1 D4:1 | C4:4
      C4:1 C4:1 C4:1 D4:1 | E4:2 D4:2 | C4:1 E4:1 D4:1 D4:1 | C4:4
      D4:1 D4:1 D4:1 D4:1 | A3:2 A3:2 | D4:1 C4:1 B3:1 A3:1 | G3:4
      C4:1 C4:1 C4:1 D4:1 | E4:2 D4:2 | C4:1 E4:1 D4:1 D4:1 | C4:4`,
    left: `C3:4 | C3:2 G2:2 | C3:2 G2:2 | C3:4
      C3:4 | C3:2 G2:2 | C3:2 G2:2 | C3:4
      G2+D3:4 | F2+C3:4 | G2+D3:4 | G2+B2:4
      C3:4 | C3:2 G2:2 | C3:2 G2:2 | C3:4`,
  },

  // ---------------------------------------------------------------- holiday & celebration
  {
    id: "happy-birthday",
    title: "Happy Birthday",
    titleTr: "İyi ki Doğdun",
    composer: "M. J. & P. S. Hill",
    level: 1,
    category: "holiday",
    bpm: 100,
    meter: [3, 1],
    pickup: 1,
    right: `G4:0.75 G4:0.25 | A4:1 G4:1 C5:1 | B4:2 G4:0.75 G4:0.25 | A4:1 G4:1 D5:1 | C5:2 G4:0.75 G4:0.25
      G5:1 E5:1 C5:1 | B4:1 A4:1 F5:0.75 F5:0.25 | E5:1 C5:1 D5:1 | C5:3`,
    left: `C3+G3:3 | G2+F3:3 | G2+F3:3 | C3+E3:3
      C3+G3:3 | F2+C3:3 | C3+G3:2 G2+F3:1 | C3+E3:3`,
  },
  {
    id: "merry-christmas",
    title: "We Wish You a Merry Christmas",
    composer: "Traditional",
    level: 2,
    category: "holiday",
    bpm: 144,
    meter: [3, 1],
    pickup: 1,
    right: `G4:1 | C5:1 C5:0.5 D5:0.5 C5:0.5 B4:0.5 | A4:1 F4:1 A4:1 | D5:1 D5:0.5 E5:0.5 D5:0.5 C5:0.5 | B4:1 G4:1 G4:1
      E5:1 E5:0.5 F5:0.5 E5:0.5 D5:0.5 | C5:1 A4:1 G4:0.5 G4:0.5 | A4:1 D5:1 B4:1 | C5:3`,
    left: `C3+G3:3 | F2+C3:3 | D3+F#3:3 | G2+D3:3
      A2+E3:3 | F2+C3:3 | G2+D3:3 | C3+G3:3`,
  },
  {
    id: "silent-night",
    title: "Silent Night",
    titleTr: "Sessiz Gece",
    composer: "F. X. Gruber",
    level: 2,
    category: "holiday",
    bpm: 78,
    meter: [2, 1.5],
    right: `G4:1.5 A4:0.5 G4:1 | E4:3 | G4:1.5 A4:0.5 G4:1 | E4:3
      D5:2 D5:1 | B4:3 | C5:2 C5:1 | G4:3
      A4:2 A4:1 | C5:1.5 B4:0.5 A4:1 | G4:1.5 A4:0.5 G4:1 | E4:3
      A4:2 A4:1 | C5:1.5 B4:0.5 A4:1 | G4:1.5 A4:0.5 G4:1 | E4:3
      D5:2 D5:1 | F5:1.5 D5:0.5 B4:1 | C5:3 | E5:3
      C5:1 G4:1 E4:1 | G4:1.5 F4:0.5 D4:1 | C4:3`,
    left: `C3+G3:3 | C3+G3:3 | C3+G3:3 | C3+G3:3
      G2+F3:3 | G2+F3:3 | C3+G3:3 | C3+G3:3
      F2+C3:3 | F2+C3:3 | C3+G3:3 | C3+G3:3
      F2+C3:3 | F2+C3:3 | C3+G3:3 | C3+G3:3
      G2+F3:3 | G2+F3:3 | C3+G3:3 | C3+G3:3
      C3+G3:3 | G2+F3:3 | C3+E3:3`,
  },
  {
    id: "deck-the-halls",
    title: "Deck the Halls",
    composer: "Traditional",
    level: 2,
    category: "holiday",
    bpm: 116,
    meter: [4, 1],
    right: `G4:1.5 F4:0.5 E4:1 D4:1 | C4:1 D4:1 E4:1 C4:1 | D4:0.5 E4:0.5 F4:0.5 D4:0.5 E4:1.5 D4:0.5 | C4:1 B3:1 C4:2
      G4:1.5 F4:0.5 E4:1 D4:1 | C4:1 D4:1 E4:1 C4:1 | D4:0.5 E4:0.5 F4:0.5 D4:0.5 E4:1.5 D4:0.5 | C4:1 B3:1 C4:2
      D4:1.5 E4:0.5 F4:1 D4:1 | E4:1.5 F4:0.5 G4:1 D4:1 | E4:0.5 F4:0.5 G4:1 A4:0.5 B4:0.5 C5:1 | B4:1 A4:1 G4:2
      G4:1.5 F4:0.5 E4:1 D4:1 | C4:1 D4:1 E4:1 C4:1 | A4:0.5 A4:0.5 A4:0.5 A4:0.5 G4:1.5 F4:0.5 | E4:1 D4:1 C4:2`,
    left: `C3+G3:4 | C3+G3:2 F2+C3:2 | G2+D3:4 | G2:2 C3:2
      C3+G3:4 | C3+G3:2 F2+C3:2 | G2+D3:4 | G2:2 C3:2
      G2+D3:4 | C3+G3:4 | C3+G3:2 F2+C3:2 | G2+D3:4
      C3+G3:4 | C3+G3:2 F2+C3:2 | F2+C3:2 G2+D3:2 | G2:2 C3:2`,
  },
  {
    id: "joy-to-the-world",
    title: "Joy to the World",
    composer: "G. F. Handel / L. Mason",
    level: 2,
    category: "holiday",
    bpm: 84,
    meter: [2, 1],
    right: `C5:1 B4:0.75 A4:0.25 | G4:1.5 F4:0.5 | E4:1 D4:1 | C4:1.5 G4:0.5
      A4:1.5 A4:0.5 | B4:1.5 B4:0.5 | C5:1.5 C5:0.5 | C5:0.5 B4:0.5 A4:0.5 G4:0.5
      G4:0.75 F4:0.25 E4:0.5 C5:0.5 | C5:0.5 B4:0.5 A4:0.5 G4:0.5 | G4:0.75 F4:0.25 E4:0.5 E4:0.5 | E4:0.5 E4:0.5 E4:0.5 E4:0.25 F4:0.25
      G4:1.5 F4:0.25 E4:0.25 | D4:0.5 D4:0.5 D4:0.5 D4:0.25 E4:0.25 | F4:1.5 E4:0.25 D4:0.25 | C4:0.5 C5:1 A4:0.5
      G4:0.75 F4:0.25 E4:0.5 F4:0.5 | E4:1 D4:1 | C4:2`,
    left: `C3+E3:2 | C3+E3:1 F2+C3:1 | C3+G3:1 G2+F3:1 | C3+E3:2
      F2+C3:2 | G2+D3:2 | C3+E3:2 | C3+E3:2
      C3+G3:2 | C3+E3:2 | C3+G3:2 | C3:2
      C3+E3:2 | G2+F3:2 | G2+D3:2 | C3+E3:1 F2+C3:1
      C3+G3:2 | G2+F3:2 | C3+E3:2`,
  },

  // ---------------------------------------------------------------- classical
  {
    id: "brahms-lullaby",
    title: "Lullaby (Wiegenlied)",
    titleTr: "Brahms Ninnisi",
    composer: "J. Brahms",
    level: 1,
    category: "classical",
    bpm: 84,
    meter: [3, 1],
    pickup: 1,
    right: `E4:0.5 E4:0.5 | G4:2 E4:0.5 E4:0.5 | G4:2 E4:0.5 G4:0.5 | C5:1 B4:1.5 A4:0.5 | A4:1 G4:1 D4:0.5 E4:0.5
      F4:1 D4:1 D4:0.5 E4:0.5 | F4:2 D4:0.5 F4:0.5 | B4:0.5 A4:0.5 G4:1 B4:1 | C5:2 C4:0.5 C4:0.5
      C5:2 A4:0.5 F4:0.5 | G4:2 E4:0.5 C4:0.5 | F4:1 G4:1 A4:1 | G4:2 C4:0.5 C4:0.5
      C5:2 A4:0.5 F4:0.5 | G4:2 E4:0.5 C4:0.5 | F4:1 E4:1 D4:1 | C4:3`,
    left: `C3+G3:3 | C3+G3:3 | G2+F3:3 | G2+F3:3
      G2+F3:3 | G2+F3:3 | G2+F3:3 | C3+G3:3
      F2+C3:3 | C3+G3:3 | F2+C3:3 | C3+G3:3
      F2+C3:3 | C3+G3:3 | G2+F3:3 | C3+E3:3`,
  },
  {
    id: "canon-in-d",
    title: "Canon in D (simplified)",
    composer: "J. Pachelbel",
    level: 2,
    category: "classical",
    bpm: 84,
    meter: [4, 1],
    right: `F#5:2 E5:2 | D5:2 C#5:2 | B4:2 A4:2 | B4:2 C#5:2
      D5:2 C#5:2 | B4:2 A4:2 | G4:2 F#4:2 | G4:2 E4:2
      D4:1 F#4:1 A4:1 G4:1 | F#4:1 D4:1 F#4:1 E4:1 | D4:1 B3:1 D4:1 A4:1 | G4:1 B4:1 A4:1 G4:1
      D5:0.5 C#5:0.5 D5:0.5 D4:0.5 C#4:0.5 A4:0.5 E4:0.5 F#4:0.5 | D4:0.5 D5:0.5 C#5:0.5 B4:0.5 C#5:0.5 F#5:0.5 A5:0.5 B5:0.5
      G5:0.5 F#5:0.5 E5:0.5 G5:0.5 F#5:0.5 E5:0.5 D5:0.5 C#5:0.5 | B4:0.5 A4:0.5 G4:0.5 F#4:0.5 E4:0.5 G4:0.5 F#4:0.5 E4:0.5
      D4+F#4+A4+D5:4`,
    left: `${canonBass}
      ${canonBass}
      ${canonBass}
      ${canonBass}
      D2+A2:4`,
  },
  {
    id: "eine-kleine-nachtmusik",
    title: "Eine kleine Nachtmusik (theme)",
    composer: "W. A. Mozart",
    level: 2,
    category: "classical",
    bpm: 132,
    meter: [4, 1],
    right: `G4:1 -:0.5 D4:0.5 G4:1 -:0.5 D4:0.5 | G4:0.5 D4:0.5 G4:0.5 B4:0.5 D5:1 -:1
      C5:1 -:0.5 A4:0.5 C5:1 -:0.5 A4:0.5 | C5:0.5 A4:0.5 F#4:0.5 A4:0.5 D4:1 -:1
      G4:1 G4:0.75 B4:0.25 A4:0.75 G4:0.25 G4:0.75 F#4:0.25 | F#4:1 F#4:0.75 A4:0.25 C5:0.75 F#4:0.25 A4:0.75 G4:0.25
      G4:1 G4:0.75 B4:0.25 A4:0.75 G4:0.25 G4:0.75 F#4:0.25 | F#4:1 F#4:0.75 A4:0.25 C5:0.75 F#4:0.25 A4:0.75 G4:0.25
      G4:2 -:2`,
    left: `G2:1 -:0.5 D2:0.5 G2:1 -:0.5 D2:0.5 | G2:0.5 D2:0.5 G2:0.5 B2:0.5 D3:1 -:1
      C3:1 -:0.5 A2:0.5 C3:1 -:0.5 A2:0.5 | C3:0.5 A2:0.5 F#2:0.5 A2:0.5 D2:1 -:1
      G2+D3:2 G2+B2:1 D2+C3:1 | D2+C3:2 D2+A2:2
      G2+D3:2 G2+B2:1 D2+C3:1 | D2+C3:2 D2+A2:2
      G2+G3:2 -:2`,
  },
  {
    id: "rondo-alla-turca",
    title: "Rondo alla Turca (theme)",
    titleTr: "Türk Marşı",
    composer: "W. A. Mozart",
    level: 3,
    category: "classical",
    bpm: 120,
    meter: [2, 1],
    pickup: 1,
    right: `B4:0.25 A4:0.25 G#4:0.25 A4:0.25
      ${turca} | A4:1 B4:0.25 A4:0.25 G#4:0.25 A4:0.25
      ${turca} | A4:2`,
    left: `${turcaLeft} | A2+E3:1 -:1
      ${turcaLeft} | A2+E3:2`,
  },
  {
    id: "mountain-king",
    title: "In the Hall of the Mountain King",
    titleTr: "Dağ Kralının Sarayında",
    composer: "E. Grieg",
    level: 2,
    category: "classical",
    bpm: 132,
    meter: [4, 1],
    right: `B3:0.5 C#4:0.5 D4:0.5 E4:0.5 F#4:0.5 D4:0.5 F#4:1 | F4:0.5 C#4:0.5 F4:1 E4:0.5 C4:0.5 E4:1
      B3:0.5 C#4:0.5 D4:0.5 E4:0.5 F#4:0.5 D4:0.5 F#4:0.5 B4:0.5 | A4:0.5 F#4:0.5 D4:0.5 F#4:0.5 A4:2
      F#4:0.5 G#4:0.5 A#4:0.5 B4:0.5 C#5:0.5 A#4:0.5 C#5:1 | D5:0.5 A#4:0.5 D5:1 C#5:0.5 A#4:0.5 C#5:1
      F#4:0.5 G#4:0.5 A#4:0.5 B4:0.5 C#5:0.5 A#4:0.5 C#5:1 | D5:0.5 A#4:0.5 D5:1 C#5:2
      B3:0.5 C#4:0.5 D4:0.5 E4:0.5 F#4:0.5 D4:0.5 F#4:1 | F4:0.5 C#4:0.5 F4:1 E4:0.5 C4:0.5 E4:1
      B3:0.5 C#4:0.5 D4:0.5 E4:0.5 F#4:0.5 D4:0.5 F#4:0.5 B4:0.5 | A4:0.5 F#4:0.5 D4:0.5 F#4:0.5 B4:2`,
    left: `B2:1 F#2:1 B2:1 F#2:1 | C#3:1 G#2:1 C3:1 G2:1
      B2:1 F#2:1 B2:1 F#2:1 | D3:1 A2:1 D3:2
      F#2:1 C#3:1 F#2:1 C#3:1 | F#2:1 C#3:1 F#2:1 C#3:1
      F#2:1 C#3:1 F#2:1 C#3:1 | F#2:1 C#3:1 F#2:2
      B2:1 F#2:1 B2:1 F#2:1 | C#3:1 G#2:1 C3:1 G2:1
      B2:1 F#2:1 B2:1 F#2:1 | D3:1 F#2:1 B2:2`,
  },
  {
    id: "morning-mood",
    title: "Morning Mood",
    titleTr: "Sabah",
    composer: "E. Grieg",
    level: 2,
    category: "classical",
    bpm: 96,
    meter: [2, 1.5],
    right: `G4:0.75 E4:0.25 D4:0.5 C4:0.5 D4:0.5 E4:0.5 | G4:0.75 E4:0.25 D4:0.5 C4:0.5 D4:0.5 E4:0.5
      D4:0.5 E4:0.5 G4:0.5 E4:0.5 G4:0.5 A4:0.5 | E4:0.5 A4:0.5 G4:0.5 E4:0.5 D4:0.5 C4:0.5
      G4:0.75 E4:0.25 D4:0.5 C4:0.5 D4:0.5 E4:0.5 | G4:0.75 E4:0.25 D4:0.5 C4:0.5 D4:0.5 E4:0.5
      D4:0.5 E4:0.5 G4:0.5 E4:0.5 G4:0.5 A4:0.5 | E4:0.5 A4:0.5 G4:0.5 E4:0.5 D4:0.5 C4:0.5
      C4:3`,
    left: `C3+G3:3 | C3+G3:3
      C3+G3:3 | A2+E3:1.5 C3+G3:1.5
      C3+G3:3 | C3+G3:3
      C3+G3:3 | A2+E3:1.5 C3+G3:1.5
      C3+E3+G3:3`,
  },
  {
    id: "largo-new-world",
    title: "Largo, New World Symphony (theme)",
    composer: "A. Dvořák",
    level: 1,
    category: "classical",
    bpm: 60,
    meter: [4, 1],
    right: `E4:1.5 G4:0.5 G4:2 | E4:1.5 D4:0.5 C4:2 | D4:1 E4:1 G4:1 E4:1 | D4:4
      E4:1.5 G4:0.5 G4:2 | E4:1.5 D4:0.5 C4:2 | D4:1 E4:1 D4:1 C4:1 | C4:4`,
    left: `C3+G3:4 | A2+E3:2 F2+C3:2 | G2+D3:4 | G2+B2:4
      C3+G3:4 | A2+E3:2 F2+C3:2 | G2+D3:2 G2+F3:2 | C3+E3:4`,
  },
  {
    id: "vivaldi-spring",
    title: "Spring, The Four Seasons (theme)",
    titleTr: "İlkbahar",
    composer: "A. Vivaldi",
    level: 2,
    category: "classical",
    bpm: 100,
    meter: [4, 1],
    right: `E4:0.5 G#4:0.5 G#4:0.5 G#4:0.5 F#4:0.25 E4:0.25 B4:1.5 | B4:0.25 A4:0.25 G#4:0.5 G#4:0.5 G#4:0.5 F#4:0.25 E4:0.25 B4:1.5
      B4:0.25 A4:0.25 G#4:0.5 A4:0.5 B4:0.5 A4:1 F#4:1
      E4:0.5 G#4:0.5 G#4:0.5 G#4:0.5 F#4:0.25 E4:0.25 B4:1.5 | B4:0.25 A4:0.25 G#4:0.5 G#4:0.5 G#4:0.5 F#4:0.25 E4:0.25 B4:1.5
      B4:0.25 A4:0.25 G#4:0.5 A4:0.5 B4:0.5 A4:0.5 F#4:0.5 E4:1`,
    left: `E2+B2:4 | E2+B2:4
      A2+E3:2 B2+F#3:2
      E2+B2:4 | E2+B2:4
      A2+E3:1 B2+F#3:1 E2+B2:2`,
  },
  {
    id: "moonlight-sonata",
    title: "Moonlight Sonata (opening)",
    titleTr: "Ay Işığı Sonatı",
    composer: "L. van Beethoven",
    level: 3,
    category: "classical",
    bpm: 56,
    meter: [4, 1],
    right: `${moon("G#3", "C#4", "E4")} ${moon("G#3", "C#4", "E4")} | ${moon("G#3", "C#4", "E4")} ${moon("G#3", "C#4", "E4")}
      ${moon("A3", "C#4", "E4")} ${moon("A3", "D4", "F#4")}
      G#3:1/3 B#3:1/3 F#4:1/3 G#3:1/3 C#4:1/3 E4:1/3 G#3:1/3 C#4:1/3 D#4:1/3 F#3:1/3 B#3:1/3 D#4:1/3
      ${moon("G#3", "C#4", "E4")} ${moon("G#3", "C#4", "E4")} | G#3+C#4+E4:4`,
    left: `C#2+C#3:4 | B1+B2:4
      A1+A2:2 F#1+F#2:2
      G#1+G#2:4
      C#2+C#3:4 | C#2+G#2:4`,
  },

  // ---------------------------------------------------------------- folk
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    composer: "Traditional",
    level: 1,
    category: "folk",
    bpm: 84,
    meter: [3, 1],
    pickup: 1,
    right: `G4:1 | C5:2 E5:0.5 C5:0.5 | E5:2 D5:1 | C5:2 A4:1 | G4:2 G4:1
      C5:2 E5:0.5 C5:0.5 | E5:2 D5:1 | G5:3 | -:2 E5:1
      G5:2 E5:0.5 C5:0.5 | E5:2 D5:1 | C5:2 A4:1 | G4:2 G4:1
      C5:2 E5:0.5 C5:0.5 | E5:2 D5:1 | C5:3`,
    left: `C3+G3:3 | C3+G3:3 | F2+C3:3 | C3+G3:3
      C3+G3:3 | C3+G3:2 G2+D3:1 | G2+D3:3 | G2+B2:3
      C3+G3:3 | C3+G3:3 | F2+C3:3 | C3+G3:3
      A2+E3:3 | G2+D3:3 | C3+E3:3`,
  },
  {
    id: "oh-susanna",
    title: "Oh! Susanna",
    composer: "S. Foster",
    level: 1,
    category: "folk",
    bpm: 120,
    meter: [4, 1],
    pickup: 1,
    right: `C4:0.5 D4:0.5 | E4:1 G4:1 G4:1.5 A4:0.5 | G4:1 E4:1 C4:1.5 D4:0.5 | E4:1 E4:1 D4:1 C4:1 | D4:3 C4:0.5 D4:0.5
      E4:1 G4:1 G4:1.5 A4:0.5 | G4:1 E4:1 C4:1.5 D4:0.5 | E4:1 E4:1 D4:1 D4:1 | C4:4
      F4:2 A4:2 | A4:1.5 G4:0.5 G4:1 E4:1 | C4:1 D4:2 C4:0.5 D4:0.5
      E4:1 G4:1 G4:1.5 A4:0.5 | G4:1 E4:1 C4:1.5 D4:0.5 | E4:1 E4:1 D4:1 D4:1 | C4:4`,
    left: `C3+G3:4 | C3+G3:4 | C3+G3:4 | G2+D3:4
      C3+G3:4 | C3+G3:4 | G2+D3:4 | C3+G3:4
      F2+C3:4 | C3+G3:4 | G2+D3:4
      C3+G3:4 | C3+G3:4 | G2+D3:4 | C3+E3:4`,
  },
  {
    id: "scarborough-fair",
    title: "Scarborough Fair",
    composer: "Traditional",
    level: 2,
    category: "folk",
    bpm: 108,
    meter: [3, 1],
    right: `D4:2 D4:1 | A4:2 A4:1 | E4:1.5 F4:0.5 E4:1 | D4:3
      -:1 A4:1 C5:1 | D5:2 C5:1 | A4:1 B4:1 G4:1 | A4:3
      -:1 D5:1 D5:1 | D5:2 C5:1 | A4:2 A4:1 | G4:1.5 F4:0.5 E4:1
      D4:1 A4:2 | G4:2 F4:1 | E4:1 D4:1 C4:1 | D4:3`,
    left: `D3+A3:3 | D3+A3:3 | C3+G3:3 | D3+A3:3
      D3+A3:3 | D3+A3:3 | G2+D3:3 | A2+E3:3
      D3+A3:3 | D3+A3:3 | F2+C3:3 | C3+G3:3
      D3+A3:3 | C3+G3:3 | C3+G3:3 | D3+A3:3`,
  },
  {
    id: "auld-lang-syne",
    title: "Auld Lang Syne",
    composer: "Traditional",
    level: 2,
    category: "folk",
    bpm: 92,
    meter: [4, 1],
    pickup: 1,
    right: `G3:1 | C4:1.5 C4:0.5 C4:1 E4:1 | D4:1.5 C4:0.5 D4:1 E4:0.5 D4:0.5 | C4:1.5 C4:0.5 E4:1 G4:1 | A4:3 A4:1
      G4:1.5 E4:0.5 E4:1 C4:1 | D4:1.5 C4:0.5 D4:1 E4:0.5 D4:0.5 | C4:1.5 A3:0.5 A3:1 G3:1 | C4:3 A4:1
      G4:1.5 E4:0.5 E4:1 C4:1 | D4:1.5 C4:0.5 D4:1 A4:1 | G4:1.5 E4:0.5 E4:1 G4:1 | A4:3 C5:1
      G4:1.5 E4:0.5 E4:1 C4:1 | D4:1.5 C4:0.5 D4:1 E4:0.5 D4:0.5 | C4:1.5 A3:0.5 A3:1 G3:1 | C4:4`,
    left: `C2+G2:4 | G2+D3:4 | C2+G2:4 | F2+C3:4
      C2+G2:4 | G2+D3:4 | F2+C3:2 G2+D3:2 | C2+G2:4
      C2+G2:4 | G2+D3:4 | C2+G2:4 | F2+C3:4
      C2+G2:4 | G2+D3:4 | F2+C3:2 G2+D3:2 | C2+G2+E3:4`,
  },
  {
    id: "when-the-saints",
    title: "When the Saints Go Marching In",
    composer: "Traditional",
    level: 1,
    category: "folk",
    bpm: 132,
    meter: [4, 1],
    pickup: 3,
    right: `C4:1 E4:1 F4:1 | G4:4 | -:1 C4:1 E4:1 F4:1 | G4:4 | -:1 C4:1 E4:1 F4:1
      G4:2 E4:2 | C4:2 E4:2 | D4:4 | -:1 E4:1 E4:1 D4:1
      C4:3 C4:1 | E4:2 G4:1 G4:1 | F4:4 | -:1 E4:1 F4:1 G4:1
      E4:2 C4:2 | D4:4 | C4:4`,
    left: `C3+G3:4 | C3+G3:4 | C3+G3:4 | C3+G3:4
      C3+G3:4 | C3+G3:4 | G2+D3:4 | G2+D3:4
      C3+G3:4 | C3+G3:4 | F2+C3:4 | F2+C3:4
      C3+G3:4 | G2+D3:4 | C3+E3:4`,
  },
  {
    id: "yankee-doodle",
    title: "Yankee Doodle",
    composer: "Traditional",
    level: 1,
    category: "folk",
    bpm: 120,
    meter: [4, 1],
    right: `C5:1 C5:1 D5:1 E5:1 | C5:1 E5:1 D5:1 G4:1 | C5:1 C5:1 D5:1 E5:1 | C5:2 B4:2
      C5:1 C5:1 D5:1 E5:1 | F5:1 E5:1 D5:1 C5:1 | B4:1 G4:1 A4:1 B4:1 | C5:2 C5:2
      A4:1.5 B4:0.5 A4:1 G4:1 | A4:1 B4:1 C5:2 | G4:1.5 A4:0.5 G4:1 F4:1 | E4:2 G4:2
      A4:1.5 B4:0.5 A4:1 G4:1 | A4:1 B4:1 C5:1 A4:1 | G4:1 C5:1 B4:1 D5:1 | C5:2 C5:2`,
    left: `C3+G3:4 | C3+G3:2 G2+D3:2 | C3+G3:4 | C3+G3:2 G2+D3:2
      C3+G3:4 | F2+C3:4 | G2+D3:4 | C3+G3:4
      F2+C3:4 | F2+C3:2 C3+G3:2 | C3+G3:4 | C3+G3:4
      F2+C3:4 | F2+C3:4 | C3+G3:2 G2+D3:2 | C3+E3:4`,
  },
  {
    id: "sakura",
    title: "Sakura Sakura",
    composer: "Traditional",
    level: 1,
    category: "folk",
    bpm: 76,
    meter: [4, 1],
    right: `A4:1 A4:1 B4:2 | A4:1 A4:1 B4:2 | A4:1 B4:1 C5:1 B4:1 | A4:1 B4:0.5 A4:0.5 F4:2
      E4:1 C4:1 E4:1 F4:1 | E4:1 E4:0.5 C4:0.5 B3:2 | A4:1 B4:1 C5:1 B4:1 | A4:1 B4:0.5 A4:0.5 F4:2
      E4:1 C4:1 E4:1 F4:1 | E4:1 E4:0.5 C4:0.5 B3:2 | A4:1 A4:1 B4:2 | A4:1 A4:1 B4:2
      E4:1 F4:1 B4:0.5 A4:0.5 F4:1 | E4:4`,
    left: `A2+E3:4 | A2+E3:4 | A2+E3:4 | D2+A2:4
      A2+E3:4 | E2+B2:4 | A2+E3:4 | D2+A2:4
      A2+E3:4 | E2+B2:4 | A2+E3:4 | A2+E3:4
      D2+A2:4 | E2+B2:4`,
  },
  {
    id: "korobeiniki",
    title: "Korobeiniki (Tetris theme)",
    composer: "Traditional",
    level: 2,
    category: "folk",
    bpm: 140,
    meter: [4, 1],
    right: `${korobeiniki}
      ${korobeiniki}`,
    left: `${korobeinikiLeft}
      ${korobeinikiLeft}`,
  },
];
