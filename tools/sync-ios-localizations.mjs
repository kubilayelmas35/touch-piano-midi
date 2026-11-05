/**
 * Declare every in-app UI language as a native iOS localization so App Store
 * lists them under Languages (CFBundleLocalizations + *.lproj).
 *
 * Re-run after adding a language to src/i18n/langs.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "ios/App/App");
const plistPath = path.join(appDir, "Info.plist");
const pbxPath = path.join(root, "ios/App/App.xcodeproj/project.pbxproj");
const langsPath = path.join(root, "src/i18n/langs.ts");

/** App language id → Apple .lproj / CFBundleLocalizations code */
const APPLE_CODE = {
  tr: "tr",
  en: "en",
  ja: "ja",
  ko: "ko",
  zh: "zh-Hans",
  zht: "zh-Hant",
  id: "id",
  es: "es",
  pt: "pt-BR",
  de: "de",
  fr: "fr",
  it: "it",
  nl: "nl",
  pl: "pl",
  ru: "ru",
  ar: "ar",
  vi: "vi",
  th: "th",
  sv: "sv",
  hi: "hi",
  uk: "uk",
  cs: "cs",
  ro: "ro",
  el: "el",
  hu: "hu",
  da: "da",
  fi: "fi",
  no: "nb",
  sk: "sk",
  bg: "bg",
  hr: "hr",
  he: "he",
  ms: "ms",
  fa: "fa",
  bn: "bn",
  ca: "ca",
  sr: "sr-Latn",
  sl: "sl",
  fil: "fil",
  ta: "ta",
  te: "te",
  mr: "mr",
  ur: "ur",
  et: "et",
  lv: "lv",
  lt: "lt",
  az: "az",
  kk: "kk",
  sw: "sw",
  af: "af",
  gu: "gu",
  kn: "kn",
  ml: "ml",
  is: "is",
  eu: "eu",
  gl: "gl",
  hy: "hy",
  ka: "ka",
  be: "be",
  mk: "mk",
  sq: "sq",
  my: "my",
  km: "km",
  ne: "ne",
  si: "si",
  pa: "pa",
  am: "am",
  zu: "zu",
  mn: "mn",
  lo: "lo",
  ky: "ky",
};

const EN_STRINGS = `"NSMicrophoneUsageDescription" = "Sonatrio listens to your real piano, guitar or violin so it can check the notes you play.";
"NSCameraUsageDescription" = "Take a photo for your Sonatrio profile picture.";
"NSPhotoLibraryUsageDescription" = "Choose a photo for your Sonatrio profile picture.";
`;

const TR_STRINGS = `"NSMicrophoneUsageDescription" = "Sonatrio, çaldığın notaları kontrol edebilmek için gerçek piyanonu, gitarını ya da kemanını dinler.";
"NSCameraUsageDescription" = "Sonatrio profil resmin için fotoğraf çek.";
"NSPhotoLibraryUsageDescription" = "Sonatrio profil resmin için bir fotoğraf seç.";
`;

function appLanguageIds() {
  const src = fs.readFileSync(langsPath, "utf8");
  const block = src.match(/export const LANGUAGE_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/);
  if (!block) throw new Error("LANGUAGE_OPTIONS not found");
  return [...block[1].matchAll(/value:\s*"([a-z]+)"/g)].map((m) => m[1]);
}

function appleId(lang) {
  const code = APPLE_CODE[lang];
  if (!code) throw new Error(`No Apple localization code for language "${lang}"`);
  return code;
}

function pbxId(seed) {
  // 24 hex chars like other project IDs
  return createHash("md5").update(`sonatrio-ios-loc-${seed}`).digest("hex").slice(0, 24).toUpperCase();
}

const langs = appLanguageIds();
const appleCodes = [...new Set(langs.map(appleId))].sort((a, b) => a.localeCompare(b));

// Prefer en then tr first in the plist for readability
const ordered = ["en", "tr", ...appleCodes.filter((c) => c !== "en" && c !== "tr")];

for (const code of ordered) {
  const dir = path.join(appDir, `${code}.lproj`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "InfoPlist.strings");
  if (code === "tr") {
    fs.writeFileSync(file, TR_STRINGS);
  } else if (!fs.existsSync(file) || code !== "en") {
    // Keep hand-tuned en/tr; refresh others from English so permission dialogs are never empty.
    if (code === "en" && fs.existsSync(file)) continue;
    fs.writeFileSync(file, code === "en" ? EN_STRINGS : EN_STRINGS);
  }
}
// Ensure en exists
fs.writeFileSync(path.join(appDir, "en.lproj/InfoPlist.strings"), EN_STRINGS);

// Info.plist CFBundleLocalizations
let plist = fs.readFileSync(plistPath, "utf8");
const locXml = ordered.map((c) => `\t\t<string>${c}</string>`).join("\n");
if (!/<key>CFBundleLocalizations<\/key>/.test(plist)) {
  throw new Error("CFBundleLocalizations missing in Info.plist");
}
plist = plist.replace(
  /<key>CFBundleLocalizations<\/key>\s*<array>[\s\S]*?<\/array>/,
  `<key>CFBundleLocalizations</key>\n\t<array>\n${locXml}\n\t</array>`
);
fs.writeFileSync(plistPath, plist);

// project.pbxproj: wipe prior InfoPlist.strings locale refs, then write one clean set
let pbx = fs.readFileSync(pbxPath, "utf8");

const fileRefLines = [];
const childLines = [];
for (const code of ordered) {
  const id = pbxId(`ref-${code}`);
  fileRefLines.push(
    `\t\t${id} /* ${code} */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ${code}; path = ${code}.lproj/InfoPlist.strings; sourceTree = "<group>"; };`
  );
  childLines.push(`\t\t\t\t${id} /* ${code} */,`);
}

pbx = pbx.replace(
  /^\t\t[0-9A-Fa-f]{24} \/\* [^*\r\n]+ \*\/ = \{isa = PBXFileReference; lastKnownFileType = text\.plist\.strings; name = [^;]+; path = [^;\r\n]+\.lproj\/InfoPlist\.strings; sourceTree = "<group>"; \};\r?\n/gm,
  ""
);

if (!pbx.includes("/* End PBXFileReference section */")) {
  throw new Error("PBXFileReference section end marker missing");
}
pbx = pbx.replace(
  /\/\* End PBXFileReference section \*\//,
  `${fileRefLines.join("\n")}\n/* End PBXFileReference section */`
);

pbx = pbx.replace(
  /5A7E10022F00000100A1B2C3 \/\* InfoPlist\.strings \*\/ = \{\s*isa = PBXVariantGroup;\s*children = \([\s\S]*?\);\s*name = InfoPlist\.strings;\s*sourceTree = "<group>";\s*\};/,
  `5A7E10022F00000100A1B2C3 /* InfoPlist.strings */ = {
			isa = PBXVariantGroup;
			children = (
${childLines.join("\n")}
			);
			name = InfoPlist.strings;
			sourceTree = "<group>";
		};`
);

const regions = ["Base", ...ordered];
pbx = pbx.replace(
  /knownRegions = \([\s\S]*?\);/,
  `knownRegions = (
				${regions.map((r) => `${r},`).join("\n\t\t\t\t")}
			);`
);

fs.writeFileSync(pbxPath, pbx);

console.log(`Synced ${ordered.length} iOS localizations:`);
console.log(ordered.join(", "));
