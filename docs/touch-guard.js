/** Dokunmatik jestleri kapat — çoklu parmak çalma bozulmasın */
(function () {
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );

  if ("ontouchstart" in window) {
    window.__touchPianoTouchInput = true;
  }

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
})();
