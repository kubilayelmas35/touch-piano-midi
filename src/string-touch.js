/** Tel vuruşu — çoklu parmak; dikey hareket = ses şiddeti + titreşim */
const StringTouch = (() => {
  const pointers = new Map();

  function resolveMidi(getMidi) {
    return typeof getMidi === "function" ? getMidi() : getMidi;
  }

  function vibratoSens() {
    return window.AppSettings?.load?.()?.stringVibratoSens ?? 1;
  }

  function bind(el, getMidi, callbacks = {}) {
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
      const midi = resolveMidi(getMidi);
      if (!midi) return;
      el.setPointerCapture(e.pointerId);
      const vel = window.AudioEngine.velocityFromPointer(e, 0.55);
      el.classList.add("active", "string-held");
      lineEl?.classList.add("string-line-active");
      window.AudioEngine.noteOn(midi, vel);
      window.AudioEngine.setLiveGain?.(midi, vel);
      callbacks.onDown?.(midi, vel, e);
      pointers.set(e.pointerId, {
        midi,
        el,
        lineEl,
        getMidi,
        baseVel: vel,
        pluck: vel,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        smooth: 0,
      });
    };

    const move = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      const now = performance.now();
      const dt = Math.max(1, now - st.lastT);
      st.lastT = now;

      const midi = resolveMidi(st.getMidi);
      if (midi !== st.midi) {
        window.AudioEngine.noteOff(st.midi);
        st.midi = midi;
        const v = window.AudioEngine.velocityFromPointer(e, st.baseVel);
        window.AudioEngine.noteOn(midi, v);
        st.baseVel = v;
        st.pluck = v;
      }

      const dx = e.clientX - st.lastX;
      const dy = e.clientY - st.lastY;
      st.lastX = e.clientX;
      st.lastY = e.clientY;

      const speed = Math.hypot(dx, dy);
      const vSpeed = Math.abs(dy) / dt;
      st.smooth = st.smooth * 0.55 + speed * 0.45;

      const sens = vibratoSens();
      const depth = Math.min(4, 0.2 + st.smooth * 0.12 * sens);
      const hz = 4.5 + Math.min(6, st.smooth * 0.14 * sens);
      window.AudioEngine.setLiveVibrato?.(st.midi, depth, hz);

      const pluckBoost = Math.min(1.85, 0.35 + vSpeed * 0.022 * sens + st.smooth * 0.04);
      st.pluck = Math.max(st.pluck, pluckBoost);
      window.AudioEngine.setLiveGain?.(st.midi, st.pluck);

      const intensity = Math.min(1, st.pluck / 1.2);
      st.el.style.setProperty("--vib-intensity", String(intensity));
      st.el.classList.toggle("string-vibrating", intensity > 0.05);
      st.lineEl?.style.setProperty("--vib-intensity", String(intensity));
    };

    const end = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
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
      window.AudioEngine.setLiveVibrato?.(st.midi, 0);
      window.AudioEngine.noteOff(st.midi);
      callbacks.onUp?.(st.midi, e);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  return { bind };
})();

window.StringTouch = StringTouch;
