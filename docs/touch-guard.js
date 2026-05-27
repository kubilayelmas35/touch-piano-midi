/** Windows dokunmatik — sağ tık, uzun basış menüsü, istenmeyen jestler */
(function () {
  const PIANO_ZONE = ".piano-wrap, .piano-keys, .key, .guitar-wrap, .guitar-cell, .guitar-string, .violin-wrap, .violin-cell";

  function inPianoZone(target) {
    return target && target.closest && target.closest(PIANO_ZONE);
  }

  /** Oyun alanında çok parmaklı kaydırma/zoom; piyanoda akor için serbest */
  function blockMultiTouchOutsidePiano(e) {
    if (!e.touches || e.touches.length <= 1) return;
    if (inPianoZone(e.target)) return;
    e.preventDefault();
  }

  document.addEventListener("touchstart", blockMultiTouchOutsidePiano, {
    passive: false,
    capture: true,
  });
  document.addEventListener("touchmove", blockMultiTouchOutsidePiano, {
    passive: false,
    capture: true,
  });

  /** Tarayıcı / Windows uzun basış sağ tık menüsü */
  document.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
    },
    { capture: true }
  );

  /** Dokunmatikte button 2 (sentez sağ tık) */
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch" && e.button !== 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    { capture: true }
  );

  document.addEventListener(
    "auxclick",
    (e) => {
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true }
  );

  document.addEventListener(
    "mousedown",
    (e) => {
      if (e.button === 2 && inPianoZone(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true }
  );

  document.querySelectorAll(".game-area, .piano-wrap, .piano-keys").forEach((el) => {
    el.style.touchAction = "none";
  });

  /** Son giriş dokunmatik mi — contextmenu ayırt etmek için */
  window.__touchPianoTouchInput = false;
  document.addEventListener(
    "pointerdown",
    (e) => {
      window.__touchPianoTouchInput = e.pointerType === "touch";
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    "pointerup",
    (e) => {
      if (e.pointerType === "touch") {
        setTimeout(() => {
          window.__touchPianoTouchInput = false;
        }, 400);
      }
    },
    { capture: true, passive: true }
  );
})();
