/** Keman — sol: tek pozisyon şeridi, sağ: tüm teller tek kutuda */
const Violin = (() => {
  const STRING_OPEN = [55, 62, 69, 76];
  const STRING_NAMES = ["E", "A", "D", "G"];
  const DISPLAY_STRINGS = [3, 2, 1, 0];
  const POSITIONS = 13;

  let boardRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 55, endMidi: 88 };
  let onNoteDown = null;
  let onNoteUp = null;
  let globalPos = 0;
  let posButtons = [];
  let cellW = 40;
  let boardH = 160;

  function midiAt(stringIdx, pos) {
    return STRING_OPEN[stringIdx] + pos;
  }

  function currentMidiForString(stringIdx) {
    return midiAt(stringIdx, globalPos);
  }

  function applySizeVars() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--inst-cell-w", `${Math.max(1.1, cellW * 0.03)}rem`);
    wrapEl.style.setProperty("--inst-string-h", `${Math.max(2, boardH / 5.5)}rem`);
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

  function setGlobalPos(pos) {
    globalPos = Math.max(0, Math.min(POSITIONS, pos));
    posButtons.forEach((btn) => {
      const p = Number(btn.dataset.pos);
      btn.classList.toggle("fret-held", p === globalPos);
    });
    stringsRoot?.querySelectorAll(".violin-string-stripe").forEach((row) => {
      const label = row.querySelector(".violin-string-fret");
      if (label) label.textContent = globalPos > 0 ? `pos ${globalPos}` : "açık";
      row.classList.toggle("has-fret", globalPos > 0);
    });
  }

  function releaseAll() {
    globalPos = 0;
    window.AudioEngine?.stopAll?.();
    posButtons.forEach((btn) => btn.classList.remove("fret-held"));
    stringsRoot?.querySelectorAll(".violin-string-stripe").forEach((el) => {
      el.classList.remove("active", "string-held", "string-vibrating", "has-fret");
    });
  }

  function buildPositionStrip() {
    if (!boardRoot) return;
    boardRoot.innerHTML = "";
    boardRoot.className = "violin-chord-strip";
    posButtons = [];

    const head = document.createElement("p");
    head.className = "guitar-chord-hint";
    head.textContent = "Tek pozisyon — seçin, sonra tellere vurun";
    boardRoot.appendChild(head);

    const row = document.createElement("div");
    row.className = "guitar-fret-picker";
    for (let p = 0; p <= POSITIONS; p++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "guitar-fret-btn";
      btn.dataset.pos = String(p);
      btn.textContent = p === 0 ? "∅" : String(p);
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        setGlobalPos(p);
      });
      row.appendChild(btn);
      posButtons.push(btn);
    }
    boardRoot.appendChild(row);
    setGlobalPos(0);
    range = {
      startMidi: STRING_OPEN[0],
      endMidi: STRING_OPEN[3] + POSITIONS,
    };
  }

  function buildStringBundle() {
    if (!stringsRoot) return;
    stringsRoot.innerHTML = "";
    stringsRoot.className = "violin-strings-bundle";

    const title = document.createElement("div");
    title.className = "strings-bundle-title";
    title.textContent = "Teller — çoklu dokunma";
    stringsRoot.appendChild(title);

    const bundle = document.createElement("div");
    bundle.className = "strings-bundle-inner";

    for (const s of DISPLAY_STRINGS) {
      const stripe = document.createElement("div");
      stripe.className = "violin-string-stripe string-touch-target";
      stripe.dataset.string = String(s);
      stripe.innerHTML = `<span class="violin-string-name">${STRING_NAMES[s]}</span><span class="violin-string-fret">açık</span><span class="violin-string-line string-line"></span>`;

      window.StringTouch?.bind(
        stripe,
        () => currentMidiForString(s),
        {
          onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
          onUp: (m, e) => onNoteUp?.(m, e),
        }
      );
      bundle.appendChild(stripe);
    }
    stringsRoot.appendChild(bundle);
    setGlobalPos(globalPos);
  }

  function buildKeys() {
    buildPositionStrip();
    buildStringBundle();
    applySize();
  }

  function init(boardEl, stringsEl, wrap, noteDownCb, noteUpCb) {
    boardRoot = boardEl;
    stringsRoot = stringsEl;
    wrapEl = wrap;
    onNoteDown = noteDownCb;
    onNoteUp = noteUpCb;
    buildKeys();
  }

  function highlightMidi(midi, on) {
    stringsRoot?.querySelectorAll(".violin-string-stripe").forEach((row) => {
      const s = Number(row.dataset.string);
      if (currentMidiForString(s) === midi) row.classList.toggle("hit-target", on);
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

window.Violin = Violin;
