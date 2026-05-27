const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src");
const coreFiles = [
  "settings.js",
  "theme.js",
  "audio.js",
  "key-labels.js",
  "flame-styles.js",
  "note-utils.js",
  "note-renderer.js",
  "piano-range.js",
  "piano.js",
  "guitar.js",
  "violin.js",
  "play-surface.js",
  "instrument-move.js",
  "keyboard-input.js",
  "game.js",
  "library.js",
];
const appFile = "app.js";
let out = "/* Otomatik birleştirilmiş — npm start öncesi üretilir */\n";

for (const f of coreFiles) {
  out += `\n/* === ${f} === */\n`;
  out += fs.readFileSync(path.join(src, f), "utf8");
  out += "\n";
}

out += "\nwindow.mainJsOk = true;\n";

out += `\n/* === ${appFile} === */\n`;
out += fs.readFileSync(path.join(src, appFile), "utf8");
out += "\n";
fs.writeFileSync(path.join(src, "main.js"), out);
console.log("src/main.js oluşturuldu");
