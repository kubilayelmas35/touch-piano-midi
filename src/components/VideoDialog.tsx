import { useState } from "react";
import { useT } from "../i18n";
import { platform, SITE_URL } from "../lib/platform";
import { useApp, type VideoKind } from "../state/store";
import type { Language } from "../state/settings";
import { Button, Dialog } from "../ui/primitives";
import { followGoal } from "../coach/coach";

/** The Android app streams the videos from the website; the iOS app ships the tutorial and plays it offline. */
export function videoUrl(kind: VideoKind, lang: Language, ext: "mp4" | "jpg" = "mp4"): string {
  const file = `videos/${kind}-${lang}.${ext}`;
  return platform === "android" ? SITE_URL + file : file;
}

export function VideoDialog() {
  const t = useT();
  const video = useApp((s) => s.video);
  const lang = useApp((s) => s.settings.language);
  const [failed, setFailed] = useState<string | null>(null);
  const close = () => {
    const first = useApp.getState().video?.first;
    useApp.setState({ video: null });
    if (first) followGoal();
  };
  const src = video ? videoUrl(video.kind, lang) : "";

  return (
    <Dialog
      open={!!video}
      onClose={close}
      title={video?.kind === "promo" ? "Sonatrio" : t("tutorialTitle")}
      width="max-w-4xl"
      closeLabel={t("close")}
      footer={
        <Button variant={video?.first ? "primary" : "subtle"} onClick={close}>
          {video?.first ? t("tutorialSkip") : t("close")}
        </Button>
      }
    >
      {video && (
        <>
          {video.first && <p className="mb-3 text-sm text-mist-300">{t("tutorialFirstHint")}</p>}
          {failed === src ? (
            <p className="rounded-2xl bg-white/[0.05] px-4 py-8 text-center text-sm text-mist-300">{t("videoOffline")}</p>
          ) : (
            <video
              key={src}
              src={src}
              poster={videoUrl(video.kind, lang, "jpg")}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="aspect-video w-full rounded-2xl bg-black"
              onError={() => setFailed(src)}
              onEnded={() => video.first && close()}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
