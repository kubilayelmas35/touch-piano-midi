import { useState } from "react";
import type { InstrumentKind } from "../engine/types";
import { useT } from "../i18n";
import { updateSettings } from "../state/actions";
import { useApp } from "../state/store";
import { unlockAudio } from "../audio/context";
import { IconGuitar, IconPiano, IconViolin } from "../ui/icons";
import { Button, Dialog, Segmented, cx } from "../ui/primitives";

export function WelcomeDialog() {
  const t = useT();
  const open = useApp((s) => s.welcomeOpen);
  const settings = useApp((s) => s.settings);
  const [pick, setPick] = useState<InstrumentKind>(settings.instrument);

  const finish = () => {
    void unlockAudio();
    updateSettings({ instrument: pick, onboarded: true });
    useApp.setState({ welcomeOpen: false });
  };

  const cards: { id: InstrumentKind; icon: typeof IconPiano; desc: string; tint: string }[] = [
    { id: "piano", icon: IconPiano, desc: t("pianoDesc"), tint: "from-sky-400/25 to-brand-500/10" },
    { id: "guitar", icon: IconGuitar, desc: t("guitarDesc"), tint: "from-orange-400/25 to-rose-500/10" },
    { id: "violin", icon: IconViolin, desc: t("violinDesc"), tint: "from-emerald-400/25 to-teal-500/10" },
  ];

  return (
    <Dialog open={open} onClose={finish} width="max-w-xl" closeLabel={t("close")}>
      <div className="pt-6 text-center">
        <div className="mx-auto mb-3 flex justify-end">
          <Segmented
            size="sm"
            label={t("language")}
            value={settings.language}
            onChange={(v) => updateSettings({ language: v })}
            options={[
              { value: "tr", label: "TR" },
              { value: "en", label: "EN" },
            ]}
          />
        </div>
        <h1 className="bg-gradient-to-r from-sky-glow via-brand-300 to-brand-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
          {t("welcomeTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-mist-300">{t("welcomeBody")}</p>
        <h2 className="mt-6 mb-3 text-sm font-bold tracking-[0.12em] text-mist-400 uppercase">{t("chooseInstrument")}</h2>
        <div role="radiogroup" aria-label={t("chooseInstrument")} className="grid gap-2 sm:grid-cols-3">
          {cards.map(({ id, icon: Icon, desc, tint }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={pick === id}
              onClick={() => setPick(id)}
              className={cx(
                "flex items-center gap-3 rounded-2xl border bg-gradient-to-br p-4 text-left transition-all sm:flex-col sm:text-center",
                tint,
                pick === id ? "border-brand-400/70 ring-2 ring-brand-400/40" : "border-white/[0.07] opacity-75 hover:opacity-100"
              )}
            >
              <Icon size={34} className="shrink-0" />
              <span>
                <span className="block font-bold">{t(id)}</span>
                <span className="mt-0.5 block text-xs text-mist-300">{desc}</span>
              </span>
            </button>
          ))}
        </div>
        <Button variant="primary" size="lg" className="mt-6 w-full sm:w-auto" onClick={finish}>
          {t("start")}
        </Button>
        <p className="mt-3 text-xs text-mist-400 [@media(pointer:coarse)]:hidden">{t("tipKeyboard")}</p>
      </div>
    </Dialog>
  );
}
