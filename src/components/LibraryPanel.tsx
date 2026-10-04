import { useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { formatTime } from "../lib/notes";
import { BUILTIN_CATEGORIES, BUILTIN_SONGS, type BuiltinCategory } from "../midi/builtin";
import { canImport } from "../auth/account";
import { syncCloud } from "../auth/cloud";
import { formatBytes } from "../lib/format";
import { importFiles, openSong, removeSong, renameUserSong } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import { bestKey, type SongPrefs } from "../storage/db";
import { dayKey } from "../progress/progress";
import { IconCheck, IconCloud, IconEdit, IconPlay, IconSearch, IconStar, IconSync, IconTrash, IconUpload } from "../ui/icons";
import { Button, Dialog, IconButton, cx } from "../ui/primitives";

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-px text-amber-300" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <IconStar key={i} size={size} filled={i < n} className={i < n ? "" : "text-white/20"} />
      ))}
    </span>
  );
}

function bestStars(prefs: SongPrefs | undefined, instrument: string): number {
  const b = prefs?.best;
  if (!b) return 0;
  return Math.max(b[bestKey(instrument, false)]?.stars ?? 0, b[bestKey(instrument, true)]?.stars ?? 0);
}

/** Same built-in song for everyone on a given day. */
function songOfTheDay(d = new Date()) {
  const key = dayKey(d);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return BUILTIN_SONGS[h % BUILTIN_SONGS.length];
}

