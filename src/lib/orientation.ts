import { useEffect, useState } from "react";
import { isNativeApp } from "./platform";

const PORTRAIT_PHONE = "(orientation: portrait) and (max-width: 700px) and (pointer: coarse)";

/** True while a phone-sized touch screen is held upright. */
export function usePortraitPhone(): boolean {
  const [on, setOn] = useState(() => typeof matchMedia !== "undefined" && matchMedia(PORTRAIT_PHONE).matches);
  useEffect(() => {
    const mq = matchMedia(PORTRAIT_PHONE);
    const update = () => setOn(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return on;
}

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/** Keeps the screen sideways (app) or tries to (mobile browsers only allow it in fullscreen). */
export async function setLandscapeLock(lock: boolean): Promise<boolean> {
  try {
    if (isNativeApp) {
      const { ScreenOrientation } = await import("@capacitor/screen-orientation");
      if (lock) await ScreenOrientation.lock({ orientation: "landscape" });
      else await ScreenOrientation.unlock();
      return true;
    }
    const so = screen.orientation as LockableOrientation | undefined;
    if (!so?.lock) return false;
    if (!lock) {
      so.unlock();
      return true;
    }
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    await so.lock("landscape");
    return true;
  } catch {
    return false;
  }
}
