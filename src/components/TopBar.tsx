import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { engine } from "../engine/engine";
import type { InstrumentKind } from "../engine/types";
import { useT } from "../i18n";
import { micSupported, toggleMic } from "../input/mic";
import { proOrTrial, useHasPro } from "../auth/account";
import { pendingCount } from "../social/social";
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
  IconMic,
  IconMore,
  IconRoute,
  IconPause,
  IconPedal,
  IconPiano,
  IconPlay,
  IconRestart,
  IconSettings,
  IconSliders,
  IconSparkles,
  IconUser,
  IconUsers,
  IconDuet,
  IconViolin,
  IconWait,
} from "../ui/icons";
import { Button, IconButton, Popover, Segmented, Slider, Switch, cx } from "../ui/primitives";
import { Timeline } from "./Timeline";
import { UserAvatar } from "./UserAvatar";

function Logo({ iconOnly }: { iconOnly?: boolean }) {
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
      <span
        className={cx(
          "hidden bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-[17px] font-extrabold tracking-tight text-transparent",
          !iconOnly && "xl:inline"
        )}
      >
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

/** Piano only: toggles the soft sustain of released keys. */
function PedalButton() {
  const t = useT();
  const piano = useApp((s) => s.settings.instrument === "piano");
  const pedal = useApp((s) => s.settings.pianoPedal);
  if (!piano) return null;
  return (
    <IconButton label={`${t("pianoPedal")} (Shift)`} active={pedal} onClick={() => updateSettings({ pianoPedal: !pedal })}>
      <IconPedal size={19} />
    </IconButton>
  );
}

/** Marks a toolbar button whose feature needs Pro. */
function ProCrown() {
  return <IconCrown size={11} className="absolute top-0.5 right-0.5 text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />;
}

/** Listens to a real instrument through the microphone instead of the on-screen one. */
function MicButton() {
  const t = useT();
  const mic = useApp((s) => s.mic);
  const pro = useHasPro();
  if (!micSupported()) return null;
  return (
    <IconButton label={pro ? t("micListen") : `${t("micListen")} (Pro)`} active={mic === "on"} onClick={() => void toggleMic()}>
      <IconMic size={19} />
      {mic === "on" && <span className="absolute top-1 right-1 h-2 w-2 animate-pulse rounded-full bg-rose-400" />}
      {!pro && <ProCrown />}
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
      <PedalButton />
      <MicButton />
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
  const piano = useApp((s) => s.settings.instrument === "piano");
  const pedal = useApp((s) => s.settings.pianoPedal);
  const mic = useApp((s) => s.mic);
  const pro = useHasPro();
  const active = session.waitMode || session.autoPlay || session.loop.a >= 0 || metronome || session.speed !== 1 || mic === "on";
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
          {piano && (
            <Switch label={t("pianoPedal")} hint={t("pianoPedalHint")} checked={pedal} onChange={(v) => updateSettings({ pianoPedal: v })} />
          )}
          {micSupported() && (
            <Switch
              label={pro ? t("micListen") : `${t("micListen")} · PRO`}
              hint={t("micListenHint")}
              checked={mic === "on"}
              onChange={() => void toggleMic()}
            />
          )}
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

function FriendsButton() {
  const t = useT();
  const on = useApp((s) => s.account.status !== "disabled");
  const waiting = useApp((s) => pendingCount(s.social));
  const pro = useHasPro();
  if (!on) return null;
  return (
    <IconButton label={pro ? t("friends") : `${t("friends")} (Pro)`} onClick={() => setPanel(pro ? "friends" : "pro")} className="shrink-0">
      <IconUsers size={19} />
      {!pro && waiting === 0 && <ProCrown />}
      {waiting > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-extrabold text-white">{waiting}</span>
      )}
    </IconButton>
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
        <span className="relative">
          <UserAvatar url={account.avatar} name={initial} me className="h-7 w-7 text-[13px]" />
          {proOrTrial(account) && <IconCrown size={11} className={cx("absolute -top-1.5 -right-1.5 text-amber-300", !account.pro && "opacity-60")} />}
        </span>
      ) : (
        <IconUser size={19} />
      )}
    </IconButton>
  );
}

