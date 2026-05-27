/** Dokunmatik gitar — perdeler + tel çalma */
const Guitar = (() => {
  const STRING_OPEN = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
  const FRET_COUNT = 14;

  let fretsRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 40, endMidi: 78 };
  let activePointers = new Map();
  let onNoteDown = null;
  let onNoteUp = null;
  let cellMap = new Map();

  function midiAt(stringIdx, fret) {
    return STRING_OPEN[stringIdx] + fret;
  }

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
    return { keyWidth: 48, keyHeight: 140 };
  }

  function getRange() {
    return { ...range };
  }

  function refreshLabels() {}

  function releaseAll() {
    for (const [, m] of activePointers) window.AudioEngine.noteOff(m);
    activePointers.clear();
    fretsRoot?.querySelectorAll(".guitar-cell.active, .guitar-string.active").forEach((el) => {
      el.classList.remove("active");
    });
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
    el.addEventListener("pointerleave", (e) => {
      if (activePointers.get(e.pointerId) === midi) up(e);
    });
  }

  function buildFretGrid() {
    if (!fretsRoot) return;
    fretsRoot.innerHTML = "";
    cellMap.clear();

    const header = document.createElement("div");
    header.className = "guitar-fret-header";
    header.innerHTML = '<span class="guitar-corner"></span>';
    for (let f = 0; f <= FRET_COUNT; f++) {
      const h = document.createElement("span");
      h.className = "guitar-fret-num";
      h.textContent = f === 0 ? "∅" : String(f);
      header.appendChild(h);
    }
    fretsRoot.appendChild(header);

    for (let s = 0; s < 6; s++) {
      const row = document.createElement("div");
      row.className = "guitar-string-row";
      const label = document.createElement("span");
      label.className = "guitar-string-label";
      label.textContent = STRING_NAMES[s];
      row.appendChild(label);

      for (let f = 0; f <= FRET_COUNT; f++) {
        const midi = midiAt(s, f);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "guitar-cell";
        cell.dataset.midi = String(midi);
        cell.dataset.string = String(s);
        cell.dataset.fret = String(f);
        cell.title = `${STRING_NAMES[s]} ${f === 0 ? "açık" : `perde ${f}`}`;
        if (f === 0) cell.classList.add("open-fret");
        bindPointer(cell, midi);
        cellMap.set(midi, cell);
        row.appendChild(cell);
      }
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
    title.textContent = "Teller — dokunarak çal";
    stringsRoot.appendChild(title);

    for (let s = 0; s < 6; s++) {
      const midi = STRING_OPEN[s];
      const row = document.createElement("button");
      row.type = "button";
      row.className = "guitar-string";
      row.dataset.midi = String(midi);
      row.innerHTML = `<span class="guitar-string-name">${STRING_NAMES[s]}</span><span class="guitar-string-line"></span>`;
      bindPointer(row, midi);
      stringsRoot.appendChild(row);
    }
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
    const cell = cellMap.get(midi) || stringsRoot?.querySelector(`[data-midi="${midi}"]`);
    if (cell) cell.classList.toggle("hit-target", on);
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
    getWrap: () => wrapEl,
  };
})();

window.Guitar = Guitar;
