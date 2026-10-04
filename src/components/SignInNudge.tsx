import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { setPanel, useApp } from "../state/store";
import { IconCloud, IconUser } from "../ui/icons";
import { Button } from "../ui/primitives";

const KEY = "sonatrio-signin-nudge";
const EVERY_MS = 3 * 86_400_000;
/** Finished songs before the results screen starts reminding. */
const AFTER_RUNS = 2;

function due(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) > EVERY_MS;
  } catch {
    return false;
  }
}

function markShown(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}

/**
 * Asks signed-out players to sign in so their progress follows them.
 * `periodic`: shown after a few finished songs, then at most every few days, with a Later button.
 */
export function SignInNudge({ periodic = false, beforeOpen }: { periodic?: boolean; beforeOpen?: () => void }) {
  const t = useT();
  const signedOut = useApp((s) => s.account.status === "signedOut");
  const runs = useApp((s) => s.progress.runs);
  const [hidden, setHidden] = useState(() => periodic && !due());
  const show = signedOut && !hidden && (!periodic || runs >= AFTER_RUNS);

  useEffect(() => {
    if (periodic && show) markShown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;
  return (
    <div className="mt-4 rounded-2xl bg-gradient-to-br from-sky-400/20 to-brand-500/15 px-4 py-3 text-left ring-1 ring-sky-300/30 animate-pop">
      <div className="flex items-start gap-3">
        <IconCloud size={22} className="mt-0.5 shrink-0 text-sky-300" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{t("nudgeTitle")}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-mist-300">{t("nudgeBody")}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {periodic && (
          <Button variant="ghost" size="sm" onClick={() => setHidden(true)}>
            {t("nudgeLater")}
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            beforeOpen?.();
            setPanel("account");
          }}
        >
          <IconUser size={14} />
          {t("signIn")} / {t("signUp")}
        </Button>
      </div>
    </div>
  );
}
