const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "app.js");
let s = fs.readFileSync(p, "utf8");

const old = `    AudioEngine.setInstrument(s.instrumentId || "piano");
    if (instrumentSelect) instrumentSelect.value = s.instrumentId || "piano";`;

const neu = `    const playMode = s.playMode || "piano";
    const modeSound = window.PlaySurface?.getModes?.()?.[playMode]?.sound || s.instrumentId || "piano";
    AudioEngine.setInstrument(modeSound);
    if (instrumentSelect) instrumentSelect.value = modeSound;`;

if (s.includes(old)) {
  s = s.replace(old, neu);
  fs.writeFileSync(p, s);
  console.log("applySettings sound fixed");
} else {
  console.log("applySettings block already patched or missing");
}
