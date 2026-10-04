import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../../auth/account";
import {
  auditLog,
  deleteFile,
  downloadFile,
  fetchStats,
  getUser,
  listFiles,
  listUsers,
  storageByUser,
  updateUser,
  userAction,
  usersCsv,
  type AdminFile,
  type AdminUser,
  type AuditEntry,
  type DayCount,
  type UserFilter,
  type UserPatch,
  type UserSort,
} from "../../auth/admin";
import { refreshAccount } from "../../auth/account";
import { useT, type TFn } from "../../i18n";
import { formatBytes, formatDate, timeAgo } from "../../lib/format";
import { setPanel, toast, useApp } from "../../state/store";
import {
  IconApple,
  IconBan,
  IconChart,
  IconClose,
  IconCloud,
  IconCopy,
  IconCrown,
  IconDownload,
  IconGoogle,
  IconList,
  IconSearch,
  IconShield,
  IconSync,
  IconTrash,
  IconUser,
  IconUsers,
} from "../../ui/icons";
import { Button, IconButton, Segmented, Switch, cx } from "../../ui/primitives";

type Tab = "overview" | "members" | "cloud" | "audit";
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
    default:
      return e.action;
  }
}

function Avatar({ name, size = 36, admin }: { name: string; size?: number; admin?: boolean }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${(hue + 50) % 360} 70% 45%))`,
      }}
    >
      {name.slice(0, 1).toUpperCase() || "?"}
      {admin && <IconShield size={Math.max(12, size * 0.38)} className="absolute -right-1 -bottom-1 text-amber-300 drop-shadow" />}
    </span>
  );
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
      {u.cloud && <Badge tone="sky">{t("admBadgeCloud")}</Badge>}
      {u.banned && <Badge tone="rose">{t("admBadgeBanned")}</Badge>}
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
        <div className="mb-3 flex items-center justify-between gap-3">
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

function Overview({ rev, t, lang }: { rev: number; t: TFn; lang: string }) {
  const { data: s, error } = useLoad(fetchStats, [rev]);
  const [series, setSeries] = useState<"signups" | "actives">("signups");
  if (error) return <ErrorBox msg={error} t={t} />;
  if (!s) return <Loading t={t} />;
  const conversion = s.users ? Math.round((s.pro / s.users) * 1000) / 10 : 0;
  return (
    <div className="space-y-4">
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
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={t("admChartTitle")}
          action={
            <Segmented
              size="sm"
              label={t("admChartTitle")}
              value={series}
              onChange={setSeries}
              options={[
                { value: "signups", label: t("admChartSignups") },
                { value: "actives", label: t("admChartActives") },
              ]}
            />
          }
        >
          <BarChart
            data={series === "signups" ? s.signups ?? [] : s.actives ?? []}
            color={series === "signups" ? "from-brand-600 to-brand-300" : "from-emerald-600 to-emerald-300"}
            lang={lang}
          />
        </Card>
        <div className="space-y-4">
          <Card title={t("admProviders")}>
            <Breakdown entries={Object.entries(s.providers ?? {})} total={s.users} label={(k) => providerLabel(t, k)} />
          </Card>
          <Card title={t("admProSources")}>
            <Breakdown entries={Object.entries(s.proSources ?? {})} total={s.pro} label={(k) => sourceLabel(t, k)} />
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
      <Avatar name={displayName(u)} admin={u.is_admin} />
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
    ["free", t("admFilterFree")],
    ["cloud", t("admFilterCloud")],
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

function UserDrawer({ id, onClose, onChanged, t, lang }: { id: string; onClose: () => void; onChanged: () => void; t: TFn; lang: string }) {
  const user = useLoad(() => getUser(id), [id]);
  const files = useLoad(() => listFiles(id, 500), [id]);
  const history = useLoad(() => auditLog(id, 50), [id]);
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
    onChanged();
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

  const act = async (action: "ban" | "unban" | "delete", hours?: number) => {
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
          {u ? <Avatar name={displayName(u)} size={44} admin={u.is_admin} /> : <span className="h-11 w-11 rounded-full bg-white/10" />}
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
                  <InfoRow label={t("admUsername")}>{u.username ?? "—"}</InfoRow>
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

  const tabs = useMemo(
    () =>
      [
        ["overview", t("admTabOverview"), <IconChart key="o" size={16} />],
        ["members", t("admTabMembers"), <IconUsers key="m" size={16} />],
        ["cloud", t("admTabCloud"), <IconCloud key="c" size={16} />],
        ["audit", t("admTabAudit"), <IconList key="a" size={16} />],
      ] as [Tab, string, ReactNode][],
    [t]
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
          {tabs.map(([id, label, icon]) => (
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
            </button>
          ))}
        </nav>
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          {tab === "overview" && <Overview rev={rev} t={t} lang={lang} />}
          {tab === "members" && <Members rev={rev} t={t} lang={lang} onOpen={setSelected} />}
          {tab === "cloud" && <CloudTab rev={rev} t={t} lang={lang} onOpen={setSelected} onChanged={bump} />}
          {tab === "audit" && <AuditTab rev={rev} t={t} lang={lang} onOpen={setSelected} />}
        </div>
      </div>
      {selected && <UserDrawer id={selected} t={t} lang={lang} onClose={() => setSelected(null)} onChanged={bump} />}
    </div>
  );
}
