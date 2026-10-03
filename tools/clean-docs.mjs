// Empties docs/ before a Pages build, keeping hand-written files.
import { readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../docs/", import.meta.url));
const KEEP = new Set(["assets/INTRO_VIDEO.md", "CNAME", ".nojekyll"]);

function sweep(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full).replace(/\\/g, "/");
    if (KEEP.has(rel)) continue;
    if (statSync(full).isDirectory()) {
      sweep(full);
      if (!readdirSync(full).length) rmSync(full, { recursive: true });
    } else {
      rmSync(full);
    }
  }
}

if (existsSync(root)) sweep(root);
