import { useMemo, type ReactNode } from "react";
import { moveStep, resetCoach, skipStep, startCoach, stepPartSeconds } from "../coach/coach";
import { goalSpeed, PASS, pathSteps, readPath, type PathStep, type Stage } from "../coach/path";
import type { DictKey } from "../i18n";
import { useT } from "../i18n";
import { engine } from "../engine/engine";
import { builtinTitle } from "../midi/builtin";
import { closeResults } from "../state/actions";
import { setPanel, useApp, type CoachOutcome } from "../state/store";
import { IconCheck, IconLock, IconPlay, IconRoute, IconStar, IconWait } from "../ui/icons";
import { Button, Dialog, cx } from "../ui/primitives";
import { SignInNudge } from "./SignInNudge";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The saved path for the current instrument and skill; re-read whenever it changes. */
export function usePath() {
  const instrument = useApp((s) => s.settings.instrument);
  const skill = useApp((s) => s.settings.skill);
  const all = useApp((s) => s.progress.path);
  return useMemo(() => {
    const steps = pathSteps(instrument, skill);
    const state = readPath(all, instrument, skill);
    return { steps, state, step: steps[state.step] as PathStep | undefined, skill };
  }, [instrument, skill, all]);
}

export function useStageText() {
  const t = useT();
  const piano = useApp((s) => s.settings.instrument === "piano");
  const lang = useApp((s) => s.settings.language);
  return {
    part: (sec: number | null) => (sec === null ? t("partWhole") : t("partFirst", { s: sec })),
    stage: (s: Stage) =>
      piano ? (s === "right" ? t("coachRightHand") : s === "left" ? t("coachLeftHand") : t("coachBothHands")) : s === "right" ? t("coachStrike") : t("coachFull"),
    tip: (s: Stage) =>
      t(piano ? (s === "right" ? "coachTipRight" : s === "left" ? "coachTipLeft" : "coachTipBoth") : s === "right" ? "coachTipStrike" : "coachTipFull"),
    title: (id: string) => builtinTitle(id, lang),
  };
}

function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "amber" | "brand" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        tone === "amber" ? "bg-amber-400/15 text-amber-200" : tone === "brand" ? "bg-brand-500/25 text-brand-100" : "bg-white/[0.08] text-mist-200"
      )}
    >
      {children}
    </span>
  );
}

