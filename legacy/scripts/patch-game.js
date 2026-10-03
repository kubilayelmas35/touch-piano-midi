const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "game.js");
let s = fs.readFileSync(p, "utf8");

const old = `  function processAutoPlay(t) {
    if (!autoPlayMode || !playing) return;
    for (const n of notes) {
      if (!n._autoStarted && t >= n.time) {
        n._autoStarted = true;
        const vel = Math.max(0.2, Math.min(1, n.velocity ?? 0.75));
        window.Piano?.pressKey?.(n.midi, vel);
        boostKeyAura(n.midi, 1);
        n.hit = true;
      }
      if (n._autoStarted && !n._autoEnded && t >= n.time + n.duration) {
        n._autoEnded = true;
        window.Piano?.releaseKey?.(n.midi);
      }
    }
  }`;

const neu = `  function playInstrumentApi() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "guitar") return window.Guitar;
    if (mode === "violin") return window.Violin;
    return window.Piano;
  }

  function processAutoPlay(t) {
    if (!autoPlayMode || !playing) return;
    const inst = playInstrumentApi();
    const sound = window.PlaySurface?.getModes?.()?.[window.PlaySurface.getMode()]?.sound;
    if (sound) window.AudioEngine?.setInstrument?.(sound);
    for (const n of notes) {
      if (!n._autoStarted && t >= n.time) {
        n._autoStarted = true;
        const vel = Math.max(0.2, Math.min(1, n.velocity ?? 0.75));
        inst?.pressKey?.(n.midi, vel);
        boostKeyAura(n.midi, 1);
        n.hit = true;
      }
      if (n._autoStarted && !n._autoEnded && t >= n.time + n.duration) {
        n._autoEnded = true;
        inst?.releaseKey?.(n.midi);
      }
    }
  }`;

if (!s.includes(old)) {
  console.error("processAutoPlay block not found");
  process.exit(1);
}
s = s.replace(old, neu);
s = s.replaceAll("window.Piano?.flash(n.midi, \"miss\")", 'window.PlaySurface?.flash?.(n.midi, "miss")');
s = s.replaceAll("window.Piano?.flash(midi, \"good\")", 'window.PlaySurface?.flash?.(midi, "good")');
fs.writeFileSync(p, s);
console.log("game.js patched");
