/** Tel vuruşu — dokunma alanındaki tüm teller çalar, ayrılınca susar */
const StringTouch = (() => {
  const bundles = new Map();

  function resolveMidi(getMidi) {
    return typeof getMidi === "function" ? getMidi() : getMidi;
  }

  function vibratoSens() {
    return window.AppSettings?.load?.()?.stringVibratoSens ?? 1;
  }

  function releaseVoice(voiceId) {
    if (voiceId == null) return;
    if (window.AudioEngine.noteOffPluck) window.AudioEngine.noteOffPluck(voiceId);
    else window.AudioEngine.noteOffVoice?.(voiceId);
  }

  function rowsInTouch(rows, e, useNearbyTouch) {
    const nearbyOn =
      typeof useNearbyTouch === "function" ? !!useNearbyTouch(e) : !!useNearbyTouch;
    if (nearbyOn) {
      const area = window.PointerSlide?.touchRect?.(e, 16);
      if (area) {
        const out = [];
        for (const row of rows) {
          const r = row.el.getBoundingClientRect();
          if (window.PointerSlide.rectsIntersect(r, area)) out.push(row);
        }
        return out;
      }
    }
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const el = hit?.closest?.(".string-touch-target");
    const found = el ? rows.find((r) => r.el === el) : null;
    return found ? [found] : [];
  }

  function clearRowVisual(rowState) {
    if (!rowState?.el) return;
    rowState.el.classList.remove("active", "string-held", "string-vibrating");
    rowState.el.style.removeProperty("--vib-intensity");
    rowState.lineEl?.classList.remove("string-line-active");
    rowState.lineEl?.style.removeProperty("--vib-intensity");
    rowState.row?.onVibrateEnd?.();
  }

  function rowLineEl(row) {
    return (
      row.el.querySelector(".string-line") ||
      row.el.querySelector(".guitar-string-line") ||
      row.el.querySelector(".violin-string-line") ||
      row.el
    );
  }

  function startRowVoice(st, row, e) {
    const midi = resolveMidi(row.getMidi);
    if (!midi) return null;

    const vel = window.AudioEngine.velocityFromPointer(e, 0.55);
    const lineEl = rowLineEl(row);
    row.el.classList.add("active", "string-held");
    lineEl?.classList.add("string-line-active");

    const voiceId = window.AudioEngine.noteOn(midi, vel, { poly: true });
    window.AudioEngine.setLiveGain?.(voiceId, vel);
    row.onDown?.(midi, vel, e);

    return {
      row,
      el: row.el,
      lineEl,
      getMidi: row.getMidi,
      midi,
      voiceId,
      baseVel: vel,
      pluck: vel,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      smooth: 0,
    };
  }

  function moveRowVoice(rowState, e) {
    const now = performance.now();
    const dt = Math.max(1, now - rowState.lastT);
    rowState.lastT = now;

    const midi = resolveMidi(rowState.getMidi);
    if (midi !== rowState.midi) {
      window.AudioEngine.setLiveVibrato?.(rowState.voiceId, 0);
      releaseVoice(rowState.voiceId);
      rowState.midi = midi;
      const v = window.AudioEngine.velocityFromPointer(e, rowState.baseVel);
      rowState.voiceId = window.AudioEngine.noteOn(midi, v, { poly: true });
      rowState.baseVel = v;
      rowState.pluck = v;
    }

    const dx = e.clientX - rowState.lastX;
    const dy = e.clientY - rowState.lastY;
    rowState.lastX = e.clientX;
    rowState.lastY = e.clientY;

    const speed = Math.hypot(dx, dy);
    const vSpeed = Math.abs(dy) / dt;
    rowState.smooth = rowState.smooth * 0.55 + speed * 0.45;

    const sens = vibratoSens();
    const depth = Math.min(4, 0.2 + rowState.smooth * 0.12 * sens);
    const hz = 4.5 + Math.min(6, rowState.smooth * 0.14 * sens);
    window.AudioEngine.setLiveVibrato?.(rowState.voiceId, depth, hz);

    const pluckBoost = Math.min(1.85, 0.35 + vSpeed * 0.022 * sens + rowState.smooth * 0.04);
    rowState.pluck = Math.max(rowState.pluck, pluckBoost);
    window.AudioEngine.setLiveGain?.(rowState.voiceId, rowState.pluck);

    const intensity = Math.min(1, rowState.pluck / 1.2);
    rowState.el.style.setProperty("--vib-intensity", String(intensity));
    rowState.el.classList.toggle("string-vibrating", intensity > 0.05);
    rowState.lineEl?.style.setProperty("--vib-intensity", String(intensity));
    rowState.row?.onVibrate?.(intensity);
  }

  function releaseRowVoice(rowState, e) {
    if (rowState.voiceId != null) {
      window.AudioEngine.setLiveVibrato?.(rowState.voiceId, 0);
      releaseVoice(rowState.voiceId);
      rowState.row?.onUp?.(rowState.midi, e);
    }
    clearRowVisual(rowState);
  }

  function syncRows(st, rows, e) {
    if (!st.activeRows) st.activeRows = new Map();
    const want = new Set(rows.map((r) => r.el));

    for (const [el, rowState] of [...st.activeRows]) {
      if (want.has(el)) continue;
      releaseRowVoice(rowState, e);
      st.activeRows.delete(el);
    }

    for (const row of rows) {
      let rowState = st.activeRows.get(row.el);
      if (!rowState) {
        rowState = startRowVoice(st, row, e);
        if (rowState) st.activeRows.set(row.el, rowState);
      } else {
        moveRowVoice(rowState, e);
      }
    }
  }

  function releaseAllRows(st, e) {
    if (!st.activeRows) return;
    for (const rowState of st.activeRows.values()) releaseRowVoice(rowState, e);
    st.activeRows.clear();
  }

  function bindPluckBundle(bundleEl, getRows, options = {}) {
    if (!window.PointerSlide?.bindMultiArea) return;
    const ctl = window.PointerSlide.bindMultiArea(bundleEl, {
      collectTargets: (e) => rowsInTouch(getRows(), e, options.useNearbyTouch),
      onSync: (st, rows, e) => syncRows(st, rows, e),
      onEnd: (st, e) => releaseAllRows(st, e),
    });
    if (!bundleEl.__stringTouchGuardBound) {
      bundleEl.__stringTouchGuardBound = true;
      window.addEventListener("blur", () => ctl.releaseAll?.(), { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) ctl.releaseAll?.();
      });
      bundleEl.addEventListener("pointerleave", () => ctl.releaseAll?.(), { passive: true });
    }
    bundles.set(bundleEl, ctl);
  }

  function bind(el, getMidi, callbacks = {}) {
    bindPluckBundle(el, () => [
      {
        el,
        getMidi,
        onDown: callbacks.onDown,
        onUp: callbacks.onUp,
        onVibrate: callbacks.onVibrate,
        onVibrateEnd: callbacks.onVibrateEnd,
      },
    ]);
  }

  return { bind, bindPluckBundle };
})();

window.StringTouch = StringTouch;
