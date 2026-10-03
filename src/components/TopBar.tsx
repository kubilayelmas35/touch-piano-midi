import { engine } from "../engine/engine";
import type { InstrumentKind } from "../engine/types";
import { useT } from "../i18n";
import { formatTime } from "../lib/notes";
import { cycleLoop, NO_LOOP, updateSession, updateSettings } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import {
  IconChevronDown,
  IconGauge,
  IconGuitar,
  IconHeadphones,
  IconLibrary,
  IconLoop,
  IconMetronome,
  IconPause,
  IconPiano,
  IconPlay,
  IconRestart,
  IconSettings,
  IconSliders,
  IconViolin,
  IconWait,
} from "../ui/icons";
import { Button, IconButton, Popover, Segmented, Slider, Switch, cx } from "../ui/primitives";
import { Timeline } from "./Timeline";

function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-2 pr-1 select-none" aria-label="StaveFlow">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38d6ff" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#lg)" />
        <rect x="8" y="7" width="4" height="12" rx="2" fill="#fff" opacity="0.95" />
        <rect x="14" y="11" width="4" height="9" rx="2" fill="#fff" opacity="0.8" />
        <rect x="20" y="5" width="4" height="15" rx="2" fill="#fff" opacity="0.65" />
        <rect x="6" y="22" width="20" height="3" rx="1.5" fill="#fff" />
      </svg>
      <span className="hidden text-[17px] font-extrabold tracking-tight md:inline">
        Stave<span className="text-brand-300">Flow</span>
      </span>
    </div>
  );
}

