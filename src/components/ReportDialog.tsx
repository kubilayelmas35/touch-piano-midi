import { useEffect, useState, type FormEvent } from "react";
import { avatarUrl } from "../auth/account";
import { useT } from "../i18n";
import { blockUser, REPORT_REASONS, reportUser, socialErrorText, type FriendRef, type ReportReason } from "../social/social";
import { toast } from "../state/store";
import { Button, Dialog, cx } from "../ui/primitives";
import { UserAvatar } from "./UserAvatar";

/** Reports a member to the moderators, optionally blocking them in the same step. */
export function ReportDialog({ target, onClose }: { target: FriendRef | null; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;
    setReason(null);
    setDetails("");
    setAlsoBlock(true);
    setError("");
  }, [target]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target || !reason) return;
    setBusy(true);
    setError("");
    const r = await reportUser(target.id, reason, details);
    if (r.ok && alsoBlock) await blockUser(target.id);
    setBusy(false);
    if (!r.ok) return setError(socialErrorText(r.error));
    toast(alsoBlock ? t("reportSentBlocked") : t("reportSent"), "success", 5000);
    onClose();
  };

  return (
    <Dialog open={!!target} onClose={onClose} title={t("reportTitle")} width="max-w-sm" closeLabel={t("close")}>
      {target && (
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
            <UserAvatar url={avatarUrl(target.avatar)} name={target.username} className="h-10 w-10 text-base" />
            <div className="min-w-0 flex-1 truncate font-bold">@{target.username ?? "?"}</div>
          </div>
          <p className="text-xs leading-relaxed text-mist-400">{t("reportIntro")}</p>
          <div role="radiogroup" aria-label={t("reportReason")} className="grid grid-cols-2 gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cx(
                  "min-h-10 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors",
                  reason === r ? "bg-rose-500/25 text-rose-50 ring-1 ring-rose-300/50" : "bg-white/[0.05] text-mist-200 hover:bg-white/[0.09]"
                )}
              >
                {t(`reportReason_${r}`)}
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("reportDetails")}
            aria-label={t("reportDetails")}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none placeholder:text-mist-500 focus:border-brand-400/70"
          />
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-500" />
            <span>
              <span className="font-semibold">{t("reportAlsoBlock")}</span>
              <span className="block text-xs text-mist-400">{t("blockHint")}</span>
            </span>
          </label>
          {error && <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={busy || !reason}>
              {t("reportSend")}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
