import { engine } from "../engine/engine";
import type { DictKey } from "../i18n";
import { useT } from "../i18n";
import { closeResults, openSong, updateSession } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import { IconPlay, IconStar, IconTrophy } from "../ui/icons";
import { Button, Dialog } from "../ui/primitives";
import { CoachResult, CoachResultActions } from "./CoachUI";
import { startCoach } from "../coach/coach";
import { SPEEDS } from "../coach/path";
import { BUILTIN_BY_DIFFICULTY, builtinTitle } from "../midi/builtin";

/** A well played run outside the path: below full speed suggest the next notch, at full speed the next harder song. */
function NextUp() {
  const t = useT();
  const speed = useApp((s) => s.session.speed);
  const wait = useApp((s) => s.session.waitMode);
  const currentId = useApp((s) => s.currentId);
  const lang = useApp((s) => s.settings.language);
  if (wait) return null;
  const faster = SPEEDS.find((v) => v > speed + 0.001);
  const idx = BUILTIN_BY_DIFFICULTY.findIndex((s) => s.id === currentId);
  const next = !faster && idx >= 0 ? BUILTIN_BY_DIFFICULTY[idx + 1] : undefined;
  if (!faster && !next) return null;
  const pct = Math.round((faster ?? 1) * 100);
  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-br from-emerald-400/25 to-brand-500/15 px-4 py-3 text-left ring-1 ring-emerald-300/35 animate-pop">
      <div className="text-base font-extrabold">{faster ? t("nextUpFaster") : t("coachV_song")}</div>
      <p className="mt-0.5 text-sm text-mist-200">
        {faster ? t("nextUpFaster_d", { speed: pct }) : t("nextUpSong_d", { song: next ? builtinTitle(next.id, lang) : "" })}
      </p>
      <Button
        variant="primary"
        size="sm"
        className="mt-2.5"
        onClick={() => {
          closeResults();
          if (faster) {
            updateSession({ speed: faster });
            engine.stop();
            void engine.play();
          } else if (next) void openSong(next.id);
        }}
      >
        <IconPlay size={14} />
        {faster ? t("nextUpPlayAt", { speed: pct }) : t("coachNextSong")}
      </Button>
    </div>
  );
}

export function ResultsDialog() {
  const t = useT();
  const results = useApp((s) => s.results);
  const title = useApp((s) => s.song?.title);
  const open = !!results;
  if (!results) return <Dialog open={false} onClose={closeResults}>{null}</Dialog>;
  const { stats, accuracy, stars, newBest, bestScore, dirty } = results;
  const msg = t(`resultMsg${Math.max(1, stars)}` as DictKey);
  const rows: [string, number, string][] = [
    [t("perfect"), stats.perfect, "text-sky-300"],
    [t("great"), stats.great, "text-emerald-300"],
    [t("good"), stats.good, "text-amber-200"],
    [t("miss"), stats.miss, "text-rose-300"],
  ];

  return (
    <Dialog
      open={open}
      onClose={() => {
        closeResults();
        // The next path attempt is set up even when the dialog is just closed.
        if (results.coach && results.coach.verdict !== "finished") void startCoach();
      }}
      width="max-w-md"
      closeLabel={t("close")}
      title={t("results")}
      footer={
        results.coach ? (
          <CoachResultActions outcome={results.coach} />
        ) : (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              closeResults();
              setPanel("library");
            }}
          >
            {t("chooseSong")}
          </Button>
          <Button
            variant="primary"
            autoFocus
            onClick={() => {
              closeResults();
              engine.stop();
              void engine.play();
            }}
          >
            {t("playAgain")}
          </Button>
        </>
        )
      }
    >
      {results.coach ? <CoachResult outcome={results.coach} /> : !dirty && stars >= 4 && <NextUp />}
      <div className="text-center">
        <p className="truncate text-sm text-mist-400">{title}</p>
        <div className="mt-3 flex justify-center gap-1.5" role="img" aria-label={t("starsOf", { n: stars })}>
          {Array.from({ length: 5 }, (_, i) => (
            <IconStar
              key={i}
              size={34}
              filled={i < stars}
              className={i < stars ? "text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.6)] animate-pop" : "text-white/15"}
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
        <p className="mt-2 text-lg font-bold">{msg}</p>
        <div className="mt-4 text-4xl font-extrabold tabular-nums tracking-tight">{stats.score.toLocaleString()}</div>
        <div className="text-xs font-semibold tracking-[0.14em] text-mist-400 uppercase">{t("score")}</div>
        {newBest ? (
          <div className="mt-2 inline-block rounded-full bg-amber-400/20 px-3 py-1 text-sm font-bold text-amber-200 animate-pop">
            {t("newBest")}
          </div>
        ) : bestScore != null ? (
          <div className="mt-2 text-sm text-mist-400">
            {t("best")}: <span className="font-semibold text-mist-200">{bestScore.toLocaleString()}</span>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="text-2xl font-extrabold tabular-nums">{Math.round(accuracy * 100)}%</div>
            <div className="text-xs text-mist-400">{t("accuracy")}</div>
          </div>
          <div className="rounded-2xl bg-white/[0.04] px-3 py-3">
            <div className="text-2xl font-extrabold tabular-nums">{stats.maxCombo}</div>
            <div className="text-xs text-mist-400">{t("maxCombo")}</div>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-4 gap-2">
          {rows.map(([label, value, color]) => (
            <div key={label} className="rounded-xl bg-white/[0.03] px-2 py-2">
              <dd className={`text-lg font-bold tabular-nums ${color}`}>{value}</dd>
              <dt className="truncate text-[11px] text-mist-400">{label}</dt>
            </div>
          ))}
        </dl>
        {stats.wrong > 0 && (
          <p className="mt-2 text-xs text-mist-400">
            {t("wrong")}: {stats.wrong}
          </p>
        )}
        {dirty && <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-mist-400">{t("practiceRun")}</p>}
        {results.achievements.length > 0 && (
          <button
            type="button"
            onClick={() => {
              closeResults();
              setPanel("progress");
            }}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-400/20 to-brand-500/15 px-3 py-3 text-left ring-1 ring-amber-300/30 animate-pop"
          >
            <div className="text-xs font-bold tracking-[0.12em] text-amber-200 uppercase">{t("newAchievements")}</div>
            <ul className="mt-1.5 space-y-1">
              {results.achievements.map((id) => (
                <li key={id} className="flex items-center gap-2 text-sm font-semibold">
                  <IconTrophy size={16} className="shrink-0 text-amber-300" />
                  <span className="truncate">{t(`ach_${id}` as DictKey)}</span>
                  <span className="truncate text-xs font-normal text-mist-400">{t(`ach_${id}_d` as DictKey)}</span>
                </li>
              ))}
            </ul>
          </button>
        )}
      </div>
    </Dialog>
  );
}