/** Before a path step starts: what to play, how fast, and a tip. Holds the play button. */
export function CoachCard() {
  const t = useT();
  const coach = useApp((s) => s.coach);
  const speed = useApp((s) => s.session.speed);
  const wait = useApp((s) => s.session.waitMode);
  const { steps, skill, state } = usePath();
  const text = useStageText();
  const step = coach ? steps[coach.step] : undefined;
  if (!step) return null;
  const partSec = stepPartSeconds(step.song, state.part);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 short:p-1.5">
      <div className="glass scroll-thin max-h-full w-full max-w-sm overflow-y-auto rounded-3xl px-5 py-4 text-center shadow-2xl animate-pop short:flex short:max-w-xl short:items-center short:gap-4 short:rounded-2xl short:px-4 short:py-1.5 short:text-left">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.14em] text-brand-200 uppercase short:text-[10px] short:leading-tight">
            {t("coachLesson", { n: step.lesson + 1 })} · {t("stepOf", { n: coach!.step + 1, total: steps.length })}
          </div>
          <div className="mt-1 truncate text-lg font-extrabold short:mt-0 short:text-base short:leading-snug">{text.title(step.song)}</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 short:mt-1 short:justify-start">
            <Pill tone="brand">{text.stage(step.stage)}</Pill>
            <Pill>{text.part(partSec)}</Pill>
            <Pill tone={speed < 1 ? "amber" : "plain"}>
              {t("speed")} {pct(speed)}
            </Pill>
            {wait && (
              <Pill tone="amber">
                <IconWait size={12} /> {t("waitMode")}
              </Pill>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-mist-200 short:mt-1 short:text-[13px] short:leading-snug">
            {wait ? t("coachTipWait") : text.tip(step.stage)}
            {partSec !== null && ` ${t("coachTipPart", { s: partSec })}`}
          </p>
          <p className="mt-1.5 text-xs text-mist-400 short:mt-0.5 short:text-[11px] short:leading-tight">
            {t("coachGoal", { acc: Math.round(PASS * 100), speed: Math.round(goalSpeed(skill, step.lesson) * 100) })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void engine.play()}
          aria-label={t("play")}
          className="mx-auto mt-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[0_18px_50px_-12px_rgba(139,92,246,0.9)] transition-transform hover:scale-105 active:scale-95 short:m-0 short:h-14 short:w-14"
        >
          <IconPlay size={28} className="translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/** While a path step plays: which lesson and hand, out of the way in the corner. */
export function CoachChip() {
  const t = useT();
  const coach = useApp((s) => s.coach);
  const speed = useApp((s) => s.session.speed);
  const { steps, state } = usePath();
  const text = useStageText();
  const step = coach ? steps[coach.step] : undefined;
  if (!step) return null;
  const partSec = stepPartSeconds(step.song, state.part);
  return (
    <div className="pointer-events-none absolute top-3 left-[calc(var(--edge-left)+0.75rem)] flex items-center gap-1.5 rounded-full border border-brand-300/25 bg-ink-900/70 px-3 py-1 text-xs font-bold text-brand-100 backdrop-blur">
      <IconRoute size={13} />
      {t("coachLesson", { n: step.lesson + 1 })} · {text.stage(step.stage)} · {pct(speed)}
      {partSec !== null && ` · ${text.part(partSec)}`}
    </div>
  );
}

const VERDICT_TONE: Record<CoachOutcome["verdict"], string> = {
  slower: "from-amber-400/20 to-rose-500/10 ring-amber-300/25",
  waitOn: "from-amber-400/20 to-rose-500/10 ring-amber-300/25",
  retry: "from-sky-400/20 to-brand-500/10 ring-sky-300/25",
  faster: "from-emerald-400/20 to-sky-500/10 ring-emerald-300/25",
  waitOff: "from-emerald-400/20 to-sky-500/10 ring-emerald-300/25",
  longer: "from-emerald-400/20 to-sky-500/10 ring-emerald-300/25",
  passed: "from-emerald-400/25 to-brand-500/15 ring-emerald-300/35",
  finished: "from-amber-300/25 to-brand-500/15 ring-amber-300/40",
};

const songMastered = (o: CoachOutcome) => o.verdict === "passed" && o.next.song !== o.played.song;

/** Results of a path step: what changes for the next attempt. */
export function CoachResult({ outcome }: { outcome: CoachOutcome }) {
  const t = useT();
  const text = useStageText();
  const v = outcome.verdict;
  const next = outcome.next;
  const key = songMastered(outcome) ? "coachV_song" : `coachV_${v}`;
  const partSec = outcome.partSec ?? null;
  const vars = { speed: Math.round(outcome.speed * 100), acc: Math.round(PASS * 100), song: text.title(next.song), part: text.part(partSec) };
  const canEasier = outcome.stepIndex > 0;
  const canEasy = v !== "passed" && v !== "finished" && outcome.stepIndex < outcome.total - 1;
  const go = (by: number) => {
    closeResults();
    moveStep(by);
    void startCoach();
  };
  return (
    <div className={cx("mb-4 rounded-2xl bg-gradient-to-br px-4 py-3 text-left ring-1 animate-pop", VERDICT_TONE[v])}>
      <div className="text-base font-extrabold">{t(key as DictKey)}</div>
      <p className="mt-0.5 text-sm text-mist-200">{t(`${key}_d` as DictKey, vars)}</p>
      {v !== "finished" && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-mist-400">{t("coachNext")}:</span>
          <Pill>{text.title(next.song)}</Pill>
          <Pill tone="brand">{text.stage(next.stage)}</Pill>
          <Pill>{text.part(partSec)}</Pill>
          <Pill tone={outcome.speed < 1 ? "amber" : "plain"}>{pct(outcome.speed)}</Pill>
          {outcome.wait && <Pill tone="amber">{t("waitMode")}</Pill>}
        </div>
      )}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-brand-400 transition-[width] duration-500"
          style={{ width: `${((outcome.stepIndex + (v === "finished" ? 1 : 0)) / outcome.total) * 100}%` }}
        />
      </div>
      {(canEasier || canEasy) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          {canEasier ? (
            <button type="button" onClick={() => go(-1)} className="text-mist-300 underline-offset-4 hover:text-white hover:underline">
              ← {t("coachPrevStep")}
            </button>
          ) : (
            <span />
          )}
          {canEasy && (
            <button type="button" onClick={() => go(1)} className="text-emerald-200 underline-offset-4 hover:text-white hover:underline">
              {t("coachTooEasy")} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Footer buttons of the results dialog during the path. */
export function CoachResultActions({ outcome }: { outcome: CoachOutcome }) {
  const t = useT();
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          closeResults();
          setPanel("path");
        }}
      >
        <IconRoute size={16} />
        {t("myPath")}
      </Button>
      {outcome.verdict === "finished" ? (
        <Button
          variant="primary"
          autoFocus
          onClick={() => {
            closeResults();
            setPanel("library");
          }}
        >
          {t("chooseSong")}
        </Button>
      ) : (
        <Button
          variant="primary"
          autoFocus
          onClick={() => {
            closeResults();
            void startCoach({ play: true });
          }}
        >
          <IconPlay size={16} />
          {songMastered(outcome) ? t("coachNextSong") : t("coachContinue")}
        </Button>
      )}
    </>
  );
}

/** Library: where the path stands, one tap to continue. */
export function PathCard({ onStart }: { onStart: () => void }) {
  const t = useT();
  const { steps, state, step } = usePath();
  const text = useStageText();
  if (!step) return null;
  return (
    <div className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-400/20 via-sky-400/10 to-brand-500/15 px-4 py-3 ring-1 ring-emerald-300/25">
      <button type="button" onClick={() => setPanel("path")} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-emerald-200 uppercase">
          <IconRoute size={13} /> {t("myPath")}
        </div>
        <div className="mt-0.5 truncate text-base font-bold">
          {t("coachLesson", { n: step.lesson + 1 })}: {text.title(step.song)}
        </div>
        <div className="mt-0.5 truncate text-xs text-mist-300">
          {text.stage(step.stage)} · {text.part(stepPartSeconds(step.song, state.part))} · {pct(state.speed)} ·{" "}
          {t("stepOf", { n: state.step + 1, total: steps.length })}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-brand-400" style={{ width: `${(state.step / steps.length) * 100}%` }} />
        </div>
      </button>
      <button
        type="button"
        onClick={() => {
          onStart();
          void startCoach();
        }}
        aria-label={t("coachContinue")}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <IconPlay size={18} className="translate-x-px" />
      </button>
    </div>
  );
}

/** The whole path: lessons in order, stars per step, the current one ready to play. */
export function PathDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "path");
  const instrument = useApp((s) => s.settings.instrument);
  const { steps, state, skill } = usePath();
  const text = useStageText();
  const close = () => setPanel(null);

  const lessons = useMemo(() => {
    const out: { lesson: number; song: string; steps: { index: number; stage: Stage }[] }[] = [];
    steps.forEach((s, index) => {
      const last = out[out.length - 1];
      if (last && last.lesson === s.lesson) last.steps.push({ index, stage: s.stage });
      else out.push({ lesson: s.lesson, song: s.song, steps: [{ index, stage: s.stage }] });
    });
    return out;
  }, [steps]);

  const skillLabel = skill === "new" ? t("skillNew") : skill === "some" ? t("skillSome") : t("skillGood");

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("myPath")}
      closeLabel={t("close")}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(t("pathResetConfirm"))) resetCoach();
            }}
          >
            {t("pathReset")}
          </Button>
          <Button variant="primary" onClick={() => void startCoach()}>
            <IconPlay size={16} />
            {t("coachContinue")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-mist-300">{t("pathIntro")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Pill tone="brand">{t(instrument)}</Pill>
        <Pill>{skillLabel}</Pill>
        <Pill>{t("stepOf", { n: state.step + 1, total: steps.length })}</Pill>
        <button
          type="button"
          onClick={() => {
            close();
            useApp.setState({ welcomeOpen: true });
          }}
          className="ml-auto text-xs font-semibold text-brand-300 underline-offset-4 hover:underline"
        >
          {t("pathChangeAnswers")}
        </button>
      </div>
      {state.step > 0 && <SignInNudge />}
      <ol className="mt-4 space-y-1.5">
        {lessons.map((l) => {
          const done = l.steps.every((s) => s.index < state.step);
          const current = l.steps.some((s) => s.index === state.step);
          const locked = !done && !current;
          return (
            <li
              key={l.lesson}
              className={cx(
                "rounded-2xl px-3 py-2.5",
                current ? "bg-brand-500/15 ring-1 ring-brand-400/40" : done ? "bg-white/[0.04]" : "opacity-55"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                    done ? "bg-emerald-400/20 text-emerald-200" : current ? "bg-brand-500 text-white" : "bg-white/[0.06] text-mist-400"
                  )}
                >
                  {done ? <IconCheck size={16} /> : locked ? <IconLock size={14} /> : l.lesson + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{text.title(l.song)}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-mist-400">
                    {l.steps.map((s) => {
                      const stars = state.stars[s.index] ?? 0;
                      return (
                        <span key={s.index} className={cx("inline-flex items-center gap-1", s.index === state.step && "font-bold text-brand-100")}>
                          {text.stage(s.stage)}
                          {s.index < state.step && (
                            <span className="inline-flex text-amber-300" aria-label={t("starsOf", { n: stars })}>
                              {Array.from({ length: 5 }, (_, i) => (
                                <IconStar key={i} size={10} filled={i < stars} className={i < stars ? "" : "text-white/20"} />
                              ))}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              {current && (
                <div className="mt-2.5 flex items-center justify-end gap-2">
                  <span className="mr-auto text-xs text-mist-300">
                    {text.stage(steps[state.step].stage)} · {text.part(stepPartSeconds(steps[state.step].song, state.part))} · {pct(state.speed)}
                    {state.wait ? ` · ${t("waitMode")}` : ""}
                  </span>
                  {state.step < steps.length - 1 && (
                    <Button size="sm" variant="ghost" onClick={skipStep}>
                      {t("pathSkip")}
                    </Button>
                  )}
                  <Button size="sm" variant="primary" onClick={() => void startCoach()}>
                    <IconPlay size={14} />
                    {t("coachStart")}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Dialog>
  );
}
