// Writes public/licenses/third-party.txt: name, version, license and full license text of every package
// shipped inside the web bundle, the Android app or the desktop app (MIT/BSD/ISC require the notice).
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ROOTS = [
  "react",
  "react-dom",
  "zustand",
  "@supabase/supabase-js",
  "@tonejs/midi",
  "idb",
  "@capacitor/core",
  "@capacitor/app",
  "@capacitor/browser",
  "@capacitor/splash-screen",
  "@capacitor/android",
  "steamworks.js",
];

const seen = new Map();

function walk(name) {
  if (seen.has(name) || name.startsWith("@types/")) return;
  const dir = join(ROOT, "node_modules", name);
  if (!existsSync(join(dir, "package.json"))) return;
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  seen.set(name, {
    version: pkg.version,
    license: typeof pkg.license === "string" ? pkg.license : (pkg.licenses?.map((l) => l.type).join(", ") ?? "UNKNOWN"),
    homepage: pkg.homepage ?? (typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url) ?? "",
    text: file ? readFileSync(join(dir, file), "utf8").trim() : "",
  });
  for (const dep of Object.keys(pkg.dependencies ?? {})) walk(dep);
}

ROOTS.forEach(walk);

const sep = "=".repeat(78);
const parts = [
  "Sonatrio — third-party software notices",
  "",
  "Sonatrio includes the following open-source packages. Electron's own license and the Chromium",
  "notices ship with the desktop app (LICENSE.electron.txt, LICENSES.chromium.html).",
  "",
];
for (const [name, p] of [...seen].sort(([a], [b]) => a.localeCompare(b))) {
  parts.push(sep, `${name} ${p.version} — ${p.license}`, p.homepage.replace(/^git\+/, ""), "", p.text || `Licensed under ${p.license}.`, "");
}

const out = join(ROOT, "public", "licenses");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "third-party.txt"), parts.join("\n"));
console.log(`licenses: ${seen.size} packages`);
