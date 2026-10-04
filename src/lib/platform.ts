/** Where the app runs: the website, the Android/iOS app (Capacitor) or the desktop app (Electron, Steam). */
export type Platform = "web" | "android" | "ios" | "desktop";

/** Bridge exposed by the desktop app's preload script. */
export interface DesktopBridge {
  platform: string;
  version: string;
  steam: boolean;
  toggleFullscreen(): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  unlockAchievement(id: string): Promise<boolean>;
  quit(): void;
}

declare global {
  interface Window {
    sonatrioDesktop?: DesktopBridge;
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

function detect(): Platform {
  if (typeof window === "undefined") return "web";
  if (window.sonatrioDesktop) return "desktop";
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) return cap.getPlatform?.() === "ios" ? "ios" : "android";
  return "web";
}

export const platform: Platform = detect();
export const isNativeApp = platform === "android" || platform === "ios";
export const isDesktopApp = platform === "desktop";
/** Any packaged app (not the website). */
export const isApp = isNativeApp || isDesktopApp;
export const desktop: DesktopBridge | null = typeof window !== "undefined" ? (window.sonatrioDesktop ?? null) : null;

/** Public site; e-mail links from inside the apps land here because the apps have no web address of their own. */
export const SITE_URL = "https://sonatrio.com/";
