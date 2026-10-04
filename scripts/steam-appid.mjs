// Writes steam_appid.txt next to Sonatrio.exe in the unpacked Windows build, so the
// desktop app turns on Steam achievements and the overlay.
// Usage: npm run steam:dist -- <APP_ID>   (or set SONATRIO_STEAM_APP_ID)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = String(process.argv[2] ?? process.env.SONATRIO_STEAM_APP_ID ?? "").trim();
if (!/^\d+$/.test(id)) {
  console.error("Steam App ID missing: npm run steam:dist -- <APP_ID>");
  process.exit(1);
}
const dir = path.resolve(root, "..", "sonatrio-release", "win-unpacked");
if (!fs.existsSync(path.join(dir, "Sonatrio.exe"))) {
  console.error(`No build at ${dir}. Run electron-builder first.`);
  process.exit(1);
}
fs.writeFileSync(path.join(dir, "steam_appid.txt"), `${id}\n`);
console.log(`steam_appid.txt (${id}) -> ${dir}`);
