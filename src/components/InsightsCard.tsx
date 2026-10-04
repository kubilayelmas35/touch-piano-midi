import { startDrill, stopDrill } from "../coach/drill";
import { hasInsights, type Hand, type RunInsights } from "../coach/insights";
import { useT } from "../i18n";
import { closeResults, setHand } from "../state/actions";
import { useApp } from "../state/store";
import { IconClose, IconLoop, IconSparkles } from "../ui/icons";
import { Button } from "../ui/primitives";

/** Results: where the run went wrong, with one tap to drill the hardest stretch. */
export function InsightsCard({ insights }: { insights: RunInsights | undefined }) {
  const t = useT();
  const coach = useApp((s) => !!s.coach);
  const piano = useApp((s) => s.settings.instrument === "piano");
  if (!hasInsights(insights)) return null;
  const { weak, drift, weakHand } = insights;
  const handName = (h: Hand) => (h === "left" ? t("insightLeftHand") : t("insightRightHand"));
  const lines: string[] = [];
  if (weak) lines.push(t("insightWeak", { from: weak.measureFrom, to: weak.measureTo, n: weak.errors }));
  if (drift) {
    const ms = Math.abs(drift.ms);
    const late = drift.ms > 0;
    const said = drift.hand
      ? t(late ? "insightLateHand" : "insightEarlyHand", { hand: handName(drift.hand), ms })
      : t(late ? "insightLate" : "insightEarly", { ms });
    lines.push(`${said} ${t(late ? "insightLateTip" : "insightEarlyTip")}`);
  }
  if (weakHand) lines.push(t("insightWeakHand", { hand: handName(weakHand) }));

  return (
    <div className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-left ring-1 ring-white/10 animate-pop">
      <div className="flex items-center gap-1.5 text-xs font-bold tracking-[0.12em] text-brand-200 uppercase">
        <IconSparkles size={14} /> {t("insightTitle")}
      </div>
      <ul className="mt-1.5 space-y-1.5 text-sm leading-snug text-mist-200">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      {(weak || (weakHand && piano && !coach)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {weak && (
            <Button size="sm" variant="primary" onClick={() => startDrill(weak)}>
              <IconLoop size={14} />
              {t("drillStart")}
            </Button>
          )}
          {weakHand && piano && !coach && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                closeResults();
                setHand(weakHand);
              }}
            >
              {t(weakHand === "left" ? "insightLeftOnly" : "insightRightOnly")}
            </Button>
          )}
        </div>
      )}
      {weak && <p className="mt-2 text-xs text-mist-400">{t("drillHint")}</p>}
    </div>
  );
}

/** While drilling: which stretch, current speed toward the goal, and a way out. */
export function DrillChip() {
  const t = useT();
  const drill = useApp((s) => s.drill);
  const speed = useApp((s) => s.session.speed);
  if (!drill) return null;
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/15 py-1 pr-1 pl-3.5 text-sm font-semibold text-emerald-100 shadow-lg backdrop-blur animate-pop">
      <IconLoop size={15} />
      <span>
        {t("drillChip", { from: drill.measureFrom, to: drill.measureTo })} · {Math.round(speed * 100)}% → {Math.round(drill.target * 100)}%
      </span>
      <button
        type="button"
        onClick={stopDrill}
        aria-label={t("drillStop")}
        title={t("drillStop")}
        className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-100/80 hover:bg-white/10 hover:text-white"
      >
        <IconClose size={14} />
      </button>
    </div>
  );
}
