import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { GUITAR, VIOLIN } from "../engine/fretting";
import type { InstrumentKind } from "../engine/types";
import {
  FRET_KEY_COUNT,
  PIANO_PRESETS,
  defaultKeymaps,
  isReservedKey,
  keyLabel,
  type FretKeymap,
  type Keymaps,
  type PianoPreset,
} from "../input/keyboard";
import { keyboardBase } from "../input/keyboardBase";
import { isBlack, noteName } from "../lib/notes";
import { updateSettings } from "../state/actions";
import { toast, useApp } from "../state/store";
import { Button, Segmented, cx } from "../ui/primitives";

const PIANO_SLOTS = 32;
const CLASSIC_SLOTS = 18;

/** Slot ids: "p:<semitone>" piano note, "s:<string>" string key, "f:<fret>" fret key (from 1). */
type Slot = string;

function assign(keymaps: Keymaps, inst: InstrumentKind, slot: Slot, code: string): Keymaps {
  const [kind, raw] = slot.split(":");
  const idx = Number(raw);
  if (inst === "piano") {
    const piano: Record<string, number> = {};
    for (const [c, off] of Object.entries(keymaps.piano)) if (c !== code && off !== idx) piano[c] = off;
    if (code) piano[code] = idx;
    return { ...keymaps, piano };
  }
  const src = keymaps[inst];
  const strip = (arr: string[]) => arr.map((c) => (c === code ? "" : c));
  const next: FretKeymap = { strings: strip(src.strings), frets: strip(src.frets) };
  if (kind === "s") next.strings[idx] = code;
  else next.frets[idx - 1] = code;
  return { ...keymaps, [inst]: next };
}

function KeyChip({
  label,
  sub,
  value,
  active,
  dark,
  onClick,
  pressLabel,
}: {
  label: string;
  sub?: string;
  value: string;
  active: boolean;
  dark?: boolean;
  onClick: () => void;
  pressLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 transition-colors",
        active
          ? "border-brand-400 bg-brand-500/25 ring-2 ring-brand-400/40"
          : dark
            ? "border-white/[0.06] bg-black/35 hover:border-brand-400/50"
            : "border-white/[0.08] bg-white/[0.05] hover:border-brand-400/50"
      )}
    >
      <span className="text-[10px] font-semibold text-mist-400">
        {label}
        {sub && <span className="text-mist-500">{sub}</span>}
      </span>
      <span className={cx("min-h-5 text-sm font-extrabold", active ? "animate-pulse text-brand-200" : value ? "text-mist-100" : "text-mist-500")}>
        {active ? pressLabel : value || "—"}
      </span>
    </button>
  );
}

