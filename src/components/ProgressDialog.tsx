import { useMemo, useState, type ReactNode } from "react";
import { startCoach } from "../coach/coach";
import { pathSteps, readPath, stagesFor } from "../coach/path";
import type { InstrumentKind } from "../engine/types";
import { useT, type DictKey } from "../i18n";
import { desktop } from "../lib/platform";
import { BUILTIN_SONGS, builtinTitle } from "../midi/builtin";
import { ACHIEVEMENTS } from "../progress/achievements";
import {
  bestStreak,
  dayKey,
  FREEZE_EVERY,
  FREEZE_MAX,
  freezesLeft,
  lastDays,
  masteredSongs,
  MASTERY_STARS,
  streak,
  type Progress,
} from "../progress/progress";
import { ReminderToggle } from "./ReminderToggle";
import { achievementContext } from "../progress/tracker";
import { openSong, updateSettings } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import { IconFlame, IconGuitar, IconLock, IconPiano, IconPlay, IconRoute, IconSnowflake, IconStar, IconTrophy, IconViolin, IconWait } from "../ui/icons";
import { Button, Dialog, Segmented, cx } from "../ui/primitives";
import { useStageText } from "./CoachUI";
import { SignInNudge } from "./SignInNudge";

const GOALS = [5, 10, 20, 30, 60] as const;
const TIER = ["", "text-amber-600", "text-slate-200", "text-amber-300"] as const;
const TIER_BG = ["", "from-amber-700/25", "from-slate-300/20", "from-amber-300/25"] as const;
const INSTRUMENTS: InstrumentKind[] = ["piano", "guitar", "violin"];
const INST_ICON = { piano: IconPiano, guitar: IconGuitar, violin: IconViolin } as const;
const LEVEL_TONE = ["", "bg-emerald-400", "bg-amber-400", "bg-rose-400"] as const;
const LEVEL_CHIP = ["", "bg-emerald-400/15 text-emerald-200", "bg-amber-400/15 text-amber-200", "bg-rose-400/15 text-rose-200"] as const;
const levelOf = new Map(BUILTIN_SONGS.map((s) => [s.id, s.level]));

type Tab = "overview" | "songs" | "ach";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.04] px-2.5 py-3 sm:px-3">
      <div className={cx("text-lg font-extrabold tabular-nums sm:text-xl", accent)}>{value}</div>
      <div className="text-xs text-mist-400">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-mist-400/80">{sub}</div>}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{title}</h3>
        {right && <span className="text-xs font-semibold text-mist-300">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-px" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <IconStar key={i} size={size} filled={i < n} className={i < n ? "text-amber-300" : "text-white/15"} />
      ))}
    </span>
  );
}

/** GitHub-style grid of the last 6 months, darker = less practice. */
function Heatmap({ days, goal }: { days: Record<string, number>; goal: number }) {
  const cells = useMemo(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - ((today.getDay() + 6) % 7)));
    const out: { key: string; v: number; future: boolean }[] = [];
    for (let i = 26 * 7 - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      out.push({ key: dayKey(d), v: days[dayKey(d)] ?? 0, future: d > today });
    }
    return out;
  }, [days]);
  const shade = (v: number) =>
    v <= 0 ? "bg-white/[0.05]" : v < goal * 0.34 ? "bg-brand-500/30" : v < goal * 0.67 ? "bg-brand-500/55" : v < goal ? "bg-brand-400/80" : "bg-emerald-400";
  return (
    <div className="grid auto-cols-fr grid-flow-col grid-rows-7 gap-[2px] sm:gap-[3px]" role="img">
      {cells.map((c) => (
        <div
          key={c.key}
          title={`${c.key}: ${Math.round(c.v / 60)} min`}
          className={cx("aspect-square w-full rounded-[2px]", c.future ? "bg-transparent" : shade(c.v))}
        />
      ))}
    </div>
  );
}

