import { useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { formatTime } from "../lib/notes";
import { BUILTIN_SONGS } from "../midi/builtin";
import { canImport } from "../auth/account";
import { importFiles, openSong, removeSong, renameUserSong } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import { bestKey, type SongPrefs } from "../storage/db";
import { IconCheck, IconEdit, IconSearch, IconStar, IconTrash, IconUpload } from "../ui/icons";
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
  const accountOn = useApp((s) => s.account.status !== "disabled");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const close = () => setPanel(null);

  const q = normalize(query.trim());
  const builtins = useMemo(
    () => BUILTIN_SONGS.filter((s) => !q || normalize(`${s.title} ${s.composer}`).includes(q)),
    [q]
  );
  const mine = useMemo(() => userSongs.filter((s) => !q || normalize(s.title).includes(q)), [userSongs, q]);

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
            {!pro && accountOn && (
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
      </div>

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
                        <div className="truncate text-sm font-semibold">{s.title}</div>
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
          {t("builtIn")}
        </h3>
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
                      <div className="truncate text-sm font-semibold">{s.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-mist-400">
                        <span className="truncate">{s.composer}</span>
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
      </section>
    </Dialog>
  );
}
