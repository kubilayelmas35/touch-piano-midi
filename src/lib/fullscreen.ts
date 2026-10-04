import { useEffect, useState } from "react";
import { desktop, isDesktopApp, isNativeApp } from "./platform";

/** Window fullscreen for the desktop app and browsers; the phone apps are always immersive. */
export function useFullscreen() {
  const [full, setFull] = useState(false);
  const supported = isDesktopApp || (!isNativeApp && typeof document !== "undefined" && !!document.documentElement.requestFullscreen);
  useEffect(() => {
    if (!supported) return;
    const sync = () => {
      if (desktop) void desktop.isFullscreen().then(setFull);
      else setFull(!!document.fullscreenElement);
    };
    sync();
    window.addEventListener("resize", sync);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, [supported]);
  const toggle = () => {
    if (desktop) void desktop.toggleFullscreen().then(setFull);
    else if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  return { supported, full, toggle };
}
