import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { closeResults } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import { IconSparkles } from "../ui/icons";
import { Button } from "../ui/primitives";
import { openSettingsTab } from "./settingsNav";

const KEY = "sonatrio-effects-tip";
/** Finished songs before we mention the calm visual defaults. */
const AFTER_RUNS = 2;

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* private mode */
  }
}

/** After a couple of calm runs, point new players to Look settings for hit/dust/approach effects. */
export function EffectsTip() {
  const t = useT();
  const runs = useApp((s) => s.progress.runs);
  const fxOff = useApp((s) => !s.settings.effects || !s.settings.dustOn || !s.settings.approachOn);
  const [hidden, setHidden] = useState(seen);
  const show = !hidden && fxOff && runs >= AFTER_RUNS;

  useEffect(() => {
    if (show) markSeen();
  }, [show]);

  if (!show) return null;
  return (
    <div className="mt-4 rounded-2xl bg-gradient-to-br from-brand-400/20 to-fuchsia-500/15 px-4 py-3 text-left ring-1 ring-brand-300/30 animate-pop">
      <div className="flex items-start gap-3">
        <IconSparkles size={22} className="mt-0.5 shrink-0 text-brand-300" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{t("effectsTipTitle")}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-mist-300">{t("effectsTipBody")}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            markSeen();
            setHidden(true);
          }}
        >
          {t("nudgeLater")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            markSeen();
            setHidden(true);
            closeResults();
            openSettingsTab("look");
            setPanel("settings");
          }}
        >
          <IconSparkles size={14} />
          {t("effectsTipOpen")}
        </Button>
      </div>
    </div>
  );
}
