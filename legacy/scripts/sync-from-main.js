const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const parts = main.split(/\n\/\* === ([^=]+) === \*\/\n/);

for (let i = 1; i < parts.length; i += 2) {
  const name = parts[i].trim();
  const body = parts[i + 1];
  if (!body || !name.endsWith(".js")) continue;
  const out = path.join(root, "src", name);
  if (name === "app.js") continue;
  fs.writeFileSync(out, body.trimEnd() + "\n");
  console.log("wrote", name);
}
