const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "audio.js");
let s = fs.readFileSync(p, "utf8");

if (s.includes("setLiveGain")) {
  console.log("setLiveGain already present");
  process.exit(0);
}

if (!s.includes("sustainGain")) {
  s = s.replace(
    "maxVibratoDepth: freq * Math.max(vibDepth, 0.018),",
    "maxVibratoDepth: freq * Math.max(vibDepth, 0.018),\n      sustainGain: Math.max(0.0002, vol * cfg.sustain),"
  );
}

const fn = `
  function setLiveGain(midi, multiplier = 1) {
    const voice = voices.get(midi);
    if (!voice?.master) return;
    const ac = ensure();
    const t = ac.currentTime;
    const m = Math.max(0.12, Math.min(2, multiplier));
    const target = Math.max(0.0003, (voice.sustainGain || 0.08) * m);
    voice.master.gain.cancelScheduledValues(t);
    voice.master.gain.setTargetAtTime(target, t, 0.028);
  }
`;

s = s.replace("  function stopAll() {", fn + "\n  function stopAll() {");
s = s.replace("setLiveVibrato,", "setLiveVibrato,\n    setLiveGain,");
fs.writeFileSync(p, s);
console.log("audio.js: setLiveGain added");
