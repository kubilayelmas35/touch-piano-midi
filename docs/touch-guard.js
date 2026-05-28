/** Dokunmatik jestleri kapat — yanlışlıkla zoom/geri gitmeyi önler */
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
