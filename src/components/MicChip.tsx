import { useEffect, useRef } from "react";
import { useT } from "../i18n";
import { micState, stopMic } from "../input/mic";
import { noteName } from "../lib/notes";
import { useApp } from "../state/store";
import { IconClose, IconMic } from "../ui/icons";

/** While the microphone listens: input level and the note heard, updated every frame without re-rendering. */
export function MicChip() {
  const t = useT();
  const mic = useApp((s) => s.mic);
  const naming = useApp((s) => s.settings.noteNaming);
  const bar = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (mic !== "on") return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { level, midi } = micState();
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, level)})`;
      if (note.current) note.current.textContent = midi === null ? "–" : noteName(midi, naming, true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mic, naming]);

  if (mic !== "on") return null;
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-500/15 py-1 pr-1 pl-3 text-sm font-semibold text-rose-100 shadow-lg backdrop-blur animate-pop">
      <IconMic size={15} />
      <span>{t("micListening")}</span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
        <div ref={bar} className="h-full w-full origin-left rounded-full bg-rose-300 transition-transform duration-75" style={{ transform: "scaleX(0)" }} />
      </div>
      <span ref={note} className="min-w-8 text-center font-extrabold tabular-nums text-white">
        –
      </span>
      <button
        type="button"
        onClick={stopMic}
        aria-label={t("micStop")}
        className="flex h-6 w-6 items-center justify-center rounded-full text-rose-200 hover:bg-white/10"
      >
        <IconClose size={14} />
      </button>
    </div>
  );
}
