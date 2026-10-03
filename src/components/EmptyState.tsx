import { useT } from "../i18n";
import { setPanel, useApp } from "../state/store";
import { IconLibrary } from "../ui/icons";
import { Button } from "../ui/primitives";

export function EmptyState() {
  const t = useT();
  const loading = useApp((s) => s.songLoading);
  if (loading) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm text-center animate-pop">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300">
          <IconLibrary size={28} />
        </div>
        <h2 className="text-xl font-bold">{t("noSong")}</h2>
        <p className="mt-1 text-sm text-mist-300">{t("noSongBody")}</p>
        <Button variant="primary" className="mt-5" onClick={() => setPanel("library")}>
          {t("openLibrary")}
        </Button>
      </div>
    </div>
  );
}
