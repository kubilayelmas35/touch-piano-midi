const path = require("path");
const { Midi } = require("@tonejs/midi");
const fs = require("fs");

const midiPath = path.join(__dirname, "..", "assets", "bach_846.mid");
const buf = fs.readFileSync(midiPath);
const midi = new Midi(buf);
const tracks = midi.tracks.filter((t) => t.notes.length > 0);
console.log("MIDI OK:", midi.name || "bach_846", "iz:", tracks.length);
tracks.forEach((t, i) => {
  console.log(`  [${i}] ${t.name || "İz"} — ${t.notes.length} nota`);
});
