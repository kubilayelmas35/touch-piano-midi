/** Dokunmatik / Windows dokunmatik — jestleri ve kısayol çakışmalarını engelle */
(function () {
  const PLAY_ZONE =
    "#instrumentFooter, .game-area, .piano-keys, .guitar-neck, .guitar-pluck-bundle, .strings-bundle-inner, .guitar-cell, .guitar-string, .violin-string, .top-bar .btn, .top-bar button, .sidebar";

  function markTouchInput() {
    window.__touchPianoTouchInput = true;
  }

  function detectTouchHardware() {
    if ("ontouchstart" in window) markTouchInput();
    if (navigator.maxTouchPoints > 0) markTouchInput();
    try {
      if (window.matchMedia("(pointer: coarse)").matches) markTouchInput();
    } catch {
      /* */
    }
  }

  detectTouchHardware();

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch" || e.pointerType === "pen") markTouchInput();
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturestart",
    (e) => e.preventDefault(),
    { passive: false }
  );
  document.addEventListener(
    "gesturechange",
    (e) => e.preventDefault(),
    { passive: false }
  );
  document.addEventListener(
    "gestureend",
    (e) => e.preventDefault(),
    { passive: false }
  );

  function inPlayZone(target) {
    return !!(target && target.closest && target.closest(PLAY_ZONE));
  }

  document.addEventListener(
    "contextmenu",
    (e) => {
      if (!inPlayZone(e.target)) return;
      if (
        window.__touchPianoTouchInput ||
        e.pointerType === "touch" ||
        e.pointerType === "pen"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true, passive: false }
  );

  document.addEventListener(
    "dblclick",
    (e) => {
      if (!inPlayZone(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true }
  );

  document.addEventListener(
    "selectstart",
    (e) => {
      if (inPlayZone(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "dragstart",
    (e) => {
      if (inPlayZone(e.target)) e.preventDefault();
    },
    { passive: false }
  );
})();
