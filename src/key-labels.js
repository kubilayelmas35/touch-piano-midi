/** Tuş etiketleri — nota, harf, özel veya tuş başına (sağ tık) */
const KeyLabels = (() => {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

  const PRESET_GAME = "ZXCVBNMASDFGHJ".split("");
  const PRESET_PIANO = "AWSEDRTYUIOPGHJKL".split("");

  let mode = "note";
  let customString = "ZXCVBNMASDFGHJ";
  let letterPreset = "game";
  /** midi → tek harf (beyaz/siyah) */
  const midiLabels = new Map();

  function setMode(m) {
    mode = m || "note";
  }

  function setCustomString(s) {
    customString = String(s || "");
  }

  function setLetterPreset(p) {
    letterPreset = p || "game";
  }

  function getPresetLetters() {
    if (letterPreset === "piano") return PRESET_PIANO;
    return PRESET_GAME;
  }

  function parseCustomList(str) {
    return String(str)
      .split(/[,;\s]+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }

  function setMidiLabel(midi, letter) {
    const m = Number(midi);
    const ch = String(letter || "").trim();
    if (!ch) {
      midiLabels.delete(m);
      return;
    }
    midiLabels.set(m, ch.length === 1 ? ch : ch[0]);
  }

  function getMidiLabel(midi) {
    return midiLabels.get(Number(midi)) || "";
  }

  function getMidiLabelsObject() {
    const o = {};
    midiLabels.forEach((v, k) => {
      o[k] = v;
    });
    return o;
  }

  function loadMidiLabelsObject(obj) {
    midiLabels.clear();
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (v) midiLabels.set(Number(k), String(v).slice(0, 1));
    }
  }

  function noteNameForMidi(midi) {
    const oct = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES[midi % 12]}${oct}`;
  }

  function labelForMidi(midi, startMidi, endMidi) {
    if (midiLabels.has(midi)) {
      return midiLabels.get(midi);
    }

    if (mode === "note") {
      return NOTE_NAMES[midi % 12];
    }

    const pc = midi % 12;
    const isWhite = WHITE_PC.includes(pc);

    if (mode === "letters") {
      if (!isWhite) return "·";
      let whiteIndex = 0;
      for (let m = startMidi; m <= endMidi; m++) {
        if (!WHITE_PC.includes(m % 12)) continue;
        if (m === midi) {
          const letters = getPresetLetters();
          return letters[whiteIndex % letters.length] || "?";
        }
        whiteIndex++;
      }
      return "";
    }

    if (mode === "custom") {
      const chars = parseCustomList(customString);
      if (!isWhite) return chars.length > 20 ? "·" : "";
      let wi = 0;
      for (let m = startMidi; m <= endMidi; m++) {
        if (!WHITE_PC.includes(m % 12)) continue;
        if (m === midi) return chars[wi]?.toUpperCase() || "?";
        wi++;
      }
    }

    return NOTE_NAMES[midi % 12];
  }

  function applyToKeys(keyMap, range) {
    const { startMidi, endMidi } = range;
    keyMap.forEach((el, midi) => {
      const label = el.querySelector(".key-label");
      if (!label) return;
      const text = labelForMidi(midi, startMidi, endMidi);
      label.textContent = text;
      const mapped = midiLabels.has(midi);
      label.classList.toggle("letter-mode", mode !== "note" || mapped);
      el.title = mapped
        ? `${noteNameForMidi(midi)} → "${text}" (sağ tık: değiştir)`
        : `${noteNameForMidi(midi)} — sağ tık ile harf ata`;
    });
  }

  return {
    setMode,
    setCustomString,
    setLetterPreset,
    setMidiLabel,
    getMidiLabel,
    getMidiLabelsObject,
    loadMidiLabelsObject,
    noteNameForMidi,
    labelForMidi,
    applyToKeys,
    getMode: () => mode,
    getCustomString: () => customString,
    hasMidiLabels: () => midiLabels.size > 0,
  };
})();

window.KeyLabels = KeyLabels;
