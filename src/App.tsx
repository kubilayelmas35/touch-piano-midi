import { useEffect } from "react";
import { initAuth } from "./auth/account";
import { AccountDialog, ProDialog } from "./components/AccountDialog";
import { GameView } from "./components/GameView";
import { LibraryPanel } from "./components/LibraryPanel";
import { ResultsDialog } from "./components/ResultsDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { SongSetupDialog } from "./components/SongSetupDialog";
import { Toasts } from "./components/Toasts";
import { TopBar } from "./components/TopBar";
import { WelcomeDialog } from "./components/WelcomeDialog";
import { useGlobalInput } from "./hooks/useGlobalInput";
import { useT } from "./i18n";
import { detectKeyLabels } from "./input/keyboard";
import { startMidi } from "./input/midi";
import { initApp } from "./state/actions";
import { useApp } from "./state/store";
import { IconUpload } from "./ui/icons";

async function startMidiIfGranted(): Promise<void> {
  try {
    const status = await navigator.permissions?.query({ name: "midi" as PermissionName });
    if (status?.state === "granted") await startMidi();
  } catch {
    /* permission API unsupported for midi */
  }
}

function DropOverlay() {
  const t = useT();
  const dragOver = useApp((s) => s.dragOver);
  if (!dragOver) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/70 backdrop-blur-sm animate-fade">
      <div className="rounded-3xl border-2 border-dashed border-brand-400/70 px-10 py-8 text-center">
        <IconUpload size={40} className="mx-auto text-brand-300" />
        <p className="mt-3 text-lg font-bold">{t("dropHere")}</p>
      </div>
    </div>
  );
}

export function App() {
  const language = useApp((s) => s.settings.language);
  useGlobalInput();

  useEffect(() => {
    void initApp();
    void initAuth();
    void detectKeyLabels();
    void startMidiIfGranted();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col">
        <GameView />
      </main>
      <LibraryPanel />
      <SongSetupDialog />
      <SettingsDialog />
      <ResultsDialog />
      <WelcomeDialog />
      <AccountDialog />
      <ProDialog />
      <Toasts />
      <DropOverlay />
    </div>
  );
}
