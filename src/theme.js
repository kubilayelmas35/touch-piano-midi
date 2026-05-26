/** Tema renkleri — CSS değişkenleri */
const AppTheme = (() => {
  const defaults = {
    effectHue: 275,
    keyColorTop: "#e8d4ff",
    keyColorMid: "#a855f7",
    keyColorBottom: "#6b21a8",
    hitLineColor: "#d8b4fe",
  };

  function apply(partial) {
    const s = { ...defaults, ...partial };
    const r = document.documentElement;
    r.style.setProperty("--effect-hue", String(s.effectHue));
    r.style.setProperty("--key-active-top", s.keyColorTop);
    r.style.setProperty("--key-active-mid", s.keyColorMid);
    r.style.setProperty("--key-active-bottom", s.keyColorBottom);
    r.style.setProperty("--hit-line-color", s.hitLineColor);
    window.__effectHue = s.effectHue;
    return s;
  }

  function fromSettings(s) {
    return apply({
      effectHue: s.effectHue,
      keyColorTop: s.keyColorTop,
      keyColorMid: s.keyColorMid,
      keyColorBottom: s.keyColorBottom,
      hitLineColor: s.hitLineColor,
    });
  }

  return { apply, fromSettings, defaults };
})();

window.AppTheme = AppTheme;
