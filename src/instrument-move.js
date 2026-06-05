/** Enstrüman panellerini sürükleyerek konumlandır (alt kenara sabitli — yukarı büyür) */
const InstrumentMove = (() => {
  let moveMode = false;
  let drag = null;

  const PANELS = {
    guitarFrets: { selector: "#guitarFretsPanel", defaultPos: { x: 1, y: 0 } },
    guitarStrings: { selector: "#guitarStringsPanel", defaultPos: { x: 72, y: 0 } },
    violinBoard: { selector: "#violinBoardPanel", defaultPos: { x: 1, y: 0 } },
    violinStrings: { selector: "#violinStringsPanel", defaultPos: { x: 72, y: 0 } },
  };

  function layoutKey(id) {
    return `panel_${id}`;
  }

  function applyPanelPosition(el, pos) {
    if (!el || !pos) return;
    el.style.left = `${pos.x}%`;
    el.style.top = "auto";
    el.style.bottom = `${pos.y}%`;
  }

  function readPanelY(panel) {
    const bottom = parseFloat(panel.style.bottom);
    if (!Number.isNaN(bottom) && panel.style.bottom) return bottom;
    const top = parseFloat(panel.style.top);
    if (!Number.isNaN(top) && panel.style.top) {
      return Math.max(0, Math.min(92, 100 - top - 14));
    }
    return 0;
  }

  function applyLayout(settings) {
    const layout = settings?.panelLayout || {};
    for (const [id, meta] of Object.entries(PANELS)) {
      const el = document.querySelector(meta.selector);
      if (!el) continue;
      const saved = layout[layoutKey(id)];
      const pos = saved || meta.defaultPos;
      applyPanelPosition(el, pos);
      if (saved?.fromTop && !saved?.migrated) {
        applyPanelPosition(el, {
          x: saved.x,
          y: Math.max(0, Math.min(92, 100 - saved.y - 14)),
        });
      }
    }
  }

  function savePanelPosition(id, x, y) {
    const s = window.AppSettings.load();
    const layout = { ...(s.panelLayout || {}) };
    layout[layoutKey(id)] = {
      x: Math.max(0, Math.min(92, x)),
      y: Math.max(0, Math.min(92, y)),
      anchor: "bottom",
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
    const bottom = readPanelY(panel);
    drag = {
      panel,
      id: panel.dataset.moveId,
      parentW: pr.width,
      parentH: pr.height,
      startX: e.clientX,
      startY: e.clientY,
      origX: left,
      origY: bottom,
    };
    panel.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag) return;
    e.preventDefault();
    const dx = ((e.clientX - drag.startX) / drag.parentW) * 100;
    const dy = ((e.clientY - drag.startY) / drag.parentH) * 100;
    const x = Math.max(0, Math.min(92, drag.origX + dx));
    const y = Math.max(0, Math.min(92, drag.origY - dy));
    drag.panel.style.left = `${x}%`;
    drag.panel.style.top = "auto";
    drag.panel.style.bottom = `${y}%`;
  }

  function onPointerUp(e) {
    if (!drag) return;
    const x = parseFloat(drag.panel.style.left) || 0;
    const y = readPanelY(drag.panel);
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
