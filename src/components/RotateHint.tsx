import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { isNativeApp } from "../lib/platform";
import { setLandscapeLock, usePortraitPhone } from "../lib/orientation";
import { updateSettings } from "../state/actions";
import { useApp } from "../state/store";
import { IconRotate } from "../ui/icons";
import { Button } from "../ui/primitives";

/** Suggests landscape on phones held upright; in the app it can also lock the screen sideways. */
export function RotateHint() {
  const t = useT();
  const portrait = usePortraitPhone();
  const enabled = useApp((s) => s.settings.rotateHint);
  const locked = useApp((s) => s.settings.landscapeLock);
  const busy = useApp((s) => s.welcomeOpen || !!s.video);
  const [later, setLater] = useState(false);

  useEffect(() => {
    if (isNativeApp) void setLandscapeLock(locked);
  }, [locked]);

  if (!portrait || !enabled || later || busy) return null;

  const rotate = async () => {
    const ok = await setLandscapeLock(true);
    if (ok && isNativeApp) updateSettings({ landscapeLock: true });
    setLater(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 pb-[calc(var(--safe-bottom)+12px)]">
      <div role="status" className="glass pointer-events-auto w-full max-w-sm rounded-3xl p-4 text-mist-100 animate-pop">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300">
            <IconRotate size={24} className="animate-tilt" />
          </span>
          <div className="min-w-0">
            <div className="font-bold">{t("rotateTitle")}</div>
            <p className="mt-0.5 text-xs text-mist-300">{t("rotateBody")}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => updateSettings({ rotateHint: false })}>
            {t("rotateNever")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLater(true)}>
            {t("rotateLater")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => void rotate()}>
            {t("rotateNow")}
          </Button>
        </div>
      </div>
    </div>
  );
}
