/** Bilgisayar klavyesi → piyano (oktav değişince yeniden eşleme) */
const KeyboardInput = (() => {
  const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

  /** Beyaz tuş sırası → fiziksel klavye konumu (US taban) */
  const WHITE_CODES = [
    "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM",
    "Comma", "KeyL", "Period", "Semicolon", "Slash",
    "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP",
    "BracketLeft", "BracketRight", "Backslash",
    "Digit1", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
    "Minus", "Equal",
  ];

  const BLACK_CODES = [
    "KeyS", "KeyD", "KeyG", "KeyH", "KeyJ",
    "KeyU", "KeyO", "KeyI", "KeyP",
    "KeyY", "KeyT", "KeyR", "KeyE", "KeyW", "KeyQ",
    "Digit2", "Digit3", "Digit5", "Digit6", "Digit7", "Digit9", "Digit0",
    "Minus", "Equal", "Backquote", "BracketLeft", "BracketRight",
  ];

  let enabled = true;
  let codeToMidi = new Map();
  let charToMidi = new Map();
  let held = new Set();
  let bound = false;

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function usesLetterMapping() {
    const mode = window.KeyLabels?.getMode?.();
    return mode === "letters" || mode === "custom" || window.KeyLabels?.hasMidiLabels?.();
  }

  function releaseAll() {
    for (const midi of [...held]) {
      held.delete(midi);
      window.Piano?.releaseKey?.(midi);
    }
  }

  function isPlayableLabel(text) {
    return text && text !== "·" && text !== "?" && text.length === 1;
  }

  function codeForWhiteSlot(slot, label, usedCodes) {
    let code = window.KeyboardLayout?.codeForChar?.(label) || null;
    if (!code || usedCodes.has(code)) {
      code = WHITE_CODES[slot] || null;
    }
    return code;
  }

  function bindLetterMappings(range, whites, blacks) {
    const usedCodes = new Set();
    const seenChars = new Set();

    whites.forEach((midi, slot) => {
      const label = window.KeyLabels?.labelForMidi?.(midi, range.startMidi, range.endMidi);
      if (!isPlayableLabel(label)) return;

      const code = codeForWhiteSlot(slot, label, usedCodes);
      if (code) {
        codeToMidi.set(code, midi);
        usedCodes.add(code);
      }

      const lower = label.toLocaleLowerCase("tr");
      const upper = label.toLocaleUpperCase("tr");
      if (!seenChars.has(lower)) {
        charToMidi.set(lower, midi);
        charToMidi.set(upper, midi);
        seenChars.add(lower);
      }
    });

    blacks.forEach((midi, slot) => {
      const label = window.KeyLabels?.labelForMidi?.(midi, range.startMidi, range.endMidi);
      if (!isPlayableLabel(label)) return;

      let code = window.KeyboardLayout?.codeForChar?.(label) || null;
      if (!code || usedCodes.has(code)) code = BLACK_CODES[slot] || null;
      if (!code) return;

      codeToMidi.set(code, midi);
      usedCodes.add(code);

      const lower = label.toLocaleLowerCase("tr");
      const upper = label.toLocaleUpperCase("tr");
      if (!seenChars.has(lower)) {
        charToMidi.set(lower, midi);
        charToMidi.set(upper, midi);
        seenChars.add(lower);
      }
    });
  }

  function rebuild() {
    releaseAll();
    codeToMidi.clear();
    charToMidi.clear();
    if (!window.Piano) return;

    const range = window.Piano.getRange();
    const whites = [];
    const blacks = [];

    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PC.includes(m % 12)) whites.push(m);
      else blacks.push(m);
    }

    if (usesLetterMapping()) {
      bindLetterMappings(range, whites, blacks);
    } else {
      whites.forEach((midi, i) => {
        if (WHITE_CODES[i]) codeToMidi.set(WHITE_CODES[i], midi);
      });
      blacks.forEach((midi, i) => {
        if (BLACK_CODES[i]) codeToMidi.set(BLACK_CODES[i], midi);
      });
    }
  }

  function resolveMidiFromChar(key) {
    if (!key || key.length !== 1) return null;
    const upper = key.toLocaleUpperCase("tr");
    const lower = key.toLocaleLowerCase("tr");
    if (charToMidi.has(upper)) return charToMidi.get(upper);
    if (charToMidi.has(lower)) return charToMidi.get(lower);
    if (charToMidi.has(key)) return charToMidi.get(key);
    return null;
  }

  function resolveMidi(e) {
    window.KeyboardLayout?.learnFromEvent?.(e.code, e.key);

    if (usesLetterMapping()) {
      if (codeToMidi.has(e.code)) return codeToMidi.get(e.code);
      const fromChar = resolveMidiFromChar(e.key);
      if (fromChar != null) return fromChar;
      return null;
    }

    if (codeToMidi.has(e.code)) return codeToMidi.get(e.code);
    return resolveMidiFromChar(e.key);
  }

  function noteOn(midi) {
    if (midi == null || held.has(midi)) return;
    if (!window.Piano?.midiInRange?.(midi)) return;
    held.add(midi);
    window.Piano.pressKey(midi, 0.85);
  }

  function noteOff(midi) {
    if (!held.has(midi)) return;
    held.delete(midi);
    window.Piano.releaseKey(midi);
  }

  function onKeyDown(e) {
    if (!enabled) return;
    if (e.repeat) return;
    if (isTypingTarget(e.target)) return;
    if (e.code === "F11" || e.code === "Escape") return;

    const midi = resolveMidi(e);
    if (midi == null) return;

    e.preventDefault();
    noteOn(midi);
  }

  function onKeyUp(e) {
    if (!enabled) return;
    if (isTypingTarget(e.target)) return;

    const midi = resolveMidi(e);
    if (midi == null) return;

    e.preventDefault();
    noteOff(midi);
  }

  function onBlur() {
    releaseAll();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) releaseAll();
  }

  function bind() {
    if (bound) return;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    bound = true;
  }

  function unbind() {
    if (!bound) return;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    releaseAll();
    bound = false;
  }

  return {
    bind,
    unbind,
    rebuild,
    releaseAll,
    setEnabled,
    isEnabled: () => enabled,
    getHeldCount: () => held.size,
  };
})();

window.KeyboardInput = KeyboardInput;
