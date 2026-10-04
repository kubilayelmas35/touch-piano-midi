import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { openSong, setHand, updateSession, updateSettings } from "../state/actions";
import { setPanel, toast, useApp } from "../state/store";
import type { Duel } from "./social";

/** Opens a friend's challenge with their instrument, hand and speed; the next full run answers it. */
export async function playDuel(d: Duel): Promise<void> {
  setPanel(null);
  engine.stop();
  if (useApp.getState().settings.instrument !== d.instrument) updateSettings({ instrument: d.instrument });
  if (!(await openSong(d.song_id))) return;
  updateSession({ speed: d.speed, waitMode: false, autoPlay: false });
  if (d.instrument === "piano") setHand(d.hand);
  useApp.setState({ activeDuel: d });
  toast(tNow("duelStarted", { name: d.friend ?? "?", score: d.from_score.toLocaleString() }), "info", 6000);
}
