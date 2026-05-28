/** Gitar — sol: tek akor/perde şeridi, sağ: tüm teller tek kutuda, çoklu dokunma */
const Guitar = (() => {
  const STRING_OPEN = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
  const DISPLAY_STRINGS = [5, 4, 3, 2, 1, 0];
  const FRET_COUNT = 14;

  let fretsRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 40, endMidi: 78 };
  let onNoteDown = null;
  let onNoteUp = null;
  let globalFret = 0;
  let fretButtons = [];
  let cellW = 48;
  let boardH = 140;

  function midiAt(stringIdx, fret) {
    return STRING_OPEN[stringIdx] + fret;
  }

  function currentMidiForString(stringIdx) {
    return midiAt(stringIdx, globalFret);
  }

  function applySizeVars() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--inst-string-h", `${Math.max(2, boardH / 7)}rem`);
  }

  function applySize() {
    applySizeVars();
    if (window.Game?.isReady?.()) window.Game.resize();
  }

  function setKeySize(width, height) {
    cellW = Math.max(28, Math.min(90, width));
    boardH = Math.max(90, Math.min(420, height));
    applySize();
  }

  function setAutoFit() {
    applySize();
  }

  function getKeySize() {
    return { keyWidth: cellW, keyHeight: boardH };
  }

  function getRange() {
    return { ...range };
  }

  function refreshLabels() {}

  function setGlobalFret(fret) {
    globalFret = Math.max(0, Math.min(FRET_COUNT, fret));
    fretButtons.forEach((btn) => {
      btn.classList.toggle("fret-held", Number(btn.dataset.fret) === globalFret);
    });
    stringsRoot?.querySelectorAll(".guitar-string-stripe").forEach((row) => {
      const label = row.querySelector(".guitar-string-fret");
      if (label) label.textContent = globalFret > 0 ? `perde ${globalFret}` : "açık";
      row.classList.toggle("has-fret", globalFret > 0);
    });
  }

  function releaseAll() {
    globalFret = 0;
    window.AudioEngine?.stopAll?.();
    fretButtons.forEach((btn) => btn.classList.remove("fret-held"));
    stringsRoot?.querySelectorAll(".guitar-string-stripe").forEach((el) => {
      el.classList.remove("active", "string-held", "string-vibrating", "has-fret");
    });
  }

  function buildChordStrip() {
    if (!fretsRoot) return;
    fretsRoot.innerHTML = "";
    fretsRoot.className = "guitar-chord-strip";
    fretButtons = [];

    const head = document.createElement("p");
    head.className = "guitar-chord-hint";
    head.textContent = "Tek akor — perde seçin, sonra sağdaki tellere vurun (birden fazla tel)";
    fretsRoot.appendChild(head);

    const row = document.createElement("div");
    row.className = "guitar-fret-picker";
    for (let f = 0; f <= FRET_COUNT; f++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "guitar-fret-btn";
      btn.dataset.fret = String(f);
      btn.textContent = f === 0 ? "∅" : String(f);
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        setGlobalFret(f);
      });
      row.appendChild(btn);
      fretButtons.push(btn);
    }
    fretsRoot.appendChild(row);

    const names = document.createElement("div");
    names.className = "guitar-open-notes";
    names.textContent = DISPLAY_STRINGS.map((s) => STRING_NAMES[s]).join(" · ");
    fretsRoot.appendChild(names);
    setGlobalFret(0);

    range = { startMidi: STRING_OPEN[0], endMidi: STRING_OPEN[5] + FRET_COUNT };
  }

  function buildStringBundle() {
    if (!stringsRoot) return;
    stringsRoot.innerHTML = "";
    stringsRoot.className = "guitar-strings-bundle";

    const title = document.createElement("div");
    title.className = "strings-bundle-title";
    title.textContent = "Teller (ince ↑ kalın ↓)";
    stringsRoot.appendChild(title);

    const bundle = document.createElement("div");
    bundle.className = "strings-bundle-inner";

    for (const s of DISPLAY_STRINGS) {
      const stripe = document.createElement("div");
      stripe.className = "guitar-string-stripe string-touch-target";
      stripe.dataset.string = String(s);
      stripe.innerHTML = `<span class="guitar-string-name">${STRING_NAMES[s]}</span><span class="guitar-string-fret">açık</span><span class="guitar-string-line string-line"></span>`;
      window.StringTouch?.bind(stripe, () => currentMidiForString(s), {
        onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
        onUp: (m, e) => onNoteUp?.(m, e),
      });
      bundle.appendChild(stripe);
    }
    stringsRoot.appendChild(bundle);
    setGlobalFret(globalFret);
  }

  function buildKeys() {
    buildChordStrip();
    buildStringBundle();
    applySize();
  }

  function init(fretsEl, stringsEl, wrap, noteDownCb, noteUpCb) {
    fretsRoot = fretsEl;
    stringsRoot = stringsEl;
    wrapEl = wrap;
    onNoteDown = noteDownCb;
    onNoteUp = noteUpCb;
    buildKeys();
  }

  function highlightMidi(midi, on) {
    stringsRoot?.querySelectorAll(".guitar-string-stripe").forEach((row) => {
      if (currentMidiForString(Number(row.dataset.string)) === midi) {
        row.classList.toggle("hit-target", on);
      }
    });
  }

  function flash(midi, type) {
    highlightMidi(midi, type === "good");
    setTimeout(() => highlightMidi(midi, false), 320);
  }

  function pressKey(midi, velocity = 0.85) {
    window.AudioEngine.noteOn(midi, velocity);
    onNoteDown?.(midi, velocity);
    highlightMidi(midi, true);
  }

  function releaseKey(midi) {
    window.AudioEngine.noteOff(midi);
    onNoteUp?.(midi);
    highlightMidi(midi, false);
  }

  return {
    init,
    buildKeys,
    getRange,
    releaseAll,
    setKeySize,
    setAutoFit,
    getKeySize,
    refreshLabels,
    highlightMidi,
    flash,
    pressKey,
    releaseKey,
    getWrap: () => wrapEl,
  };
})();

window.Guitar = Guitar;
