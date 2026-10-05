import { engine } from "../engine/engine";
import { accuracyOf, comboMultiplier } from "../engine/types";
import { useT } from "../i18n";
import { useApp } from "../state/store";
import { IconHeadphones, IconPlay, IconWait } from "../ui/icons";
import { cx } from "../ui/primitives";
import { CoachCard, CoachChip } from "./CoachUI";
import { DrillChip } from "./InsightsCard";
import { MicChip } from "./MicChip";
import { DuelChip } from "./ResultsSocial";
import { DuetHud } from "./DuetDialog";

export function Hud() {
  const t = useT();
  const stats = useApp((s) => s.stats);
  const status = useApp((s) => s.status);
  const waiting = useApp((s) => s.waiting);
  const autoPlay = useApp((s) => s.session.autoPlay);
  const audioLoading = useApp((s) => s.audioLoading);
  const audioProgress = useApp((s) => s.audioProgress);
  const audioError = useApp((s) => s.audioError);
  const songLoading = useApp((s) => s.songLoading);
  const judged = stats.perfect + stats.great + stats.good + stats.miss;
  const acc = accuracyOf(stats);
  const mult = comboMultiplier(stats.combo);
  const idle = status === "ready" || status === "paused";
  const freePlay = useApp((s) => !!s.song && s.song.notes.length === 0);
  const coach = useApp((s) => !!s.coach);

  return (
    <>
      {!autoPlay && (judged > 0 || status === "playing") && (
        <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-1 text-right">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-mist-400 uppercase">{t("score")}</div>
          <div className="text-2xl leading-none font-extrabold tabular-nums text-white drop-shadow sm:text-3xl">
            {stats.score.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold tabular-nums">
            <span className="text-mist-300">
              {t("accuracy")} <span className="text-white">{judged ? Math.round(acc * 100) : 0}%</span>
            </span>
          </div>
          {stats.combo >= 2 && (
            <div key={stats.combo >= 10 ? mult : 0} className="mt-1 flex items-baseline gap-1.5 animate-pop">
              <span className="text-xl font-extrabold tabular-nums text-sky-glow">{stats.combo}</span>
              <span className="text-[11px] font-bold tracking-wider text-mist-300 uppercase">{t("combo")}</span>
              {mult > 1 && (
                <span className="rounded-md bg-brand-500/30 px-1.5 py-0.5 text-[11px] font-extrabold text-brand-300">
                  ×{mult}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-2 px-24">
        <DrillChip />
        <DuelChip />
        <DuetHud />
        <MicChip />
        {waiting && (
          <div className="flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/15 px-3.5 py-1.5 text-sm font-semibold text-amber-100 shadow-lg backdrop-blur animate-pop">
            <IconWait size={16} /> {t("waiting")}
          </div>
        )}
        {autoPlay && status === "playing" && (
          <div className="flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-400/15 px-3.5 py-1.5 text-sm font-semibold text-sky-100 shadow-lg backdrop-blur animate-pop">
            <IconHeadphones size={16} /> {t("listening")}
          </div>
        )}
      </div>

      {(audioLoading || audioError) && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
          <div className="glass w-full max-w-xs rounded-2xl px-4 py-3 text-center animate-pop" role="status">
            <div className="text-sm font-semibold">{audioError ? t("loadFailed") : t("loadingSounds")}</div>
            {!audioError && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-glow transition-[width] duration-200"
                  style={{ width: `${Math.round(audioProgress * 100)}%` }}
                />
              </div>
            )}
            {audioError && (
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-brand-300 underline-offset-4 hover:underline"
                onClick={() => void engine.ensureAudio()}
              >
                {t("retry")}
              </button>
            )}
          </div>
        </div>
      )}

      {freePlay && !audioLoading && !songLoading && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
          <div className="text-2xl font-extrabold tracking-tight text-white/80">{t("freePlay")}</div>
          <div className="text-sm text-mist-400">{t("freePlayHint")}</div>
        </div>
      )}

      {coach && !freePlay && !songLoading && status !== "ready" && <CoachChip />}

      {coach && status === "ready" && !freePlay && !audioLoading && !songLoading && <CoachCard />}

      {idle && !(coach && status === "ready") && !freePlay && !audioLoading && !songLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => void engine.play()}
            aria-label={t("play")}
            className={cx(
              "group pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full text-white",
              "bg-gradient-to-b from-brand-400 to-brand-600 shadow-[0_18px_50px_-12px_rgba(139,92,246,0.9)]",
              "transition-transform duration-150 hover:scale-105 active:scale-95 animate-pop"
            )}
          >
            <IconPlay size={34} className="translate-x-0.5" />
          </button>
        </div>
      )}
    </>
  );
}
