/** Gitar — sol: tek kol (5 tel × perdeler), sağ: renkli teller; ses sadece sağda titreşince */
const Guitar = (() => {
  const STRING_OPEN = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ["e", "B", "G", "D", "A"];
  /** İnce → kalın (5 tel, alt E yok) */
  const DISPLAY_STRINGS = [5, 4, 3, 2, 1];
  const STRING_COLORS = ["#ef4444", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];
  const FRET_COUNT = 14;

  let fretsRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 40, endMidi: 78 };
  let onNoteDown = null;
  let onNoteUp = null;
  let cellMap = new Map();
  let fretCellsByString = {};
  let fretted = {};
  let fretPointers = new Map();
  let cellW = 48;
  let boardH = 140;

  function gripAllStrings() {
    return !!window.AppSettings?.load?.()?.guitarGripAllStrings;
  }

  function midiAt(stringIdx, fret) {
    return STRING_OPEN[stringIdx] + fret;
  }

  function currentMidiForString(stringIdx) {
    const fret = fretted[stringIdx] || 0;
    return midiAt(stringIdx, fret);
  }

  function applySizeVars() {
    if (!wrapEl) return;
    const rowH = Math.max(1.15, boardH / (DISPLAY_STRINGS.length + 1.2));
    wrapEl.style.setProperty("--inst-cell-w", `${Math.max(1.1, cellW * 0.032)}rem`);
    wrapEl.style.setProperty("--inst-row-h", `${rowH}rem`);
    wrapEl.style.setProperty("--inst-string-h", `${Math.min(2.75, rowH)}rem`);
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

  function colorClass(stringIdx) {
    const i = DISPLAY_STRINGS.indexOf(stringIdx);
    return `guitar-str-color-${i >= 0 ? i : 0}`;
  }

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
    if (gripAllStrings()) {
      for (const s of DISPLAY_STRINGS) fretted[s] = fret;
    } else {
      fretted[stringIdx] = fret;
    }
    for (const s of DISPLAY_STRINGS) {
      fretCellsByString[s]?.forEach((cell) => {
        const f = Number(cell.dataset.fret);
        const held = fretted[s] || 0;
        cell.classList.toggle("fret-held", f === held && held > 0);
        cell.classList.toggle("open-selected", f === 0 && held === 0);
      });
    }
    updateStringHighlights();
  }

  function releaseAll() {
    fretPointers.clear();
    fretted = {};
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
      fretPointers.set(e.pointerId, { stringIdx, fret, gripAll: gripAllStrings() });
      setFretForString(stringIdx, fret);
    };
    const up = (e) => {
      const st = fretPointers.get(e.pointerId);
      if (!st) return;
      if (!st.gripAll && st.stringIdx !== stringIdx) return;
      e.preventDefault();
      fretPointers.delete(e.pointerId);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      if (st.gripAll) {
        if (DISPLAY_STRINGS.every((s) => (fretted[s] || 0) === st.fret)) {
          for (const s of DISPLAY_STRINGS) fretted[s] = 0;
          fretsRoot?.querySelectorAll(".guitar-cell").forEach((c) => {
            c.classList.remove("fret-held", "open-selected");
          });
          updateStringHighlights();
        }
      } else if ((fretted[stringIdx] || 0) === st.fret) {
        setFretForString(stringIdx, 0);
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", (e) => {
      const st = fretPointers.get(e.pointerId);
      if (!st) return;
      if (st.gripAll || st.stringIdx === stringIdx) up(e);
    });
  }

  function buildFretGrid() {
    if (!fretsRoot) return;
    fretsRoot.innerHTML = "";
    fretsRoot.className = "guitar-neck";
    cellMap.clear();
    fretCellsByString = {};
    fretted = {};

    const hint = document.createElement("p");
    hint.className = "guitar-neck-hint";
    hint.textContent = gripAllStrings()
      ? "Kol — bir perdeye basınca tüm teller sıkılır; sesi sağda titreterek çalın"
      : "Kol — sıkmak istediğiniz tele/perdeye basın; sesi sağdaki aynı renkteki telden verin";
    fretsRoot.appendChild(hint);

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

    DISPLAY_STRINGS.forEach((s, colorIdx) => {
      fretCellsByString[s] = [];
      const row = document.createElement("div");
      row.className = `guitar-string-row ${colorClass(s)}`;
      row.dataset.string = String(s);
      row.style.setProperty("--str-color", STRING_COLORS[colorIdx]);

      const label = document.createElement("span");
      label.className = "guitar-string-label";
      label.textContent = STRING_NAMES[colorIdx];
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
        if (f === 0) cell.classList.add("open-fret");
        bindFretCell(cell, s, f);
        cellMap.set(midi, cell);
        fretCellsByString[s].push(cell);
        cells.appendChild(cell);
      }

      lane.appendChild(cells);
      row.appendChild(lane);
      fretsRoot.appendChild(row);
    });

    const minMidi = Math.min(...DISPLAY_STRINGS.map((s) => STRING_OPEN[s]));
    const maxMidi = Math.max(...DISPLAY_STRINGS.map((s) => STRING_OPEN[s] + FRET_COUNT));
    range = { startMidi: minMidi, endMidi: maxMidi };
  }

  function buildStringPlucks() {
    if (!stringsRoot) return;
    stringsRoot.innerHTML = "";
    stringsRoot.className = "guitar-strings-bundle";

    const title = document.createElement("div");
    title.className = "strings-bundle-title";
    title.textContent = "Teller — basılı perdeye göre ses (aynı renk = aynı tel)";
    stringsRoot.appendChild(title);

    const bundle = document.createElement("div");
    bundle.className = "strings-bundle-inner guitar-pluck-bundle";

    DISPLAY_STRINGS.forEach((s, colorIdx) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `guitar-string string-touch-target ${colorClass(s)}`;
      row.dataset.string = String(s);
      row.style.setProperty("--str-color", STRING_COLORS[colorIdx]);
      row.innerHTML = `<span class="guitar-string-name">${STRING_NAMES[colorIdx]}</span><span class="guitar-string-fret">açık</span><span class="guitar-string-line string-line"></span>`;

      window.StringTouch?.bind(row, () => currentMidiForString(s), {
        onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
        onUp: (m, e) => onNoteUp?.(m, e),
      });
      bundle.appendChild(row);
    });
    stringsRoot.appendChild(bundle);
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
    highlightMidi(midi, true);
  }

  function releaseKey(midi) {
    const el = cellMap.get(midi);
    if (el) el.classList.remove("active");
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