/** Narrow screens: the less used buttons, folded into one menu so the song title keeps its room. */
function MoreMenu() {
  const t = useT();
  const freePlay = useApp((s) => !!s.song && s.song.notes.length === 0);
  const accountOn = useApp((s) => s.account.status !== "disabled");
  const waiting = useApp((s) => pendingCount(s.social));
  const pro = useHasPro();
  const p = useApp((s) => s.progress);
  const n = streak(p);
  const items: { label: string; icon: ReactNode; onClick: () => void; active?: boolean; extra?: ReactNode }[] = [
    { label: t("studio"), icon: <IconSparkles size={18} />, onClick: () => setPanel("studio") },
    { label: t("freePlay"), icon: <IconKeyboard size={18} />, onClick: openFreePlay, active: freePlay },
    {
      label: t("progress"),
      icon: <IconFlame size={18} className={n > 0 ? "text-orange-400" : ""} />,
      onClick: () => setPanel("progress"),
      extra: <span className="text-xs font-bold text-orange-200 tabular-nums">{t("streakDays", { n })}</span>,
    },
    ...(accountOn
      ? [
          {
            label: t("friends"),
            icon: <IconUsers size={18} />,
            onClick: () => setPanel(pro ? "friends" : "pro"),
            extra:
              waiting > 0 ? (
                <span className="rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">{waiting}</span>
              ) : !pro ? (
                <IconCrown size={14} className="text-amber-300" />
              ) : undefined,
          },
          { label: t("duet"), icon: <IconDuet size={18} />, onClick: () => setPanel("duet") },
          { label: t("account"), icon: <IconUser size={18} />, onClick: () => setPanel("account") },
        ]
      : []),
    { label: t("settings"), icon: <IconSettings size={18} />, onClick: () => setPanel("settings") },
  ];
  return (
    <Popover
      label={t("more")}
      align="end"
      trigger={({ open, toggle, ref }) => (
        <IconButton label={t("more")} active={open} onClick={toggle} ref={ref} aria-expanded={open}>
          <IconMore size={20} />
        </IconButton>
      )}
    >
      {(close) => (
        <ul className="-m-1 space-y-0.5">
          {items.map((it) => (
            <li key={it.label}>
              <button
                type="button"
                onClick={() => {
                  close();
                  it.onClick();
                }}
                className={cx(
                  "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors hover:bg-white/[0.07]",
                  it.active && "bg-brand-500/20 text-brand-100"
                )}
              >
                <span className="text-mist-300">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {it.extra}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
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

const MAX_DENSITY = 5;

/**
 * How much the toolbar row has to fold up to fit: 0 shows everything its breakpoint allows; each
 * level hides more (instrument names → other labels → practice toggles → right-side buttons → time). Stepped up before paint
 * while the row still overflows, and started over whenever the width or `key` content changes.
 */
function useDensity(key: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fit, setFit] = useState({ key: "", level: 0 });
  const fullKey = `${width}|${key}`;
  const level = fit.key === fullKey ? fit.level : 0;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && level < MAX_DENSITY && el.scrollWidth > el.clientWidth + 1) setFit({ key: fullKey, level: level + 1 });
  });
  return { level, ref };
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
  const coach = useApp((s) => !!s.coach);
  const lang = useApp((s) => s.settings.language);
  const instrument = useApp((s) => s.settings.instrument);
  const accountStatus = useApp((s) => s.account.status);
  const { level: dense, ref: rowRef } = useDensity(`${lang}|${instrument}|${accountStatus}`);
  const labels = (from: "lg" | "xl") => (dense >= 2 ? "[&>span]:hidden" : from === "lg" ? "max-lg:[&>span]:hidden" : "max-xl:[&>span]:hidden");

  return (
    <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-ink-900/85 backdrop-blur-xl">
      <div ref={rowRef} className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
        <Logo iconOnly={dense >= 2} />
        <IconButton label={t("library")} onClick={() => setPanel("library")} showLabel className={cx("shrink-0", labels("lg"))}>
          <IconLibrary size={19} />
        </IconButton>
        <IconButton label={t("myPath")} active={coach} onClick={() => setPanel("path")} showLabel className={cx("shrink-0", labels("xl"))}>
          <IconRoute size={19} />
        </IconButton>
        <IconButton
          label={t("studio")}
          onClick={() => setPanel("studio")}
          showLabel
          className={cx("shrink-0", dense >= 4 ? "hidden" : "max-lg:hidden", labels("xl"))}
        >
          <IconSparkles size={19} />
        </IconButton>
        <IconButton
          label={t("freePlay")}
          active={freePlay}
          onClick={openFreePlay}
          showLabel
          className={cx("shrink-0", dense >= 4 ? "hidden" : "max-lg:hidden", labels("xl"))}
        >
          <IconKeyboard size={19} />
        </IconButton>

        <button
          type="button"
          disabled={!song}
          onClick={() => setPanel("setup")}
          title={t("songSetup")}
          className="group flex min-w-[4.5rem] flex-1 items-center lg:min-w-[10rem] gap-1 rounded-xl px-2 py-1 text-left transition-colors hover:bg-white/[0.06] lg:max-w-[26rem] lg:flex-initial"
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
          <div className={cx("hidden w-[88px] text-center text-xs font-semibold tabular-nums text-mist-300", dense < 5 && "md:block")}>
            {formatTime(Math.max(0, time))} <span className="text-mist-400">/ {formatTime(Math.max(0, endTime - 0.6))}</span>
          </div>
        </div>

        <div className="hidden flex-1 lg:block" />

        <div className={cx("hidden shrink-0", dense < 3 && "lg:block")}>
          <PracticeToggles />
        </div>
        <div className={cx("hidden shrink-0 sm:block", dense < 3 && "lg:hidden")}>
          <PracticeMenu />
        </div>
        <div className="hidden shrink-0 sm:block">
          <InstrumentSwitch compact={dense >= 1} />
        </div>
        <div className={cx("hidden shrink-0 items-center gap-1", dense < 4 && "lg:flex")}>
          <StreakButton />
          <FriendsButton />
          <AccountButton />
          <IconButton label={t("settings")} onClick={() => setPanel("settings")} className="shrink-0">
            <IconSettings size={19} />
          </IconButton>
        </div>
        <div className={cx("shrink-0", dense < 4 && "lg:hidden")}>
          <MoreMenu />
        </div>
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
        <PedalButton />
        <PracticeMenu />
        <InstrumentSwitch compact />
      </div>

      <Timeline />
    </header>
  );
}
