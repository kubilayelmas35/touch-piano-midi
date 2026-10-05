import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { avatarUrl, refreshAccount, supabase } from "../../auth/account";
import {
  auditLog,
  deleteFeedback,
  deleteFile,
  downloadFile,
  feedbackCounts,
  fetchStats,
  getUser,
  listErrors,
  listFeedback,
  listFiles,
  listReports,
  listUsers,
  referralStats,
  resetUsername,
  resolveError,
  setTrial,
  storageByUser,
  updateFeedback,
  updateReport,
  updateUser,
  userAction,
  userExtra,
  usersCsv,
  type AdminFile,
  type AdminReport,
  type AdminStats,
  type AdminUser,
  type AuditEntry,
  type DayCount,
  type ErrorGroup,
  type FeedbackEntry,
  type FeedbackStatus,
  type ReportReason,
  type ReportStatus,
  type UserFilter,
  type UserPatch,
  type UserSort,
} from "../../auth/admin";
import { useT, type TFn } from "../../i18n";
import { builtinTitle } from "../../midi/builtin";
import { formatBytes, formatDate, timeAgo } from "../../lib/format";
import { setPanel, toast, useApp } from "../../state/store";
import {
  IconApple,
  IconBan,
  IconBug,
  IconChart,
  IconCheck,
  IconClose,
  IconCloud,
  IconCopy,
  IconCrown,
  IconDownload,
  IconFlag,
  IconGift,
  IconGoogle,
  IconList,
  IconMessage,
  IconSearch,
  IconShield,
  IconSync,
  IconTrash,
  IconUser,
  IconUsers,
} from "../../ui/icons";
import { Button, IconButton, Segmented, Switch, cx } from "../../ui/primitives";

type Tab = "overview" | "members" | "reports" | "errors" | "feedback" | "referrals" | "cloud" | "audit";
const PAGE = 25;

// ------------------------------------------------------------------ helpers

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (err: unknown) => alive && setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err), loading: false }))
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

function saveText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function displayName(u: { username: string | null; email: string | null }): string {
  return u.username ?? u.email ?? "—";
}

function sourceLabel(t: TFn, src: string | null): string {
  switch (src) {
    case "google_play":
      return "Google Play";
    case "app_store":
      return "App Store";
    case "steam":
      return "Steam";
    case "manual":
      return t("admSrcManual");
    default:
      return t("admSrcUnknown");
  }
}

function providerLabel(t: TFn, p: string): string {
  if (p === "email") return t("admProvEmail");
  if (p === "google") return "Google";
  if (p === "apple") return "Apple";
  return p;
}

function describe(t: TFn, e: AuditEntry): string {
  const d = e.detail ?? {};
  switch (e.action) {
    case "update": {
      const patch = (d.patch ?? {}) as UserPatch;
      const parts: string[] = [];
      if (patch.pro !== undefined) parts.push(patch.pro ? t("admActProOn") : t("admActProOff"));
      if (patch.cloud !== undefined) parts.push(patch.cloud ? t("admActCloudOn") : t("admActCloudOff"));
      if (patch.cloud_quota_mb !== undefined) parts.push(t("admActQuota", { n: patch.cloud_quota_mb }));
      if (patch.is_admin !== undefined) parts.push(patch.is_admin ? t("admActAdminOn") : t("admActAdminOff"));
      if (d.note) parts.push(t("admActNote"));
      return parts.join(" · ") || e.action;
    }
    case "ban":
      return t("admActBan");
    case "unban":
      return t("admActUnban");
    case "delete_user":
      return t("admActDeleteUser");
    case "self_delete":
      return t("admActSelfDelete");
    case "pro_purchase":
      return t("admActProPurchase", { store: sourceLabel(t, String(d.store ?? "")) });
    case "delete_file":
      return t("admActDeleteFile", { title: String(d.title ?? "") });
    case "delete_feedback":
      return t("admActDeleteFeedback");
    case "trial":
      return Number(d.days) === 0 ? t("admActTrialEnd") : t("admActTrial", { n: Number(d.days) });
    case "reset_username":
      return t("admActResetUsername", { name: String(d.username ?? "—") });
    case "remove_avatar":
      return t("admActRemoveAvatar");
    case "report_resolved":
      return t("admActReportResolved");
    case "report_dismissed":
      return t("admActReportDismissed");
    case "report_open":
      return t("admActReportOpen");
    case "resolve_error":
      return t("admActResolveError", { n: Number(d.rows ?? 0) });
    default:
      return e.action;
  }
}

function Avatar({ name, size = 36, admin, path }: { name: string; size?: number; admin?: boolean; path?: string | null }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const url = avatarUrl(path);
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: url ? undefined : `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${(hue + 50) % 360} 70% 45%))`,
      }}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full rounded-full object-cover ring-1 ring-white/10" />
      ) : (
        name.slice(0, 1).toUpperCase() || "?"
      )}
      {admin && <IconShield size={Math.max(12, size * 0.38)} className="absolute -right-1 -bottom-1 text-amber-300 drop-shadow" />}
    </span>
  );
}

function trialLeft(until: string | null): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 86_400_000));
}

function songName(id: string, lang: string): string {
  return builtinTitle(id, lang === "tr" ? "tr" : "en");
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
}

function Badge({ tone, children }: { tone: "amber" | "sky" | "violet" | "rose" | "slate"; children: ReactNode }) {
  const tones = {
    amber: "bg-amber-300/15 text-amber-200",
    sky: "bg-sky-400/15 text-sky-200",
    violet: "bg-brand-400/20 text-brand-200",
    rose: "bg-rose-400/15 text-rose-200",
    slate: "bg-white/10 text-mist-300",
  };
  return <span className={cx("rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide", tones[tone])}>{children}</span>;
}

function UserBadges({ u, t }: { u: AdminUser; t: TFn }) {
  return (
    <span className="flex flex-wrap gap-1">
      {u.is_admin && <Badge tone="violet">{t("admBadgeAdmin")}</Badge>}
      {u.pro && <Badge tone="amber">PRO</Badge>}
      {!u.pro && trialLeft(u.trial_until) > 0 && <Badge tone="amber">{t("admBadgeTrial", { n: trialLeft(u.trial_until) })}</Badge>}
      {u.cloud && <Badge tone="sky">{t("admBadgeCloud")}</Badge>}
      {u.banned && <Badge tone="rose">{t("admBadgeBanned")}</Badge>}
      {u.open_reports > 0 && <Badge tone="rose">{t("admBadgeReports", { n: u.open_reports })}</Badge>}
      {u.referrals > 0 && <Badge tone="sky">{t("admBadgeReferrals", { n: u.referrals })}</Badge>}
      {!u.confirmed && <Badge tone="slate">{t("admBadgeUnconfirmed")}</Badge>}
    </span>
  );
}

function ProviderIcons({ list }: { list: string[] }) {
  return (
    <span className="flex items-center gap-1 text-mist-400">
      {list.map((p) =>
        p === "google" ? (
          <IconGoogle key={p} size={13} />
        ) : p === "apple" ? (
          <IconApple key={p} size={13} />
        ) : (
          <span key={p} className="text-[10px] font-bold uppercase">
            @
          </span>
        )
      )}
    </span>
  );
}

function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-3xl border border-white/[0.07] bg-white/[0.03] p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-mist-200">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function ErrorBox({ msg, t }: { msg: string; t: TFn }) {
  return <p className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{t("admError", { msg })}</p>;
}

function Loading({ t }: { t: TFn }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-mist-400">
      <IconSync size={16} className="animate-spin" /> {t("admLoading")}
    </div>
  );
}

