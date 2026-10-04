import { useState } from "react";
import { useT } from "../i18n";
import { formatTime } from "../lib/notes";
import { useApp } from "../state/store";
import { discardTake, saveTake, stopRecording } from "../studio/recording";
import { IconShare, IconStop } from "../ui/icons";
import { Button, Dialog } from "../ui/primitives";

/** Floating "REC 0:42 · 120 notes [Stop]" pill while recording. */
export function RecordingBar() {
  const t = useT();
  const rec = useApp((s) => s.recording);
  if (!rec) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink-950/85 py-1.5 pr-1.5 pl-4 shadow-xl ring-1 ring-rose-400/40 backdrop-blur">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        <span className="text-xs font-extrabold tracking-[0.14em] text-rose-200">{t("recording")}</span>
        <span className="text-sm font-semibold tabular-nums">{formatTime((Date.now() - rec.startedAt) / 1000)}</span>
        <span className="text-xs text-mist-400 tabular-nums max-[360px]:hidden">{t("recordNotes", { n: rec.notes })}</span>
        <Button size="sm" variant="danger" onClick={stopRecording} aria-label={t("recordStop")}>
          <IconStop size={14} />
          <span className="max-sm:hidden">{t("recordStop")}</span>
        </Button>
      </div>
    </div>
  );
}

function defaultName(lang: string): string {
  const d = new Date();
  return d.toLocaleString(lang === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TakeDialog() {
  const t = useT();
  const take = useApp((s) => s.take);
  const lang = useApp((s) => s.settings.language);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [shownFor, setShownFor] = useState<typeof take>(null);
  if (take !== shownFor) {
    setShownFor(take);
    if (take) setName(t("takeDefaultName", { date: defaultName(lang) }));
  }
  const save = (share: boolean) => {
    if (busy) return;
    setBusy(true);
    void saveTake(name.trim() || t("takeDefaultName", { date: defaultName(lang) }), share).finally(() => setBusy(false));
  };
  return (
    <Dialog
      open={!!take}
      onClose={() => {
        if (window.confirm(t("takeDiscardConfirm"))) discardTake();
      }}
      title={t("takeTitle")}
      width="max-w-md"
      closeLabel={t("close")}
      footer={
        <>
          <Button variant="ghost" className="mr-auto hover:!text-rose-300" onClick={discardTake} disabled={busy}>
            {t("takeDiscard")}
          </Button>
          <Button variant="subtle" onClick={() => save(true)} disabled={busy}>
            <IconShare size={16} />
            {t("takeSaveShare")}
          </Button>
          <Button variant="primary" onClick={() => save(false)} disabled={busy}>
            {t("takeSave")}
          </Button>
        </>
      }
    >
      {take && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <p className="mb-3 text-sm text-mist-300">{t("takeInfo", { time: formatTime(take.seconds), n: take.notes.length })}</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-mist-300">{t("takeNameLabel")}</span>
            <input
              autoFocus
              value={name}
              maxLength={120}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-base outline-none focus:border-brand-400/60"
            />
          </label>
        </form>
      )}
    </Dialog>
  );
}
