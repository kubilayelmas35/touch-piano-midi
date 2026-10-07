import { useEffect, useRef, useState } from "react";
import { getBus, unlockAudio } from "../audio/context";
import type { InstrumentId } from "../audio/instruments";
import { loadInstrument, playNote } from "../audio/sampler";
import { cx } from "../ui/primitives";

type Kind = "piano" | "guitar" | "violin";

/** A short phrase per instrument: a broken chord, a strum, two bowed notes. */
const PREVIEW: Record<Kind, { notes: number[]; gap: number; dur: number }> = {
  piano: { notes: [60, 64, 67, 72], gap: 0.13, dur: 1.1 },
  guitar: { notes: [52, 59, 64, 68, 71, 76], gap: 0.035, dur: 1.4 },
  violin: { notes: [69, 76], gap: 0.6, dur: 0.55 },
};

let previewToken = 0;

async function preview(
  id: InstrumentId,
  kind: Kind,
  onReady: () => void,
): Promise<void> {
  const token = ++previewToken;
  await unlockAudio();
  const ok = await loadInstrument(id).then(
    () => true,
    () => false,
  );
  onReady();
  if (!ok || token !== previewToken) return;
  const p = PREVIEW[kind];
  const start = getBus().ctx.currentTime + 0.05;
  p.notes.forEach((m, i) =>
    playNote(id, m, 0.75, { when: start + i * p.gap, duration: p.dur }),
  );
}

/** Picks an instrument's sound; picking one also plays it. */
export function SoundPicker<T extends string>({
  label,
  kind,
  value,
  options,
  idFor,
  onChange,
}: {
  label: string;
  kind: Kind;
  value: T;
  options: { value: T; label: string }[];
  idFor: (v: T) => InstrumentId;
  onChange: (v: T) => void;
}) {
  const [busy, setBusy] = useState<T | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <div className="py-2">
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                onChange(o.value);
                setBusy(o.value);
                void preview(
                  idFor(o.value),
                  kind,
                  () =>
                    mounted.current &&
                    setBusy((b) => (b === o.value ? null : b)),
                );
              }}
              className={cx(
                "truncate rounded-xl border px-3 py-2 text-left text-xs font-semibold transition",
                active
                  ? "border-brand-400/80 bg-brand-400/10 text-mist-100 ring-2 ring-brand-400/35"
                  : "border-white/10 text-mist-300 hover:border-white/25",
                busy === o.value && "animate-pulse",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
