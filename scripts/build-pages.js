/**
 * GitHub Pages için docs/ klasörünü üretir.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const docs = path.join(root, "docs");

execSync("node scripts/bundle-renderer.js", { cwd: root, stdio: "inherit" });

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

if (fs.existsSync(docs)) {
  for (const name of fs.readdirSync(docs)) {
    fs.rmSync(path.join(docs, name), { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(docs, { recursive: true });
}

copy(path.join(root, "src", "styles.css"), path.join(docs, "styles.css"));
if (fs.existsSync(path.join(root, "src", "styles-instruments-extra.css"))) {
  copy(path.join(root, "src", "styles-instruments-extra.css"), path.join(docs, "styles-instruments-extra.css"));
}
copy(path.join(root, "src", "main.js"), path.join(docs, "main.js"));
copy(path.join(root, "src", "touch-guard.js"), path.join(docs, "touch-guard.js"));
copy(path.join(root, "web", "index.html"), path.join(docs, "index.html"));
copy(path.join(root, "web", "pianoApi-web.js"), path.join(docs, "pianoApi-web.js"));
copy(path.join(root, "web", "web-boot.js"), path.join(docs, "web-boot.js"));
copy(path.join(root, "web", "wix-config.example.js"), path.join(docs, "wix-config.example.js"));
copy(path.join(root, "wix", "VERIFICATION.md"), path.join(docs, "VERIFICATION.md"));
const webVsDesktop = path.join(root, "docs", "WEB_VS_DESKTOP.md");
if (fs.existsSync(webVsDesktop)) {
  copy(webVsDesktop, path.join(docs, "WEB_VS_DESKTOP.md"));
}

fs.writeFileSync(path.join(docs, ".nojekyll"), "");

console.log("GitHub Pages çıktısı: docs/");
console.log("Repo → Settings → Pages → Source: Deploy from branch → /docs");