function SpeedControl({ compact }: { compact?: boolean }) {
  const t = useT();
  const speed = useApp((s) => s.session.speed);
  const set = (v: number) => updateSession({ speed: Math.round(v * 100) / 100 });
  return (
    <Popover
      label={t("speed")}
      align="end"
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          title={t("speed")}
          className={cx(
            "inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold tabular-nums transition-colors",
            speed !== 1 ? "bg-amber-400/15 text-amber-200" : "text-mist-300 hover:bg-white/[0.07] hover:text-mist-100"
          )}
        >
          <IconGauge size={18} />
          {Math.round(speed * 100)}%
          {!compact && <IconChevronDown size={14} />}
        </button>
      )}
    >
      {() => (
        <div>
          <Slider
            label={t("speed")}
            value={speed}
            min={0.25}
            max={1.5}
            step={0.05}
            onChange={set}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[0.5, 0.75, 1, 1.25].map((v) => (
              <Button key={v} size="sm" variant={speed === v ? "primary" : "subtle"} onClick={() => set(v)}>
                {Math.round(v * 100)}%
              </Button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

function LoopButton() {
  const t = useT();
  const loop = useApp((s) => s.session.loop);
  const state = loop.enabled ? "on" : loop.a >= 0 ? "a" : "off";
  const label = state === "on" ? t("clearLoop") : state === "a" ? t("setB") : t("setA");
  return (
    <IconButton label={`${t("loop")} — ${label}`} active={state !== "off"} onClick={cycleLoop}>
      <IconLoop size={19} />
      {state !== "off" && (
        <span className="absolute -top-0.5 -right-0.5 rounded-md bg-sky-400 px-1 text-[9px] leading-[14px] font-extrabold text-ink-950">
          {state === "a" ? "A" : "AB"}
        </span>
      )}
    </IconButton>
  );
}

function PracticeToggles() {
  const t = useT();
  const waitMode = useApp((s) => s.session.waitMode);
  const autoPlay = useApp((s) => s.session.autoPlay);
  const metronome = useApp((s) => s.settings.metronome);
  return (
    <div className="flex items-center gap-0.5">
      <IconButton label={t("waitMode")} active={waitMode} onClick={() => updateSession({ waitMode: !waitMode })}>
        <IconWait size={19} />
      </IconButton>
      <LoopButton />
      <IconButton label={t("metronome")} active={metronome} onClick={() => updateSettings({ metronome: !metronome })}>
        <IconMetronome size={19} />
      </IconButton>
      <IconButton label={t("autoPlay")} active={autoPlay} onClick={() => updateSession({ autoPlay: !autoPlay })}>
        <IconHeadphones size={19} />
      </IconButton>
      <SpeedControl />
    </div>
  );
}

function PracticeMenu() {
  const t = useT();
  const session = useApp((s) => s.session);
  const metronome = useApp((s) => s.settings.metronome);
  const active = session.waitMode || session.autoPlay || session.loop.a >= 0 || metronome || session.speed !== 1;
  return (
    <Popover
      label={t("practice")}
      align="end"
      trigger={({ open, toggle, ref }) => (
        <IconButton label={t("practice")} active={active || open} onClick={toggle} ref={ref} aria-expanded={open}>
          <IconSliders size={19} />
        </IconButton>
      )}
    >
      {() => (
        <div className="space-y-1">
          <Switch
            label={t("waitMode")}
            hint={t("waitModeHint")}
            checked={session.waitMode}
            onChange={(v) => updateSession({ waitMode: v })}
          />
          <Switch label={t("metronome")} checked={metronome} onChange={(v) => updateSettings({ metronome: v })} />
          <Switch
            label={t("autoPlay")}
            hint={t("autoPlayHint")}
            checked={session.autoPlay}
            onChange={(v) => updateSession({ autoPlay: v })}
          />
          <Slider
            label={t("speed")}
            value={session.speed}
            min={0.25}
            max={1.5}
            step={0.05}
            onChange={(v) => updateSession({ speed: Math.round(v * 100) / 100 })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <div className="pt-1">
            <div className="mb-1.5 text-sm font-medium">{t("loop")}</div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                size="sm"
                onClick={() => updateSession({ loop: { a: Math.max(0, engine.time), b: -1, enabled: false } })}
              >
                A
              </Button>
              <Button
                size="sm"
                disabled={session.loop.a < 0}
                onClick={() => {
                  const b = engine.time;
                  if (b > session.loop.a + 0.5) updateSession({ loop: { a: session.loop.a, b, enabled: true } });
                }}
              >
                B
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateSession({ loop: { ...NO_LOOP } })}>
                {t("clearLoop")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Popover>
  );
}

const INSTRUMENT_ICONS: Record<InstrumentKind, typeof IconPiano> = {
  piano: IconPiano,
  guitar: IconGuitar,
  violin: IconViolin,
};

function InstrumentSwitch({ compact }: { compact?: boolean }) {
  const t = useT();
  const instrument = useApp((s) => s.settings.instrument);
  const options = (["piano", "guitar", "violin"] as InstrumentKind[]).map((id) => {
    const Icon = INSTRUMENT_ICONS[id];
    return {
      value: id,
      title: t(id),
      label: (
        <>
          <Icon size={17} />
          {!compact && <span className="hidden xl:inline">{t(id)}</span>}
        </>
      ),
    };
  });
  return (
    <Segmented
      label={t("instrument")}
      value={instrument}
      options={options}
      onChange={(v) => updateSettings({ instrument: v })}
    />
  );
}

export function TopBar() {
  const t = useT();
  const status = useApp((s) => s.status);
  const song = useApp((s) => s.song);
  const time = useApp((s) => s.time);
  const endTime = useApp((s) => s.endTime);
  const session = useApp((s) => s.session);
  const playing = status === "playing";
  const handLabel = session.hand === "right" ? t("handRight") : session.hand === "left" ? t("handLeft") : null;
  const trackCount = session.playTracks.length;

  return (
    <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-ink-900/85 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
        <Logo />
        <IconButton label={t("library")} onClick={() => setPanel("library")} showLabel className="shrink-0 max-sm:[&>span]:hidden">
          <IconLibrary size={19} />
        </IconButton>

        <button
          type="button"
          disabled={!song}
          onClick={() => setPanel("setup")}
          title={t("songSetup")}
          className="group flex min-w-0 flex-1 items-center gap-1 rounded-xl px-2 py-1 text-left transition-colors hover:bg-white/[0.06] lg:max-w-[26rem] lg:flex-initial"
        >
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-tight font-bold">{song?.title ?? "—"}</span>
            {song && (
              <span className="block truncate text-[11px] leading-tight text-mist-400">
                {song.tracks.length > 1 ? `${t("tracks")}: ${trackCount}/${song.tracks.filter((x) => !x.isDrum).length}` : t("songSetup")}
                {handLabel ? ` · ${t("hands")}: ${handLabel}` : ""}
              </span>
            )}
          </span>
          <IconChevronDown size={16} className="shrink-0 text-mist-400 group-hover:text-mist-100" />
        </button>

        <div className="hidden flex-1 lg:block" />

        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <IconButton label={t("restart")} onClick={() => engine.stop()} disabled={!song}>
            <IconRestart size={19} />
          </IconButton>
          <button
            type="button"
            onClick={() => engine.toggle()}
            disabled={!song}
            aria-label={playing ? t("pause") : t("play")}
            title={`${playing ? t("pause") : t("play")} (Space)`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.9)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            {playing ? <IconPause size={20} /> : <IconPlay size={20} className="translate-x-px" />}
          </button>
          <div className="w-[88px] text-center text-xs font-semibold tabular-nums text-mist-300">
            {formatTime(Math.max(0, time))} <span className="text-mist-400">/ {formatTime(Math.max(0, endTime - 0.6))}</span>
          </div>
        </div>

        <div className="hidden flex-1 lg:block" />

        <div className="hidden shrink-0 lg:block">
          <PracticeToggles />
        </div>
        <div className="shrink-0 lg:hidden">
          <PracticeMenu />
        </div>
        <div className="hidden shrink-0 sm:block">
          <InstrumentSwitch />
        </div>
        <IconButton label={t("settings")} onClick={() => setPanel("settings")} className="shrink-0">
          <IconSettings size={19} />
        </IconButton>
      </div>

      {/* Mobile transport row */}
      <div className="flex h-12 items-center gap-2 px-2 sm:hidden">
        <IconButton label={t("restart")} onClick={() => engine.stop()} disabled={!song}>
          <IconRestart size={19} />
        </IconButton>
        <button
          type="button"
          onClick={() => engine.toggle()}
          disabled={!song}
          aria-label={playing ? t("pause") : t("play")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-lg active:scale-95 disabled:opacity-40"
        >
          {playing ? <IconPause size={18} /> : <IconPlay size={18} className="translate-x-px" />}
        </button>
        <div className="text-xs font-semibold tabular-nums text-mist-300">
          {formatTime(Math.max(0, time))}
          <span className="text-mist-400"> / {formatTime(Math.max(0, endTime - 0.6))}</span>
        </div>
        <div className="flex-1" />
        <InstrumentSwitch compact />
      </div>

      <Timeline />
    </header>
  );
}
