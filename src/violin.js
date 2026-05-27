/** Dokunmatik keman — 4 tel, perde noktaları */
const Violin = (() => {
  const STRING_OPEN = [55, 62, 69, 76];
  const STRING_NAMES = ["G", "D", "A", "E"];
  const POSITIONS = 13;

  let boardRoot = null;
  let wrapEl = null;
  let range = { startMidi: 55, endMidi: 88 };
  let activePointers = new Map();
  let onNoteDown = null;
  let onNoteUp = null;
  let cellMap = new Map();

  function applySize() {
    if (window.Game?.resize) window.Game.resize();
  }

  function setKeySize() {
    applySize();
  }

  function setAutoFit() {
    applySize();
  }

  function getKeySize() {
    return { keyWidth: 40, keyHeight: 160 };
  }

  function getRange() {
    return { ...range };
  }

  function refreshLabels() {}

  function releaseAll() {
    for (const [, m] of activePointers) window.AudioEngine.noteOff(m);
    activePointers.clear();
    boardRoot?.querySelectorAll(".violin-cell.active").forEach((el) => el.classList.remove("active"));
  }

  function bindPointer(el, midi) {
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
    header.innerHTML = '<span></span>';
    for (let p = 0; p <= POSITIONS; p++) {
      const h = document.createElement("span");
      h.textContent = p === 0 ? "açık" : String(p);
      header.appendChild(h);
    }
    boardRoot.appendChild(header);

    for (let s = 0; s < 4; s++) {
      const row = document.createElement("div");
      row.className = "violin-string-row";
      const label = document.createElement("span");
      label.className = "violin-string-label";
      label.textContent = STRING_NAMES[s];
      row.appendChild(label);

      for (let p = 0; p <= POSITIONS; p++) {
        const midi = STRING_OPEN[s] + p;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "violin-cell";
        cell.dataset.midi = String(midi);
        bindPointer(cell, midi);
        cellMap.set(midi, cell);
        row.appendChild(cell);
      }
      boardRoot.appendChild(row);
    }

    range = {
      startMidi: STRING_OPEN[0],
      endMidi: STRING_OPEN[3] + POSITIONS,
    };
    applySize();
  }

  function buildKeys() {
    buildBoard();
  }

  function init(boardEl, wrap, noteDownCb, noteUpCb) {
    boardRoot = boardEl;
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
