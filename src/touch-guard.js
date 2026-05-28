/** Dokunmatik jestleri kapat — zoom, çift dokunma, tarayıcı kısayolları */
(function () {
  const BLOCK_SEL =
    ".game-area, .instrument-footer, .piano-wrap, .guitar-wrap, .violin-wrap, .guitar-neck, .guitar-pluck-bundle, .inst-card";

  function inPlaySurface(target) {
    return target && typeof target.closest === "function" && target.closest(BLOCK_SEL);
  }

  if ("ontouchstart" in window) {
    window.__touchPianoTouchInput = true;
  }

  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      if (!inPlaySurface(e.target)) return;
      const now = Date.now();
      if (now - lastTouchEnd < 380) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturestart",
    (e) => {
      if (inPlaySurface(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturechange",
    (e) => {
      if (inPlaySurface(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gestureend",
    (e) => {
      if (inPlaySurface(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "dblclick",
    (e) => {
      if (inPlaySurface(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "contextmenu",
    (e) => {
      if (inPlaySurface(e.target)) e.preventDefault();
    },
    { passive: false }
  );
})();
