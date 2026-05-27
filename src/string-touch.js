/** Dokunmatik tel — basılı tutup sürükleyerek titreşim (vibrato) */
const StringTouch = (() => {
  const pointers = new Map();

  function vibratoSens() {
    return window.AppSettings?.load?.()?.stringVibratoSens ?? 1;
  }

  function bind(el, midi, callbacks = {}) {
    const lineEl =
      el.querySelector(".string-line") ||
      el.querySelector(".guitar-string-line") ||
      el.querySelector(".violin-string-line") ||
      el;

    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const vel = window.AudioEngine.velocityFromPointer(e);
      el.classList.add("active", "string-held");
      lineEl?.classList.add("string-line-active");
      window.AudioEngine.noteOn(midi, vel);
      callbacks.onDown?.(midi, vel, e);
      pointers.set(e.pointerId, {
        midi,
        el,
        lineEl,
        lastX: e.clientX,
        lastY: e.clientY,
        smooth: 0,
      });
    };

    const move = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st || st.midi !== midi) return;
      e.preventDefault();
      const dx = e.clientX - st.lastX;
      const dy = e.clientY - st.lastY;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      const speed = Math.hypot(dx, dy);
      st.smooth = st.smooth * 0.65 + speed * 0.35;

      const sens = vibratoSens();
      const depth = Math.min(4, 0.25 + st.smooth * 0.1 * sens);
      const hz = 4.5 + Math.min(5, st.smooth * 0.12 * sens);
      window.AudioEngine.setLiveVibrato?.(midi, depth, hz);

      const intensity = Math.min(1, st.smooth / 14);
      el.style.setProperty("--vib-intensity", String(intensity));
      el.classList.toggle("string-vibrating", intensity > 0.06);
      if (lineEl) {
        lineEl.style.setProperty("--vib-intensity", String(intensity));
      }
    };

    const end = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st || st.midi !== midi) return;
      e.preventDefault();
      pointers.delete(e.pointerId);
      st.el.classList.remove("active", "string-held", "string-vibrating");
      st.el.style.removeProperty("--vib-intensity");
      st.lineEl?.classList.remove("string-line-active");
      st.lineEl?.style.removeProperty("--vib-intensity");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      window.AudioEngine.setLiveVibrato?.(midi, 0);
      window.AudioEngine.noteOff(midi);
      callbacks.onUp?.(midi, e);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  return { bind };
})();

window.StringTouch = StringTouch;
