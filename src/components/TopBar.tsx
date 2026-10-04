import { engine } from "../engine/engine";
import type { InstrumentKind } from "../engine/types";
import { useT } from "../i18n";
import { formatTime } from "../lib/notes";
import { dayKey, streak } from "../progress/progress";
import { cycleLoop, NO_LOOP, openFreePlay, updateSession, updateSettings } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import {
  IconChevronDown,
  IconCrown,
  IconFlame,
  IconGauge,
  IconGuitar,
  IconHeadphones,
  IconKeyboard,
  IconLibrary,
  IconLoop,
  IconMetronome,
  IconPause,
  IconPiano,
  IconPlay,
  IconRestart,
  IconSettings,
  IconSliders,
  IconSparkles,
  IconUser,
  IconViolin,
  IconWait,
} from "../ui/icons";
import { Button, IconButton, Popover, Segmented, Slider, Switch, cx } from "../ui/primitives";
import { Timeline } from "./Timeline";

function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-2 pr-1 select-none" aria-label="Sonatrio">
      <img
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        width={30}
        height={30}
        alt=""
        draggable={false}
        className="rounded-[7px] shadow-[0_0_14px_rgba(139,92,246,0.45)]"
      />
      <span className="hidden bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-[17px] font-extrabold tracking-tight text-transparent md:inline">
        Sonatrio
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

function AccountButton() {
  const t = useT();
  const account = useApp((s) => s.account);
  if (account.status === "disabled") return null;
  const initial = (account.username ?? account.email ?? "").slice(0, 1).toUpperCase();
  return (
    <IconButton label={t("account")} onClick={() => setPanel("account")} className="shrink-0">
      {account.status === "signedIn" && initial ? (
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-brand-600 text-[13px] font-extrabold text-white">
          {initial}
          {account.pro && <IconCrown size={11} className="absolute -top-1.5 -right-1.5 text-amber-300" />}
        </span>
      ) : (
        <IconUser size={19} />
      )}
    </IconButton>
  );
}

/** Flame with the current day streak; opens the progress panel. Fills in once today's goal is met. */
function StreakButton({ className }: { className?: string }) {
  const t = useT();
  const p = useApp((s) => s.progress);
  const goal = useApp((s) => s.settings.dailyGoalMin * 60);
  const n = streak(p);
  const today = p.days[dayKey()] ?? 0;
  const met = today >= goal;
  return (
    <button
      type="button"
      onClick={() => setPanel("progress")}
      title={`${t("progress")} · ${t("streakDays", { n })}`}
      aria-label={`${t("progress")}, ${t("streakDays", { n })}`}
      className={cx(
        "relative flex h-9 shrink-0 items-center gap-1 overflow-hidden rounded-full px-2.5 text-sm font-bold tabular-nums transition-colors hover:bg-white/[0.08]",
        className
      )}
    >
      <IconFlame size={18} filled={met} className={n > 0 || met ? "text-orange-400" : "text-mist-400"} />
      <span className={n > 0 ? "text-orange-200" : "text-mist-400"}>{n}</span>
      {!met && (
        <span className="absolute inset-x-2.5 bottom-1 h-[2px] rounded-full bg-white/10" aria-hidden="true">
          <span className="block h-full rounded-full bg-orange-400/80" style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
        </span>
      )}
    </button>
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
  const freePlay = !!song && song.notes.length === 0;
  const canPlay = !!song && !freePlay;
  const fretHand = useApp((s) =>
    s.settings.instrument === "piano"
      ? null
      : s.settings.autoFret && !s.settings.tapToPlay
        ? "right"
        : s.settings.tapToPlay && !s.settings.autoFret
          ? "left"
          : "both"
  );
  const hand = fretHand ?? session.hand;
  const handLabel = hand === "right" ? t("handRight") : hand === "left" ? t("handLeft") : null;
  const trackCount = session.playTracks.length;

  return (
    <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-ink-900/85 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
        <Logo />
        <IconButton label={t("library")} onClick={() => setPanel("library")} showLabel className="shrink-0 max-sm:[&>span]:hidden">
          <IconLibrary size={19} />
        </IconButton>
        <IconButton label={t("studio")} onClick={() => setPanel("studio")} showLabel className="shrink-0 max-xl:[&>span]:hidden">
          <IconSparkles size={19} />
        </IconButton>
        <IconButton
          label={t("freePlay")}
          active={freePlay}
          onClick={openFreePlay}
          showLabel
          className="shrink-0 max-xl:[&>span]:hidden"
        >
          <IconKeyboard size={19} />
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
          <IconButton label={t("restart")} onClick={() => engine.stop()} disabled={!canPlay}>
            <IconRestart size={19} />
          </IconButton>
          <button
            type="button"
            onClick={() => engine.toggle()}
            disabled={!canPlay}
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
        <StreakButton className="max-sm:hidden" />
        <AccountButton />
        <IconButton label={t("settings")} onClick={() => setPanel("settings")} className="shrink-0">
          <IconSettings size={19} />
        </IconButton>
      </div>

      {/* Mobile transport row */}
      <div className="flex h-12 items-center gap-2 px-2 sm:hidden">
        <IconButton label={t("restart")} onClick={() => engine.stop()} disabled={!canPlay}>
          <IconRestart size={19} />
        </IconButton>
        <button
          type="button"
          onClick={() => engine.toggle()}
          disabled={!canPlay}
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
        <StreakButton />
        <InstrumentSwitch compact />
      </div>

      <Timeline />
    </header>
  );
}
