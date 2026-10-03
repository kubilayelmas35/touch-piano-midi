import { useT } from "../i18n";
import { noteName } from "../lib/notes";
import type { Song } from "../midi/song";
import { updateSession } from "../state/actions";
import { setPanel, useApp } from "../state/store";
import { Button, Dialog, Segmented } from "../ui/primitives";

type Role = "play" | "accomp" | "mute";

function handTracks(song: Song): { right: number; left: number } | null {
  const right = song.tracks.find((t) => /right|\brh\b|sağ/i.test(t.name));
  const left = song.tracks.find((t) => /left|\blh\b|sol el/i.test(t.name));
  return right && left ? { right: right.index, left: left.index } : null;
}

export function SongSetupDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "setup");
  const song = useApp((s) => s.song);
  const session = useApp((s) => s.session);
  const naming = useApp((s) => s.settings.noteNaming);
  const instrument = useApp((s) => s.settings.instrument);
  const close = () => setPanel(null);
  if (!song) return null;

  const trackName = (name: string) =>
    name === "Right hand" ? t("trackRightHand") : name === "Left hand" ? t("trackLeftHand") : name;

  const roleOf = (i: number): Role =>
    session.playTracks.includes(i) ? "play" : session.mutedTracks.includes(i) ? "mute" : "accomp";

  const setRole = (i: number, role: Role) => {
    const play = session.playTracks.filter((x) => x !== i);
    const mute = session.mutedTracks.filter((x) => x !== i);
    if (role === "play") play.push(i);
    if (role === "mute") mute.push(i);
    updateSession({ playTracks: play.sort((a, b) => a - b), mutedTracks: mute });
  };

  const ht = handTracks(song);
  let handValue: "both" | "right" | "left" = session.hand;
  if (ht) {
    const r = session.playTracks.includes(ht.right);
    const l = session.playTracks.includes(ht.left);
    handValue = r && !l ? "right" : l && !r ? "left" : "both";
  }
  const setHand = (h: "both" | "right" | "left") => {
    if (ht) {
      const others = session.playTracks.filter((x) => x !== ht.right && x !== ht.left);
      const next = h === "right" ? [ht.right] : h === "left" ? [ht.left] : [ht.right, ht.left];
      updateSession({
        hand: "both",
        playTracks: [...others, ...next].sort((a, b) => a - b),
        mutedTracks: session.mutedTracks.filter((x) => !next.includes(x)),
      });
    } else {
      updateSession({ hand: h });
    }
  };

  const pitched = song.tracks.filter((tr) => !tr.isDrum);

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("songSetup")}
      closeLabel={t("close")}
      footer={
        <Button variant="primary" onClick={close}>
          {t("done")}
        </Button>
      }
    >
      <p className="-mt-1 mb-4 truncate text-sm text-mist-300">{song.title}</p>

      <div className="mb-5">
        <div className="mb-2 text-sm font-semibold">{t("hands")}</div>
        <Segmented
          label={t("hands")}
          value={handValue}
          onChange={setHand}
          className="w-full"
          options={[
            { value: "both", label: t("handBoth") },
            { value: "right", label: t("handRight") },
            { value: "left", label: t("handLeft") },
          ]}
        />
        {!ht && <p className="mt-1.5 text-xs text-mist-400">{t("handsHint")}</p>}
      </div>

      <div className="mb-2 text-sm font-semibold">{t("tracks")}</div>
      <ul className="space-y-2">
        {song.tracks.map((tr) => (
          <li
            key={tr.index}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{trackName(tr.name)}</div>
              <div className="text-xs text-mist-400">
                {tr.isDrum
                  ? t("drums")
                  : `${t("notesCount", { n: tr.noteCount })} · ${noteName(tr.low, naming, true)}–${noteName(tr.high, naming, true)}`}
              </div>
            </div>
            {!tr.isDrum && (
              <Segmented
                size="sm"
                label={trackName(tr.name)}
                value={roleOf(tr.index)}
                onChange={(r) => setRole(tr.index, r)}
                options={[
                  { value: "play", label: t("trackPlay") },
                  { value: "accomp", label: t("trackAccomp") },
                  { value: "mute", label: t("trackMute") },
                ]}
              />
            )}
          </li>
        ))}
      </ul>
      {session.playTracks.length === 0 && pitched.length > 0 && (
        <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{t("noPlayTracks")}</p>
      )}
      {instrument !== "piano" && <p className="mt-3 text-xs text-mist-400">{t("foldedHint")}</p>}
    </Dialog>
  );
}
