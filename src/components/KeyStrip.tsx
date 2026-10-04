import { useEffect, useRef } from "react";
import { PianoLayout } from "../engine/layout";
import { KEY_ZOOM_MAX } from "../state/settings";
import { useApp } from "../state/store";
import { updateSettings } from "../state/actions";
import { useT } from "../i18n";
import { cx } from "../ui/primitives";

export const KEY_STRIP_H = 30;
const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, KEY_ZOOM_MAX];

/** Overview of the whole piano: shows which part is on screen, drag to scroll, buttons to zoom. */
export function KeyStrip({ piano, used }: { piano: PianoLayout; used: readonly number[] }) {
  const t = useT();
  const zoom = useApp((s) => s.settings.keyZoom);
  const compact = useApp((s) => s.settings.compactKeys);
  const ref = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const mini = new PianoLayout(piano.low, piano.high, w, { only: piano.compact ? piano.keys : null });
    const hit = new Set(used);
    for (const black of [false, true]) {
      for (const m of mini.keys) {
        const l = mini.lane(m)!;
        if (l.black !== black) continue;
        const kh = black && !mini.compact ? h * 0.6 : h;
        g.fillStyle = hit.has(m) ? (black ? "#7c5cf0" : "#a78bfa") : black ? "#1b1d2b" : "#c9cbe0";
        g.fillRect(l.x + 0.25, 0, Math.max(0.5, l.w - 0.5), kh);
      }
    }
    if (piano.fullW > piano.width) {
      const vx = (piano.offset / piano.fullW) * w;
      const vw = (piano.width / piano.fullW) * w;
      g.fillStyle = "rgba(8,9,18,0.55)";
      g.fillRect(0, 0, vx, h);
      g.fillRect(vx + vw, 0, w - vx - vw, h);
      g.strokeStyle = "#f5c451";
      g.lineWidth = 2;
      g.strokeRect(vx + 1, 1, vw - 2, h - 2);
    }
  }, [piano, used]);

  const panTo = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (piano.fullW <= piano.width) return;
    const r = e.currentTarget.getBoundingClientRect();
    const view = piano.width / piano.fullW;
    const pan = ((e.clientX - r.left) / r.width - view / 2) / (1 - view);
    useApp.setState({ keyPan: Math.max(0, Math.min(1, pan)) });
  };

  const step = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.findIndex((z) => z >= zoom - 0.01);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (i < 0 ? 0 : i) + dir))];
    updateSettings({ keyZoom: next });
  };

  const btn = "grid h-6 min-w-6 place-items-center rounded-md px-1 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-30";
  return (
    <div className="flex h-full items-center gap-1 border-t border-white/5 bg-[#0c0d18] px-1.5">
      <button type="button" className={btn} onClick={() => step(-1)} disabled={zoom <= 1} title={t("keyZoomOut")} aria-label={t("keyZoomOut")}>
        −
      </button>
      <canvas
        ref={ref}
        className={cx("h-5 min-w-0 flex-1 rounded-sm touch-none", piano.fullW > piano.width && "cursor-grab")}
        aria-label={t("keyMap")}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          panTo(e);
        }}
        onPointerMove={(e) => dragging.current && panTo(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      />
      <button type="button" className={btn} onClick={() => step(1)} disabled={zoom >= KEY_ZOOM_MAX} title={t("keyZoomIn")} aria-label={t("keyZoomIn")}>
        +
      </button>
      <span className="w-8 text-center text-[11px] tabular-nums text-white/50">{zoom.toFixed(zoom % 1 ? 2 : 0).replace(/0$/, "")}×</span>
      <button
        type="button"
        onClick={() => updateSettings({ compactKeys: !compact })}
        aria-pressed={compact}
        title={t("compactKeysHint")}
        className={cx(
          "h-6 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap",
          compact ? "bg-brand-500/30 text-brand-100" : "text-white/60 hover:bg-white/10"
        )}
      >
        {t("compactKeysShort")}
      </button>
    </div>
  );
}
