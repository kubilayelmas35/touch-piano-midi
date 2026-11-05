import { useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { useT } from "../i18n";
import { reportError } from "../lib/errors";
import { isNativeApp, SITE_URL } from "../lib/platform";
import { useApp, type VideoKind } from "../state/store";
import type { Language } from "../state/settings";
import { videoLang } from "../i18n/langs";
import { Button, Dialog } from "../ui/primitives";
import { followGoal } from "../coach/coach";

const NATIVE_PLAYER_ID = "sonatrio-video";

/**
 * Web keeps relative paths. Native never uses WKWebView `<video>` — Capacitor
 * WebViews hit MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) on remote/local mp4; we play
 * through the Capgo native AVPlayer / ExoPlayer instead.
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

/** Absolute https URL for native / system playback. */
function externalUrl(kind: VideoKind, lang: Language): string {
  return SITE_URL + `videos/${kind}-${videoLang(lang)}.mp4`;
}

async function openExternally(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

type NativeListener = {
  addListener: (event: string, cb: (data: { dismiss?: boolean }) => void) => Promise<PluginListenerHandle>;
};

async function playNativeFullscreen(url: string, title: string, poster: string): Promise<boolean> {
  const { VideoPlayer } = await import("@capgo/capacitor-video-player");
  try {
    await VideoPlayer.stopAllPlayers().catch(() => undefined);
  } catch {
    /* no active player */
  }
  const result = await VideoPlayer.initPlayer({
    mode: "fullscreen",
    url,
    playerId: NATIVE_PLAYER_ID,
    title,
    artwork: poster,
    exitOnEnd: true,
    loopOnEnd: false,
    showControls: true,
    pipEnabled: false,
    bkmodeEnabled: false,
    chromecast: false,
    audioCategory: "moviePlayback",
  });
  return result.result !== false;
}

export function VideoDialog() {
  const t = useT();
  const video = useApp((s) => s.video);
  const lang = useApp((s) => s.settings.language);
  const [failed, setFailed] = useState(false);
  const [nativeBusy, setNativeBusy] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const close = () => {
    const first = useApp.getState().video?.first;
    useApp.setState({ video: null });
    setFailed(false);
    setNativeBusy(false);
    if (isNativeApp) {
      void import("@capgo/capacitor-video-player")
        .then(({ VideoPlayer }) => VideoPlayer.exitPlayer().catch(() => undefined))
        .catch(() => undefined);
    }
    if (first) followGoal();
  };
  const src = video ? videoUrl(video.kind, lang) : "";
  const openUrl = video ? externalUrl(video.kind, lang) : "";
  const poster = video ? videoUrl(video.kind, lang, "jpg") : "";
  const title = video?.kind === "promo" ? "Sonatrio" : t("tutorialTitle");

  useEffect(() => {
    setFailed(false);
    setNativeBusy(false);
  }, [src]);

  // Native: AVPlayer / ExoPlayer — never HTML5 <video> in the WebView.
  useEffect(() => {
    if (!video || !isNativeApp || !openUrl) return;
    let cancelled = false;
    const handles: PluginListenerHandle[] = [];
    const kind = video.kind;
    const first = !!video.first;

    const finishFirst = () => {
      if (!first || useApp.getState().video?.kind !== kind) return;
      useApp.setState({ video: null });
      setFailed(false);
      setNativeBusy(false);
      followGoal();
    };

    const run = async () => {
      setNativeBusy(true);
      setFailed(false);
      try {
        const { VideoPlayer } = await import("@capgo/capacitor-video-player");
        const withListeners = VideoPlayer as typeof VideoPlayer & NativeListener;
        handles.push(
          await withListeners.addListener("jeepCapVideoPlayerExit", () => {
            if (cancelled) return;
            setNativeBusy(false);
            finishFirst();
          }),
        );
        handles.push(
          await withListeners.addListener("jeepCapVideoPlayerEnded", () => {
            if (cancelled) return;
            finishFirst();
          }),
        );
        const ok = await playNativeFullscreen(openUrl, title, poster);
        if (cancelled) {
          await VideoPlayer.exitPlayer().catch(() => undefined);
          return;
        }
        if (!ok) throw new Error("initPlayer returned false");
        setNativeBusy(false);
      } catch (err) {
        if (cancelled) return;
        reportError("error", err instanceof Error ? err.message : String(err));
        setNativeBusy(false);
        setFailed(true);
        try {
          await openExternally(openUrl);
        } catch (browserErr) {
          reportError("error", browserErr);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      for (const h of handles) void h.remove();
    };
  }, [video?.kind, video?.first, openUrl, title, poster]);

  // Web-only stall watchdog for the HTML5 player.
  useEffect(() => {
    if (!src || failed || isNativeApp) return;
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

  const replayNative = () => {
    if (!openUrl) return;
    setFailed(false);
    setNativeBusy(true);
    void playNativeFullscreen(openUrl, title, poster)
      .then((ok) => {
        setNativeBusy(false);
        if (!ok) {
          setFailed(true);
          return openExternally(openUrl);
        }
      })
      .catch((err) => {
        reportError("error", err);
        setNativeBusy(false);
        setFailed(true);
        return openExternally(openUrl).catch((e) => reportError("error", e));
      });
  };

  return (
    <Dialog
      open={!!video}
      onClose={close}
      title={title}
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
          {isNativeApp ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-black/40 px-4 py-8">
              {poster ? (
                <img
                  src={poster}
                  alt=""
                  className="aspect-video w-full max-w-lg rounded-xl object-cover opacity-80"
                />
              ) : null}
              {failed ? <p className="text-center text-sm text-mist-300">{t("videoOffline")}</p> : null}
              <Button
                variant="primary"
                disabled={nativeBusy}
                onClick={() => {
                  if (failed) {
                    void openExternally(openUrl).catch((err) => reportError("error", err));
                  } else {
                    replayNative();
                  }
                }}
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
              poster={poster}
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