function Meter({ value, max, tone = "from-sky-400 to-brand-400" }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className={cx("h-full rounded-full bg-gradient-to-r", pct > 90 ? "from-rose-400 to-amber-400" : tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- overview

function Kpi({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className={cx("pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-30 blur-2xl", tone)} />
      <div className="flex items-center gap-2 text-xs font-semibold text-mist-400">
        <span className={cx("flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br text-white", tone)}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight sm:text-3xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-mist-400">{sub}</div>}
    </div>
  );
}

function BarChart({ data, color, lang }: { data: DayCount[]; color: string; lang: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const [hover, setHover] = useState<number | null>(null);
  const h = hover != null ? data[hover] : null;
  return (
    <div>
      <div className="mb-1 flex h-5 items-baseline justify-between text-xs text-mist-400">
        <span>{h ? formatDate(h.day, lang) : ""}</span>
        <span className="font-bold text-mist-100 tabular-nums">{h ? h.n : ""}</span>
      </div>
      <div className="flex h-36 items-end gap-[3px]" onPointerLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full flex-1 cursor-default items-end"
            onPointerEnter={() => setHover(i)}
            title={`${formatDate(d.day, lang)}: ${d.n}`}
          >
            <div
              className={cx("w-full rounded-t-md bg-gradient-to-t transition-opacity", color, hover != null && hover !== i && "opacity-50")}
              style={{ height: `${Math.max(d.n ? 6 : 2, (d.n / max) * 100)}%`, opacity: d.n ? undefined : 0.25 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-mist-500">
        <span>{data[0] ? formatDate(data[0].day, lang) : ""}</span>
        <span>{data.length ? formatDate(data[data.length - 1].day, lang) : ""}</span>
      </div>
    </div>
  );
}

function Breakdown({ entries, total, label }: { entries: [string, number][]; total: number; label: (k: string) => string }) {
  if (!entries.length) return <p className="text-sm text-mist-400">—</p>;
  return (
    <ul className="space-y-2.5">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => (
          <li key={k}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-semibold text-mist-200">{label(k)}</span>
              <span className="tabular-nums text-mist-400">
                {n} · {total ? Math.round((n / total) * 100) : 0}%
              </span>
            </div>
            <Meter value={n} max={total} tone="from-brand-400 to-fuchsia-400" />
          </li>
        ))}
    </ul>
  );
}

function Attention({ s, t, onTab }: { s: AdminStats; t: TFn; onTab: (tab: Tab) => void }) {
  const items: { tab: Tab; n: number; label: string; icon: ReactNode; tone: string }[] = [
    { tab: "reports", n: s.reportsOpen ?? 0, label: t("admAttReports"), icon: <IconFlag size={16} />, tone: "text-rose-300 bg-rose-500/10 ring-rose-400/25" },
    { tab: "errors", n: s.errors24 ?? 0, label: t("admAttErrors", { users: s.errorUsers24 ?? 0 }), icon: <IconBug size={16} />, tone: "text-amber-200 bg-amber-400/10 ring-amber-300/25" },
    { tab: "feedback", n: s.feedbackNew ?? 0, label: t("admAttFeedback"), icon: <IconMessage size={16} />, tone: "text-brand-200 bg-brand-500/10 ring-brand-400/25" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((i) => (
        <button
          key={i.tab}
          type="button"
          onClick={() => onTab(i.tab)}
          className={cx(
            "flex items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition-colors hover:bg-white/[0.06]",
            i.n ? i.tone : "bg-white/[0.02] text-mist-400 ring-white/[0.06]"
          )}
        >
          {i.icon}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{i.label}</span>
          <span className="text-xl font-extrabold tabular-nums">{i.n}</span>
        </button>
      ))}
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; n: number; tone: string }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.n));
  return (
    <ul className="space-y-2.5">
      {steps.map((s) => (
        <li key={s.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold text-mist-200">{s.label}</span>
            <span className="tabular-nums text-mist-400">{s.n}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className={cx("h-full rounded-full bg-gradient-to-r", s.tone)} style={{ width: `${(s.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

type Series = "signups" | "actives" | "purchases" | "errors";
const SERIES_COLOR: Record<Series, string> = {
  signups: "from-brand-600 to-brand-300",
  actives: "from-emerald-600 to-emerald-300",
  purchases: "from-amber-600 to-amber-300",
  errors: "from-rose-600 to-rose-300",
};

function Overview({ rev, t, lang, onTab }: { rev: number; t: TFn; lang: string; onTab: (tab: Tab) => void }) {
  const { data: s, error } = useLoad(fetchStats, [rev]);
  const [series, setSeries] = useState<Series>("signups");
  if (error) return <ErrorBox msg={error} t={t} />;
  if (!s) return <Loading t={t} />;
  const conversion = s.users ? Math.round((s.pro / s.users) * 1000) / 10 : 0;
  const trialRate = s.trialConverted + s.trialEnded ? Math.round((s.trialConverted / (s.trialConverted + s.trialEnded)) * 1000) / 10 : 0;
  const seriesData = (s[series] as DayCount[] | undefined) ?? [];
  const seriesTotal = seriesData.reduce((a, d) => a + d.n, 0);
  return (
    <div className="space-y-4">
      <Attention s={s} t={t} onTab={onTab} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<IconUsers size={15} />} tone="from-sky-400 to-blue-600" label={t("admKpiUsers")} value={s.users} sub={t("admKpiUsersSub", { n: s.new7 })} />
        <Kpi icon={<IconChart size={15} />} tone="from-emerald-400 to-teal-600" label={t("admKpiActive")} value={s.active7} sub={t("admKpiActiveSub", { n: s.active1, m: s.active30 })} />
        <Kpi icon={<IconCrown size={15} />} tone="from-amber-300 to-orange-500" label={t("admKpiPro")} value={s.pro} sub={t("admKpiProSub", { n: conversion })} />
        <Kpi
          icon={<IconCloud size={15} />}
          tone="from-cyan-400 to-brand-500"
          label={t("admKpiCloud")}
          value={s.cloud}
          sub={t("admKpiCloudSub", { files: s.files, size: formatBytes(s.bytes) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<IconUser size={15} />} tone="from-fuchsia-400 to-brand-600" label={t("admKpiNew30")} value={s.new30} />
        <Kpi icon={<IconList size={15} />} tone="from-slate-400 to-slate-600" label={t("admKpiUnconfirmed")} value={s.unconfirmed} />
        <Kpi icon={<IconBan size={15} />} tone="from-rose-400 to-red-600" label={t("admKpiBanned")} value={s.banned} />
        <Kpi icon={<IconShield size={15} />} tone="from-violet-400 to-indigo-600" label={t("admKpiAdmins")} value={s.admins} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<IconCrown size={15} />}
          tone="from-yellow-300 to-amber-600"
          label={t("admKpiTrial")}
          value={s.trial}
          sub={t("admKpiTrialSub", { n: s.trialEnded })}
        />
        <Kpi
          icon={<IconChart size={15} />}
          tone="from-lime-400 to-emerald-600"
          label={t("admKpiPurchases")}
          value={s.purchases30}
          sub={t("admKpiPurchasesSub", { n: s.purchases7 })}
        />
        <Kpi
          icon={<IconGift size={15} />}
          tone="from-sky-300 to-cyan-600"
          label={t("admKpiReferrals")}
          value={s.referrals}
          sub={t("admKpiReferralsSub", { n: s.referrals7 })}
        />
        <Kpi
          icon={<IconUsers size={15} />}
          tone="from-pink-400 to-rose-600"
          label={t("admKpiFriendships")}
          value={s.friendships}
          sub={t("admKpiFriendshipsSub", { duels: s.duels7, avatars: s.avatars })}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={
            <span>
              {t("admChartTitle")} <span className="ml-1 font-normal text-mist-400 tabular-nums">· {seriesTotal}</span>
            </span>
          }
          action={
            <Segmented
              size="sm"
              label={t("admChartTitle")}
              value={series}
              onChange={setSeries}
              options={[
                { value: "signups", label: t("admChartSignups") },
                { value: "actives", label: t("admChartActives") },
                { value: "purchases", label: t("admChartPurchases") },
                { value: "errors", label: t("admChartErrors") },
              ]}
            />
          }
        >
          <BarChart data={seriesData} color={SERIES_COLOR[series]} lang={lang} />
        </Card>
        <Card title={t("admFunnel")}>
          <Funnel
            steps={[
              { label: t("admFunnelUsers"), n: s.users, tone: "from-sky-400 to-brand-400" },
              { label: t("admFunnelTrial"), n: s.trial, tone: "from-yellow-300 to-amber-500" },
              { label: t("admFunnelEnded"), n: s.trialEnded, tone: "from-slate-400 to-slate-500" },
              { label: t("admFunnelPro"), n: s.pro, tone: "from-amber-300 to-orange-500" },
            ]}
          />
          <p className="mt-3 text-xs leading-relaxed text-mist-400">
            {t("admFunnelRate", { n: trialRate, m: s.trialConverted })}
          </p>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title={t("admTopSongs")} className="lg:col-span-2">
          {s.topSongs?.length ? (
            <ol className="space-y-2">
              {s.topSongs.map((x, i) => (
                <li key={x.song} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right text-xs font-bold text-mist-500 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{songName(x.song, lang)}</span>
                  <span className="text-xs text-mist-400 tabular-nums">{t("admTopSongsPlayers", { n: x.players })}</span>
                  <span className="w-16 text-right text-xs font-bold tabular-nums">{x.best.toLocaleString(lang)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-mist-400">—</p>
          )}
        </Card>
        <Card title={t("admProviders")}>
          <Breakdown entries={Object.entries(s.providers ?? {})} total={s.users} label={(k) => providerLabel(t, k)} />
        </Card>
        <div className="space-y-4">
          <Card title={t("admProSources")}>
            <Breakdown entries={Object.entries(s.proSources ?? {})} total={s.pro} label={(k) => sourceLabel(t, k)} />
          </Card>
          <Card title={t("admErrorPlatforms")}>
            <Breakdown
              entries={Object.entries(s.platforms ?? {})}
              total={Object.values(s.platforms ?? {}).reduce((a, n) => a + n, 0)}
              label={(k) => k}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- members

function UserRow({ u, onOpen, t, lang }: { u: AdminUser; onOpen: () => void; t: TFn; lang: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
    >
      <Avatar name={displayName(u)} admin={u.is_admin} path={u.avatar_path} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{displayName(u)}</span>
          <ProviderIcons list={u.providers} />
        </div>
        <div className="truncate text-xs text-mist-400">{u.username ? u.email : ""}</div>
        <div className="mt-1 md:hidden">
          <UserBadges u={u} t={t} />
        </div>
      </div>
      <div className="hidden md:block">
        <UserBadges u={u} t={t} />
      </div>
      <div className="hidden text-xs text-mist-400 md:block">
        <div>{formatDate(u.created_at, lang)}</div>
        <div className="text-mist-500">{t("admJoined")}</div>
      </div>
      <div className="text-right text-xs text-mist-400 md:text-left">
        <div>{u.last_sign_in_at ? timeAgo(u.last_sign_in_at, lang) : t("admNever")}</div>
        {u.cloud ? (
          <div className="mt-1 w-24 md:w-full">
            <Meter value={u.bytes} max={u.cloud_quota_mb * 1048576} />
          </div>
        ) : (
          <div className="hidden text-mist-500 md:block">{t("admLastSeen")}</div>
        )}
      </div>
    </button>
  );
}

function Members({ rev, onOpen, t, lang }: { rev: number; onOpen: (id: string) => void; t: TFn; lang: string }) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sort, setSort] = useState<UserSort>("new");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [q, filter, sort]);
  const { data, error, loading } = useLoad(
    () => listUsers({ search: q, filter, sort, limit: PAGE, offset: page * PAGE }),
    [q, filter, sort, page, rev]
  );
  const total = data?.total ?? 0;
  const filters: [UserFilter, string][] = [
    ["all", t("admFilterAll")],
    ["pro", t("admFilterPro")],
    ["trial", t("admFilterTrial")],
    ["free", t("admFilterFree")],
    ["cloud", t("admFilterCloud")],
    ["reported", t("admFilterReported")],
    ["referrers", t("admFilterReferrers")],
    ["admin", t("admFilterAdmin")],
    ["unconfirmed", t("admFilterUnconfirmed")],
    ["banned", t("admFilterBanned")],
  ];

  const exportCsv = async () => {
    try {
      const all: AdminUser[] = [];
      for (let off = 0; ; off += 500) {
        const { users } = await listUsers({ search: q, filter, sort, limit: 500, offset: off });
        all.push(...users);
        if (users.length < 500) break;
      }
      saveText(`staveflow-members-${new Date().toISOString().slice(0, 10)}.csv`, usersCsv(all), "text/csv");
    } catch (err) {
      toast(t("admError", { msg: err instanceof Error ? err.message : String(err) }), "error");
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3 focus-within:border-brand-400/60">
          <IconSearch size={16} className="shrink-0 text-mist-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admSearch")}
            aria-label={t("admSearch")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mist-400"
          />
        </label>
        <div className="flex gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as UserSort)}
            aria-label={t("admSort")}
            className="h-10 rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-sm outline-none"
          >
            <option value="new">{t("admSortNew")}</option>
            <option value="old">{t("admSortOld")}</option>
            <option value="active">{t("admSortActive")}</option>
            <option value="storage">{t("admSortStorage")}</option>
            <option value="name">{t("admSortName")}</option>
            <option value="reports">{t("admSortReports")}</option>
            <option value="referrals">{t("admSortReferrals")}</option>
          </select>
          <Button onClick={() => void exportCsv()}>
            <IconDownload size={15} /> CSV
          </Button>
        </div>
      </div>
      <div className="scroll-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {filters.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            aria-pressed={filter === v}
            className={cx(
              "h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors",
              filter === v ? "bg-brand-500 text-white" : "bg-white/[0.06] text-mist-300 hover:bg-white/[0.1]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 hidden grid-cols-[36px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 text-[11px] font-bold tracking-wider text-mist-500 uppercase md:grid">
        <span />
        <span>{t("admColMember")}</span>
        <span>{t("admColStatus")}</span>
        <span>{t("admJoined")}</span>
        <span>{t("admLastSeen")}</span>
      </div>
      <div className={cx("mt-1 transition-opacity", loading && data && "opacity-60")}>
        {error ? (
          <ErrorBox msg={error} t={t} />
        ) : !data ? (
          <Loading t={t} />
        ) : data.users.length === 0 ? (
          <p className="py-10 text-center text-sm text-mist-400">{t("admNoUsers")}</p>
        ) : (
          data.users.map((u) => <UserRow key={u.id} u={u} t={t} lang={lang} onOpen={() => onOpen(u.id)} />)
        )}
      </div>
      {total > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs text-mist-400">
          <span className="tabular-nums">
            {t("admPageInfo", { from: page * PAGE + 1, to: Math.min(total, (page + 1) * PAGE), total })}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              {t("admPrev")}
            </Button>
            <Button size="sm" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>
              {t("admNext")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------- user drawer

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-mist-400">{label}</span>
      <span className="min-w-0 text-right break-words text-mist-100">{children}</span>
    </div>
  );
}

function FileList({
  files,
  t,
  lang,
  showOwner,
  onChanged,
  onOpenUser,
}: {
  files: AdminFile[];
  t: TFn;
  lang: string;
  showOwner?: boolean;
  onChanged: () => void;
  onOpenUser?: (id: string) => void;
}) {
  if (!files.length) return <p className="py-3 text-sm text-mist-400">{t("admNoFiles")}</p>;
  return (
    <ul className="divide-y divide-white/[0.05]">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
            <IconCloud size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{f.title}</div>
            <div className="flex flex-wrap gap-x-2 text-xs text-mist-400">
              <span>{formatBytes(f.size_bytes)}</span>
              <span>{formatDate(f.created_at, lang, true)}</span>
              {showOwner && (
                <button type="button" className="truncate text-brand-300 hover:text-brand-200" onClick={() => onOpenUser?.(f.user_id)}>
                  {displayName(f)}
                </button>
              )}
            </div>
          </div>
          <IconButton
            size="sm"
            label={t("admDownload")}
            onClick={() => void downloadFile(f).catch((err) => toast(t("admError", { msg: String(err?.message ?? err) }), "error"))}
          >
            <IconDownload size={15} />
          </IconButton>
          <IconButton
            size="sm"
            label={t("admDeleteFile")}
            className="hover:!text-rose-300"
            onClick={() => {
              if (!window.confirm(t("admConfirmDeleteFile", { title: f.title }))) return;
              void deleteFile(f).then(
                () => {
                  toast(t("admDone"), "success");
                  onChanged();
                },
                (err) => toast(t("admError", { msg: String(err?.message ?? err) }), "error")
              );
            }}
          >
            <IconTrash size={15} />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function AuditList({ entries, t, lang, showTarget, onOpenUser }: { entries: AuditEntry[]; t: TFn; lang: string; showTarget?: boolean; onOpenUser?: (id: string) => void }) {
  if (!entries.length) return <p className="py-3 text-sm text-mist-400">{t("admNoHistory")}</p>;
  return (
    <ol className="relative space-y-3 border-l border-white/10 pl-4">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-brand-400 ring-4 ring-ink-950" />
          <div className="text-sm font-semibold">{describe(t, e)}</div>
          <div className="flex flex-wrap gap-x-2 text-xs text-mist-400">
            <span>{formatDate(e.at, lang, true)}</span>
            {e.admin_email && <span>{t("admBy", { admin: e.admin_email })}</span>}
            {showTarget && (e.target_email || e.detail?.email) ? (
              e.target_id ? (
                <button type="button" className="text-brand-300 hover:text-brand-200" onClick={() => onOpenUser?.(e.target_id!)}>
                  → {e.target_email}
                </button>
              ) : (
                <span>→ {String(e.detail?.email ?? "")}</span>
              )
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-black/20 px-3 py-2.5">
      <div className="text-lg font-extrabold tabular-nums">{value}</div>
      <div className="text-[11px] text-mist-400">{label}</div>
    </div>
  );
}

function formatDuration(seconds: number, t: TFn): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return t("admMinutes", { n: m });
  return t("admHours", { n: Math.round((m / 60) * 10) / 10 });
}

const REPORT_TONE: Record<ReportStatus, "rose" | "slate" | "sky"> = { open: "rose", resolved: "sky", dismissed: "slate" };

function TrialControls({ u, busy, onSet, t, lang }: { u: AdminUser; busy: boolean; onSet: (days: number) => void; t: TFn; lang: string }) {
  const left = trialLeft(u.trial_until);
  return (
    <Card title={t("admTrial")}>
      <p className="text-sm text-mist-200">
        {u.pro
          ? t("admTrialPro")
          : left > 0
            ? t("admTrialActive", { n: left, date: formatDate(u.trial_until, lang, true) })
            : u.trial_until
              ? t("admTrialEnded", { date: formatDate(u.trial_until, lang) })
              : t("admTrialNone")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[1, 7, 30].map((n) => (
          <Button key={n} size="sm" disabled={busy} onClick={() => onSet(n)}>
            +{t("admDays", { n })}
          </Button>
        ))}
        {left > 0 && (
          <Button size="sm" variant="ghost" disabled={busy} className="text-rose-200" onClick={() => onSet(0)}>
            {t("admTrialEnd")}
          </Button>
        )}
      </div>
    </Card>
  );
}

function UserDrawer({
  id,
  onClose,
  onChanged,
  onOpen,
  t,
  lang,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
  t: TFn;
  lang: string;
}) {
  const user = useLoad(() => getUser(id), [id]);
  const files = useLoad(() => listFiles(id, 500), [id]);
  const history = useLoad(() => auditLog(id, 50), [id]);
  const extra = useLoad(() => userExtra(id), [id]);
  const x = extra.data;
  const [myId, setMyId] = useState<string | null>(null);
  const [quota, setQuota] = useState("");
  const [note, setNote] = useState("");
  const [banHours, setBanHours] = useState("876000");
  const [busy, setBusy] = useState(false);
  const u = user.data;

  useEffect(() => {
    void supabase?.auth.getSession().then(({ data }) => setMyId(data.session?.user.id ?? null));
  }, []);
  useEffect(() => {
    if (!u) return;
    setQuota(String(u.cloud_quota_mb));
    setNote(u.admin_note ?? "");
  }, [u]);

  const reloadAll = () => {
    user.reload();
    files.reload();
    history.reload();
    extra.reload();
    onChanged();
  };

  const run = async (job: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await job();
      toast(t("admDone"), "success");
      reloadAll();
      if (id === myId) void refreshAccount();
    } catch (err) {
      toast(t("admError", { msg: errText(err) }), "error");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (p: UserPatch) => {
    setBusy(true);
    try {
      await updateUser(id, p);
      toast(t("admSaved"), "success");
      reloadAll();
      if (id === myId) void refreshAccount();
    } catch (err) {
      toast(t("admError", { msg: err instanceof Error ? err.message : String(err) }), "error");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "ban" | "unban" | "delete" | "remove_avatar", hours?: number) => {
    setBusy(true);
    try {
      await userAction(action, id, hours);
      toast(action === "delete" ? t("admUserDeleted") : t("admDone"), "success");
      if (action === "delete") {
        onChanged();
        onClose();
      } else reloadAll();
    } catch (err) {
      toast(t("admError", { msg: err instanceof Error ? err.message : String(err) }), "error");
    } finally {
      setBusy(false);
    }
  };

  const self = id === myId;
  const usedPct = u && u.cloud_quota_mb ? Math.round((u.bytes / (u.cloud_quota_mb * 1048576)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-black/50 backdrop-blur-[2px] animate-fade" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={u ? displayName(u) : t("admDetails")}
        className="glass flex h-full w-full max-w-lg flex-col overflow-hidden rounded-none border-r-0 sm:rounded-l-3xl animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          {u ? <Avatar name={displayName(u)} size={44} admin={u.is_admin} path={u.avatar_path} /> : <span className="h-11 w-11 rounded-full bg-white/10" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{u ? displayName(u) : "…"}</div>
            {u && <UserBadges u={u} t={t} />}
          </div>
          <IconButton label={t("close")} onClick={onClose}>
            <IconClose size={18} />
          </IconButton>
        </div>

        <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {user.error ? (
            <ErrorBox msg={user.error} t={t} />
          ) : !u ? (
            <Loading t={t} />
          ) : (
            <>
              <Card title={t("admDetails")}>
                <div className="divide-y divide-white/[0.05]">
                  <InfoRow label={t("admEmail")}>{u.email ?? "—"}</InfoRow>
                  <InfoRow label={t("admUsername")}>
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      {u.username ?? "—"}
                      {u.username && (
                        <button
                          type="button"
                          disabled={busy}
                          className="text-xs font-semibold text-rose-300 hover:text-rose-200"
                          onClick={() => window.confirm(t("admResetUsernameConfirm", { name: u.username! })) && void run(() => resetUsername(id))}
                        >
                          {t("admResetUsername")}
                        </button>
                      )}
                    </span>
                    {x?.username_changed_at && (
                      <span className="block text-[11px] text-mist-500">{t("admUsernameChanged", { date: formatDate(x.username_changed_at, lang) })}</span>
                    )}
                  </InfoRow>
                  <InfoRow label={t("admAvatar")}>
                    {u.avatar_path ? (
                      <span className="inline-flex items-center gap-2">
                        <a href={avatarUrl(u.avatar_path) ?? undefined} target="_blank" rel="noreferrer">
                          <Avatar name={displayName(u)} size={56} path={u.avatar_path} />
                        </a>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          className="text-rose-200"
                          onClick={() => window.confirm(t("admRemoveAvatarConfirm")) && void act("remove_avatar")}
                        >
                          <IconTrash size={14} /> {t("admRemoveAvatar")}
                        </Button>
                      </span>
                    ) : (
                      "—"
                    )}
                  </InfoRow>
                  <InfoRow label={t("admUserId")}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-mono text-xs text-mist-300 hover:text-mist-100"
                      onClick={() => void navigator.clipboard?.writeText(u.id).then(() => toast(t("admCopied"), "success"))}
                    >
                      {u.id.slice(0, 8)}… <IconCopy size={12} />
                    </button>
                  </InfoRow>
                  <InfoRow label={t("admProviders")}>{u.providers.map((p) => providerLabel(t, p)).join(", ") || "—"}</InfoRow>
                  <InfoRow label={t("admJoined")}>{formatDate(u.created_at, lang, true)}</InfoRow>
                  <InfoRow label={t("admLastSeen")}>
                    {u.last_sign_in_at ? `${formatDate(u.last_sign_in_at, lang, true)} · ${timeAgo(u.last_sign_in_at, lang)}` : t("admNever")}
                  </InfoRow>
                  <InfoRow label={t("admConfirmed")}>{u.confirmed ? t("admYes") : t("admNo")}</InfoRow>
                </div>
              </Card>

              {x && (
                <Card title={t("admActivity")}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Stat label={t("admPracticeTime")} value={formatDuration(x.practice_seconds, t)} />
                    <Stat label={t("admPracticeDays")} value={x.practice_days} />
                    <Stat label={t("admSongsPlayed")} value={x.songs_played} />
                    <Stat label={t("admRuns")} value={x.runs.toLocaleString(lang)} />
                    <Stat label={t("admNotesPlayed")} value={x.notes.toLocaleString(lang)} />
                    <Stat label={t("admWeeklySongs")} value={x.weekly_songs} />
                  </div>
                  <p className="mt-2 text-[11px] text-mist-500">
                    {t("admLastPractice", { date: x.last_practice ? formatDate(x.last_practice, lang) : "—" })} ·{" "}
                    {t("admSynced", { date: x.synced_at ? timeAgo(x.synced_at, lang) : "—" })}
                  </p>
                </Card>
              )}

              {x && (
                <Card title={t("admSocial")}>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label={t("admFriends")} value={x.friends} />
                    <Stat label={t("admDuels")} value={x.duels} />
                    <Stat label={t("admReportsMade")} value={x.reports_made} />
                    <Stat label={t("admBlocksMade")} value={x.blocks_made} />
                    <Stat label={t("admBlockedBy")} value={x.blocked_by} />
                    <Stat label={t("admReferralDays")} value={`${x.referral_days ?? 0}/30`} />
                  </div>
                  <div className="mt-3 divide-y divide-white/[0.05]">
                    <InfoRow label={t("admReferredBy")}>
                      {x.referred_by ? (
                        <button type="button" className="font-semibold text-brand-300 hover:text-brand-200" onClick={() => onOpen(x.referred_by!.id)}>
                          @{x.referred_by.username ?? x.referred_by.id.slice(0, 8)}
                        </button>
                      ) : (
                        "—"
                      )}
                    </InfoRow>
                    <InfoRow label={t("admInvited", { n: x.referrals.length })}>
                      {x.referrals.length ? (
                        <span className="flex flex-wrap justify-end gap-1.5">
                          {x.referrals.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              title={formatDate(r.at, lang)}
                              className="rounded-lg bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-brand-200 hover:bg-white/[0.1]"
                              onClick={() => onOpen(r.id)}
                            >
                              @{r.username ?? r.id.slice(0, 6)}
                            </button>
                          ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </InfoRow>
                  </div>
                </Card>
              )}

              {x && x.reports.length > 0 && (
                <Card title={<span className="text-rose-200">{t("admReportsReceived", { n: x.reports.length })}</span>} className="border-rose-400/20">
                  <ul className="space-y-2">
                    {x.reports.map((r) => (
                      <li key={r.id} className="rounded-2xl bg-black/20 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge tone="rose">{t(`reportReason_${r.reason}`).toUpperCase()}</Badge>
                          <Badge tone={REPORT_TONE[r.status]}>{t(`admReport_${r.status}`).toUpperCase()}</Badge>
                          <span className="text-mist-400">{timeAgo(r.at, lang)}</span>
                          <span className="ml-auto text-mist-400">@{r.reporter ?? "?"}</span>
                        </div>
                        {r.details && <p className="mt-2 whitespace-pre-wrap break-words text-mist-200">{r.details}</p>}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card title={t("admPermissions")}>
                <Switch
                  checked={u.pro}
                  onChange={(v) => void patch({ pro: v, pro_source: "manual" })}
                  label={t("admProSwitch")}
                  hint={u.pro ? t("admProHint", { source: sourceLabel(t, u.pro_source), date: formatDate(u.pro_since, lang) }) : undefined}
                />
                <Switch checked={u.cloud} onChange={(v) => void patch({ cloud: v })} label={t("admCloudSwitch")} hint={t("admCloudHint")} />
                {u.cloud && (
                  <div className="mt-1 mb-2 rounded-2xl bg-black/20 p-3">
                    <div className="mb-1.5 flex justify-between text-xs text-mist-400">
                      <span>
                        {formatBytes(u.bytes)} / {u.cloud_quota_mb} MB · {t("cloudSongs", { n: u.files })}
                      </span>
                      <span className="tabular-nums">{usedPct}%</span>
                    </div>
                    <Meter value={u.bytes} max={u.cloud_quota_mb * 1048576} />
                    <form
                      className="mt-3 flex flex-wrap items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const n = Math.round(Number(quota));
                        if (Number.isFinite(n) && n >= 0 && n <= 102400) void patch({ cloud_quota_mb: n });
                      }}
                    >
                      <label className="min-w-[7rem] flex-1">
                        <span className="mb-1 block whitespace-nowrap text-xs text-mist-400">{t("admQuota")}</span>
                        <input
                          type="number"
                          min={0}
                          max={102400}
                          value={quota}
                          onChange={(e) => setQuota(e.target.value)}
                          className="h-9 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-brand-400/70"
                        />
                      </label>
                      {[100, 500, 2048].map((n) => (
                        <Button key={n} size="sm" type="button" onClick={() => setQuota(String(n))}>
                          {n >= 1024 ? `${n / 1024} GB` : `${n} MB`}
                        </Button>
                      ))}
                      <Button size="sm" variant="primary" type="submit" disabled={busy}>
                        {t("admSave")}
                      </Button>
                    </form>
                  </div>
                )}
                <Switch
                  checked={u.is_admin}
                  onChange={(v) => (self && !v ? toast(t("admAdminSelf"), "error") : void patch({ is_admin: v }))}
                  label={t("admAdminSwitch")}
                  hint={self ? t("admAdminSelf") : undefined}
                />
              </Card>

              <TrialControls u={u} busy={busy} t={t} lang={lang} onSet={(days) => void run(() => setTrial(id, days))} />

              {x && x.purchases.length > 0 && (
                <Card title={t("admPurchases")}>
                  <ul className="divide-y divide-white/[0.05]">
                    {x.purchases.map((p, i) => (
                      <li key={`${p.order ?? i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="font-semibold">{sourceLabel(t, p.store)}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-mist-400">{p.order ?? p.product}</span>
                        <span className="text-xs text-mist-400">{formatDate(p.at, lang, true)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {x && x.errors.length > 0 && (
                <Card title={t("admUserErrors", { n: x.errors.length })}>
                  <ul className="space-y-1.5">
                    {x.errors.map((e, i) => (
                      <li key={i} className="rounded-xl bg-black/20 px-3 py-2 text-xs">
                        <div className="truncate font-mono text-rose-200" title={e.message}>
                          {e.message}
                        </div>
                        <div className="mt-0.5 flex gap-2 text-mist-500">
                          <span>{timeAgo(e.created_at, lang)}</span>
                          {e.app_version && <span>v{e.app_version}</span>}
                          {e.platform && <span>{e.platform}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card title={t("admNote")}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={t("admNoteHint")}
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none placeholder:text-mist-500 focus:border-brand-400/70"
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="primary" disabled={busy || note === (u.admin_note ?? "")} onClick={() => void patch({ admin_note: note })}>
                    {t("admSave")}
                  </Button>
                </div>
              </Card>

              <Card title={`${t("admFiles")} (${files.data?.length ?? 0})`}>
                {files.error ? <ErrorBox msg={files.error} t={t} /> : !files.data ? <Loading t={t} /> : <FileList files={files.data} t={t} lang={lang} onChanged={reloadAll} />}
              </Card>

              <Card title={t("admHistory")}>
                {history.data ? <AuditList entries={history.data} t={t} lang={lang} /> : <Loading t={t} />}
              </Card>

              {!self && (
                <Card title={<span className="text-rose-300">{t("admDanger")}</span>} className="border-rose-400/20">
                  {u.banned ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-mist-300">{t("admBannedUntil", { date: formatDate(u.banned_until, lang, true) })}</span>
                      <Button disabled={busy} onClick={() => void act("unban")}>
                        {t("admUnban")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex-1">
                        <span className="mb-1 block text-xs text-mist-400">{t("admBanFor")}</span>
                        <select
                          value={banHours}
                          onChange={(e) => setBanHours(e.target.value)}
                          className="h-10 w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-sm outline-none"
                        >
                          <option value="24">{t("admBan24h")}</option>
                          <option value="168">{t("admBan7d")}</option>
                          <option value="720">{t("admBan30d")}</option>
                          <option value="876000">{t("admBanForever")}</option>
                        </select>
                      </label>
                      <Button variant="danger" disabled={busy} onClick={() => void act("ban", Number(banHours))}>
                        <IconBan size={15} /> {t("admBan")}
                      </Button>
                    </div>
                  )}
                  <div className="mt-4 border-t border-white/[0.06] pt-4">
                    <Button
                      variant="danger"
                      className="w-full"
                      disabled={busy}
                      onClick={() => {
                        const typed = window.prompt(t("admConfirmDeleteUser"));
                        if (typed != null && typed.trim().toLowerCase() === (u.email ?? "").toLowerCase()) void act("delete");
                      }}
                    >
                      <IconTrash size={15} /> {t("admDeleteUser")}
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------- cloud / log

function CloudTab({ rev, onOpen, onChanged, t, lang }: { rev: number; onOpen: (id: string) => void; onChanged: () => void; t: TFn; lang: string }) {
  const stats = useLoad(fetchStats, [rev]);
  const top = useLoad(() => storageByUser(20), [rev]);
  const recent = useLoad(() => listFiles(null, 100), [rev]);
  const s = stats.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi icon={<IconCloud size={15} />} tone="from-cyan-400 to-brand-500" label={t("admStorageTotal")} value={s ? formatBytes(s.bytes) : "…"} />
        <Kpi icon={<IconList size={15} />} tone="from-sky-400 to-blue-600" label={t("admFiles")} value={s ? s.files : "…"} />
        <Kpi icon={<IconUsers size={15} />} tone="from-emerald-400 to-teal-600" label={t("admCloudUsers")} value={s ? s.cloud : "…"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("admTopStorage")}>
          {top.error ? (
            <ErrorBox msg={top.error} t={t} />
          ) : !top.data ? (
            <Loading t={t} />
          ) : top.data.length === 0 ? (
            <p className="py-3 text-sm text-mist-400">{t("admNoFiles")}</p>
          ) : (
            <ul className="space-y-3">
              {top.data.map((r) => (
                <li key={r.user_id}>
                  <button type="button" className="w-full text-left" onClick={() => onOpen(r.user_id)}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={displayName(r)} size={24} />
                        <span className="truncate font-semibold">{displayName(r)}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-mist-400">
                        {formatBytes(r.bytes)} / {r.quota_mb} MB · {r.files}
                      </span>
                    </div>
                    <Meter value={r.bytes} max={r.quota_mb * 1048576} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t("admRecentUploads")}>
          {recent.error ? (
            <ErrorBox msg={recent.error} t={t} />
          ) : !recent.data ? (
            <Loading t={t} />
          ) : (
            <FileList files={recent.data} t={t} lang={lang} showOwner onOpenUser={onOpen} onChanged={onChanged} />
          )}
        </Card>
      </div>
    </div>
  );
}

function AuditTab({ rev, onOpen, t, lang }: { rev: number; onOpen: (id: string) => void; t: TFn; lang: string }) {
  const { data, error } = useLoad(() => auditLog(null, 300), [rev]);
  return (
    <Card title={t("admTabAudit")}>
      {error ? <ErrorBox msg={error} t={t} /> : !data ? <Loading t={t} /> : <AuditList entries={data} t={t} lang={lang} showTarget onOpenUser={onOpen} />}
    </Card>
  );
}

// ---------------------------------------------------------------- feedback

const FEEDBACK_TONE: Record<FeedbackEntry["kind"], "amber" | "sky" | "violet" | "rose" | "slate"> = {
  suggestion: "sky",
  complaint: "amber",
  bug: "rose",
  other: "slate",
};

function FeedbackItem({ f, t, lang, onOpen, onChanged }: { f: FeedbackEntry; t: TFn; lang: string; onOpen: (id: string) => void; onChanged: () => void }) {
  const [note, setNote] = useState(f.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const run = (job: () => Promise<void>, ok = t("admFbSaved")) => {
    setBusy(true);
    void job().then(
      () => {
        setBusy(false);
        toast(ok, "success");
        onChanged();
      },
      (err) => {
        setBusy(false);
        toast(t("admError", { msg: String(err?.message ?? err) }), "error");
      }
    );
  };
  const replyTo = f.email ?? f.account_email;
  return (
    <li className={cx("rounded-2xl border p-4", f.status === "new" ? "border-brand-400/30 bg-brand-500/[0.06]" : "border-white/[0.06] bg-white/[0.02]")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={FEEDBACK_TONE[f.kind]}>{t(`feedbackKind_${f.kind}`).toUpperCase()}</Badge>
        {f.status === "new" && <Badge tone="violet">{t("admFbNew").toUpperCase()}</Badge>}
        {f.status === "done" && <Badge tone="slate">{t("admFbDone").toUpperCase()}</Badge>}
        <span className="text-mist-400" title={formatDate(f.created_at, lang, true)}>
          {timeAgo(f.created_at, lang)}
        </span>
        <span className="ml-auto flex items-center gap-2 text-mist-400">
          {f.user_id ? (
            <button type="button" className="flex items-center gap-1.5 font-semibold text-brand-300 hover:text-brand-200" onClick={() => onOpen(f.user_id!)}>
              <Avatar name={displayName({ username: f.username, email: f.account_email })} size={18} />
              {displayName({ username: f.username, email: f.account_email })}
            </button>
          ) : (
            <span>{t("admFbGuest")}</span>
          )}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-mist-100">{f.message}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-mist-500">
        {f.platform && <span>{f.platform}</span>}
        {f.app_version && <span>v{f.app_version}</span>}
        {f.language && <span>{f.language.toUpperCase()}</span>}
        {f.email && <span>{f.email}</span>}
        {f.device && (
          <span className="max-w-full truncate" title={f.device}>
            {f.device}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("admFbNote")}
          maxLength={2000}
          className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 text-xs outline-none focus:border-brand-400"
        />
        {note !== (f.admin_note ?? "") && (
          <Button size="sm" disabled={busy} onClick={() => run(() => updateFeedback(f.id, { note }))}>
            {t("admFbNoteSave")}
          </Button>
        )}
        {f.status === "new" && (
          <Button size="sm" disabled={busy} onClick={() => run(() => updateFeedback(f.id, { status: "read" }))}>
            <IconCheck size={14} /> {t("admFbMarkRead")}
          </Button>
        )}
        {f.status !== "done" ? (
          <Button size="sm" disabled={busy} onClick={() => run(() => updateFeedback(f.id, { status: "done" }))}>
            <IconCheck size={14} /> {t("admFbMarkDone")}
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => run(() => updateFeedback(f.id, { status: "read" }))}>
            {t("admFbReopen")}
          </Button>
        )}
        {replyTo && (
          <a
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 text-[13px] font-semibold text-mist-100 hover:bg-white/[0.11]"
            href={`mailto:${replyTo}?subject=${encodeURIComponent(t("admFbReplySubject"))}`}
          >
            <IconMessage size={14} /> {t("admFbReply")}
          </a>
        )}
        <IconButton
          size="sm"
          label={t("admFbDelete")}
          className="hover:!text-rose-300"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("admFbDeleteConfirm"))) run(() => deleteFeedback(f.id), t("admDone"));
          }}
        >
          <IconTrash size={15} />
        </IconButton>
      </div>
    </li>
  );
}

function FeedbackTab({ rev, onOpen, onChanged, t, lang }: { rev: number; onOpen: (id: string) => void; onChanged: () => void; t: TFn; lang: string }) {
  const [filter, setFilter] = useState<FeedbackStatus | "open" | "all">("open");
  const counts = useLoad(feedbackCounts, [rev]);
  const list = useLoad(() => listFeedback(filter, 300), [rev, filter]);
  const c = counts.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi icon={<IconMessage size={15} />} tone="from-brand-400 to-fuchsia-600" label={t("admFbNew")} value={c ? c.new : "…"} />
        <Kpi icon={<IconList size={15} />} tone="from-sky-400 to-blue-600" label={t("admFbRead")} value={c ? c.read : "…"} />
        <Kpi icon={<IconCheck size={15} />} tone="from-emerald-400 to-teal-600" label={t("admFbDone")} value={c ? c.done : "…"} />
      </div>
      <Card
        title={t("admTabFeedback")}
        action={
          <Segmented
            size="sm"
            label={t("admTabFeedback")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: t("admFbOpen") },
              { value: "new", label: t("admFbNew") },
              { value: "done", label: t("admFbDone") },
              { value: "all", label: t("admFbAll") },
            ]}
          />
        }
      >
        {list.error ? (
          <ErrorBox msg={list.error} t={t} />
        ) : !list.data ? (
          <Loading t={t} />
        ) : list.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-mist-400">{t("admFbEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {list.data.map((f) => (
              <FeedbackItem key={`${f.id}-${f.status}-${f.admin_note ?? ""}`} f={f} t={t} lang={lang} onOpen={onOpen} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------- reports

function ReportItem({ r, t, lang, onOpen, onChanged }: { r: AdminReport; t: TFn; lang: string; onOpen: (id: string) => void; onChanged: () => void }) {
  const [note, setNote] = useState(r.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const run = (job: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    void job().then(
      () => {
        setBusy(false);
        toast(t("admDone"), "success");
        onChanged();
      },
      (err) => {
        setBusy(false);
        toast(t("admError", { msg: errText(err) }), "error");
      }
    );
  };
  const name = r.target_username ?? r.reported_username ?? r.target_email ?? "?";
  const renamed = r.reported_username && r.target_username && r.reported_username !== r.target_username;
  const tid = r.target_id;
  return (
    <li className={cx("rounded-2xl border p-4", r.status === "open" ? "border-rose-400/30 bg-rose-500/[0.05]" : "border-white/[0.06] bg-white/[0.02]")}>
      <div className="flex flex-wrap items-start gap-3">
        <a
          href={avatarUrl(r.target_avatar) ?? undefined}
          target="_blank"
          rel="noreferrer"
          className={cx(!r.target_avatar && "pointer-events-none")}
          aria-label={t("admAvatar")}
        >
          <Avatar name={name} size={r.reason === "avatar" ? 72 : 44} path={r.target_avatar} />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {tid ? (
              <button type="button" className="truncate font-bold hover:text-brand-200" onClick={() => onOpen(tid)}>
                @{name}
              </button>
            ) : (
              <span className="font-bold text-mist-400">{t("admReportDeletedUser")}</span>
            )}
            <Badge tone="rose">{t(`reportReason_${r.reason}`).toUpperCase()}</Badge>
            <Badge tone={REPORT_TONE[r.status]}>{t(`admReport_${r.status}`).toUpperCase()}</Badge>
            {r.target_banned && <Badge tone="rose">{t("admBadgeBanned")}</Badge>}
            {r.target_reports > 1 && <Badge tone="amber">{t("admReportTotal", { n: r.target_reports })}</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-mist-400">
            {r.target_email && <span>{r.target_email}</span>}
            {renamed && <span>{t("admReportWasNamed", { name: r.reported_username! })}</span>}
            {r.reason === "avatar" && r.reported_avatar && r.reported_avatar !== r.target_avatar && <span>{t("admReportAvatarChanged")}</span>}
          </div>
          {r.details && <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words text-mist-100">“{r.details}”</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-mist-500">
            <span title={formatDate(r.created_at, lang, true)}>{timeAgo(r.created_at, lang)}</span>
            <span>
              {t("admReportBy")}{" "}
              {r.reporter_id ? (
                <button type="button" className="font-semibold text-brand-300 hover:text-brand-200" onClick={() => onOpen(r.reporter_id!)}>
                  @{r.reporter_username ?? r.reporter_email ?? "?"}
                </button>
              ) : (
                "—"
              )}
            </span>
            {r.resolved_at && <span>{t("admReportClosedBy", { admin: r.resolved_by_email ?? "—", date: formatDate(r.resolved_at, lang) })}</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("admFbNote")}
          maxLength={2000}
          className="h-8 min-w-0 flex-1 basis-40 rounded-lg border border-white/10 bg-black/30 px-2.5 text-xs outline-none focus:border-brand-400"
        />
        {note !== (r.admin_note ?? "") && (
          <Button size="sm" disabled={busy} onClick={() => run(() => updateReport(r.id, { note }))}>
            {t("admFbNoteSave")}
          </Button>
        )}
        {r.status === "open" ? (
          <>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => updateReport(r.id, { status: "resolved", note }))}>
              <IconCheck size={14} /> {t("admReportResolve")}
            </Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updateReport(r.id, { status: "dismissed", note }))}>
              {t("admReportDismiss")}
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => run(() => updateReport(r.id, { status: "open" }))}>
            {t("admFbReopen")}
          </Button>
        )}
      </div>
      {tid && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-white/[0.05] pt-2">
          {r.target_avatar && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => userAction("remove_avatar", tid), t("admRemoveAvatarConfirm"))}>
              <IconTrash size={14} /> {t("admRemoveAvatar")}
            </Button>
          )}
          {r.target_username && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => run(() => resetUsername(tid), t("admResetUsernameConfirm", { name: r.target_username! }))}
            >
              {t("admResetUsername")}
            </Button>
          )}
          {!r.target_banned && (
            <>
              <Button size="sm" variant="ghost" className="text-rose-200" disabled={busy} onClick={() => run(() => userAction("ban", tid, 168), t("admBanConfirm", { name, time: t("admBan7d") }))}>
                <IconBan size={14} /> {t("admBan")} · {t("admBan7d")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-200"
                disabled={busy}
                onClick={() => run(() => userAction("ban", tid, 876000), t("admBanConfirm", { name, time: t("admBanForever") }))}
              >
                <IconBan size={14} /> {t("admBan")} · {t("admBanForever")}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onOpen(tid)}>
            <IconUser size={14} /> {t("admOpenUser")}
          </Button>
        </div>
      )}
    </li>
  );
}

function ReportsTab({ rev, onOpen, onChanged, t, lang }: { rev: number; onOpen: (id: string) => void; onChanged: () => void; t: TFn; lang: string }) {
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const list = useLoad(() => listReports(filter, 300), [rev, filter]);
  const reasons = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of list.data ?? []) m[r.reason] = (m[r.reason] ?? 0) + 1;
    return Object.entries(m);
  }, [list.data]);
  return (
    <div className="space-y-4">
      <Card title={t("admReportsTitle")} action={
        <Segmented
          size="sm"
          label={t("admReportsTitle")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: t("admReport_open") },
            { value: "resolved", label: t("admReport_resolved") },
            { value: "dismissed", label: t("admReport_dismissed") },
            { value: "all", label: t("admFbAll") },
          ]}
        />
      }>
        <p className="mb-3 text-xs leading-relaxed text-mist-400">{t("admReportsHint")}</p>
        {reasons.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {reasons.map(([k, n]) => (
              <span key={k} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-mist-300">
                {t(`reportReason_${k as ReportReason}`)} · {n}
              </span>
            ))}
          </div>
        )}
        {list.error ? (
          <ErrorBox msg={list.error} t={t} />
        ) : !list.data ? (
          <Loading t={t} />
        ) : list.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-mist-400">{t("admReportsEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {list.data.map((r) => (
              <ReportItem key={`${r.id}-${r.status}-${r.admin_note ?? ""}-${r.target_avatar ?? ""}-${r.target_username ?? ""}`} r={r} t={t} lang={lang} onOpen={onOpen} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ errors

function ErrorItem({ e, t, lang, onChanged }: { e: ErrorGroup; t: TFn; lang: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const resolve = () => {
    if (!window.confirm(t("admErrorResolveConfirm"))) return;
    setBusy(true);
    void resolveError(e.fingerprint).then(
      () => {
        setBusy(false);
        toast(t("admDone"), "success");
        onChanged();
      },
      (err) => {
        setBusy(false);
        toast(t("admError", { msg: errText(err) }), "error");
      }
    );
  };
  const copy = () => {
    const text = [e.message, e.stack ?? "", `url: ${e.url ?? ""}`, `device: ${e.device ?? ""}`, `versions: ${(e.versions ?? []).join(", ")}`].join("\n");
    void navigator.clipboard?.writeText(text).then(() => toast(t("admCopied"), "success"));
  };
  const fresh = Date.now() - Date.parse(e.last_seen) < 86_400_000;
  return (
    <li className={cx("rounded-2xl border p-4", fresh ? "border-amber-300/25 bg-amber-400/[0.04]" : "border-white/[0.06] bg-white/[0.02]")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={e.kind === "crash" ? "rose" : e.kind === "promise" ? "violet" : "amber"}>{t(`admErrKind_${e.kind}` as "admErrKind_error").toUpperCase()}</Badge>
        <span className="font-bold tabular-nums">{t("admErrorCount", { n: e.count })}</span>
        <span className="text-mist-400 tabular-nums">{t("admErrorUsers", { n: e.users })}</span>
        <span className="ml-auto text-mist-400" title={formatDate(e.last_seen, lang, true)}>
          {timeAgo(e.last_seen, lang)}
        </span>
      </div>
      <p className="mt-2 font-mono text-[13px] leading-snug break-words text-rose-100">{e.message}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {(e.versions ?? []).map((v) => (
          <span key={v} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-mist-300">
            v{v}
          </span>
        ))}
        {(e.platforms ?? []).map((p) => (
          <span key={p} className="rounded-md bg-sky-400/10 px-1.5 py-0.5 text-sky-200">
            {p}
          </span>
        ))}
        {e.url && <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-mist-400">{e.url}</span>}
        <span className="text-mist-500">{t("admErrorFirst", { date: formatDate(e.first_seen, lang) })}</span>
      </div>
      {(e.stack || e.device) && (
        <details className="mt-2 rounded-xl bg-black/30 text-xs">
          <summary className="cursor-pointer px-3 py-2 font-semibold text-mist-300">{t("admErrorDetails")}</summary>
          {e.stack && <pre className="scroll-thin max-h-64 overflow-auto px-3 pb-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-mist-300">{e.stack}</pre>}
          {e.device && <p className="border-t border-white/[0.05] px-3 py-2 text-[11px] break-words text-mist-500">{e.device}</p>}
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={copy}>
          <IconCopy size={14} /> {t("admCopy")}
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={resolve}>
          <IconCheck size={14} /> {t("admErrorResolve")}
        </Button>
      </div>
    </li>
  );
}

function ErrorsTab({ rev, onChanged, t, lang }: { rev: number; onChanged: () => void; t: TFn; lang: string }) {
  const [days, setDays] = useState<"1" | "7" | "30" | "90">("7");
  const list = useLoad(() => listErrors(Number(days), 200), [rev, days]);
  const totals = useMemo(() => {
    const l = list.data ?? [];
    return { groups: l.length, events: l.reduce((a, e) => a + e.count, 0), crashes: l.filter((e) => e.kind === "crash").reduce((a, e) => a + e.count, 0) };
  }, [list.data]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi icon={<IconBug size={15} />} tone="from-amber-400 to-orange-600" label={t("admErrorGroups")} value={list.data ? totals.groups : "…"} />
        <Kpi icon={<IconList size={15} />} tone="from-slate-400 to-slate-600" label={t("admErrorEvents")} value={list.data ? totals.events : "…"} />
        <Kpi icon={<IconBan size={15} />} tone="from-rose-400 to-red-600" label={t("admErrorCrashes")} value={list.data ? totals.crashes : "…"} />
      </div>
      <Card
        title={t("admTabErrors")}
        action={
          <Segmented
            size="sm"
            label={t("admTabErrors")}
            value={days}
            onChange={setDays}
            options={[
              { value: "1", label: t("admLast24h") },
              { value: "7", label: t("admDays", { n: 7 }) },
              { value: "30", label: t("admDays", { n: 30 }) },
              { value: "90", label: t("admDays", { n: 90 }) },
            ]}
          />
        }
      >
        <p className="mb-3 text-xs leading-relaxed text-mist-400">{t("admErrorsHint")}</p>
        {list.error ? (
          <ErrorBox msg={list.error} t={t} />
        ) : !list.data ? (
          <Loading t={t} />
        ) : list.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-mist-400">{t("admErrorsEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {list.data.map((e) => (
              <ErrorItem key={e.fingerprint} e={e} t={t} lang={lang} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// --------------------------------------------------------------- referrals

function ReferralsTab({ rev, onOpen, t, lang }: { rev: number; onOpen: (id: string) => void; t: TFn; lang: string }) {
  const data = useLoad(() => referralStats(150), [rev]);
  const stats = useLoad(fetchStats, [rev]);
  const d = data.data;
  const s = stats.data;
  const proCount = d?.recent.filter((r) => r.pro).length ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<IconGift size={15} />} tone="from-sky-300 to-cyan-600" label={t("admKpiReferrals")} value={s ? s.referrals : "…"} />
        <Kpi icon={<IconChart size={15} />} tone="from-emerald-400 to-teal-600" label={t("admRefLast7")} value={s ? s.referrals7 : "…"} />
        <Kpi icon={<IconUsers size={15} />} tone="from-brand-400 to-fuchsia-600" label={t("admRefInviters")} value={d ? d.top.length : "…"} />
        <Kpi icon={<IconCrown size={15} />} tone="from-amber-300 to-orange-500" label={t("admRefBecamePro")} value={d ? proCount : "…"} />
      </div>
      <p className="px-1 text-xs leading-relaxed text-mist-400">{t("admRefHint")}</p>
      {data.error ? (
        <ErrorBox msg={data.error} t={t} />
      ) : !d ? (
        <Loading t={t} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t("admRefTop")}>
            {d.top.length === 0 ? (
              <p className="py-3 text-sm text-mist-400">{t("admRefEmpty")}</p>
            ) : (
              <ol className="space-y-1">
                {d.top.map((r, i) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.05]">
                      <span className="w-5 text-right text-xs font-bold text-mist-500 tabular-nums">{i + 1}</span>
                      <Avatar name={displayName(r)} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{displayName(r)}</span>
                        <span className="block text-[11px] text-mist-400">
                          {t("admRefEarned", { n: r.referral_days ?? 0 })} · {timeAgo(r.last_at, lang)}
                        </span>
                      </span>
                      <span className="text-lg font-extrabold tabular-nums">{r.n}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card title={t("admRefRecent")}>
            {d.recent.length === 0 ? (
              <p className="py-3 text-sm text-mist-400">{t("admRefEmpty")}</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {d.recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                    <button type="button" className="min-w-0 truncate font-semibold hover:text-brand-200" onClick={() => onOpen(r.id)}>
                      {displayName(r)}
                    </button>
                    {r.pro && <Badge tone="amber">PRO</Badge>}
                    <span className="text-mist-500">←</span>
                    <button type="button" className="min-w-0 truncate text-brand-300 hover:text-brand-200" onClick={() => onOpen(r.inviter_id)}>
                      @{r.inviter ?? "?"}
                    </button>
                    <span className="ml-auto shrink-0 text-xs text-mist-400" title={formatDate(r.at, lang, true)}>
                      {timeAgo(r.at, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- shell

export default function AdminPanel() {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const [tab, setTab] = useState<Tab>("overview");
  const [selected, setSelected] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (selectedRef.current) setSelected(null);
      else setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useLoad(fetchStats, [rev]).data;
  const tabs = useMemo(
    () =>
      [
        ["overview", t("admTabOverview"), <IconChart key="o" size={16} />, 0],
        ["members", t("admTabMembers"), <IconUsers key="m" size={16} />, 0],
        ["reports", t("admTabReports"), <IconFlag key="r" size={16} />, counts?.reportsOpen ?? 0],
        ["errors", t("admTabErrors"), <IconBug key="e" size={16} />, counts?.errors24 ?? 0],
        ["feedback", t("admTabFeedback"), <IconMessage key="f" size={16} />, counts?.feedbackNew ?? 0],
        ["referrals", t("admTabReferrals"), <IconGift key="g" size={16} />, 0],
        ["cloud", t("admTabCloud"), <IconCloud key="c" size={16} />, 0],
        ["audit", t("admTabAudit"), <IconList key="a" size={16} />, 0],
      ] as [Tab, string, ReactNode, number][],
    [t, counts]
  );
  const bump = () => setRev((r) => r + 1);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("admTitle")} className="fixed inset-0 z-[70] flex flex-col bg-ink-950 text-mist-100 animate-fade">
      <header className="border-b border-white/[0.06] bg-ink-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-brand-600 text-ink-950">
            <IconShield size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold tracking-tight">{t("admTitle")}</h2>
            <p className="truncate text-xs text-mist-400">Sonatrio</p>
          </div>
          <IconButton label={t("admRefresh")} onClick={bump}>
            <IconSync size={18} />
          </IconButton>
          <IconButton label={t("close")} onClick={() => setPanel(null)}>
            <IconClose size={18} />
          </IconButton>
        </div>
        <nav className="scroll-thin mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pt-3 sm:px-6" role="tablist">
          {tabs.map(([id, label, icon, badge]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cx(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors",
                tab === id ? "border-brand-400 text-white" : "border-transparent text-mist-400 hover:text-mist-200"
              )}
            >
              {icon}
              {label}
              {badge > 0 && (
                <span className="min-w-[18px] rounded-full bg-rose-500 px-1.5 text-center text-[10px] leading-[18px] font-extrabold text-white tabular-nums">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          {tab === "overview" && <Overview rev={rev} t={t} lang={lang} onTab={setTab} />}
          {tab === "members" && <Members rev={rev} t={t} lang={lang} onOpen={setSelected} />}
          {tab === "reports" && <ReportsTab rev={rev} t={t} lang={lang} onOpen={setSelected} onChanged={bump} />}
          {tab === "errors" && <ErrorsTab rev={rev} t={t} lang={lang} onChanged={bump} />}
          {tab === "referrals" && <ReferralsTab rev={rev} t={t} lang={lang} onOpen={setSelected} />}
          {tab === "cloud" && <CloudTab rev={rev} t={t} lang={lang} onOpen={setSelected} onChanged={bump} />}
          {tab === "feedback" && <FeedbackTab rev={rev} t={t} lang={lang} onOpen={setSelected} onChanged={bump} />}
          {tab === "audit" && <AuditTab rev={rev} t={t} lang={lang} onOpen={setSelected} />}
        </div>
      </div>
      {selected && <UserDrawer key={selected} id={selected} t={t} lang={lang} onClose={() => setSelected(null)} onChanged={bump} onOpen={setSelected} />}
    </div>
  );
}