/** Minutes per day for the last 7 days, with the daily goal as a line. */
function WeekBars({ p, goal }: { p: Progress; goal: number }) {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const days = lastDays(p, 14);
  const week = days.slice(7);
  const thisWeek = week.reduce((n, d) => n + d.v, 0);
  const prevWeek = days.slice(0, 7).reduce((n, d) => n + d.v, 0);
  const max = Math.max(goal, ...week.map((d) => d.v), 1);
  const change = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : null;
  const note =
    change == null ? t("weekFirst") : change > 0 ? t("weekUp", { n: change }) : change < 0 ? t("weekDown", { n: -change }) : t("weekSame");
  const today = dayKey();
  return (
    <Section title={t("thisWeek")} right={t("minutesShort", { n: Math.round(thisWeek / 60) })}>
      <div className="relative flex h-28 items-end gap-1.5 rounded-2xl bg-white/[0.03] px-3 pt-3 pb-6">
        <div
          className="pointer-events-none absolute inset-x-3 border-t border-dashed border-emerald-300/40"
          style={{ bottom: `calc(1.5rem + ${(goal / max) * (112 - 36)}px)` }}
        />
        {week.map((d) => (
          <div key={d.key} className="relative flex h-full flex-1 flex-col justify-end">
            <div
              title={t("minutesShort", { n: Math.round(d.v / 60) })}
              className={cx(
                "w-full rounded-t-md transition-[height] duration-500",
                d.v >= goal ? "bg-emerald-400" : d.v > 0 ? "bg-brand-400/80" : "bg-white/[0.06]"
              )}
              style={{ height: `${Math.max(4, (d.v / max) * 100)}%` }}
            />
            <span
              className={cx(
                "absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px]",
                d.key === today ? "font-bold text-mist-100" : "text-mist-400"
              )}
            >
              {d.date.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", { weekday: "short" })}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-mist-400">{note}</p>
    </Section>
  );
}

function InstrumentSplit({ p }: { p: Progress }) {
  const t = useT();
  const total = INSTRUMENTS.reduce((n, i) => n + (p.inst[i] ?? 0), 0);
  if (total < 60) return null;
  return (
    <Section title={t("byInstrument")}>
      <div className="space-y-2">
        {INSTRUMENTS.map((i) => {
          const v = p.inst[i] ?? 0;
          const Icon = INST_ICON[i];
          return (
            <div key={i} className="flex items-center gap-2.5">
              <Icon size={18} className="shrink-0 text-mist-300" />
              <span className="w-14 shrink-0 text-sm">{t(i)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-400" style={{ width: `${(v / total) * 100}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-mist-300">{t("minutesShort", { n: Math.round(v / 60) })}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function useSongTitle() {
  const lang = useApp((s) => s.settings.language);
  const userSongs = useApp((s) => s.userSongs);
  return (id: string) => (levelOf.has(id) ? builtinTitle(id, lang) : (userSongs.find((s) => s.id === id)?.title ?? id));
}

function AccuracyTrend({ p }: { p: Progress }) {
  const t = useT();
  const runs = [...p.recent].reverse();
  if (runs.length < 2) return null;
  const lo = Math.min(0.5, ...runs.map((r) => r.acc));
  const y = (acc: number) => 30 - ((acc - lo) / (1 - lo)) * 28;
  const pts = runs.map((r, i) => `${(i / (runs.length - 1)) * 100},${y(r.acc)}`).join(" ");
  const avg = runs.reduce((n, r) => n + r.acc, 0) / runs.length;
  return (
    <Section title={t("accTrend")} right={t("avgAccuracy", { n: Math.round(avg * 100) })}>
      <div className="rounded-2xl bg-white/[0.03] px-3 py-3">
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label={t("accTrend")}>
          <line x1="0" x2="100" y1={y(0.85)} y2={y(0.85)} className="stroke-emerald-300/40" strokeDasharray="2 2" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <polyline points={`0,32 ${pts} 100,32`} className="fill-brand-500/15 stroke-none" />
          <polyline points={pts} className="fill-none stroke-brand-300" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </Section>
  );
}

function RecentRuns({ p, onOpen }: { p: Progress; onOpen: (id: string) => void }) {
  const t = useT();
  const title = useSongTitle();
  const lang = useApp((s) => s.settings.language);
  if (!p.recent.length) return <p className="mt-5 rounded-2xl bg-white/[0.03] px-4 py-4 text-sm text-mist-300">{t("noRunsYet")}</p>;
  return (
    <Section title={t("recentRuns")}>
      <ul className="space-y-1.5">
        {p.recent.slice(0, 6).map((r) => {
          const Icon = INST_ICON[r.instrument as InstrumentKind] ?? IconPiano;
          return (
            <li key={`${r.at}-${r.song}`}>
              <button
                type="button"
                onClick={() => onOpen(r.song)}
                className="flex w-full items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.07]"
              >
                <Icon size={16} className="shrink-0 text-mist-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{title(r.song)}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-mist-400">
                    {new Date(r.at).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "short" })}
                    <span>·</span>
                    {t("speed")} {pct(r.speed)}
                    {r.wait && <IconWait size={11} className="text-amber-300" />}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold tabular-nums">{pct(r.acc)}</div>
                  <Stars n={r.stars} size={10} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Overview({ p, goalMin, onOpen }: { p: Progress; goalMin: number; onOpen: (id: string) => void }) {
  const t = useT();
  const today = p.days[dayKey()] ?? 0;
  const goal = goalMin * 60;
  const st = streak(p);
  const hours = Math.floor(p.seconds / 3600);
  const mins = Math.floor((p.seconds % 3600) / 60);
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <div className="col-span-3 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-orange-500/25 to-rose-500/10 px-4 py-3 sm:col-span-1 sm:flex-col sm:items-start sm:gap-1">
          <IconFlame size={30} filled={st > 0} className={st > 0 ? "text-orange-400" : "text-white/25"} />
          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold tabular-nums">{t("streakDays", { n: st })}</div>
            <div className="text-[11px] text-mist-300">{t("bestStreak", { n: Math.max(st, bestStreak(p)) })}</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sky-200" title={t("freezeHint", { n: FREEZE_EVERY })}>
              <IconSnowflake size={12} />
              {t("freezesLeft", { n: freezesLeft(p), max: FREEZE_MAX })}
            </div>
          </div>
          <ReminderToggle />
        </div>
        <div className="min-w-0 rounded-2xl bg-white/[0.04] px-2.5 py-3 sm:px-3">
          <div className="text-lg font-extrabold tabular-nums sm:text-xl">
            {Math.floor(today / 60)}
            <span className="text-sm font-semibold text-mist-400"> / {t("minutesShort", { n: goalMin })}</span>
          </div>
          <div className="text-xs text-mist-400">{t("today")}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cx("h-full rounded-full transition-[width] duration-500", today >= goal ? "bg-emerald-400" : "bg-brand-400")}
              style={{ width: `${Math.min(100, (today / goal) * 100)}%` }}
            />
          </div>
        </div>
        <Stat label={t("totalPractice")} value={t("hoursMinutes", { h: hours, m: mins })} sub={`${t("notesPlayed")}: ${p.notes.toLocaleString()}`} />
        <Stat
          label={t("songsFinished")}
          value={String(Object.keys(p.songs).length)}
          sub={`${t("masteredSongs")}: ${masteredSongs(p).length}`}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{t("dailyGoal")}</span>
        <Segmented
          size="sm"
          label={t("dailyGoal")}
          value={String(goalMin)}
          options={GOALS.map((g) => ({ value: String(g), label: t("minutesShort", { n: g }) }))}
          onChange={(v) => updateSettings({ dailyGoalMin: Number(v) })}
        />
      </div>

      <WeekBars p={p} goal={goal} />
      <AccuracyTrend p={p} />
      <RecentRuns p={p} onOpen={onOpen} />
      <InstrumentSplit p={p} />

      <Section title={t("lastWeeks")}>
        <Heatmap days={p.days} goal={goal} />
      </Section>
    </>
  );
}

function PathProgress({ onClose }: { onClose: () => void }) {
  const t = useT();
  const instrument = useApp((s) => s.settings.instrument);
  const skill = useApp((s) => s.settings.skill);
  const all = useApp((s) => s.progress.path);
  const text = useStageText();
  const paths = useMemo(
    () =>
      INSTRUMENTS.map((i) => {
        const steps = pathSteps(i, skill);
        const state = readPath(all, i, skill);
        const per = stagesFor(i, skill).length;
        return { i, steps, state, lessons: steps.length / per, done: Math.floor(state.step / per) };
      }),
    [skill, all]
  );
  const mine = paths.find((x) => x.i === instrument)!;
  const others = paths.filter((x) => x.i !== instrument && x.state.step > 0);
  const step = mine.steps[mine.state.step];
  const Icon = INST_ICON[instrument];
  return (
    <Section title={t("myPath")} right={t("lessonsDone", { n: mine.done, total: mine.lessons })}>
      <div className="rounded-2xl bg-gradient-to-br from-brand-500/20 to-sky-500/10 px-4 py-3 ring-1 ring-brand-300/20">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/25">
            <Icon size={22} className="text-brand-200" />
          </div>
          <div className="min-w-0 flex-1">
            {mine.state.step === 0 ? (
              <p className="text-sm text-mist-200">{t("pathNotStarted")}</p>
            ) : (
              <>
                <div className="truncate text-sm font-bold">
                  {t("coachLesson", { n: step.lesson + 1 })}: {text.title(step.song)}
                </div>
                <div className="text-xs text-mist-300">
                  {text.stage(step.stage)} · {pct(mine.state.speed)} · {t("stepOf", { n: mine.state.step + 1, total: mine.steps.length })}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-brand-400"
            style={{ width: `${(mine.state.step / mine.steps.length) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPanel("path")}>
            <IconRoute size={14} />
            {t("myPath")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onClose();
              void startCoach();
            }}
          >
            <IconPlay size={14} />
            {mine.state.step === 0 ? t("coachStart") : t("coachContinue")}
          </Button>
        </div>
      </div>
      {others.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <div className="text-[11px] font-semibold text-mist-400">{t("pathOther")}</div>
          {others.map((o) => {
            const OIcon = INST_ICON[o.i];
            return (
              <div key={o.i} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2">
                <OIcon size={16} className="shrink-0 text-mist-300" />
                <span className="w-14 shrink-0 text-sm">{t(o.i)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-brand-400/80" style={{ width: `${(o.state.step / o.steps.length) * 100}%` }} />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-mist-300">{t("lessonsDone", { n: o.done, total: o.lessons })}</span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function Songs({ p, onOpen, onClose }: { p: Progress; onOpen: (id: string) => void; onClose: () => void }) {
  const t = useT();
  const title = useSongTitle();
  const mastered = new Set(masteredSongs(p));
  const levels = [1, 2, 3].map((l) => {
    const ids = BUILTIN_SONGS.filter((s) => s.level === l).map((s) => s.id);
    return { l, total: ids.length, done: ids.filter((id) => mastered.has(id)).length };
  });
  const played = Object.entries(p.songs).sort(([, a], [, b]) => b.last - a.last || b.plays - a.plays);
  const target = played
    .filter(([id]) => !mastered.has(id))
    .sort(([, a], [, b]) => b.stars - a.stars || b.speed - a.speed || b.last - a.last)[0];
  const levelLabel = (l: number) => t(`level${l}` as DictKey);

  return (
    <>
      <PathProgress onClose={onClose} />

      <Section title={t("masteredSongs")} right={`${mastered.size}`}>
        <div className="grid grid-cols-3 gap-2">
          {levels.map(({ l, total, done }) => (
            <div key={l} className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-xs font-semibold text-mist-300">{levelLabel(l)}</span>
                <span className="text-sm font-extrabold tabular-nums">
                  {done}
                  <span className="text-xs font-semibold text-mist-400">/{total}</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={cx("h-full rounded-full", LEVEL_TONE[l])} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-mist-400">{t("masteryRule")}</p>
      </Section>

      {target && (
        <Section title={t("nextToMaster")}>
          <button
            type="button"
            onClick={() => onOpen(target[0])}
            className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400/15 to-brand-500/10 px-4 py-3 text-left ring-1 ring-amber-300/25 transition-colors hover:from-amber-400/25"
          >
            <IconTrophy size={22} className="shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{title(target[0])}</div>
              <div className="text-xs text-mist-300">{t("nextToMaster_d", { stars: MASTERY_STARS })}</div>
            </div>
            <div className="shrink-0 text-right text-[11px] text-mist-300">
              <Stars n={target[1].stars} />
              <div className="mt-0.5 tabular-nums">
                {t("bestSpeed")}: {target[1].speed ? pct(target[1].speed) : "–"}
              </div>
            </div>
          </button>
        </Section>
      )}

      <Section title={t("songsPlayed")} right={`${played.length}`}>
        {played.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.03] px-4 py-4 text-sm text-mist-300">{t("noRunsYet")}</p>
        ) : (
          <ul className="space-y-1.5">
            {played.map(([id, s]) => {
              const level = levelOf.get(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onOpen(id)}
                    className="flex w-full items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{title(id)}</span>
                        {mastered.has(id) && (
                          <span className="shrink-0 rounded-md bg-amber-300/20 px-1.5 py-px text-[10px] font-bold text-amber-200">
                            {t("masteredBadge")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-mist-400">
                        {level && <span className={cx("rounded px-1 font-semibold", LEVEL_CHIP[level])}>{levelLabel(level)}</span>}
                        <span>
                          {t("bestAccuracy")}: {s.acc ? pct(s.acc) : "–"}
                        </span>
                        <span>·</span>
                        <span>
                          {t("bestSpeed")}: {s.speed ? pct(s.speed) : "–"}
                        </span>
                      </div>
                    </div>
                    <Stars n={s.stars} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

function Achievements({ p }: { p: Progress }) {
  const t = useT();
  const ctx = achievementContext();
  const unlockedCount = ACHIEVEMENTS.filter((a) => p.unlocked[a.id]).length;
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(!!p.unlocked[b.id]) - Number(!!p.unlocked[a.id]) || a.tier - b.tier);
  return (
    <Section title={t("achievements")} right={t("achCount", { n: unlockedCount, total: ACHIEVEMENTS.length })}>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sorted.map((a) => {
          const at = p.unlocked[a.id];
          const m = !at && a.measure ? a.measure(ctx) : null;
          return (
            <li
              key={a.id}
              className={cx(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5",
                at ? `bg-gradient-to-r ${TIER_BG[a.tier]} to-white/[0.03] ring-1 ring-white/10` : "bg-white/[0.03]"
              )}
            >
              <div className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", at ? "bg-black/25" : "bg-white/[0.04]")}>
                {at ? <IconTrophy size={22} className={TIER[a.tier]} /> : <IconLock size={18} className="text-white/30" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className={cx("truncate text-sm font-semibold", !at && "text-mist-300")}>{t(`ach_${a.id}` as DictKey)}</div>
                <div className="truncate text-xs text-mist-400">{t(`ach_${a.id}_d` as DictKey)}</div>
                {m && m[1] > 1 && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-brand-400/80" style={{ width: `${(m[0] / m[1]) * 100}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-mist-400">
                      {Math.floor(m[0]).toLocaleString()}/{m[1].toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function ProgressDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "progress");
  const p = useApp((s) => s.progress);
  const goalMin = useApp((s) => s.settings.dailyGoalMin);
  const signedIn = useApp((s) => s.account.status === "signedIn");
  const accountsOn = useApp((s) => s.account.status !== "disabled");
  const [tab, setTab] = useState<Tab>("overview");
  const close = () => setPanel(null);
  const play = async (id: string) => {
    if (await openSong(id)) close();
  };
  const unlockedCount = ACHIEVEMENTS.filter((a) => p.unlocked[a.id]).length;

  return (
    <Dialog open={open} onClose={close} title={t("progress")} width="max-w-2xl" closeLabel={t("close")}>
      <Segmented
        label={t("progress")}
        className="mb-4 w-full [&>*]:flex-1"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: t("progOverview") },
          { value: "songs", label: t("progSongs") },
          { value: "ach", label: t("achievements"), title: t("achCount", { n: unlockedCount, total: ACHIEVEMENTS.length }) },
        ]}
      />
      {open && tab === "overview" && <Overview p={p} goalMin={goalMin} onOpen={play} />}
      {open && tab === "songs" && <Songs p={p} onOpen={play} onClose={close} />}
      {open && tab === "ach" && <Achievements p={p} />}
      <SignInNudge />
      <p className="mt-4 text-[11px] leading-relaxed text-mist-400/80">
        {accountsOn && signedIn ? t("progressSynced") : null}
        {desktop?.steam ? ` ${t("steamAchievements")}` : ""}
      </p>
    </Dialog>
  );
}
