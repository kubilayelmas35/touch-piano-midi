import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { engine } from "../engine/engine";
import { useT } from "../i18n";
import { formatTime } from "../lib/notes";
import { useApp } from "../state/store";

export function Timeline() {
  const t = useT();
  const time = useApp((s) => s.time);
  const endTime = useApp((s) => s.endTime);
  const loop = useApp((s) => s.session.loop);
  const hasSong = useApp((s) => !!s.song);
  const playing = useApp((s) => s.status === "playing");
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const total = Math.max(1, endTime);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`;

  const timeAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!hasSong) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(true);
    engine.seek(timeAt(e.clientX));
    useApp.setState({ time: engine.time });
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const tt = timeAt(e.clientX);
    setHover(tt);
    if (drag) {
      engine.seek(tt);
      useApp.setState({ time: engine.time });
    }
  };
  const onUp = () => setDrag(false);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 5;
    if (e.key === "ArrowLeft") engine.seek(engine.time - step);
    else if (e.key === "ArrowRight") engine.seek(engine.time + step);
    else if (e.key === "Home") engine.seek(0);
    else return;
    e.preventDefault();
    e.stopPropagation();
    useApp.setState({ time: engine.time });
  };

  const shown = Math.max(0, time);
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={hasSong ? 0 : -1}
      aria-label={t("timeline")}
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={formatTime(shown)}
      className="group relative h-4 cursor-pointer touch-none select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKey}
    >
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.07] transition-[height] group-hover:h-[6px]">
        {loop.b > loop.a && loop.a >= 0 && (
          <div
            className={loop.enabled ? "absolute inset-y-0 bg-sky-400/45" : "absolute inset-y-0 bg-sky-400/20"}
            style={{ left: pct(loop.a), width: `calc(${pct(loop.b)} - ${pct(loop.a)})` }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-sky-glow"
          style={{ width: pct(shown), transition: playing && !drag ? "width 100ms linear" : "none" }}
        />
      </div>
      {loop.a >= 0 && (
        <div className="absolute bottom-0 h-3 w-0.5 -translate-x-1/2 rounded bg-sky-300" style={{ left: pct(loop.a) }}>
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-extrabold text-sky-300">A</span>
        </div>
      )}
      {loop.b > loop.a && loop.a >= 0 && (
        <div className="absolute bottom-0 h-3 w-0.5 -translate-x-1/2 rounded bg-sky-300" style={{ left: pct(loop.b) }}>
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-extrabold text-sky-300">B</span>
        </div>
      )}
      {hover !== null && hasSong && (
        <div
          className="pointer-events-none absolute top-full mt-1 -translate-x-1/2 rounded-md bg-ink-700 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-mist-100 shadow"
          style={{ left: pct(hover) }}
        >
          {formatTime(hover)}
        </div>
      )}
    </div>
  );
}
