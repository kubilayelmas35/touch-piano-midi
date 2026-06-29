/** Gitar / keman — sol kol + sağ teller (ortak mantık) */
function createFrettedInstrument(config) {
  const {
    id,
    STRING_OPEN,
    STRING_NAMES,
    DISPLAY_STRINGS,
    STRING_COLORS,
    STRING_THICK,
    FRET_COUNT,
    gripSettingKey,
    pluckMinVar,
    neckHintGrip,
    neckHintSingle,
    pluckTitle,
    cardNeckTitle,
    cardPluckTitle,
  } = config;

  return (() => {
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
    let autoFrets = {};
    let midiTargets = new Map();

    function gripAllStrings() {
      return !!window.AppSettings?.load?.()?.[gripSettingKey];
    }

    function neckNearbyEnabled() {
      const s = window.AppSettings?.load?.() || {};
      const key = id === "violin" ? "violinNeckNearbyTouch" : "guitarNeckNearbyTouch";
      return s[key] !== false;
    }

    function stringsNearbyEnabled() {
      const s = window.AppSettings?.load?.() || {};
      const key = id === "violin" ? "violinStringsNearbyTouch" : "guitarStringsNearbyTouch";
      return !!s[key];
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

    function colorClass(stringIdx) {
      const i = DISPLAY_STRINGS.indexOf(stringIdx);
      return `guitar-str-color-${i >= 0 ? i : 0}`;
    }

    function getNeckRow(stringIdx) {
      return fretsRoot?.querySelector(`.guitar-string-row[data-string="${stringIdx}"]`);
    }

    function setNeckVibrato(stringIdx, intensity) {
      const row = getNeckRow(stringIdx);
      const wire = row?.querySelector(".guitar-row-wire");
      const light = intensity * 0.42;
      row?.classList.toggle("string-vibrating", light > 0.03);
      wire?.style.setProperty("--vib-intensity", String(light));
      if (light <= 0.03) wire?.style.removeProperty("--vib-intensity");
    }

    function clearNeckVibrato(stringIdx) {
      setNeckVibrato(stringIdx, 0);
    }

    function measureLayoutChrome() {
      let h = 0;
      const banner = document.getElementById("authBanner");
      if (banner && banner.offsetHeight > 0) h += banner.offsetHeight;
      const top = document.querySelector(".top-bar");
      if (top) h += top.offsetHeight;
      return h;
    }

    function applySizeVars() {
      const { neckH, stringH, neckW, pluckW } = layoutFromSettings();
      const requestedRow = Math.max(10, neckH);
      const requestedStr = Math.max(10, stringH);
      const requestedCell = Math.max(10, neckW);
      const colCount = FRET_COUNT + 1;
      const n = DISPLAY_STRINGS.length;
      const fretHeader = 34;
      const cardHead = 52;
      const cardPad = 24;
      const rowGaps = Math.max(0, n - 1) * 2;
      const strGaps = Math.max(0, n - 1) * 3 + 18;

      const baseNeckInner = fretHeader + n * requestedRow + rowGaps;
      const basePluckInner = n * requestedStr + strGaps;
      const baseContentH = cardHead + Math.max(baseNeckInner, basePluckInner) + cardPad;

      const chrome = measureLayoutChrome();
      const maxFooter = Math.max(140, window.innerHeight - chrome);
      const heightScale = Math.min(1, maxFooter / Math.max(1, baseContentH));
      let rowPx = Math.max(6, Math.floor(requestedRow * heightScale));
      let strPx = Math.max(6, Math.floor(requestedStr * heightScale));

      const availColumnH = Math.max(64, maxFooter - cardHead - cardPad);
      const fitRowPx = Math.floor((availColumnH - fretHeader - rowGaps) / Math.max(1, n));
      const fitStrPx = Math.floor((availColumnH - strGaps) / Math.max(1, n));
      rowPx = Math.max(6, Math.min(rowPx, fitRowPx));
      strPx = Math.max(6, Math.min(strPx, fitStrPx));

      const neckInner = fretHeader + n * rowPx + rowGaps;
      const pluckInner = n * strPx + strGaps;
      const contentH = cardHead + Math.max(neckInner, pluckInner) + cardPad;
      const footerH = Math.min(contentH, maxFooter);

      let pluckPx = Math.max(80, pluckW);
      let cellPx = requestedCell;

      document.documentElement.style.setProperty("--footer-row-h", `${footerH}px`);

      const footerEl = document.getElementById("instrumentFooter");
      if (footerEl) {
        footerEl.style.height = "";
        footerEl.style.minHeight = "";
        footerEl.style.maxHeight = `${footerH}px`;
      }

      if (wrapEl) {
        wrapEl.style.height = "auto";
        wrapEl.style.minHeight = "0";
        wrapEl.style.maxHeight = "";
      }

      function finalizeFooterHeight() {
        if (!wrapEl) return;
        wrapEl.style.height = "auto";
        wrapEl.style.maxHeight = "";
        const measured = Math.ceil(wrapEl.getBoundingClientRect().height);
        const nextH = Math.min(Math.max(96, measured + 2), maxFooter);
        document.documentElement.style.setProperty("--footer-row-h", `${nextH}px`);
        if (footerEl) footerEl.style.maxHeight = `${nextH}px`;
      }

      function applyDims(nextRow, nextStr, nextCell, nextPluck) {
        const cellW = `${nextCell}px`;
        const rowH = `${nextRow}px`;
        const strH = `${nextStr}px`;
        const pluck = `${nextPluck}px`;
        const gridCols = `repeat(${colCount}, ${cellW})`;

        const varTargets = [wrapEl, fretsRoot, stringsRoot].filter(Boolean);
        for (const el of varTargets) {
          el.style.setProperty("--inst-cell-w", cellW);
          el.style.setProperty("--inst-row-h", rowH);
          el.style.setProperty("--inst-string-h", strH);
          el.style.setProperty(pluckMinVar, pluck);
        }
        if (wrapEl) {
          wrapEl.style.height = "auto";
          wrapEl.style.minHeight = "0";
          wrapEl.style.maxHeight = "";
          DISPLAY_STRINGS.forEach((s, i) => {
            wrapEl.style.setProperty(`--str-thick-${i}`, `${STRING_THICK[i]}px`);
          });
        }

        fretsRoot
          ?.querySelectorAll(".guitar-fret-cells, .guitar-fret-header-cells")
          .forEach((grid) => {
            grid.style.gridTemplateColumns = gridCols;
          });

        fretsRoot?.querySelectorAll(".guitar-cell, .violin-cell").forEach((cell) => {
          cell.style.width = cellW;
          cell.style.height = rowH;
          cell.style.minHeight = rowH;
          cell.style.flexShrink = "0";
        });

        fretsRoot?.querySelectorAll(".guitar-string-row, .violin-string-row").forEach((row) => {
          row.style.height = rowH;
          row.style.minHeight = rowH;
        });

        const stringsPanel = stringsRoot?.closest(
          ".guitar-strings-panel, .guitar-strings-card, .violin-strings-card"
        );
        if (stringsPanel) {
          stringsPanel.style.width = pluck;
          stringsPanel.style.minWidth = pluck;
        }

        const fretsPanel = fretsRoot?.closest(".guitar-frets-panel");
        if (fretsPanel) {
          const panelW = Math.max(120, colCount * (nextCell + 2) + 48);
          fretsPanel.style.width = `${panelW}px`;
          fretsPanel.style.maxWidth = "100%";
        }

        pluckRows.forEach(({ el }) => {
          el.style.height = strH;
          el.style.minHeight = strH;
          el.style.flexBasis = strH;
        });
      }

      applyDims(rowPx, strPx, cellPx, pluckPx);
      requestAnimationFrame(finalizeFooterHeight);
    }

    function applySize() {
      applySizeVars();
      if (window.Game?.isReady?.()) window.Game.resize();
    }

    if (!window.__frettedLayoutResizeBound) {
      window.__frettedLayoutResizeBound = true;
      window.addEventListener("resize", () => {
        if (wrapEl && !wrapEl.closest(".hidden")) applySizeVars();
      });
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

    function noteLabel(midi) {
      return window.KeyLabels?.noteNameForMidi?.(midi) || String(midi);
    }

    function getTouchedFretsByString() {
      const map = {};
      for (const st of fretPointers.values()) {
        if (st.cells?.length) {
          for (const c of st.cells) {
            if (!map[c.stringIdx]) map[c.stringIdx] = [];
            map[c.stringIdx].push(c.fret);
          }
        } else if (st.gripAll) {
          for (const s of DISPLAY_STRINGS) {
            if (!map[s]) map[s] = [];
            map[s].push(st.fret);
          }
        } else if (st.stringIdx != null) {
          if (!map[st.stringIdx]) map[st.stringIdx] = [];
          map[st.stringIdx].push(st.fret);
        }
      }
      return map;
    }

    function openStringWord() {
      return window.I18n?.t?.("inst.openString") || "open";
    }

    function formatActiveString(fret, midi, touchedFrets) {
      const note = noteLabel(midi);
      if (touchedFrets.length > 1) {
        const uniq = [...new Set(touchedFrets)].sort((a, b) => a - b);
        return `P${fret} · ${note} (${uniq.join("+")}→${fret})`;
      }
      if (fret > 0) return `P${fret} · ${note}`;
      return `${openStringWord()} · ${note}`;
    }

    function updateStringHighlights() {
      const touched = getTouchedFretsByString();
      pluckRows.forEach(({ el, stringIdx }) => {
        const fret = fretted[stringIdx] || 0;
        const midi = currentMidiForString(stringIdx);
        el.dataset.midi = String(midi);
        el.classList.toggle("has-fret", fret > 0);
        const label = el.querySelector(".guitar-string-fret");
        if (label) label.textContent = formatActiveString(fret, midi, touched[stringIdx] || []);
      });
      DISPLAY_STRINGS.forEach((s) => {
        const row = getNeckRow(s);
        const activeEl = row?.querySelector(".guitar-neck-active");
        if (!activeEl) return;
        const fret = fretted[s] || 0;
        const midi = currentMidiForString(s);
        const touches = touched[s] || [];
        if (touches.length || fret > 0 || autoFrets[s] != null) {
          activeEl.textContent = formatActiveString(fret, midi, touches);
        } else {
          activeEl.textContent = "";
        }
      });
    }

    function repaintFretCells() {
      for (const s of DISPLAY_STRINGS) {
        fretCellsByString[s]?.forEach((cell) => {
          const f = Number(cell.dataset.fret);
          const held = fretted[s] ?? 0;
          cell.classList.remove("active-touch");
          cell.classList.toggle("fret-held", f === held && held > 0);
        });
      }
      for (const st of fretPointers.values()) {
        if (st.cells?.length) {
          for (const c of st.cells) {
            fretCellsByString[c.stringIdx]?.[c.fret]?.classList.add("active-touch");
          }
        } else if (st.gripAll) {
          for (const s of DISPLAY_STRINGS) {
            const cell = fretCellsByString[s]?.[st.fret];
            cell?.classList.add("active-touch");
          }
        } else if (st.stringIdx != null) {
          fretCellsByString[st.stringIdx]?.[st.fret]?.classList.add("active-touch");
        }
      }
      updateStringHighlights();
    }

    function mergeFrettedDisplay() {
      const next = {};
      for (const st of fretPointers.values()) {
        if (st.cells?.length) {
          for (const c of st.cells) {
            next[c.stringIdx] = Math.max(next[c.stringIdx] ?? 0, c.fret);
          }
        } else if (st.gripAll) {
          for (const s of DISPLAY_STRINGS) next[s] = Math.max(next[s] ?? 0, st.fret);
        } else if (st.stringIdx != null) {
          next[st.stringIdx] = Math.max(next[st.stringIdx] ?? 0, st.fret);
        }
      }
      for (const s of DISPLAY_STRINGS) {
        if (next[s] == null && autoFrets[s] != null) next[s] = autoFrets[s];
      }
      fretted = next;
      repaintFretCells();
    }

    function pickBarreFret(cells, clientX) {
      const byFret = new Map();
      for (const c of cells) {
        const prev = byFret.get(c.fret) || { count: 0, dist: Infinity };
        const r = c.el.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        byFret.set(c.fret, {
          count: prev.count + 1,
          dist: Math.min(prev.dist, Math.abs(cx - clientX)),
        });
      }
      let best = 0;
      let bestCount = -1;
      let bestDist = Infinity;
      for (const [f, { count, dist }] of byFret) {
        if (count > bestCount || (count === bestCount && dist < bestDist)) {
          bestCount = count;
          bestDist = dist;
          best = f;
        }
      }
      return best;
    }

    function pointerStateFromCells(cells, e) {
      if (gripAllStrings() && cells.length) {
        return { gripAll: true, fret: pickBarreFret(cells, e.clientX) };
      }
      return {
        multi: true,
        cells: cells.map((c) => ({ stringIdx: c.stringIdx, fret: c.fret })),
      };
    }

    function collectNeckCells(e, root) {
      if (!neckNearbyEnabled()) {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".guitar-cell");
        if (!el || !root.contains(el)) return [];
        return [
          {
            el,
            stringIdx: Number(el.dataset.string),
            fret: Number(el.dataset.fret),
            midi: Number(el.dataset.midi),
          },
        ];
      }
      const area = window.PointerSlide.touchRect(e, 18);
      const cells = [];
      root.querySelectorAll(".guitar-cell").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!window.PointerSlide.rectsIntersect(r, area)) return;
        cells.push({
          el,
          stringIdx: Number(el.dataset.string),
          fret: Number(el.dataset.fret),
          midi: Number(el.dataset.midi),
        });
      });
      return cells;
    }

    let neckSlideCtl = null;

    function releaseAll() {
      neckSlideCtl?.releaseAll?.();
      fretPointers.clear();
      autoFrets = {};
      fretted = {};
      window.AudioEngine?.stopAll?.();
      fretsRoot?.querySelectorAll(".guitar-cell").forEach((el) => {
        el.classList.remove("active", "fret-held", "active-touch", "open-selected");
      });
      pluckRows.forEach(({ el, stringIdx }) => {
        el.classList.remove("active", "string-held", "string-vibrating", "has-fret", "hit-target");
        clearNeckVibrato(stringIdx);
      });
    }

    function bindNeckSlide() {
      if (!fretsRoot || !window.PointerSlide?.bindMultiArea || neckSlideCtl) return;
      neckSlideCtl = window.PointerSlide.bindMultiArea(fretsRoot, {
        shouldHandle: (e) => !e.target.closest?.(".move-handle"),
        collectTargets: collectNeckCells,
        onSync: (st, cells, e) => {
          st.pointerId = e.pointerId;
          fretPointers.set(e.pointerId, pointerStateFromCells(cells, e));
          mergeFrettedDisplay();
        },
        onEnd: (st) => {
          if (st.pointerId != null) fretPointers.delete(st.pointerId);
          mergeFrettedDisplay();
        },
      });
    }

    function bindFretCell() {
      /* Perde kaydırma bindNeckSlide ile */
    }

    function buildFretGrid() {
      if (!fretsRoot) return;
      fretsRoot.innerHTML = "";
      fretsRoot.className = "guitar-neck";
      cellMap.clear();
      fretCellsByString = {};
      fretted = {};
      autoFrets = {};
      midiTargets = new Map();

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
        row.style.setProperty("--str-thick", `${STRING_THICK[colorIdx]}px`);

        const labelWrap = document.createElement("div");
        labelWrap.className = "guitar-string-label-wrap";
        labelWrap.innerHTML = `<span class="guitar-string-label">${STRING_NAMES[colorIdx]}</span><span class="guitar-neck-active" aria-live="polite"></span>`;
        row.appendChild(labelWrap);

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
          cellMap.set(midi, cell);
          const prev = midiTargets.get(midi);
          if (!prev || f < prev.fret) midiTargets.set(midi, { cell, stringIdx: s, fret: f });
          fretCellsByString[s].push(cell);
          cells.appendChild(cell);
        }

        lane.appendChild(cells);
        row.appendChild(lane);
        fretsRoot.appendChild(row);
      });

      range = {
        startMidi: Math.min(...DISPLAY_STRINGS.map((s) => STRING_OPEN[s])),
        endMidi: Math.max(...DISPLAY_STRINGS.map((s) => STRING_OPEN[s] + FRET_COUNT)),
      };
      bindNeckSlide();
    }

    function buildStringPlucks() {
      if (!stringsRoot) return;
      stringsRoot.innerHTML = "";
      stringsRoot.className = "guitar-strings-bundle";
      pluckRows = [];

      pluckBundle = document.createElement("div");
      pluckBundle.className = "strings-bundle-inner guitar-pluck-bundle";

      DISPLAY_STRINGS.forEach((s, colorIdx) => {
        const row = document.createElement("div");
        row.className = `guitar-string string-touch-target ${colorClass(s)}`;
        row.dataset.string = String(s);
        row.dataset.midi = String(STRING_OPEN[s]);
        row.style.setProperty("--str-color", STRING_COLORS[colorIdx]);
        row.style.setProperty("--str-thick", `${STRING_THICK[colorIdx]}px`);
        row.innerHTML = `<span class="guitar-string-name">${STRING_NAMES[colorIdx]}</span><span class="guitar-string-fret">${openStringWord()}</span><span class="guitar-string-line string-line"></span>`;

        const entry = {
          el: row,
          stringIdx: s,
          getMidi: () => currentMidiForString(s),
          onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
          onUp: (m, e) => onNoteUp?.(m, e),
          onVibrate: (intensity) => setNeckVibrato(s, intensity),
          onVibrateEnd: () => clearNeckVibrato(s),
        };
        pluckRows.push(entry);
        pluckBundle.appendChild(row);
      });

      stringsRoot.appendChild(pluckBundle);
      window.StringTouch?.bindPluckBundle(pluckBundle, () => pluckRows, {
        useNearbyTouch: () => stringsNearbyEnabled(),
        instrument: id,
      });
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
      const target = midiTargets.get(midi);
      if (target?.cell) target.cell.classList.toggle("hit-target", on);
      if (target?.stringIdx != null) {
        const row = pluckRows.find((r) => r.stringIdx === target.stringIdx);
        if (row) row.el.classList.toggle("hit-target", on);
      }
    }

    function flash(midi, type) {
      highlightMidi(midi, type === "good");
      setTimeout(() => highlightMidi(midi, false), 320);
    }

    function pressKey(midi, velocity = 0.85) {
      const target = midiTargets.get(midi);
      if (target) {
        autoFrets[target.stringIdx] = target.fret;
        mergeFrettedDisplay();
      }
      const el = target?.cell || cellMap.get(midi);
      if (el) el.classList.add("active");
      window.AudioEngine.noteOn(midi, velocity, { poly: true, instrument: id });
      onNoteDown?.(midi, velocity);
      if (target?.stringIdx != null) {
        setNeckVibrato(target.stringIdx, 0.35);
        const row = pluckRows.find((r) => r.stringIdx === target.stringIdx)?.el;
        if (row) {
          row.classList.add("active", "string-held", "string-vibrating");
          row.style.setProperty("--vib-intensity", "0.35");
        }
      }
      highlightMidi(midi, true);
    }

    function releaseKey(midi) {
      const target = midiTargets.get(midi);
      const el = target?.cell || cellMap.get(midi);
      if (el) el.classList.remove("active");
      window.AudioEngine.noteOff(midi);
      onNoteUp?.(midi);
      if (target?.stringIdx != null) {
        if (autoFrets[target.stringIdx] != null) {
          delete autoFrets[target.stringIdx];
          mergeFrettedDisplay();
        }
        const rowEntry = pluckRows.find((r) => r.stringIdx === target.stringIdx);
        const ms = window.AudioEngine?.getSustainMs?.() ?? 550;
        if (rowEntry) {
          window.StringTouch?.decayPluckVisual?.(rowEntry, ms);
        } else {
          clearNeckVibrato(target.stringIdx);
        }
      }
      highlightMidi(midi, false);
    }

    function getMidiTarget(midi) {
      return midiTargets.get(midi);
    }

    return {
      id,
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
      getMidiTarget,
      getWrap: () => wrapEl,
      getNeckHint: () => (gripAllStrings() ? neckHintGrip : neckHintSingle),
      cardNeckTitle,
      cardPluckTitle,
      pluckTitle,
    };
  })();
}

window.createFrettedInstrument = createFrettedInstrument;
