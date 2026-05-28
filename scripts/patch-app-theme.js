const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "src", "app.js");
let s = fs.readFileSync(p, "utf8");

const applyThemeOld = `  function applyThemeFromSettings(s) {
    window.AppTheme?.fromSettings?.(s || AppSettings.load());
  }`;

const applyThemeNew = `  const themeInputs = () => ({
    effectHue: effectHueInput,
    keyColorTop: keyColorTopInput,
    keyColorMid: keyColorMidInput,
    keyColorBottom: keyColorBottomInput,
    hitLineColor: hitLineColorInput,
  });

  function applyThemeFromSettings(s, playMode) {
    const mode = playMode || s?.playMode || window.PlaySurface?.getMode?.() || "piano";
    window.AppTheme?.fromSettings?.(s || AppSettings.load(), mode);
    window.AppTheme?.fillInputs?.(themeInputs(), {
      ...(window.AppTheme.getPreset(mode)),
      ...((s || AppSettings.load()).themesByMode?.[mode] || {}),
    });
    document.body.dataset.themeMode = mode;
  }`;

if (s.includes(applyThemeOld) && !s.includes("themeInputs")) {
  s = s.replace(applyThemeOld, applyThemeNew);
}

const persistThemeOld = `  function persistThemeFromInputs() {
    persistSettings({
      effectHue: Number(effectHueInput?.value) || 275,
      keyColorTop: keyColorTopInput?.value,
      keyColorMid: keyColorMidInput?.value,
      keyColorBottom: keyColorBottomInput?.value,
      hitLineColor: hitLineColorInput?.value,
    });
    applyThemeFromSettings(AppSettings.load());
  }`;

const persistThemeNew = `  function persistThemeFromInputs() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    const theme = window.AppTheme.readFromInputs(themeInputs(), mode);
    const s = AppSettings.load();
    const themesByMode = window.AppTheme.saveForMode(mode, theme, s);
    persistSettings({ themesByMode });
    applyThemeFromSettings(AppSettings.load(), mode);
  }`;

if (s.includes(persistThemeOld)) {
  s = s.replace(persistThemeOld, persistThemeNew);
}

const applyPlayOld = `    updateSettingsForPlayMode(m);
    const s = AppSettings.load();
    applyInstrumentKeySize(s.keyWidth, s.keyHeight);`;

const applyPlayNew = `    updateSettingsForPlayMode(m);
    applyThemeFromSettings(AppSettings.load(), m);
    const s = AppSettings.load();
    applyInstrumentKeySize(s.keyWidth, s.keyHeight);`;

if (s.includes(applyPlayOld) && !s.includes("applyThemeFromSettings(AppSettings.load(), m)")) {
  s = s.replace(applyPlayOld, applyPlayNew);
}

const autoPlayOld = `    Game.setAutoPlayMode(true);
    if (Game.isPlaying()) {`;

const autoPlayNew = `    Game.setAutoPlayMode(true);
    const sound = window.PlaySurface?.getModes?.()?.[window.PlaySurface.getMode()]?.sound;
    if (sound) requireMods().AudioEngine.setInstrument(sound);
    if (Game.isPlaying()) {`;

if (s.includes(autoPlayOld) && !s.includes("setInstrument(sound)")) {
  s = s.replace(autoPlayOld, autoPlayNew);
}

fs.writeFileSync(p, s);
console.log("app.js theme patches applied");
