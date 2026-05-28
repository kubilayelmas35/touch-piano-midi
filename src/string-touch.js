/** Tel vuruşu — çoklu parmak, sürükleyerek tel değiştirme, titreşim + sönüm */
const StringTouch = (() => {
  const pointers = new Map();

  function resolveMidi(getMidi) {
    return typeof getMidi === "function" ? getMidi() : getMidi;
  }

  function vibratoSens() {
    return window.AppSettings?.load?.()?.stringVibratoSens ?? 1;
  }

  function releaseNote(midi) {
    if (window.AudioEngine.noteOffPluck) window.AudioEngine.noteOffPluck(midi);
    else window.AudioEngine.noteOff(midi);
  }

  function hitRow(rows, clientY) {
    for (const row of rows) {
      const r = row.el.getBoundingClientRect();
      if (clientY >= r.top - 2 && clientY <= r.bottom + 2) return row;
    }
    return null;
  }

  function clearRowVisual(st) {
    if (!st?.el) return;
    st.el.classList.remove("active", "string-held", "string-vibrating");
    st.el.style.removeProperty("--vib-intensity");
    st.lineEl?.classList.remove("string-line-active");
    st.lineEl?.style.removeProperty("--vib-intensity");
  }

  function startRow(st, row, e) {
    clearRowVisual(st);
    st.row = row;
    st.el = row.el;
    st.getMidi = row.getMidi;
    st.lineEl =
      row.el.querySelector(".string-line") ||
      row.el.querySelector(".guitar-string-line") ||
      row.el.querySelector(".violin-string-line") ||
      row.el;

    const midi = resolveMidi(row.getMidi);
    if (!midi) return;
    st.midi = midi;
    const vel = window.AudioEngine.velocityFromPointer(e, 0.55);
    st.baseVel = vel;
    st.pluck = vel;
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    st.lastT = performance.now();
    st.smooth = 0;

    row.el.classList.add("active", "string-held");
    st.lineEl?.classList.add("string-line-active");
    window.AudioEngine.noteOn(midi, vel);
    window.AudioEngine.setLiveGain?.(midi, vel);
    row.onDown?.(midi, vel, e);
  }

  function moveRow(st, e) {
    const now = performance.now();
    const dt = Math.max(1, now - st.lastT);
    st.lastT = now;

    const midi = resolveMidi(st.getMidi);
    if (midi !== st.midi) {
      releaseNote(st.midi);
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
  }

  /** Sağ panel: parmak kaydırınca doğru tel seçilir */
  function bindPluckBundle(bundleEl, getRows) {
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && e.button !== 0) return;
      const rows = getRows();
      const row = hitRow(rows, e.clientY);
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      bundleEl.setPointerCapture(e.pointerId);
      const st = { bundleEl, getRows };
      pointers.set(e.pointerId, st);
      startRow(st, row, e);
    };

    const move = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      const rows = st.getRows();
      const row = hitRow(rows, e.clientY);
      if (row && row !== st.row) {
        if (st.midi) {
          window.AudioEngine.setLiveVibrato?.(st.midi, 0);
          releaseNote(st.midi);
          st.row?.onUp?.(st.midi, e);
        }
        startRow(st, row, e);
      }
      if (st.row) moveRow(st, e);
    };

    const end = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      pointers.delete(e.pointerId);
      if (st.midi) {
        window.AudioEngine.setLiveVibrato?.(st.midi, 0);
        releaseNote(st.midi);
        st.row?.onUp?.(st.midi, e);
      }
      clearRowVisual(st);
      try {
        bundleEl.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    };

    bundleEl.addEventListener("pointerdown", down);
    bundleEl.addEventListener("pointermove", move);
    bundleEl.addEventListener("pointerup", end);
    bundleEl.addEventListener("pointercancel", end);
  }

  function bind(el, getMidi, callbacks = {}) {
    bindPluckBundle(el, () => [{ el, getMidi, onDown: callbacks.onDown, onUp: callbacks.onUp }]);
  }

  return { bind, bindPluckBundle };
})();

window.StringTouch = StringTouch;
