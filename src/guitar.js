/** Dokunmatik gitar — sol: perde (akor), sağ: teller (ince→kalın). Ses sadece tel vurulunca. */
const Guitar = (() => {
  const STRING_OPEN = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
  /** Ekranda üstten alta: ince e → kalın E */
  const DISPLAY_STRINGS = [5, 4, 3, 2, 1, 0];
  const FRET_COUNT = 14;

  let fretsRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 40, endMidi: 78 };
  let onNoteDown = null;
  let onNoteUp = null;
  let cellMap = new Map();
  let fretCellsByString = [];
  let fretted = [0, 0, 0, 0, 0, 0];
  let fretPointers = new Map();
  let cellW = 48;
  let boardH = 140;

  function midiAt(stringIdx, fret) {
    return STRING_OPEN[stringIdx] + fret;
  }

  function currentMidiForString(stringIdx) {
    return midiAt(stringIdx, fretted[stringIdx] || 0);
  }

  function applySizeVars() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--inst-cell-w", `${Math.max(1.25, cellW * 0.034)}rem`);
    wrapEl.style.setProperty("--inst-row-h", `${Math.max(1.5, boardH / 5.5)}rem`);
    wrapEl.style.setProperty("--inst-string-h", `${Math.max(2.2, boardH / 7)}rem`);
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
    stringsRoot.querySelectorAll(".guitar-string").forEach((row) => {
      const s = Number(row.dataset.string);
      const fret = fretted[s] || 0;
      row.classList.toggle("has-fret", fret > 0);
      const label = row.querySelector(".guitar-string-fret");
      if (label) label.textContent = fret > 0 ? `perde ${fret}` : "açık";
    });
  }

  function setFretForString(stringIdx, fret) {
    fretted[stringIdx] = fret;
    fretCellsByString[stringIdx]?.forEach((cell) => {
      const f = Number(cell.dataset.fret);
      cell.classList.toggle("fret-held", f === fret && fret > 0);
      cell.classList.toggle("open-selected", f === 0 && fret === 0);
    });
    updateStringHighlights();
  }

  function releaseAll() {
    fretPointers.clear();
    fretted = [0, 0, 0, 0, 0, 0];
    window.AudioEngine?.stopAll?.();
    fretsRoot?.querySelectorAll(".guitar-cell").forEach((el) => {
      el.classList.remove("active", "fret-held", "open-selected");
    });
    stringsRoot?.querySelectorAll(".guitar-string").forEach((el) => {
      el.classList.remove("active", "string-held", "string-vibrating", "has-fret");
    });
  }

  function bindFretCell(el, stringIdx, fret) {
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      fretPointers.set(e.pointerId, { stringIdx, fret });
      setFretForString(stringIdx, fret);
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
      if (fretted[stringIdx] === fret) {
        setFretForString(stringIdx, 0);
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", (e) => {
      const st = fretPointers.get(e.pointerId);
      if (st?.stringIdx === stringIdx) up(e);
    });
  }

  function buildFretGrid() {
    if (!fretsRoot) return;
    fretsRoot.innerHTML = "";
    cellMap.clear();
    fretCellsByString = [[], [], [], [], [], []];

    const header = document.createElement("div");
    header.className = "guitar-fret-header";
    header.innerHTML =
      '<span class="guitar-corner"></span><div class="guitar-fret-cells guitar-fret-header-cells"></div>';
    const nums = header.querySelector(".guitar-fret-header-cells");
    for (let f = 0; f <= FRET_COUNT; f++) {
      const h = document.createElement("span");
      h.className = "guitar-fret-num";
      h.textContent = f === 0 ? "∅" : String(f);
      nums.appendChild(h);
    }
    fretsRoot.appendChild(header);

    for (const s of DISPLAY_STRINGS) {
      const row = document.createElement("div");
      row.className = "guitar-string-row";
      row.dataset.string = String(s);

      const label = document.createElement("span");
      label.className = "guitar-string-label";
      label.textContent = STRING_NAMES[s];
      row.appendChild(label);

      const lane = document.createElement("div");
      lane.className = "guitar-fret-lane";
      const wire = document.createElement("div");
      wire.className = "guitar-row-wire";
      wire.setAttribute("aria-hidden", "true");
      lane.appendChild(wire);

      const cells = document.createElement("div");
      cells.className = "guitar-fret-cells";

      for (let f = 0; f <= FRET_COUNT; f++) {
        const midi = midiAt(s, f);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "guitar-cell";
        cell.dataset.midi = String(midi);
        cell.dataset.string = String(s);
        cell.dataset.fret = String(f);
        cell.title = `${STRING_NAMES[s]} — ${f === 0 ? "açık tel" : `perde ${f}`}`;
        if (f === 0) cell.classList.add("open-fret");
        bindFretCell(cell, s, f);
        cellMap.set(midi, cell);
        fretCellsByString[s].push(cell);
        cells.appendChild(cell);
      }

      lane.appendChild(cells);
      row.appendChild(lane);
      fretsRoot.appendChild(row);
    }

    range = {
      startMidi: STRING_OPEN[0],
      endMidi: STRING_OPEN[5] + FRET_COUNT,
    };
  }

  function buildStringPlucks() {
    if (!stringsRoot) return;
    stringsRoot.innerHTML = "";
    const title = document.createElement("div");
    title.className = "guitar-strings-title";
    title.textContent = "Teller (ince → kalın) — önce perde, sonra tele vurun";
    stringsRoot.appendChild(title);

    for (const s of DISPLAY_STRINGS) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "guitar-string string-touch-target";
      row.dataset.string = String(s);
      row.dataset.midi = String(STRING_OPEN[s]);
      row.innerHTML = `<span class="guitar-string-name">${STRING_NAMES[s]}</span><span class="guitar-string-fret">açık</span><span class="guitar-string-line string-line"></span>`;

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
    buildFretGrid();
    buildStringPlucks();
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
    const cell = cellMap.get(midi);
    if (cell) cell.classList.toggle("hit-target", on);
    stringsRoot?.querySelectorAll(".guitar-string").forEach((row) => {
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

window.Guitar = Guitar;
