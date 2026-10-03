const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "app.js");
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  `    const playMode = s.playMode || "piano";
    if (playModeSelect) playModeSelect.value = playMode;`,
  `    if (playModeSelect) playModeSelect.value = playMode;`
);
fs.writeFileSync(p, s);
console.log("removed duplicate playMode");
