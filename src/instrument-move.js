/** Enstrüman panellerini sürükleyerek konumlandır */
const InstrumentMove = (() => {
  let moveMode = false;
  let drag = null;

  const PANELS = {
    guitarFrets: { selector: "#guitarFretsPanel", defaultPos: { x: 2, y: 4 } },
    guitarStrings: { selector: "#guitarStringsPanel", defaultPos: { x: 2, y: 72 } },
    violinBoard: { selector: "#violinBoardPanel", defaultPos: { x: 4, y: 8 } },
    violinStrings: { selector: "#violinStringsPanel", defaultPos: { x: 68, y: 10 } },
  };

  function layoutKey(id) {
    return `panel_${id}`;
  }

  function applyPanelPosition(el, pos) {
    if (!el || !pos) return;
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
  }

  function applyLayout(settings) {
    const layout = settings?.panelLayout || {};
    for (const [id, meta] of Object.entries(PANELS)) {
      const el = document.querySelector(meta.selector);
      if (!el) continue;
      const pos = layout[layoutKey(id)] || meta.defaultPos;
      applyPanelPosition(el, pos);
    }
  }

  function savePanelPosition(id, x, y) {
    const s = window.AppSettings.load();
    const layout = { ...(s.panelLayout || {}) };
    layout[layoutKey(id)] = {
      x: Math.max(0, Math.min(92, x)),
      y: Math.max(0, Math.min(92, y)),
    };
    window.AppSettings.save({ panelLayout: layout });
  }

  function setMoveMode(on) {
    moveMode = !!on;
    document.body.classList.toggle("instrument-move-mode", moveMode);
    const btn = document.getElementById("btnMoveInstrument");
    if (btn) {
      btn.classList.toggle("active", moveMode);
      btn.textContent = moveMode ? "✓ Konumu kaydet" : "↔ Hareket ettir";
    }
  }

  function isMoveMode() {
    return moveMode;
  }

  function onPointerDown(e) {
    if (!moveMode) return;
    const handle = e.target.closest(".move-handle");
    if (!handle) return;
    const panel = handle.closest(".movable-panel");
    if (!panel) return;
    e.preventDefault();
    e.stopPropagation();
    const parent = panel.offsetParent || panel.parentElement;
    const pr = parent.getBoundingClientRect();
    const left = parseFloat(panel.style.left) || 0;
    const top = parseFloat(panel.style.top) || 0;
    drag = {
      panel,
      id: panel.dataset.moveId,
      parentW: pr.width,
      parentH: pr.height,
      startX: e.clientX,
      startY: e.clientY,
      origX: left,
      origY: top,
    };
    panel.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag) return;
    e.preventDefault();
    const dx = ((e.clientX - drag.startX) / drag.parentW) * 100;
    const dy = ((e.clientY - drag.startY) / drag.parentH) * 100;
    const x = Math.max(0, Math.min(92, drag.origX + dx));
    const y = Math.max(0, Math.min(92, drag.origY + dy));
    drag.panel.style.left = `${x}%`;
    drag.panel.style.top = `${y}%`;
  }

  function onPointerUp(e) {
    if (!drag) return;
    const x = parseFloat(drag.panel.style.left) || 0;
    const y = parseFloat(drag.panel.style.top) || 0;
    if (drag.id) savePanelPosition(drag.id, x, y);
    try {
      drag.panel.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    drag = null;
    window.Game?.resize?.();
  }

  function bind() {
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("pointermove", onPointerMove, { capture: true });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("pointercancel", onPointerUp, { capture: true });
  }

  bind();

  return { setMoveMode, isMoveMode, applyLayout };
})();

window.InstrumentMove = InstrumentMove;
