/** Dokunmatik keman — 4 tel, perde noktaları + tel titreşimi */
const Violin = (() => {
  const STRING_OPEN = [55, 62, 69, 76];
  const STRING_NAMES = ["G", "D", "A", "E"];
  const POSITIONS = 13;

  let boardRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 55, endMidi: 88 };
  let activePointers = new Map();
  let onNoteDown = null;
  let onNoteUp = null;
  let cellMap = new Map();
  let cellW = 40;
  let boardH = 160;

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

  function releaseAll() {
    for (const [, m] of activePointers) window.AudioEngine.noteOff(m);
    activePointers.clear();
    boardRoot?.querySelectorAll(".violin-cell.active").forEach((el) => el.classList.remove("active"));
    stringsRoot?.querySelectorAll(".violin-string.active, .violin-string.string-held").forEach((el) => {
      el.classList.remove("active", "string-held", "string-vibrating");
    });
  }

  function bindFretCell(el, midi) {
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const vel = window.AudioEngine.velocityFromPointer(e);
      el.classList.add("active");
      activePointers.set(e.pointerId, midi);
      window.AudioEngine.noteOn(midi, vel);
      onNoteDown?.(midi, vel, e);
    };
    const up = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      e.preventDefault();
      const m = activePointers.get(e.pointerId);
      activePointers.delete(e.pointerId);
      el.classList.remove("active");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      window.AudioEngine.noteOff(m);
      onNoteUp?.(m, e);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  function buildBoard() {
    if (!boardRoot) return;
    boardRoot.innerHTML = "";
    cellMap.clear();

    const header = document.createElement("div");
    header.className = "violin-pos-header";
    const corner = document.createElement("span");
    corner.className = "violin-corner";
    header.appendChild(corner);
    const nums = document.createElement("div");
    nums.className = "violin-fret-cells violin-pos-header-cells";
    for (let p = 0; p <= POSITIONS; p++) {
      const h = document.createElement("span");
      h.className = "violin-pos-num";
      h.textContent = p === 0 ? "açık" : String(p);
      nums.appendChild(h);
    }
    header.appendChild(nums);
    boardRoot.appendChild(header);

    for (let s = 0; s < 4; s++) {
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
        const midi = STRING_OPEN[s] + p;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "violin-cell";
        cell.dataset.midi = String(midi);
        bindFretCell(cell, midi);
        cellMap.set(midi, cell);
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
    title.textContent = "Teller — basılı tutup sürükleyerek titreştirin";
    stringsRoot.appendChild(title);

    for (let s = 0; s < 4; s++) {
      const midi = STRING_OPEN[s];
      const row = document.createElement("button");
      row.type = "button";
      row.className = "violin-string string-touch-target";
      row.dataset.midi = String(midi);
      row.innerHTML = `<span class="violin-string-name">${STRING_NAMES[s]}</span><span class="violin-string-line string-line"></span>`;
      window.StringTouch?.bind(row, midi, {
        onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
        onUp: (m, e) => onNoteUp?.(m, e),
      });
      stringsRoot.appendChild(row);
    }
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

  return {
    init,
    buildKeys,
    getRange,
    releaseAll,
    setKeySize,
    setAutoFit,
    getKeySize,
    refreshLabels,
    getWrap: () => wrapEl,
  };
})();

window.Violin = Violin;
