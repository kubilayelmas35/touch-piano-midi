import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { listMics, micState, setMicDevice, stopMic, type MicDevice } from "../input/mic";
import { noteName } from "../lib/notes";
import { updateSettings } from "../state/actions";
import { useApp } from "../state/store";
import { IconChevronDown, IconClose, IconMic } from "../ui/icons";
import { Popover, Slider } from "../ui/primitives";

/** Which microphone to listen with; the list follows devices being plugged in and out. */
export function MicDevicePicker() {
  const t = useT();
  const mic = useApp((s) => s.mic);
  const chosen = useApp((s) => s.settings.micDevice);
  const [devices, setDevices] = useState<MicDevice[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => void listMics().then((d) => alive && setDevices(d));
    load();
    navigator.mediaDevices?.addEventListener?.("devicechange", load);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", load);
    };
    // Names show up once access is granted, so look again when listening starts.
  }, [mic]);

  if (!devices.length) return null;
  const value = devices.some((d) => d.id === chosen) ? chosen : "";
  return (
    <label className="block py-2">
      <span className="mb-1 block text-sm font-medium text-mist-100">{t("micDevice")}</span>
      <select
        value={value}
        onChange={(e) => void setMicDevice(e.target.value)}
        className="h-10 w-full rounded-xl border border-white/10 bg-ink-800 px-3 text-sm"
      >
        <option value="">{t("micDefault")}</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MicSensitivity() {
  const t = useT();
  const value = useApp((s) => s.settings.micSensitivity);
  return (
    <Slider
      label={t("micSensitivity")}
      hint={t("micSensitivityHint")}
      value={value}
      min={0}
      max={1}
      step={0.05}
      onChange={(v) => updateSettings({ micSensitivity: v })}
      format={(v) => `${Math.round(v * 100)}%`}
    />
  );
}

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

  // Kept through "starting" so switching microphones doesn't close the settings.
  if (mic !== "on" && mic !== "starting") return null;
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-rose-300/25 bg-rose-500/15 py-1 pr-1 pl-1 text-sm font-semibold text-rose-100 shadow-lg backdrop-blur animate-pop">
      <Popover
        label={t("micSettings")}
        trigger={({ open, toggle, ref }) => (
          <button
            ref={ref}
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={t("micSettings")}
            title={t("micSettings")}
            className="flex items-center gap-2 rounded-full py-0.5 pr-1.5 pl-2 hover:bg-white/10"
          >
            <IconMic size={15} />
            <span>{t("micListening")}</span>
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
              <div ref={bar} className="h-full w-full origin-left rounded-full bg-rose-300 transition-transform duration-75" style={{ transform: "scaleX(0)" }} />
            </div>
            <span ref={note} className="min-w-8 text-center font-extrabold tabular-nums text-white">
              –
            </span>
            <IconChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        )}
      >
        {() => (
          <div className="text-left font-normal text-mist-100">
            <div className="text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("micSettings")}</div>
            <MicDevicePicker />
            <MicSensitivity />
            <p className="text-xs leading-relaxed text-mist-400">{t("micLevelHint")}</p>
            <p className="mt-2 text-xs leading-relaxed text-mist-400">{t("micNoiseHint")}</p>
          </div>
        )}
      </Popover>
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
