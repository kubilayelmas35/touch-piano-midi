import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { reportError } from "../lib/errors";
import { isNativeApp, SITE_URL } from "../lib/platform";
import { useApp, type VideoKind } from "../state/store";
import type { Language } from "../state/settings";
import { videoLang } from "../i18n/langs";
import { Button, Dialog } from "../ui/primitives";
import { followGoal } from "../coach/coach";

/**
 * Native WebViews (especially iOS Capacitor) fail on large local mp4 over capacitor://
 * (MEDIA_ERR_SRC_NOT_SUPPORTED / network 3 — no Range). Stream from the site instead;
 * the system browser is the last resort when the in-app player still can't play it.
 */
export function videoUrl(kind: VideoKind, lang: Language, ext: "mp4" | "jpg" = "mp4"): string {
  const file = `videos/${kind}-${videoLang(lang)}.${ext}`;
  return isNativeApp ? SITE_URL + file : file;
}

function describeVideo(el: HTMLVideoElement): string {
  const e = el.error;
  const mp4 = el.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"') || "no";
  return `code ${e?.code ?? "-"} ${e?.message ?? ""}; network ${el.networkState}, ready ${el.readyState}; mp4 ${mp4}; ${el.currentSrc || el.src}`;
}

/** Absolute https URL for the system player (Safari / Chrome Custom Tab). */
function externalUrl(kind: VideoKind, lang: Language): string {
  return SITE_URL + `videos/${kind}-${videoLang(lang)}.mp4`;
}

async function openExternally(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

export function VideoDialog() {
  const t = useT();
  const video = useApp((s) => s.video);
  const lang = useApp((s) => s.settings.language);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const close = () => {
    const first = useApp.getState().video?.first;
    useApp.setState({ video: null });
    setFailed(false);
    if (first) followGoal();
  };
  const src = video ? videoUrl(video.kind, lang) : "";
  const openUrl = video ? externalUrl(video.kind, lang) : "";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (!src || failed) return;
    const timer = setTimeout(() => {
      const el = ref.current;
      if (el && el.readyState < 2 && !el.error) reportError("error", `Video stalled: ${describeVideo(el)}`);
    }, 12000);
    return () => clearTimeout(timer);
  }, [src, failed]);

  const onError = () => {
    const el = ref.current;
    if (el) reportError("error", `Video failed: ${describeVideo(el)}`);
    setFailed(true);
  };

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
          {failed && isNativeApp ? (
            <div className="flex justify-center rounded-2xl bg-white/[0.05] px-4 py-8">
              <Button
                variant="primary"
                onClick={() => void openExternally(openUrl).catch((err) => reportError("error", err))}
              >
                {t("videoOpenExternal")}
              </Button>
            </div>
          ) : failed ? (
            <p className="rounded-2xl bg-white/[0.05] px-4 py-8 text-center text-sm text-mist-300">{t("videoOffline")}</p>
          ) : (
            <video
              ref={ref}
              key={src}
              src={src}
              poster={videoUrl(video.kind, lang, "jpg")}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="aspect-video w-full rounded-2xl bg-black"
              onError={onError}
              onEnded={() => video.first && close()}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
