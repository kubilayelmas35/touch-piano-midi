/** Tema — enstrümana göre ayrı renk paletleri */
const AppTheme = (() => {
  const PRESETS = {
    piano: {
      effectHue: 275,
      keyColorTop: "#e8d4ff",
      keyColorMid: "#a855f7",
      keyColorBottom: "#6b21a8",
      hitLineColor: "#d8b4fe",
      surfaceAccent: "#6c9eff",
    },
    guitar: {
      effectHue: 38,
      keyColorTop: "#f5e6c8",
      keyColorMid: "#c9a227",
      keyColorBottom: "#5c4a1e",
      hitLineColor: "#e8c468",
      surfaceAccent: "#d4a017",
    },
    violin: {
      effectHue: 350,
      keyColorTop: "#ffe4ec",
      keyColorMid: "#e11d48",
      keyColorBottom: "#881337",
      hitLineColor: "#fda4af",
      surfaceAccent: "#fb7185",
    },
  };

  function apply(partial) {
    const s = { ...PRESETS.piano, ...partial };
    const r = document.documentElement;
    r.style.setProperty("--effect-hue", String(s.effectHue));
    r.style.setProperty("--key-active-top", s.keyColorTop);
    r.style.setProperty("--key-active-mid", s.keyColorMid);
    r.style.setProperty("--key-active-bottom", s.keyColorBottom);
    r.style.setProperty("--hit-line-color", s.hitLineColor);
    if (s.surfaceAccent) r.style.setProperty("--accent", s.surfaceAccent);
    window.__effectHue = s.effectHue;
    return s;
  }

  function getPreset(mode) {
    return { ...(PRESETS[mode] || PRESETS.piano) };
  }

  function fromSettings(s, playMode) {
    const mode = playMode || s.playMode || "piano";
    const saved = s.themesByMode?.[mode];
    return apply({ ...getPreset(mode), ...saved });
  }

  function readFromInputs(inputs, mode) {
    const base = getPreset(mode);
    return {
      ...base,
      effectHue: Number(inputs.effectHue?.value) || base.effectHue,
      keyColorTop: inputs.keyColorTop?.value || base.keyColorTop,
      keyColorMid: inputs.keyColorMid?.value || base.keyColorMid,
      keyColorBottom: inputs.keyColorBottom?.value || base.keyColorBottom,
      hitLineColor: inputs.hitLineColor?.value || base.hitLineColor,
    };
  }

  function fillInputs(inputs, theme) {
    if (inputs.effectHue) inputs.effectHue.value = String(theme.effectHue);
    if (inputs.keyColorTop) inputs.keyColorTop.value = theme.keyColorTop;
    if (inputs.keyColorMid) inputs.keyColorMid.value = theme.keyColorMid;
    if (inputs.keyColorBottom) inputs.keyColorBottom.value = theme.keyColorBottom;
    if (inputs.hitLineColor) inputs.hitLineColor.value = theme.hitLineColor;
  }

  function saveForMode(mode, theme, settings) {
    const themesByMode = { ...(settings.themesByMode || {}) };
    themesByMode[mode] = { ...themesByMode[mode], ...theme };
    return themesByMode;
  }

  return {
    apply,
    fromSettings,
    getPreset,
    readFromInputs,
    fillInputs,
    saveForMode,
    PRESETS,
  };
})();

window.AppTheme = AppTheme;
