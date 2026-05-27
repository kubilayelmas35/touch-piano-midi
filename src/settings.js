const AppSettings = (() => {
  const KEY = "touch-piano-settings";
  const defaults = {
    octaveStart: 3,
    octaveCount: 2,
    keyWidth: 48,
    keyHeight: 160,
    dynamicPressure: true,
    sustainEnabled: true,
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
    instrumentPromptDone: false,
    panelLayout: {},
    stringVibratoSens: 1,
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
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