export function KeyBindings() {
  const t = useT();
  const s = useApp((st) => st.settings);
  const [inst, setInst] = useState<InstrumentKind>(s.instrument);
  const [capture, setCapture] = useState<Slot | null>(null);

  useEffect(() => {
    if (!capture) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === "Escape") return setCapture(null);
      const km = useApp.getState().settings.keymaps;
      if (e.code === "Backspace" || e.code === "Delete") {
        updateSettings({ keymaps: assign(km, inst, capture, "") });
        return setCapture(null);
      }
      if (isReservedKey(e.code)) {
        toast(t("keyReserved", { key: keyLabel(e.code) }), "error", 2200);
        return;
      }
      updateSettings({ keymaps: assign(km, inst, capture, e.code) });
      setCapture(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capture, inst, t]);

  const pianoKeyFor = (offset: number) => {
    const codes = Object.entries(s.keymaps.piano)
      .filter(([, o]) => o === offset)
      .map(([c]) => keyLabel(c));
    return codes.join(" ");
  };
  const presetOf = (): PianoPreset | null => {
    for (const [id, map] of Object.entries(PIANO_PRESETS) as [PianoPreset, Record<string, number>][]) {
      const a = Object.entries(map);
      if (a.length === Object.keys(s.keymaps.piano).length && a.every(([c, o]) => s.keymaps.piano[c] === o)) return id;
    }
    return null;
  };

  const base = keyboardBase(s);
  const slots = presetOf() === "classic" ? CLASSIC_SLOTS : PIANO_SLOTS;
  const spec = inst === "violin" ? VIOLIN : GUITAR;
  const fkm = inst === "piano" ? null : s.keymaps[inst];

  return (
    <div className="py-2">
      <Segmented
        label={t("keyBindings")}
        value={inst}
        onChange={(v) => {
          setCapture(null);
          setInst(v);
        }}
        className="mb-3 w-full"
        options={[
          { value: "piano", label: t("piano") },
          { value: "guitar", label: t("guitar") },
          { value: "violin", label: t("violin") },
        ]}
      />

      {inst === "piano" ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {(["twoRow", "classic"] as PianoPreset[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={presetOf() === p ? "primary" : "subtle"}
                onClick={() => updateSettings({ keymaps: { ...s.keymaps, piano: { ...PIANO_PRESETS[p] } } })}
              >
                {p === "classic" ? t("presetClassic") : t("presetTwoRow")}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {Array.from({ length: slots }, (_, off) => {
              const midi = base + off;
              return (
                <KeyChip
                  key={off}
                  label={noteName(midi, s.noteNaming)}
                  sub={String(Math.floor(midi / 12) - 1)}
                  value={pianoKeyFor(off)}
                  dark={isBlack(midi)}
                  active={capture === `p:${off}`}
                  onClick={() => setCapture(capture === `p:${off}` ? null : `p:${off}`)}
                  pressLabel={t("pressAKey")}
                />
              );
            })}
          </div>
        </>
      ) : (
        <>
          <Segmented
            label={t("fretKeyMode")}
            value={s.fretKeyMode}
            onChange={(v) => updateSettings({ fretKeyMode: v })}
            className="mb-2 w-full"
            options={[
              { value: "strings", label: t("fretKeyStrings") },
              { value: "chromatic", label: t("fretKeyChromatic") },
            ]}
          />
          <p className="mb-3 text-xs leading-relaxed text-mist-400">
            {s.fretKeyMode === "strings" ? t("fretKeyStringsHint") : t("fretKeyChromaticHint")}
          </p>
          {s.fretKeyMode === "strings" && fkm && (
            <>
              <h4 className="mb-1.5 text-xs font-bold text-mist-300">{t("strings")}</h4>
              <div className={cx("mb-3 grid gap-1.5", spec.tuning.length === 6 ? "grid-cols-6" : "grid-cols-4")}>
                {spec.labels.map((name, i) => (
                  <KeyChip
                    key={i}
                    label={s.noteNaming === "solfege" ? noteName(spec.tuning[i], "solfege") : name}
                    value={keyLabel(fkm.strings[i])}
                    active={capture === `s:${i}`}
                    onClick={() => setCapture(capture === `s:${i}` ? null : `s:${i}`)}
                    pressLabel={t("pressAKey")}
                  />
                ))}
              </div>
              <h4 className="mb-1.5 text-xs font-bold text-mist-300">{t("frets")}</h4>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: FRET_KEY_COUNT }, (_, i) => (
                  <KeyChip
                    key={i}
                    label={String(i + 1)}
                    value={keyLabel(fkm.frets[i])}
                    active={capture === `f:${i + 1}`}
                    onClick={() => setCapture(capture === `f:${i + 1}` ? null : `f:${i + 1}`)}
                    pressLabel={t("pressAKey")}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mist-400">{t("keyBindingsHint")}</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setCapture(null);
            const d = defaultKeymaps();
            updateSettings({ keymaps: inst === "piano" ? { ...s.keymaps, piano: d.piano } : { ...s.keymaps, [inst]: d[inst] } });
          }}
        >
          {t("resetKeys")}
        </Button>
      </div>
    </div>
  );
}
