/** Dokunmatik keman — sol: parmak pozisyonu, sağ: teller. Ses sadece tel vurulunca. */
const Violin = (() => {
  const STRING_OPEN = [55, 62, 69, 76];
  const STRING_NAMES = ["G", "D", "A", "E"];
  /** Üstten alta ince E → kalın G */
  const DISPLAY_STRINGS = [3, 2, 1, 0];
  const POSITIONS = 13;

  let boardRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 55, endMidi: 88 };
  let onNoteDown = null;
  let onNoteUp = null;
  let cellMap = new Map();
  let fretCellsByString = [[], [], [], []];
  let fretted = [0, 0, 0, 0];
  let fretPointers = new Map();
  let cellW = 40;
  let boardH = 160;

  function midiAt(stringIdx, pos) {
    return STRING_OPEN[stringIdx] + pos;
  }

  function currentMidiForString(stringIdx) {
    return midiAt(stringIdx, fretted[stringIdx] || 0);
  }

  function applySizeVars() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--inst-cell-w", `${Math.max(1.15, cellW * 0.032)}rem`);
    wrapEl.style.setProperty("--inst-row-h", `${Math.max(1.6, boardH / 5)}rem`);
    wrapEl.style.setProperty("--inst-string-h", `${Math.max(2.4, boardH / 6.5)}rem`);
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

  function updateStringHighlights() {
    if (!stringsRoot) return;
    stringsRoot.querySelectorAll(".violin-string").forEach((row) => {
      const s = Number(row.dataset.string);
      const pos = fretted[s] || 0;
      row.classList.toggle("has-fret", pos > 0);
      const label = row.querySelector(".violin-string-fret");
      if (label) label.textContent = pos > 0 ? `pos ${pos}` : "açık";
    });
  }

  function setFretForString(stringIdx, pos) {
    fretted[stringIdx] = pos;
    fretCellsByString[stringIdx]?.forEach((cell) => {
      const p = Number(cell.dataset.pos);
      cell.classList.toggle("fret-held", p === pos && pos > 0);
      cell.classList.toggle("open-selected", p === 0 && pos === 0);
    });
    updateStringHighlights();
  }

  function releaseAll() {
    fretPointers.clear();
    fretted = [0, 0, 0, 0];
    window.AudioEngine?.stopAll?.();
    boardRoot?.querySelectorAll(".violin-cell").forEach((el) => {
      el.classList.remove("active", "fret-held", "open-selected");
    });
    stringsRoot?.querySelectorAll(".violin-string").forEach((el) => {
      el.classList.remove("active", "string-held", "string-vibrating", "has-fret");
    });
  }

  function bindFretCell(el, stringIdx, pos) {
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      fretPointers.set(e.pointerId, { stringIdx, pos });
      setFretForString(stringIdx, pos);
    };
    const up = (e) => {
      const st = fretPointers.get(e.pointerId);
      if (!st || st.stringIdx !== stringIdx) return;
      e.preventDefault();
      fretPointers.delete(e.pointerId);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      if (fretted[stringIdx] === pos) setFretForString(stringIdx, 0);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  function buildBoard() {
    if (!boardRoot) return;
    boardRoot.innerHTML = "";
    cellMap.clear();
    fretCellsByString = [[], [], [], []];

    const header = document.createElement("div");
    header.className = "violin-pos-header";
    header.innerHTML =
      '<span class="violin-corner"></span><div class="violin-fret-cells violin-pos-header-cells"></div>';
    const nums = header.querySelector(".violin-pos-header-cells");
    for (let p = 0; p <= POSITIONS; p++) {
      const h = document.createElement("span");
      h.className = "violin-pos-num";
      h.textContent = p === 0 ? "∅" : String(p);
      nums.appendChild(h);
    }
    boardRoot.appendChild(header);

    for (const s of DISPLAY_STRINGS) {
      const row = document.createElement("div");
      row.className = "violin-string-row";
      row.dataset.string = String(s);

      const label = document.createElement("span");
      label.className = "violin-string-label";
      label.textContent = STRING_NAMES[s];
      row.appendChild(label);

      const lane = document.createElement("div");
      lane.className = "violin-string-lane";
      const wire = document.createElement("div");
      wire.className = "violin-row-wire";
      wire.setAttribute("aria-hidden", "true");
      lane.appendChild(wire);

      const cells = document.createElement("div");
      cells.className = "violin-fret-cells";

      for (let p = 0; p <= POSITIONS; p++) {
        const midi = midiAt(s, p);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "violin-cell";
        cell.dataset.midi = String(midi);
        cell.dataset.string = String(s);
        cell.dataset.pos = String(p);
        bindFretCell(cell, s, p);
        cellMap.set(midi, cell);
        fretCellsByString[s].push(cell);
        cells.appendChild(cell);
      }

      lane.appendChild(cells);
      row.appendChild(lane);
      boardRoot.appendChild(row);
    }

    range = {
      startMidi: STRING_OPEN[0],
      endMidi: STRING_OPEN[3] + POSITIONS,
    };
  }

  function buildStringPlucks() {
    if (!stringsRoot) return;
    stringsRoot.innerHTML = "";
    const title = document.createElement("div");
    title.className = "violin-strings-title";
    title.textContent = "Teller (ince → kalın) — önce pozisyon, sonra tel";
    stringsRoot.appendChild(title);

    for (const s of DISPLAY_STRINGS) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "violin-string string-touch-target";
      row.dataset.string = String(s);
      row.dataset.midi = String(STRING_OPEN[s]);
      row.innerHTML = `<span class="violin-string-name">${STRING_NAMES[s]}</span><span class="violin-string-fret">açık</span><span class="violin-string-line string-line"></span>`;

      window.StringTouch?.bind(
        row,
        () => currentMidiForString(s),
        {
          onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
          onUp: (m, e) => onNoteUp?.(m, e),
        }
      );
      stringsRoot.appendChild(row);
    }
    updateStringHighlights();
  }

  function buildKeys() {
    buildBoard();
    buildStringPlucks();
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
    const cell = cellMap.get(midi);
    if (cell) cell.classList.toggle("hit-target", on);
    stringsRoot?.querySelectorAll(".violin-string").forEach((row) => {
      const s = Number(row.dataset.string);
      if (currentMidiForString(s) === midi) row.classList.toggle("hit-target", on);
    });
  }

  function flash(midi, type) {
    highlightMidi(midi, type === "good");
    setTimeout(() => highlightMidi(midi, false), 320);
  }

  function pressKey(midi, velocity = 0.85) {
    const el = cellMap.get(midi);
    if (el) el.classList.add("active");
    window.AudioEngine.noteOn(midi, velocity);
    onNoteDown?.(midi, velocity);
  }

  function releaseKey(midi) {
    const el = cellMap.get(midi);
    if (el) el.classList.remove("active");
    window.AudioEngine.noteOff(midi);
    onNoteUp?.(midi);
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
