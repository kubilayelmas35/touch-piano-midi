import { useState } from "react";
import { useT } from "../i18n";
import { createDuel, toastSocialError } from "../social/social";
import { toast, useApp } from "../state/store";
import { IconClose, IconCrown, IconSwords } from "../ui/icons";
import { Button, cx } from "../ui/primitives";

/** While a friend's challenge is being played: whom to beat, with a way out. */
export function DuelChip() {
  const t = useT();
  const duel = useApp((s) => s.activeDuel);
  if (!duel) return null;
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/15 py-1 pr-1 pl-3 text-sm font-semibold text-amber-100 shadow-lg backdrop-blur animate-pop">
      <IconSwords size={15} />
      <span>{t("duelChip", { name: duel.friend ?? "?", score: duel.from_score.toLocaleString() })}</span>
      <button
        type="button"
        onClick={() => useApp.setState({ activeDuel: null })}
        aria-label={t("cancel")}
        className="flex h-6 w-6 items-center justify-center rounded-full text-amber-200 hover:bg-white/10"
      >
        <IconClose size={14} />
      </button>
    </div>
  );
}

/** Results, social part: a challenge answered, friends' best on this song this week, and sending a challenge. */
export function ResultsSocial() {
  const t = useT();
  const results = useApp((s) => s.results);
  const board = useApp((s) => s.social?.board);
  const signedIn = useApp((s) => s.account.status === "signedIn");
  const currentId = useApp((s) => s.currentId);
  const instrument = useApp((s) => s.settings.instrument);
  const [picking, setPicking] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  if (!results || !signedIn) return null;
  const { duel, friendScores } = results;
  const others = friendScores?.filter((f) => !f.is_me) ?? [];
  const friends = board?.filter((r) => !r.is_me) ?? [];

  const challenge = async (id: string, name: string | null) => {
    if (!currentId) return;
    const r = await createDuel(id, { songId: currentId, instrument, score: results.stats.score, accuracy: results.accuracy });
    if (!r.ok) return toastSocialError(r.error);
    setSent((s) => [...s, id]);
    toast(t("challengeSent", { name: name ?? "?" }), "success");
  };

  return (
    <div className="mt-4 space-y-3 text-left">
      {duel && (
        <div
          className={cx(
            "rounded-2xl px-4 py-3 ring-1 animate-pop",
            duel.mine > duel.theirs
              ? "bg-emerald-400/15 ring-emerald-300/35"
              : duel.mine < duel.theirs
                ? "bg-rose-400/10 ring-rose-300/30"
                : "bg-white/[0.05] ring-white/10"
          )}
        >
          <div className="flex items-center gap-2 text-base font-extrabold">
            <IconSwords size={18} />
            {t(duel.mine > duel.theirs ? "duelResultWin" : duel.mine < duel.theirs ? "duelResultLose" : "duelResultTie", { name: duel.friend ?? "?" })}
          </div>
          <div className="mt-1 text-sm tabular-nums text-mist-200">
            {t("you")} {duel.mine.toLocaleString()} – {duel.theirs.toLocaleString()} @{duel.friend ?? "?"}
          </div>
        </div>
      )}

      {others.length > 0 && friendScores && (
        <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
          <div className="mb-1.5 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("friendsThisWeek")}</div>
          <ol className="space-y-1">
            {friendScores.slice(0, 5).map((f, i) => (
              <li key={`${f.username}-${i}`} className={cx("flex items-center gap-2 text-sm", f.is_me && "font-bold text-brand-200")}>
                <span className="w-5 text-center text-xs tabular-nums text-mist-400">{i === 0 ? <IconCrown size={14} className="mx-auto text-amber-300" /> : i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{f.is_me ? t("you") : `@${f.username ?? "?"}`}</span>
                <span className="tabular-nums">{f.score.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {results.social && !duel && friends.length > 0 && (
        <div>
          {!picking ? (
            <Button size="sm" className="w-full" onClick={() => setPicking(true)}>
              <IconSwords size={15} /> {t("challengeFriend")}
            </Button>
          ) : (
            <div className="rounded-2xl bg-white/[0.04] p-2">
              <div className="px-1 pb-1.5 text-xs text-mist-400">{t("challengeHint", { score: results.stats.score.toLocaleString() })}</div>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {friends.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">@{f.username ?? "?"}</span>
                    <Button size="sm" variant={sent.includes(f.id) ? "ghost" : "primary"} disabled={sent.includes(f.id)} onClick={() => void challenge(f.id, f.username)}>
                      {sent.includes(f.id) ? t("challengeSentShort") : t("challengeSend")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
