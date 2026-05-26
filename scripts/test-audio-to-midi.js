const path = require("path");
const { transcribeAudioFile } = require("../electron/audio-to-midi");

const sample = path.join(__dirname, "..", "assets", "test-tone.wav");

(async () => {
  console.log("Test:", sample);
  const result = await transcribeAudioFile(sample, (p, msg) => {
    process.stdout.write(`\r${Math.round(p * 100)}% ${msg}`);
  });
  console.log("\nNotalar:", result.noteCount, "Süre:", result.durationSec.toFixed(1), "s");
  console.log("MIDI bytes:", result.midiBuffer.length);
  process.exit(result.noteCount > 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
