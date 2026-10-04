import { engine } from "../engine/engine";
import { NoteState } from "../engine/types";
import { tNow, type DictKey } from "../i18n";
import { streak } from "../progress/progress";
import { drawShareCard, type ShareCardData } from "../render/shareCard";
import { toast, useApp } from "../state/store";
import { shareFile } from "../studio/share";

export const SHARE_URL = "https://sonatrio.com";

/** Builds the picture of the run on the results screen. */
export async function resultCard(): Promise<HTMLCanvasElement | null> {
  const { results, song, settings, progress, session } = useApp.getState();
  if (!results || !song) return null;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const data: ShareCardData = {
    title: song.title,
    subtitle: [tNow(settings.instrument as DictKey), `${tNow("speed")} ${pct(session.speed)}`, session.waitMode ? tNow("waitMode") : ""]
      .filter(Boolean)
      .join(" · "),
    stars: results.stars,
    score: results.stats.score,
    accuracy: results.accuracy,
    maxCombo: results.stats.maxCombo,
    streak: streak(progress),
    date: new Date().toLocaleDateString(settings.language === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "long", year: "numeric" }),
    badges: [results.newBest ? tNow("newBest") : "", results.daily ? tNow("dailyDoneNow") : ""].filter(Boolean),
    notes: engine.notes.map((n) => ({
      time: n.time,
      duration: n.duration,
      midi: n.midi,
      judgement: n.state === NoteState.Hit ? n.judgement : n.state === NoteState.Missed ? "miss" : null,
    })),
    labels: {
      score: tNow("score"),
      accuracy: tNow("accuracy"),
      combo: tNow("maxCombo"),
      streak: tNow("shareStreak"),
      cta: tNow("shareCta"),
    },
  };
  return drawShareCard(data);
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "run"
  );
}

/** Shares the results picture with a line of text (or downloads it on a computer). */
export async function shareResult(): Promise<void> {
  const { results, song } = useApp.getState();
  if (!results || !song) return;
  try {
    const canvas = await resultCard();
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("no image");
    const text = tNow("shareText", { song: song.title, stars: results.stars, acc: Math.round(results.accuracy * 100), url: SHARE_URL });
    const r = await shareFile(await blob.arrayBuffer(), `sonatrio-${slug(song.title)}.png`, "image/png", tNow("shareTitle"), text);
    if (r === "saved") toast(tNow("shareSaved"), "success");
  } catch (err) {
    console.warn("[share] failed", err);
    toast(tNow("shareFailed"), "error");
  }
}
