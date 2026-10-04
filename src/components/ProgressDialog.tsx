import { useMemo } from "react";
import { useT, type DictKey } from "../i18n";
import { desktop } from "../lib/platform";
import { ACHIEVEMENTS } from "../progress/achievements";
import { bestStreak, dayKey, streak } from "../progress/progress";
import { achievementContext } from "../progress/tracker";
import { updateSettings } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import { IconFlame, IconLock, IconTrophy } from "../ui/icons";
import { Dialog, Segmented, cx } from "../ui/primitives";

const GOALS = [5, 10, 20, 30, 60] as const;
const TIER = ["", "text-amber-600", "text-slate-200", "text-amber-300"] as const;
const TIER_BG = ["", "from-amber-700/25", "from-slate-300/20", "from-amber-300/25"] as const;

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.04] px-2.5 py-3 sm:px-3">
      <div className={cx("text-lg font-extrabold tabular-nums sm:text-xl", accent)}>{value}</div>
      <div className="text-xs text-mist-400">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-mist-400/80">{sub}</div>}
    </div>
  );
}

/** GitHub-style grid of the last 12 weeks, darker = less practice. */
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

export function ProgressDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "progress");
  const p = useApp((s) => s.progress);
  const goalMin = useApp((s) => s.settings.dailyGoalMin);
  const signedIn = useApp((s) => s.account.status === "signedIn");
  const accountsOn = useApp((s) => s.account.status !== "disabled");
  const close = () => setPanel(null);

  const ctx = open ? achievementContext() : null;
  const today = p.days[dayKey()] ?? 0;
  const goal = goalMin * 60;
  const st = streak(p);
  const hours = Math.floor(p.seconds / 3600);
  const mins = Math.floor((p.seconds % 3600) / 60);
  const unlockedCount = ACHIEVEMENTS.filter((a) => p.unlocked[a.id]).length;
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(!!p.unlocked[b.id]) - Number(!!p.unlocked[a.id]) || a.tier - b.tier);

  return (
    <Dialog open={open} onClose={close} title={t("progress")} width="max-w-2xl" closeLabel={t("close")}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <div className="col-span-3 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-orange-500/25 to-rose-500/10 px-4 py-3 sm:col-span-1 sm:flex-col sm:items-start sm:gap-1">
          <IconFlame size={30} filled={st > 0} className={st > 0 ? "text-orange-400" : "text-white/25"} />
          <div>
            <div className="text-xl font-extrabold tabular-nums">{t("streakDays", { n: st })}</div>
            <div className="text-[11px] text-mist-300">{t("bestStreak", { n: Math.max(st, bestStreak(p)) })}</div>
          </div>
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
        <Stat label={t("totalPractice")} value={t("hoursMinutes", { h: hours, m: mins })} />
        <Stat label={t("songsFinished")} value={String(Object.keys(p.songs).length)} sub={`${t("notesPlayed")}: ${p.notes.toLocaleString()}`} />
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

      <div className="mt-4">
        <div className="mb-1.5 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("lastWeeks")}</div>
        <Heatmap days={p.days} goal={goal} />
      </div>

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("achievements")}</h3>
        <span className="text-xs font-semibold text-mist-300">{t("achCount", { n: unlockedCount, total: ACHIEVEMENTS.length })}</span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sorted.map((a) => {
          const at = p.unlocked[a.id];
          const m = !at && ctx && a.measure ? a.measure(ctx) : null;
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
      <p className="mt-4 text-[11px] leading-relaxed text-mist-400/80">
        {accountsOn ? (signedIn ? t("progressSynced") : t("progressLocal")) : null}
        {desktop?.steam ? ` ${t("steamAchievements")}` : ""}
      </p>
    </Dialog>
  );
}
