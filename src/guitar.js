/** Gitar — sol kol (6 tel), sağ teller; sol sık + sağ titreşim */
const Guitar = (() => {
  const STRING_OPEN = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
  const DISPLAY_STRINGS = [5, 4, 3, 2, 1, 0];
  const STRING_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];
  /** İnce → kalın tel kalınlığı (px) */
  const STRING_THICK = [1.2, 1.5, 1.85, 2.2, 2.65, 3.2];
  const FRET_COUNT = 14;

  let fretsRoot = null;
  let stringsRoot = null;
  let pluckBundle = null;
  let wrapEl = null;
  let range = { startMidi: 40, endMidi: 78 };
  let onNoteDown = null;
  let onNoteUp = null;
  let cellMap = new Map();
  let fretCellsByString = {};
  let pluckRows = [];
  let fretted = {};
  let fretPointers = new Map();

  function gripAllStrings() {
    return !!window.AppSettings?.load?.()?.guitarGripAllStrings;
  }

  function layoutFromSettings() {
    const s = window.AppSettings?.load?.() || {};
    const stringH = s.guitarStringHeight ?? 30;
    return {
      neckH: s.guitarNeckHeight ?? stringH,
      stringH,
      neckW: s.guitarNeckWidth ?? s.keyWidth ?? 42,
      pluckW: s.guitarPluckWidth ?? 220,
    };
  }

  function midiAt(stringIdx, fret) {
    return STRING_OPEN[stringIdx] + fret;
  }

  function currentMidiForString(stringIdx) {
    return midiAt(stringIdx, fretted[stringIdx] || 0);
  }

  function applySizeVars() {
    if (!wrapEl) return;
    const { neckH, stringH, neckW, pluckW } = layoutFromSettings();
    const rowRem = Math.max(0.65, neckH / 16);
    const strRem = Math.max(0.65, stringH / 16);
    wrapEl.style.setProperty("--inst-cell-w", `${Math.max(0.75, neckW / 16)}rem`);
    wrapEl.style.setProperty("--inst-row-h", `${rowRem}rem`);
    wrapEl.style.setProperty("--inst-string-h", `${strRem}rem`);
    wrapEl.style.setProperty("--guitar-pluck-min-w", `${Math.max(80, pluckW)}px`);
    DISPLAY_STRINGS.forEach((s, i) => {
      wrapEl.style.setProperty(`--str-thick-${i}`, `${STRING_THICK[i]}px`);
    });
  }

  function applySize() {
    applySizeVars();
    if (window.Game?.isReady?.()) window.Game.resize();
  }

  function applyLayout() {
    applySize();
  }

  function setKeySize(width, height) {
    const s = window.AppSettings?.load?.() || {};
    window.AppSettings?.save?.({
      guitarNeckWidth: width ?? s.guitarNeckWidth,
      guitarNeckHeight: height ?? s.guitarNeckHeight,
      keyWidth: width ?? s.keyWidth,
      keyHeight: height ?? s.keyHeight,
    });
    applySize();
  }

  function setAutoFit() {
    applySize();
  }

  function getKeySize() {
    const L = layoutFromSettings();
    return { keyWidth: L.neckW, keyHeight: L.neckH };
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
    pluckRows.forEach(({ el, stringIdx }) => {
      const fret = fretted[stringIdx] || 0;
      const midi = currentMidiForString(stringIdx);
      el.dataset.midi = String(midi);
      el.classList.toggle("has-fret", fret > 0);
      const label = el.querySelector(".guitar-string-fret");
      if (label) label.textContent = fret > 0 ? `perde ${fret}` : "açık";
    });
  }

  /** Tüm aktif parmaklardan tellerin perdesini hesapla (çoklu dokunma) */
  function recomputeFrettedFromPointers() {
    const next = {};
    for (const s of DISPLAY_STRINGS) next[s] = 0;

    for (const st of fretPointers.values()) {
      if (st.gripAll) {
        for (const s of DISPLAY_STRINGS) {
          next[s] = Math.max(next[s], st.fret);
        }
      } else {
        next[s] = Math.max(next[s] || 0, st.fret);
      }
    }
    fretted = next;
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
    pluckRows.forEach(({ el }) => {
      el.classList.remove("active", "string-held", "string-vibrating", "has-fret");
    });
  }

  function bindFretCell(el, stringIdx, fret) {
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      fretPointers.set(e.pointerId, { stringIdx, fret, gripAll: gripAllStrings() });
      recomputeFrettedFromPointers();
    };
    const up = (e) => {
      if (!fretPointers.has(e.pointerId)) return;
      e.preventDefault();
      fretPointers.delete(e.pointerId);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      recomputeFrettedFromPointers();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
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
      ? "Kol — birden fazla perdeye aynı anda basabilirsiniz (çok parmak)"
      : "Kol — her tele ayrı perde; aynı anda birden fazla hücreye basın";
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
      row.style.setProperty("--str-thick", STRING_THICK[colorIdx] + "px");

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

    range = {
      startMidi: STRING_OPEN[0],
      endMidi: STRING_OPEN[5] + FRET_COUNT,
    };
  }

  function buildStringPlucks() {
    if (!stringsRoot) return;
    stringsRoot.innerHTML = "";
    stringsRoot.className = "guitar-strings-bundle";
    pluckRows = [];

    const title = document.createElement("div");
    title.className = "strings-bundle-title";
    title.textContent = "Teller — parmağı kaydırarak tel seçin";
    stringsRoot.appendChild(title);

    pluckBundle = document.createElement("div");
    pluckBundle.className = "strings-bundle-inner guitar-pluck-bundle";

    DISPLAY_STRINGS.forEach((s, colorIdx) => {
      const row = document.createElement("div");
      row.className = `guitar-string string-touch-target ${colorClass(s)}`;
      row.dataset.string = String(s);
      row.dataset.midi = String(STRING_OPEN[s]);
      row.style.setProperty("--str-color", STRING_COLORS[colorIdx]);
      row.style.setProperty("--str-thick", STRING_THICK[colorIdx] + "px");
      row.innerHTML = `<span class="guitar-string-name">${STRING_NAMES[colorIdx]}</span><span class="guitar-string-fret">açık</span><span class="guitar-string-line string-line"></span>`;

      const entry = {
        el: row,
        stringIdx: s,
        getMidi: () => currentMidiForString(s),
        onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
        onUp: (m, e) => onNoteUp?.(m, e),
      };
      pluckRows.push(entry);
      pluckBundle.appendChild(row);
    });

    stringsRoot.appendChild(pluckBundle);

    window.StringTouch?.bindPluckBundle(pluckBundle, () => pluckRows);
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
    pluckRows.forEach(({ el, stringIdx }) => {
      if (currentMidiForString(stringIdx) === midi) el.classList.toggle("hit-target", on);
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
    applyLayout,
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
