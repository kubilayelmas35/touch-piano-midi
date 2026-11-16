import { useEffect } from "react";
import { useT } from "../i18n";
import { MIDI_KEY_COUNTS, midiStartChoices, playedSpan, songPitchBounds, type MidiMap } from "../input/midiKeyboard";
import { startMidi } from "../input/midi";
import { isBlack, noteName } from "../lib/notes";
import { requirePro } from "../auth/account";
import { updateSettings } from "../state/actions";
import { useApp } from "../state/store";
import { Button, Slider, Switch, cx } from "../ui/primitives";

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));

function mapOf(s: { midiKeys: number; midiLow: number; midiOctave: number; midiTranspose: number; midiFit: boolean }): MidiMap {
  return { keys: s.midiKeys, low: s.midiLow, octave: s.midiOctave, transpose: s.midiTranspose, fit: s.midiFit };
}

/** Size, range, octave, transpose, velocity and channel for a hardware MIDI keyboard. */
export function MidiKeyboardSettings() {
  const t = useT();
  const s = useApp((st) => st.settings);
  const song = useApp((st) => st.song);
  const playTracks = useApp((st) => st.session.playTracks);
  const hand = useApp((st) => st.session.hand);
  const learn = useApp((st) => st.midiLearn);
  const heard = useApp((st) => st.midiHeard);
  const access = useApp((st) => st.midiAccess);

  useEffect(() => () => useApp.setState({ midiLearn: null }), []);

  const span = s.instrument === "piano" && s.midiKeys ? playedSpan(mapOf(s), songPitchBounds(song, playTracks, hand)) : null;
  const choices = midiStartChoices(s.midiKeys);
  const range = span ? `${noteName(span[0], s.noteNaming, true)}–${noteName(span[1], s.noteNaming, true)}` : "";

  const pickSize = (n: number) => {
    const low = n && s.midiLow && !midiStartChoices(n).includes(s.midiLow) ? 0 : s.midiLow;
    updateSettings({ midiKeys: n, midiLow: low });
  };

  return (
    <div className="space-y-1 border-t border-white/[0.06] pt-2">
      <div className="py-2">
        <div className="mb-1 text-sm font-medium">{t("midiKeys")}</div>
        <p className="mb-2 text-xs leading-relaxed text-mist-400">{t("midiKeysHint")}</p>
        <div className="grid grid-cols-4 gap-2">
          <SizeButton label={t("midiKeysAuto")} pressed={s.midiKeys === 0} onClick={() => pickSize(0)} />
          {MIDI_KEY_COUNTS.map((n) => (
            <SizeButton key={n} label={String(n)} pressed={s.midiKeys === n} onClick={() => pickSize(n)} />
          ))}
        </div>
      </div>

      {s.midiKeys > 0 && (
        <>
          <div className="py-2">
            <div className="mb-1 text-sm font-medium">{t("midiStart")}</div>
            <p className="mb-2 text-xs leading-relaxed text-mist-400">{t("midiStartHint")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={choices.includes(s.midiLow) ? s.midiLow : 0}
                onChange={(e) => updateSettings({ midiLow: Number(e.target.value) })}
                aria-label={t("midiStart")}
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 text-sm"
              >
                <option value={0}>{t("midiStartAuto")}</option>
                {choices.map((n) => (
                  <option key={n} value={n}>
                    {noteName(n, s.noteNaming, true)}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant={learn === "low" ? "primary" : "subtle"}
                onClick={() => {
                  if (learn === "low") {
                    useApp.setState({ midiLearn: null });
                    return;
                  }
                  if (!requirePro()) return;
                  if (access !== "ready") void startMidi();
                  useApp.setState({ midiLearn: "low" });
                }}
              >
                {learn === "low" ? t("midiLearning") : t("midiLearn")}
              </Button>
            </div>
          </div>
          {span && (
            <>
              <p className="text-xs font-semibold text-brand-300">{t("midiShown", { range })}</p>
              <KeyPreview lo={span[0]} hi={span[1]} heard={heard} />
            </>
          )}
          <Slider
            label={t("midiOctave")}
            hint={t("midiOctaveHint")}
            value={s.midiOctave}
            min={-3}
            max={3}
            step={1}
            onChange={(v) => updateSettings({ midiOctave: v })}
            format={signed}
          />
          <Slider
            label={t("midiTranspose")}
            hint={t("midiTransposeHint")}
            value={s.midiTranspose}
            min={-12}
            max={12}
            step={1}
            onChange={(v) => updateSettings({ midiTranspose: v })}
            format={signed}
          />
          <Switch label={t("midiFit")} hint={t("midiFitHint")} checked={s.midiFit} onChange={(v) => updateSettings({ midiFit: v })} />
          <Switch label={t("midiFold")} hint={t("midiFoldHint")} checked={s.midiFold} onChange={(v) => updateSettings({ midiFold: v })} />
          <Switch label={t("midiGuide")} hint={t("midiGuideHint")} checked={s.midiGuide} onChange={(v) => updateSettings({ midiGuide: v })} />
        </>
      )}

      <Slider
        label={t("midiVelocity")}
        hint={t("midiVelocityHint")}
        value={s.midiVelocity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => updateSettings({ midiVelocity: Math.round(v * 20) / 20 })}
        format={(v) => (v < 0.4 ? t("midiVelocitySoft") : v > 0.6 ? t("midiVelocityHard") : t("midiVelocityLinear"))}
      />
      <div className="py-2">
        <div className="mb-1 text-sm font-medium">{t("midiChannel")}</div>
        <p className="mb-2 text-xs leading-relaxed text-mist-400">{t("midiChannelHint")}</p>
        <select
          value={s.midiChannel}
          onChange={(e) => updateSettings({ midiChannel: Number(e.target.value) })}
          aria-label={t("midiChannel")}
          className="h-10 w-full rounded-xl border border-white/10 bg-ink-800 px-3 text-sm"
        >
          <option value={0}>{t("midiChannelAll")}</option>
          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <Switch label={t("midiPedal")} hint={t("midiPedalHint")} checked={s.midiPedal} onChange={(v) => updateSettings({ midiPedal: v })} />
      {heard != null && <p className="pb-2 text-xs text-mist-400">{t("midiLast", { note: noteName(heard, s.noteNaming, true) })}</p>}
    </div>
  );
}

function SizeButton({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "rounded-xl border px-3 py-2 text-xs font-semibold transition",
        pressed ? "border-brand-400/80 bg-brand-400/10 text-mist-100 ring-2 ring-brand-400/35" : "border-white/10 text-mist-400 hover:border-white/25"
      )}
    >
      {label}
    </button>
  );
}

function KeyPreview({ lo, hi, heard }: { lo: number; hi: number; heard: number | null }) {
  const whites: number[] = [];
  const blacks: number[] = [];
  for (let m = lo; m <= hi; m++) (isBlack(m) ? blacks : whites).push(m);
  const w = 16;
  return (
    <div className="overflow-x-auto rounded-xl bg-black/30 p-2" aria-hidden>
      <div className="relative h-14" style={{ width: whites.length * w }}>
        {whites.map((m, i) => (
          <div
            key={m}
            className={cx("absolute top-0 h-full rounded-sm border border-black/20", heard === m ? "bg-brand-300" : "bg-white")}
            style={{ left: i * w, width: w - 1 }}
          />
        ))}
        {blacks.map((m) => {
          const i = whites.filter((n) => n < m).length;
          return (
            <div
              key={m}
              className={cx("absolute top-0 z-10 h-8 rounded-sm", heard === m ? "bg-brand-500" : "bg-zinc-950")}
              style={{ left: i * w - 5, width: 10 }}
            />
          );
        })}
      </div>
    </div>
  );
}
