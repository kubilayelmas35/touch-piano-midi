/** Windows dokunmatik — çoklu parmak / kaydırma jestlerini azalt */
(function () {
  const block = (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  };

  document.addEventListener("touchstart", block, { passive: false, capture: true });
  document.addEventListener("touchmove", block, { passive: false, capture: true });

  document.querySelectorAll(".game-area, .piano-wrap, .piano-keys").forEach((el) => {
    el.style.touchAction = "none";
  });
})();