function normalize(s: string): string {
  return s
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

export function LibraryPanel() {
  const t = useT();
  const open = useApp((s) => s.panel === "library");
  const userSongs = useApp((s) => s.userSongs);
  const prefs = useApp((s) => s.prefs);
  const currentId = useApp((s) => s.currentId);
  const instrument = useApp((s) => s.settings.instrument);
  const pro = useApp((s) => s.account.pro);
  const cloud = useApp((s) => s.account.status === "signedIn" && s.account.cloud);
  const quotaMb = useApp((s) => s.account.cloudQuotaMb);
  const cloudIds = useApp((s) => s.cloudIds);
  const cloudBytes = useApp((s) => s.cloudBytes);
  const cloudBusy = useApp((s) => s.cloudBusy);
  const accountOn = useApp((s) => s.account.status !== "disabled");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const close = () => setPanel(null);

  const [category, setCategory] = useState<BuiltinCategory | "all">("all");
  const lang = useApp((s) => s.settings.language);
  const q = normalize(query.trim());
  const builtins = useMemo(
    () =>
      BUILTIN_SONGS.filter(
        (s) =>
          (category === "all" || s.category === category) &&
          (!q || normalize(`${s.title} ${s.titleTr ?? ""} ${s.composer}`).includes(q))
      ),
    [q, category]
  );
  const composerLabel = (c: string) => (c === "Traditional" ? t("traditional") : c);
  const catLabel = (c: BuiltinCategory | "all") =>
    c === "all" ? t("catAll") : c === "kids" ? t("catKids") : c === "classical" ? t("catClassical") : c === "folk" ? t("catFolk") : t("catHoliday");
  const mine = useMemo(() => userSongs.filter((s) => !q || normalize(s.title).includes(q)), [userSongs, q]);
  const daily = songOfTheDay();

  const choose = async (id: string) => {
    if (editing) return;
    const ok = await openSong(id);
    if (ok) close();
  };

  const levelLabel = (l: number) => (l === 1 ? t("level1") : l === 2 ? t("level2") : t("level3"));
  const levelColor = (l: number) =>
    l === 1 ? "bg-emerald-400/15 text-emerald-200" : l === 2 ? "bg-amber-400/15 text-amber-200" : "bg-rose-400/15 text-rose-200";

  return (
    <Dialog open={open} onClose={close} title={t("library")} side="left" closeLabel={t("close")}>
      <div className="sticky top-0 z-10 -mx-5 bg-gradient-to-b from-ink-850 via-ink-850/95 to-transparent px-5 pt-1 pb-3">
        <div className="flex gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3 focus-within:border-brand-400/60">
            <IconSearch size={16} className="shrink-0 text-mist-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mist-400"
            />
          </label>
          <Button variant="primary" onClick={() => (canImport() ? fileRef.current?.click() : setPanel("pro"))}>
            <IconUpload size={16} />
            <span className="max-[380px]:hidden">{t("importMidi")}</span>
            {!pro && !cloud && accountOn && (
              <span className="rounded-md bg-amber-300 px-1.5 text-[10px] leading-4 font-extrabold text-ink-950">PRO</span>
            )}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".mid,.midi,.kar,audio/midi,audio/x-midi"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) void importFiles(files).then((ok) => ok && close());
            }}
          />
        </div>
        <p className="mt-2 hidden text-xs text-mist-400 sm:block">{t("dropHint")}</p>
        {cloud && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-sky-300/15 bg-sky-400/[0.07] px-3 py-2">
            <IconCloud size={18} className="shrink-0 text-sky-300" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-sky-100">{t("cloudOn")}</span>
                <span className="tabular-nums text-mist-300">
                  {formatBytes(cloudBytes)} / {quotaMb} MB · {t("cloudSongs", { n: cloudIds.length })}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-brand-400"
                  style={{ width: `${Math.min(100, quotaMb ? (cloudBytes / (quotaMb * 1048576)) * 100 : 0)}%` }}
                />
              </div>
            </div>
            <IconButton size="sm" label={t("cloudSync")} disabled={cloudBusy} onClick={() => void syncCloud()}>
              <IconSync size={16} className={cloudBusy ? "animate-spin" : ""} />
            </IconButton>
          </div>
        )}
      </div>

      {!q && (
        <button
          type="button"
          onClick={() => void choose(daily.id)}
          className="group relative mb-5 flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500/30 via-fuchsia-500/15 to-sky-400/10 px-4 py-3.5 text-left ring-1 ring-brand-300/25 transition-transform active:scale-[0.99]"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-[0.12em] text-brand-200 uppercase">{t("songOfDay")}</div>
            <div className="mt-0.5 truncate text-base font-bold">{lang === "tr" && daily.titleTr ? daily.titleTr : daily.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-mist-300">
              <span className="truncate">
                {composerLabel(daily.composer)} · {levelLabel(daily.level)}
              </span>
              <Stars n={bestStars(prefs[daily.id], instrument)} />
            </div>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-lg transition-transform group-hover:scale-105">
            <IconPlay size={18} className="translate-x-px" />
          </span>
        </button>
      )}

      <section aria-labelledby="lib-mine">
        <h3 id="lib-mine" className="mt-1 mb-2 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">
          {t("mySongs")}
        </h3>
        {mine.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-mist-400">
            {q ? t("noResults") : t("emptyMySongs")}
          </p>
        ) : (
          <ul className="space-y-1">
            {mine.map((s) => {
              const active = s.id === currentId;
              const isEditing = editing === s.id;
              return (
                <li key={s.id}>
                  <div
                    className={cx(
                      "group flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-colors",
                      active ? "bg-brand-500/20 ring-1 ring-brand-400/40" : "hover:bg-white/[0.05]"
                    )}
                  >
                    {isEditing ? (
                      <form
                        className="flex min-w-0 flex-1 gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void renameUserSong(s.id, draft).then(() => setEditing(null));
                        }}
                      >
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              e.preventDefault();
                              setEditing(null);
                            }
                          }}
                          aria-label={t("rename")}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-brand-400/50 bg-black/40 px-2 text-sm outline-none"
                        />
                        <IconButton label={t("done")} size="sm" type="submit">
                          <IconCheck size={16} />
                        </IconButton>
                      </form>
                    ) : (
                      <button type="button" onClick={() => void choose(s.id)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{s.title}</span>
                          {cloud && cloudIds.includes(s.id) && (
                            <span title={t("inCloud")} className="shrink-0 text-sky-300">
                              <IconCloud size={13} />
                              <span className="sr-only">{t("inCloud")}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-mist-400">
                          {s.duration ? <span>{formatTime(s.duration)}</span> : null}
                          {s.noteCount ? <span>{t("notesCount", { n: s.noteCount })}</span> : null}
                          {s.folder ? <span className="truncate">· {s.folder}</span> : null}
                          <Stars n={bestStars(prefs[s.id], instrument)} />
                        </div>
                      </button>
                    )}
                    {!isEditing && (
                      <div className="flex shrink-0 opacity-70 transition-opacity group-hover:opacity-100">
                        <IconButton
                          size="sm"
                          label={t("rename")}
                          onClick={() => {
                            setDraft(s.title);
                            setEditing(s.id);
                          }}
                        >
                          <IconEdit size={15} />
                        </IconButton>
                        <IconButton
                          size="sm"
                          label={t("delete")}
                          className="hover:!text-rose-300"
                          onClick={() => {
                            if (window.confirm(t("confirmDelete", { title: s.title }))) void removeSong(s.id);
                          }}
                        >
                          <IconTrash size={15} />
                        </IconButton>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="lib-builtin" className="mt-6">
        <h3 id="lib-builtin" className="mb-2 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">
          {t("builtIn")} <span className="font-semibold text-mist-400/70">· {builtins.length}</span>
        </h3>
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={t("builtIn")}>
          {(["all", ...BUILTIN_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cx(
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                category === c ? "bg-brand-500/25 text-brand-100 ring-1 ring-brand-400/40" : "bg-white/[0.05] text-mist-300 hover:bg-white/[0.09]"
              )}
            >
              {catLabel(c)}
            </button>
          ))}
        </div>
        {builtins.length === 0 ? (
          <p className="px-1 text-sm text-mist-400">{t("noResults")}</p>
        ) : (
          <ul className="space-y-1">
            {builtins.map((s) => {
              const active = s.id === currentId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => void choose(s.id)}
                    aria-current={active ? "true" : undefined}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                      active ? "bg-brand-500/20 ring-1 ring-brand-400/40" : "hover:bg-white/[0.05]"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{lang === "tr" && s.titleTr ? s.titleTr : s.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-mist-400">
                        <span className="truncate">
                          {composerLabel(s.composer)}
                          {lang === "tr" && s.titleTr ? ` · ${s.title}` : ""}
                        </span>
                        <Stars n={bestStars(prefs[s.id], instrument)} />
                      </div>
                    </div>
                    <span className={cx("shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold", levelColor(s.level))}>
                      {levelLabel(s.level)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 px-1 text-[11px] leading-relaxed text-mist-400/70">{t("builtInNote")}</p>
      </section>
    </Dialog>
  );
}
