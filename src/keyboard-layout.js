/** Klavye düzeni algılama — fiziksel tuş (code) ↔ yazılan harf (key) */
const KeyboardLayout = (() => {
  const LAYOUTS = {
    qwerty: {
      KeyQ: "q", KeyW: "w", KeyE: "e", KeyR: "r", KeyT: "t", KeyY: "y", KeyU: "u", KeyI: "i", KeyO: "o", KeyP: "p",
      BracketLeft: "[", BracketRight: "]", Backslash: "\\",
      KeyA: "a", KeyS: "s", KeyD: "d", KeyF: "f", KeyG: "g", KeyH: "h", KeyJ: "j", KeyK: "k", KeyL: "l",
      Semicolon: ";", Quote: "'",
      KeyZ: "z", KeyX: "x", KeyC: "c", KeyV: "v", KeyB: "b", KeyN: "n", KeyM: "m",
      Comma: ",", Period: ".", Slash: "/",
      Backquote: "`", Minus: "-", Equal: "=",
      Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4", Digit5: "5",
      Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9", Digit0: "0",
    },
    qwertz: {
      KeyQ: "q", KeyW: "w", KeyE: "e", KeyR: "r", KeyT: "t", KeyZ: "z", KeyU: "u", KeyI: "i", KeyO: "o", KeyP: "p",
      KeyA: "a", KeyS: "s", KeyD: "d", KeyF: "f", KeyG: "g", KeyH: "h", KeyJ: "j", KeyK: "k", KeyL: "l",
      KeyY: "y", KeyX: "x", KeyC: "c", KeyV: "v", KeyB: "b", KeyN: "n", KeyM: "m",
    },
    azerty: {
      KeyA: "q", KeyZ: "w", KeyE: "e", KeyR: "r", KeyT: "t", KeyY: "u", KeyU: "i", KeyI: "o", KeyO: "p",
      KeyQ: "a", KeyS: "s", KeyD: "d", KeyF: "f", KeyG: "g", KeyH: "h", KeyJ: "j", KeyK: "k", KeyL: "l",
      KeyW: "z", KeyX: "x", KeyC: "c", KeyV: "v", KeyB: "b", KeyN: "n", KeyM: "m",
    },
    "tr-q": {
      KeyQ: "q", KeyW: "w", KeyE: "e", KeyR: "r", KeyT: "t", KeyY: "y", KeyU: "u", KeyI: "ı", KeyO: "o", KeyP: "p",
      KeyA: "a", KeyS: "s", KeyD: "d", KeyF: "f", KeyG: "g", KeyH: "h", KeyJ: "j", KeyK: "k", KeyL: "l",
      KeyZ: "z", KeyX: "x", KeyC: "c", KeyV: "v", KeyB: "b", KeyN: "n", KeyM: "m",
      Comma: "ş", Period: "i", Slash: "ö",
    },
    "tr-f": {
      KeyQ: "f", KeyW: "g", KeyE: "ğ", KeyR: "ı", KeyT: "o", KeyY: "d", KeyU: "r", KeyI: "n", KeyO: "h", KeyP: "p",
      BracketLeft: "q", BracketRight: "w",
      KeyA: "u", KeyS: "i", KeyD: "e", KeyF: "a", KeyG: "ü", KeyH: "t", KeyJ: "k", KeyK: "m", KeyL: "l",
      Semicolon: "y", Quote: "ş",
      KeyZ: "x", KeyX: "j", KeyC: "ö", KeyV: "v", KeyB: "c", KeyN: "ç", KeyM: "z",
      Comma: "s", Period: "b", Slash: ".",
    },
  };

  const PROBE_CODES = ["KeyQ", "KeyW", "KeyE", "KeyA", "KeyZ", "BracketRight"];

  let layoutId = "auto";
  const learned = new Map();
  const scores = Object.create(null);
  let layoutMapReady = null;

  function normChar(ch) {
    if (!ch || ch.length !== 1) return "";
    return ch.toLocaleLowerCase("tr");
  }

  function mergeLayout(baseId) {
    const base = LAYOUTS[baseId] || LAYOUTS.qwerty;
    const out = { ...base };
    learned.forEach((ch, code) => {
      out[code] = ch;
    });
    return out;
  }

  function scoreLayout(id, code, key) {
    const expected = LAYOUTS[id]?.[code];
    if (!expected) return;
    if (normChar(expected) === normChar(key)) {
      scores[id] = (scores[id] || 0) + 2;
    }
  }

  function localeGuess() {
    const lang = (navigator.language || "").toLowerCase();
    if (lang.startsWith("tr")) return "tr-f";
    if (lang.startsWith("de") || lang.startsWith("at") || lang.startsWith("ch")) return "qwertz";
    if (lang.startsWith("fr")) return "azerty";
    return "qwerty";
  }

  function getDetectedId() {
    if (layoutId !== "auto") return layoutId;

    let best = null;
    let bestScore = 0;
    for (const [id, s] of Object.entries(scores)) {
      if (s > bestScore) {
        bestScore = s;
        best = id;
      }
    }
    if (best && bestScore >= 4) return best;
    if (learned.size >= 4) return "learned";
    return localeGuess();
  }

  function getActiveMap() {
    const id = getDetectedId();
    if (id === "learned") return mergeLayout(localeGuess());
    return mergeLayout(id);
  }

  function charForCode(code) {
    const map = getActiveMap();
    return map[code] || LAYOUTS.qwerty[code] || null;
  }

  function codeForChar(char) {
    const target = normChar(char);
    if (!target) return null;

    for (const [code, ch] of learned) {
      if (normChar(ch) === target) return code;
    }

    const map = getActiveMap();
    for (const [code, ch] of Object.entries(map)) {
      if (normChar(ch) === target) return code;
    }

    for (const [code, ch] of Object.entries(LAYOUTS.qwerty)) {
      if (normChar(ch) === target) return code;
    }
    return null;
  }

  function learnFromEvent(code, key) {
    if (!code || !key || key.length !== 1) return;
    if (key === "Dead" || key === "Unidentified" || key === "Process") return;

    learned.set(code, key);
    for (const id of Object.keys(LAYOUTS)) scoreLayout(id, code, key);

    const detected = getDetectedId();
    if (window.AppSettings && layoutId === "auto") {
      try {
        window.AppSettings.save({ keyboardLayoutDetected: detected });
      } catch {
        /* ignore */
      }
    }
  }

  function setLayoutId(id) {
    layoutId = id || "auto";
    if (id === "auto") return;
    learned.clear();
    for (const k of Object.keys(scores)) delete scores[k];
  }

  function getLayoutId() {
    return layoutId;
  }

  function getDetectedLabel() {
    const id = getDetectedId();
    const labels = {
      qwerty: "QWERTY",
      qwertz: "QWERTZ",
      azerty: "AZERTY",
      "tr-q": "Türkçe Q",
      "tr-f": "Türkçe F",
      learned: "Öğrenildi",
    };
    return labels[id] || id;
  }

  async function tryLayoutMapApi() {
    if (!navigator.keyboard?.getLayoutMap) return;
    try {
      const map = await navigator.keyboard.getLayoutMap();
      for (const code of PROBE_CODES) {
        const ch = map.get(code);
        if (ch) learnFromEvent(code, ch);
      }
      layoutMapReady = true;
    } catch {
      /* izin yok veya desteklenmiyor */
    }
  }

  function loadLearned(obj) {
    learned.clear();
    if (!obj || typeof obj !== "object") return;
    for (const [code, ch] of Object.entries(obj)) {
      if (code && ch) learned.set(code, String(ch).slice(0, 1));
    }
  }

  function getLearnedObject() {
    const o = {};
    learned.forEach((ch, code) => {
      o[code] = ch;
    });
    return o;
  }

  tryLayoutMapApi();

  return {
    charForCode,
    codeForChar,
    learnFromEvent,
    setLayoutId,
    getLayoutId,
    getDetectedId,
    getDetectedLabel,
    loadLearned,
    getLearnedObject,
    LAYOUTS,
  };
})();

window.KeyboardLayout = KeyboardLayout;
