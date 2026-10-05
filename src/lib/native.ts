import { engine } from "../engine/engine";
import { isNativeApp, platform } from "./platform";

/** Android back button: close the top dialog or menu, then pause, then leave the app. */
async function onBack(): Promise<void> {
  const dialogs = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")];
  const top = dialogs[dialogs.length - 1];
  if (top) {
    top.dispatchEvent(new Event("cancel", { cancelable: true }));
    return;
  }
  if (document.querySelector("[data-popover-open]")) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return;
  }
  if (engine.status === "playing") {
    engine.pause();
    return;
  }
  const { App } = await import("@capacitor/app");
  await App.minimizeApp();
}

/** Hooks for the Android/iOS app; does nothing on the website. */
export async function initNative(): Promise<void> {
  if (!isNativeApp) return;
  document.documentElement.classList.add("native-app");
  if (platform === "ios") {
    // The iOS home indicator fades while playing; Capacitor owns prefersHomeIndicatorAutoHidden.
    const { SystemBars, SystemBarType } = await import("@capacitor/core");
    void SystemBars.hide({ bar: SystemBarType.NavigationBar }).catch(() => {});
  }
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", () => void onBack());
  await App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) {
      engine.releaseAll();
      if (engine.status === "playing") engine.pause();
    }
  });
}
