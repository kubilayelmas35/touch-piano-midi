/** Dokunmatik piyano — 88 tuş, otomatik boyut */
const Piano = (() => {
  const WHITE_PATTERN = [0, 2, 4, 5, 7, 9, 11];

  let container = null;
  let wrapEl = null;
  let range = { startMidi: 48, endMidi: 83 };
  let keyMap = new Map();
  let activePointers = new Map();
  let keyboardHeld = new Set();
  const holdCount = new Map();
  let onNoteDown = null;
  let onNoteUp = null;
  let keyWidth = 48;
  let keyHeight = 160;
  let autoFitWidth = true;

  function applySize() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--white-key-width", `${keyWidth}px`);
    wrapEl.style.setProperty("--piano-height", `${keyHeight}px`);
    let chrome = 0;
    const banner = document.getElementById("authBanner");
    if (banner?.offsetHeight) chrome += banner.offsetHeight;
    const top = document.querySelector(".top-bar");
    if (top) chrome += top.offsetHeight;
    const usedH = keyHeight + 20;
    const maxFooter = Math.max(120, window.innerHeight - chrome);
    const footerH = Math.min(usedH, maxFooter);
    document.documentElement.style.setProperty("--footer-row-h", `${footerH}px`);
    const footerEl = document.getElementById("instrumentFooter");
    if (footerEl) {
      footerEl.style.height = `${footerH}px`;
      footerEl.style.minHeight = `${footerH}px`;
      footerEl.style.maxHeight = `${footerH}px`;
    }
    wrapEl.style.height = "100%";
    wrapEl.style.minHeight = "0";
    wrapEl.style.maxHeight = "100%";
    if (window.Game && typeof window.Game.resize === "function") {
      window.Game.resize();
    }
  }

  function autoSizeKeys() {
    if (!wrapEl || !container) return;
    const whites = [...keyMap.keys()].filter((m) => WHITE_PATTERN.includes(m % 12));
    if (!whites.length) return;
    const avail = wrapEl.clientWidth - 16;
    const fit = Math.floor(avail / whites.length) - 1;
    keyWidth = Math.max(20, Math.min(100, fit));
    applySize();
  }

  function setKeySize(width, height) {
    autoFitWidth = false;
    keyWidth = Math.max(20, Math.min(100, width));
    keyHeight = Math.max(90, Math.min(420, height));
    applySize();
  }

  function setAutoFit(on) {
    autoFitWidth = !!on;
    if (autoFitWidth) autoSizeKeys();
  }

  function getKeySize() {
    return { keyWidth, keyHeight };
  }

  function refreshLabels() {
    if (window.KeyLabels && keyMap.size) {
      window.KeyLabels.applyToKeys(keyMap, range);
    }
    window.KeyboardInput?.rebuild?.();
  }

  function buildKeys(startOctave, octaveCount) {
    if (!container) return;

    window.KeyboardInput?.releaseAll?.();

    const clamped = window.PianoRange
      ? window.PianoRange.clampRange(startOctave, octaveCount)
      : {
          startMidi: (startOctave + 1) * 12,
          endMidi: (startOctave + 1) * 12 + octaveCount * 12 - 1,
        };

    range = {
      startMidi: clamped.startMidi,
      endMidi: clamped.endMidi,
    };

    keyMap.clear();
    activePointers.clear();
    keyboardHeld.clear();
    container.innerHTML = "";

    const whites = [];
    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PATTERN.includes(m % 12)) whites.push(m);
    }

    for (const midi of whites) {
      const el = createKey(midi, "white");
      container.appendChild(el);
      keyMap.set(midi, el);
    }

    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PATTERN.includes(m % 12)) continue;
      const el = createKey(m, "black");
      let prev = m - 1;
      while (prev >= range.startMidi && !keyMap.has(prev)) prev--;
      const anchor = keyMap.get(prev);
      if (anchor?.nextSibling) container.insertBefore(el, anchor.nextSibling);
      else container.appendChild(el);
      keyMap.set(m, el);
    }

    if (autoFitWidth) autoSizeKeys();
    else applySize();
    refreshLabels();
    bindKeyboardSlide();
  }

  function createKey(midi, kind) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `key ${kind}`;
    el.dataset.midi = String(midi);
    const label = document.createElement("span");
    label.className = "key-label";
    label.textContent = "?";
    el.appendChild(label);
    bindPointer(el, midi);
    bindContextMenu(el, midi);
    return el;
  }

  function openLabelEditor(midi) {
    window.dispatchEvent(
      new CustomEvent("piano:edit-label", { detail: { midi: Number(midi) } })
    );
  }

  function bindContextMenu(el, midi) {
    const openMouse = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      openLabelEditor(midi);
    };

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.__touchPianoTouchInput) return;
      if (e.pointerType === "touch" || e.pointerType === "pen") return;
      openLabelEditor(midi);
    });

    el.addEventListener("auxclick", (e) => {
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.__touchPianoTouchInput || e.pointerType === "touch" || e.pointerType === "pen")
        return;
      openMouse(e);
    });
  }

  function releaseAll() {
    slideCtl?.releaseAll?.();
    for (const [, m] of activePointers) {
      window.AudioEngine.noteOff(m);
    }
    activePointers.clear();
    for (const m of keyboardHeld) {
      window.AudioEngine.noteOff(m);
    }
    keyboardHeld.clear();
    holdCount.clear();
    keyMap.forEach((el) => {
      el.classList.remove("active", "hit-target", "miss-flash", "key-burst");
    });
  }

  function bindPointer(el, midi) {
    /* Oynatma kaydırma bindKeyboardSlide ile — yalnızca sağ tık etiket */
  }

  let slideCtl = null;

  function bindKeyboardSlide() {
    if (!container || !window.PointerSlide || slideCtl) return;
    slideCtl = window.PointerSlide.bind(container, {
      hitTest: (x, y) => {
        const el = document.elementFromPoint(x, y)?.closest?.(".key");
        if (!el || !container.contains(el)) return null;
        const midi = Number(el.dataset.midi);
        if (!midi) return null;
        return { el, midi };
      },
      onEnter: (st, target, e) => {
        st.el = target.el;
        st.midi = target.midi;
        target.el.classList.add("active");
        const vel = window.AudioEngine.velocityFromPointer(e);
        window.AudioEngine.noteOn(st.midi, vel, { poly: true });
        onNoteDown?.(st.midi, vel, e);
      },
      onLeave: (st, e) => {
        if (st.midi == null) return;
        st.el?.classList.remove("active");
        window.AudioEngine.noteOff(st.midi);
        onNoteUp?.(st.midi, e);
        st.midi = null;
        st.el = null;
      },
    });
  }

  function pressKey(midi, velocity = 0.85) {
    if (!midiInRange(midi)) return;
    const el = keyMap.get(midi);
    if (!el) return;
    const next = (holdCount.get(midi) || 0) + 1;
    holdCount.set(midi, next);
    if (next > 1) return;
    keyboardHeld.add(midi);
    el.classList.add("active");
    window.AudioEngine.noteOn(midi, velocity);
    onNoteDown?.(midi, velocity);
  }

  function releaseKey(midi) {
    const cur = holdCount.get(midi) || 0;
    if (cur <= 0) return;
    const next = cur - 1;
    if (next > 0) {
      holdCount.set(midi, next);
      return;
    }
    holdCount.delete(midi);
    if (!keyboardHeld.has(midi)) return;
    keyboardHeld.delete(midi);
    const el = keyMap.get(midi);
    if (el) el.classList.remove("active");
    window.AudioEngine.noteOff(midi);
    onNoteUp?.(midi);
  }

  function flash(midi, type) {
    const el = keyMap.get(midi);
    if (!el) return;
    el.classList.remove("hit-target", "miss-flash");
    el.classList.add(type === "good" ? "hit-target" : "miss-flash");
    if (type === "good") el.classList.add("key-burst");
    setTimeout(() => el.classList.remove("hit-target", "miss-flash", "key-burst"), 320);
  }

  function init(rootEl, wrap, noteDownCb, noteUpCb) {
    container = rootEl;
    wrapEl = wrap;
    onNoteDown = noteDownCb;
    onNoteUp = noteUpCb;
    bindKeyboardSlide();
    window.addEventListener("resize", () => {
      if (autoFitWidth) autoSizeKeys();
    });
  }

  function midiInRange(midi) {
    return midi >= range.startMidi && midi <= range.endMidi;
  }

  function applyLayout() {
    applySize();
  }

  return {
    init,
    buildKeys,
    flash,
    refreshLabels,
    pressKey,
    releaseKey,
    setKeySize,
    setAutoFit,
    getKeySize,
    applySize,
    applyLayout,
    midiInRange,
    getRange: () => ({ ...range }),
    getKeyMap: () => keyMap,
    getKeyElement: (midi) => keyMap.get(midi),
    releaseAll,
  };
})();

window.Piano = Piano;
