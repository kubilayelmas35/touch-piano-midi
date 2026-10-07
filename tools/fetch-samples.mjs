// Downloads instrument samples into public/samples/<instrument>/<midi>.mp3
// Piano: Salamander Grand Piano (CC-BY 3.0, Alexander Holm) via tonejs.github.io
// Guitar / violin: MusyngKite SoundFont (CC-BY-SA 3.0) via gleitz/midi-js-soundfonts
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "samples");

const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SALAMANDER_NAMES = { 0: "C", 3: "Ds", 6: "Fs", 9: "A" };

const octave = (midi) => Math.floor(midi / 12) - 1;
const range = (from, to, step = 1) => {
  const out = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
};

const INSTRUMENTS = [
  {
    id: "piano",
    notes: range(21, 108, 3),
    url: (m) => `https://tonejs.github.io/audio/salamander/${SALAMANDER_NAMES[m % 12]}${octave(m)}.mp3`,
  },
  {
    id: "guitar-steel",
    notes: range(40, 88),
    url: (m) =>
      `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_guitar_steel-mp3/${FLAT_NAMES[m % 12]}${octave(m)}.mp3`,
  },
  {
    id: "guitar-nylon",
    notes: range(40, 88),
    url: (m) =>
      `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_guitar_nylon-mp3/${FLAT_NAMES[m % 12]}${octave(m)}.mp3`,
  },
  {
    id: "guitar-electric",
    notes: range(40, 88),
    url: (m) =>
      `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/overdriven_guitar-mp3/${FLAT_NAMES[m % 12]}${octave(m)}.mp3`,
  },
  {
    id: "violin",
    notes: range(55, 100),
    url: (m) =>
      `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/violin-mp3/${FLAT_NAMES[m % 12]}${octave(m)}.mp3`,
  },
];

/** Other sounds to pick from in the settings: [folder id, MusyngKite name]. */
const musyng = (id, name, notes) => ({
  id,
  notes,
  url: (m) => `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/${name}-mp3/${FLAT_NAMES[m % 12]}${octave(m)}.mp3`,
});
const KEYS = range(21, 108, 3);
const GUITAR = range(40, 88);
const BOWED = range(55, 100);
INSTRUMENTS.push(
  musyng("piano-bright", "bright_acoustic_piano", KEYS),
  musyng("piano-honky", "honkytonk_piano", KEYS),
  musyng("piano-epiano", "electric_piano_1", KEYS),
  musyng("piano-epiano2", "electric_piano_2", KEYS),
  musyng("piano-harpsichord", "harpsichord", KEYS),
  musyng("piano-clavinet", "clavinet", KEYS),
  musyng("piano-musicbox", "music_box", KEYS),
  musyng("piano-vibraphone", "vibraphone", KEYS),
  musyng("piano-organ", "drawbar_organ", KEYS),
  musyng("piano-church", "church_organ", KEYS),
  musyng("piano-accordion", "accordion", KEYS),
  musyng("guitar-clean", "electric_guitar_clean", GUITAR),
  musyng("guitar-jazz", "electric_guitar_jazz", GUITAR),
  musyng("guitar-muted", "electric_guitar_muted", GUITAR),
  musyng("guitar-distortion", "distortion_guitar", GUITAR),
  musyng("guitar-harmonics", "guitar_harmonics", GUITAR),
  musyng("guitar-banjo", "banjo", GUITAR),
  musyng("guitar-sitar", "sitar", GUITAR),
  musyng("violin-fiddle", "fiddle", BOWED),
  musyng("violin-viola", "viola", BOWED),
  musyng("violin-cello", "cello", BOWED),
  musyng("violin-tremolo", "tremolo_strings", BOWED),
  musyng("violin-ensemble", "string_ensemble_1", BOWED),
  musyng("violin-synth", "synth_strings_1", BOWED)
);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) throw new Error(`too small (${buf.length} bytes)`);
      await writeFile(dest, buf);
      return buf.length;
    } catch (err) {
      if (attempt === 3) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return 0;
}

async function pool(tasks, size) {
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < tasks.length) {
      const task = tasks[i++];
      await task();
    }
  });
  await Promise.all(workers);
}

const manifest = {};
let total = 0;
for (const inst of INSTRUMENTS) {
  const dir = join(OUT, inst.id);
  await mkdir(dir, { recursive: true });
  manifest[inst.id] = inst.notes;
  await pool(
    inst.notes.map((m) => async () => {
      const dest = join(dir, `${m}.mp3`);
      if (await exists(dest)) return;
      const bytes = await download(inst.url(m), dest);
      total += bytes;
    }),
    8
  );
  console.log(`${inst.id}: ${inst.notes.length} samples`);
}

await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest));
console.log(`done, downloaded ${(total / 1024 / 1024).toFixed(2)} MB`);
