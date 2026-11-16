import { useEffect, useState } from "react";
import { engine } from "../engine/engine";
import { useT } from "../i18n";
import { keyPlace, nextPendingChord } from "../input/midiKeyboard";
import { isBlack, noteName } from "../lib/notes";
import { useApp } from "../state/store";
import { cx } from "../ui/primitives";

export const KEY_GUIDE_H = 72;

/** Picture of the hardware keyboard with the notes to play filled in. */
function MiniKeyboard({ low, high, on }: { low: number; high: number; on: ReadonlySet<number> }) {
  const whites: number[] = [];
  const blacks: { midi: number; before: number }[] = [];
  let before = 0;
  for (let m = low; m <= high; m++) {
    if (isBlack(m)) blacks.push({ midi: m, before });
    else {
      whites.push(m);
      before++;
    }
  }
  const n = Math.max(1, whites.length);
  return (
    <div className="relative h-7 w-full overflow-hidden" aria-hidden="true">
      <div className="flex h-full">
        {whites.map((m) => (
          <div key={m} className={cx("h-full min-w-0 flex-1", on.has(m) ? "bg-amber-300" : "bg-white/85")} />
        ))}
      </div>
      {blacks.map(({ midi, before: b }) => {
        const nudge = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 }[midi % 12] ?? 0;
        const width = 62 / n;
        const left = ((b + nudge) / n) * 100 - width / 2;
        return (
          <div
            key={midi}
            className={cx("absolute top-0 h-[62%]", on.has(midi) ? "bg-amber-400" : "bg-[#161722]")}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      })}
    </div>
  );
}

/**
 * For a MIDI keyboard with no lights: the next note's name, which white key it is
 * counting from the left, and that key lit on a picture of this keyboard.
 */
export function KeyGuide({ low, high }: { low: number; high: number }) {
  const t = useT();
  const naming = useApp((s) => s.settings.noteNaming);
  const [tick, setTick] = useState(0);
  useEffect(() => engine.subscribe(() => setTick((n) => n + 1)), []);
  const chord = nextPendingChord(tick >= 0 ? engine.notes : [])
    .slice()
    .sort((a, b) => a.midi - b.midi);
  const on = new Set(chord.map((n) => n.midi));

  return (
    <div className="flex h-full flex-col justify-end border-t border-amber-200/15 bg-[#101221]">
      <div className="flex items-baseline gap-x-3 overflow-hidden px-3 pb-1 whitespace-nowrap" role="status" aria-live="polite">
        {chord.length === 0 ? (
          <span className="text-xs font-semibold text-white/50">
            {noteName(low, naming, true)}–{noteName(high, naming, true)}
          </span>
        ) : (
          chord.map((n) => {
            const place = keyPlace(n.midi, low, high);
            const where = !place ? "" : place.black ? t("midiGuideBlack", { n: place.white }) : t("midiGuideWhite", { n: place.white });
            return (
              <span key={n.id} className="inline-flex items-baseline gap-1.5">
                <span className="text-base font-extrabold text-amber-200">{noteName(n.midi, naming, true)}</span>
                {where && <span className="text-[11px] font-semibold text-white/70">{where}</span>}
              </span>
            );
          })
        )}
      </div>
      <MiniKeyboard low={low} high={high} on={on} />
    </div>
  );
}
