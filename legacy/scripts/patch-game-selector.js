const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "game.js");
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  '.guitar-cell, .guitar-string.string-touch-target',
  ".guitar-string-stripe.string-touch-target"
);
s = s.replace(
  ".violin-cell, .violin-string.string-touch-target",
  ".violin-string-stripe.string-touch-target"
);
fs.writeFileSync(p, s);
console.log("game.js selectors updated");
