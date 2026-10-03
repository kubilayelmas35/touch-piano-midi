const AppSettings = (() => {
  const KEY = "touch-piano-settings";
  const defaults = {
    octaveStart: 3,
    octaveCount: 2,
    keyWidth: 48,
    keyHeight: 160,
    dynamicPressure: true,
    sustainMs: 550,
    timingWindow: 200,
    speed: 100,
    labelMode: "note",
    labelPreset: "game",
    customLabels: "Z,X,C,V,B,N,M,A,S,D,F,G,H,J",
    flameIntensity: 1,
    flameStyle: "aurora",
    trimStart: 0,
    trimEnd: 0,
    midiLabels: {},
    keyboardEnabled: true,
    keyboardLayout: "auto",
    keyboardLayoutDetected: "",
    keyboardLearned: {},
    sidebarVisible: true,
    autoKeyboardFromSong: true,
    octaveLockManual: false,
    effectHue: 275,
    keyColorTop: "#e8d4ff",
    keyColorMid: "#a855f7",
    keyColorBottom: "#6b21a8",
    hitLineColor: "#d8b4fe",
    pianoDock: "bottom",
    pianoAlign: "stretch",
    instrumentId: "piano",
    playMode: "piano",
    themesByMode: {},
    instrumentPromptDone: false,
    panelLayout: {},
    stringVibratoSens: 1,
    /** Gitar: sol kolde bir perde → tüm teller sıkılır */
    guitarGripAllStrings: false,
    violinGripAllStrings: false,
    guitarNeckNearbyTouch: true,
    violinNeckNearbyTouch: true,
    guitarStringsNearbyTouch: false,
    violinStringsNearbyTouch: false,
    guitarNeckHeight: 30,
    guitarStringHeight: 30,
    guitarNeckWidth: 42,
    guitarPluckWidth: 220,
    /** "auto" veya en, tr, de, fr, it, … */
    locale: "auto",
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      const data = { ...defaults, ...JSON.parse(raw) };
      if (data.sustainMs == null || !Number.isFinite(data.sustainMs)) {
        data.sustainMs = data.sustainEnabled === false ? 0 : 550;
      }
      data.sustainMs = Math.max(0, Math.min(10000, Math.round(data.sustainMs)));
      const mode = data.playMode || "piano";
      if (mode === "guitar" || mode === "violin") {
        data.instrumentId = mode;
      }
      return data;
    } catch {
      return { ...defaults };
    }
  }

  function save(partial) {
    const next = { ...load(), ...partial };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  return { load, save, defaults };
})();

window.AppSettings = AppSettings;
