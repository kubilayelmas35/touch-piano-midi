/** Parmak kaydırma — tek hedef veya dokunma alanındaki tüm hedefler */
const PointerSlide = (() => {
  function touchRect(e, pad = 14) {
    let w = e.width > 0 ? e.width : 28;
    let h = e.height > 0 ? e.height : 28;
    if (e.radiusX > 0) w = Math.max(w, e.radiusX * 2);
    if (e.radiusY > 0) h = Math.max(h, e.radiusY * 2);
    w += pad * 2;
    h += pad * 2;
    return {
      left: e.clientX - w / 2,
      right: e.clientX + w / 2,
      top: e.clientY - h / 2,
      bottom: e.clientY + h / 2,
    };
  }

  function rectsIntersect(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function samplePath(x0, y0, x1, y1, stepPx = 8) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / stepPx));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    }
    return pts;
  }

  function targetKey(target) {
    if (!target) return null;
    if (target.midi != null) return `m${target.midi}`;
    if (target.stringIdx != null && target.fret != null) {
      return `s${target.stringIdx}f${target.fret}`;
    }
    if (target.row) return target.row;
    if (target.el) return target.el;
    return target;
  }

  function bindMultiArea(rootEl, opts) {
    const {
      collectTargets,
      onSync,
      onEnd,
      shouldHandle = () => true,
      keyOf = targetKey,
      sampleOnMove = true,
    } = opts;
    const pointers = new Map();

    function mergeTargets(st, e) {
      const merged = [];
      const seen = new Set();
      const add = (list) => {
        for (const t of list || []) {
          const k = keyOf(t);
          if (k == null || seen.has(k)) continue;
          seen.add(k);
          merged.push(t);
        }
      };
      add(collectTargets(e, rootEl));
      if (sampleOnMove && st.lastX != null && st.lastY != null) {
        const pts = samplePath(st.lastX, st.lastY, e.clientX, e.clientY, 6);
        for (const p of pts) {
          add(
            collectTargets(
              {
                ...e,
                clientX: p.x,
                clientY: p.y,
                width: 0,
                height: 0,
                radiusX: 0,
                radiusY: 0,
              },
              rootEl
            )
          );
        }
      }
      return merged;
    }

    const sync = (st, e) => {
      onSync(st, mergeTargets(st, e), e);
    };

    const down = (e) => {
      if (!shouldHandle(e)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const targets = collectTargets(e, rootEl) || [];
      if (!targets.length) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        rootEl.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      const st = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      pointers.set(e.pointerId, st);
      onSync(st, targets, e);
    };

    const move = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      sync(st, e);
      st.lastX = e.clientX;
      st.lastY = e.clientY;
    };

    const end = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      onEnd?.(st, e);
      pointers.delete(e.pointerId);
      try {
        rootEl.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    };

    rootEl.addEventListener("pointerdown", down, { passive: false });
    rootEl.addEventListener("pointermove", move, { passive: false });
    rootEl.addEventListener("pointerup", end, { passive: false });
    rootEl.addEventListener("pointercancel", end, { passive: false });

    return {
      releaseAll() {
        for (const [, st] of pointers) onEnd?.(st, {});
        pointers.clear();
      },
    };
  }

  function bind(rootEl, opts) {
    const {
      hitTest,
      onEnter,
      onLeave,
      onMove,
      shouldHandle = () => true,
    } = opts;
    const pointers = new Map();

    function leave(st, e) {
      if (st.target == null) return;
      onLeave?.(st, e);
      st.target = null;
      st.targetId = null;
    }

    function enter(st, target, e) {
      const id = targetKey(target);
      if (st.targetId === id) return;
      leave(st, e);
      st.targetId = id;
      st.target = target;
      if (target != null) onEnter?.(st, target, e);
    }

    function processMove(st, e) {
      const x0 = st.lastX ?? e.clientX;
      const y0 = st.lastY ?? e.clientY;
      const pts = samplePath(x0, y0, e.clientX, e.clientY);
      let lastHit = null;
      for (const p of pts) {
        const hit = hitTest(p.x, p.y);
        if (hit) {
          enter(st, hit, e);
          lastHit = hit;
          onMove?.(st, hit, e);
        }
      }
      const at = hitTest(e.clientX, e.clientY);
      if (at) {
        enter(st, at, e);
        onMove?.(st, at, e);
      } else if (!lastHit) {
        leave(st, e);
      }
      st.lastX = e.clientX;
      st.lastY = e.clientY;
    }

    const down = (e) => {
      if (!shouldHandle(e)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const hit = hitTest(e.clientX, e.clientY);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        rootEl.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      const st = { lastX: e.clientX, lastY: e.clientY, target: null };
      pointers.set(e.pointerId, st);
      enter(st, hit, e);
    };

    const move = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      processMove(st, e);
    };

    const end = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      leave(st, e);
      pointers.delete(e.pointerId);
      try {
        rootEl.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    };

    rootEl.addEventListener("pointerdown", down, { passive: false });
    rootEl.addEventListener("pointermove", move, { passive: false });
    rootEl.addEventListener("pointerup", end, { passive: false });
    rootEl.addEventListener("pointercancel", end, { passive: false });

    return {
      releaseAll() {
        for (const [, st] of pointers) leave(st, {});
        pointers.clear();
      },
    };
  }

  return { bind, bindMultiArea, touchRect, rectsIntersect, samplePath };
})();

window.PointerSlide = PointerSlide;
