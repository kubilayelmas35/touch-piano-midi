const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "index.html");
let s = fs.readFileSync(p, "utf8");

if (!s.includes("styles-instruments-extra.css")) {
  s = s.replace(
    '<link rel="stylesheet" href="styles.css" />',
    '<link rel="stylesheet" href="styles.css" />\n  <link rel="stylesheet" href="styles-instruments-extra.css" />'
  );
}

s = s.replace(
  /<script src="wix-config\.js"[\s\S]*?<script src="main\.js[^"]*"><\/script>/,
  '  <script src="touch-guard.js"></script>\n  <script src="main.js"></script>'
);

if (!s.includes('class="settings-theme-hint"')) {
  s = s.replace(
    '<div class="stab-panel" data-panel="appearance">',
    '<div class="stab-panel" data-panel="appearance">\n        <p class="settings-theme-hint">Renkler seçili enstrümana özel kaydedilir (piyano / gitar / keman).</p>'
  );
}

fs.writeFileSync(p, s);
console.log("index.html patched for electron");
