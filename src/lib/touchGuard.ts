import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { toast } from "../state/store";

const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

/**
 * Stops the browser and OS from treating playing as gestures: long-press menus, pinch / Ctrl+wheel zoom,
 * swipe navigation and image dragging. When Windows still steals the window mid-chord (its three- and
 * four-finger gestures can't be blocked by apps), notes are released and a one-time tip explains the setting.
 */
export function installTouchGuard(): void {
  const opts = { passive: false } as const;
  document.addEventListener("contextmenu", (e) => {
    if (!editable(e.target)) e.preventDefault();
  });
  document.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    opts
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1 && e.cancelable && !editable(e.target)) e.preventDefault();
    },
    opts
  );
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(type, (e) => e.preventDefault(), opts);
  document.addEventListener("dragstart", (e) => {
    if (!editable(e.target)) e.preventDefault();
  });
  document.addEventListener("selectstart", (e) => {
    if (!editable(e.target)) e.preventDefault();
  });

  const touches = new Set<number>();
  let maxTouches = 0;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch") return;
      touches.add(e.pointerId);
      maxTouches = Math.max(maxTouches, touches.size);
    },
    true
  );
  const lift = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (!touches.size) maxTouches = 0;
  };
  document.addEventListener("pointerup", lift, true);
  document.addEventListener("pointercancel", lift, true);

  let tipped = false;
  const stolen = () => {
    if (!touches.size) return;
    const fingers = maxTouches;
    touches.clear();
    maxTouches = 0;
    engine.releaseAll();
    if (isWindows && fingers >= 2 && !tipped) {
      tipped = true;
      toast(tNow("touchGestureTip"), "info", 9000);
    }
  };
  window.addEventListener("blur", stolen);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stolen();
  });
}
