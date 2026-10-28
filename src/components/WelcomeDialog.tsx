import { useEffect, useState, type ReactNode } from "react";
import type { InstrumentKind } from "../engine/types";
import type { Goal, Skill } from "../coach/path";
import { useT } from "../i18n";
import { updateSettings } from "../state/actions";
import { openVideo, setPanel, useApp } from "../state/store";
import { unlockAudio } from "../audio/context";
import { IconGuitar, IconKeyboard, IconLibrary, IconPiano, IconRoute, IconSparkles, IconStar, IconTrophy, IconViolin } from "../ui/icons";
import { Button, Dialog, cx } from "../ui/primitives";
import { LanguageSelect } from "./LanguageSelect";

function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; icon: ReactNode; title: string; desc: string; tint: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("grid gap-2", options.length === 3 && "sm:grid-cols-3")}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "flex items-center gap-3 rounded-2xl border bg-gradient-to-br p-4 text-left transition-all sm:flex-col sm:text-center",
            o.tint,
            value === o.id ? "border-brand-400/70 ring-2 ring-brand-400/40" : "border-white/[0.07] opacity-75 hover:opacity-100"
          )}
        >
          <span className="shrink-0">{o.icon}</span>
          <span>
            <span className="block font-bold">{o.title}</span>
            <span className="mt-0.5 block text-xs text-mist-300">{o.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

const TINTS = ["from-sky-400/25 to-brand-500/10", "from-orange-400/25 to-rose-500/10", "from-emerald-400/25 to-teal-500/10"];

/** First run: instrument, experience and goal, which set up the learning path. */
export function WelcomeDialog() {
  const t = useT();
  const open = useApp((s) => s.welcomeOpen);
  const settings = useApp((s) => s.settings);
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState<InstrumentKind>(settings.instrument);
  const [skill, setSkill] = useState<Skill>(settings.onboarded ? settings.skill : "new");
  const [goal, setGoal] = useState<Goal>(settings.onboarded ? settings.goal : "learn");

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const finish = () => {
    void unlockAudio();
    const first = !settings.onboarded;
    updateSettings({ instrument: pick, skill, goal, onboarded: true, ...(first ? { compactKeys: true, fingerNumbers: skill === "new" } : {}) });
    useApp.setState({ welcomeOpen: false });
    if (first) openVideo("tutorial", true);
    else setPanel("path");
  };

  const steps: { title: string; body: ReactNode }[] = [
    {
      title: t("chooseInstrument"),
      body: (
        <Choice
          label={t("chooseInstrument")}
          value={pick}
          onChange={setPick}
          options={[
            { id: "piano", icon: <IconPiano size={34} />, title: t("piano"), desc: t("pianoDesc"), tint: TINTS[0] },
            { id: "guitar", icon: <IconGuitar size={34} />, title: t("guitar"), desc: t("guitarDesc"), tint: TINTS[1] },
            { id: "violin", icon: <IconViolin size={34} />, title: t("violin"), desc: t("violinDesc"), tint: TINTS[2] },
          ]}
        />
      ),
    },
    {
      title: t("askSkill"),
      body: (
        <Choice
          label={t("askSkill")}
          value={skill}
          onChange={setSkill}
          options={[
            { id: "new", icon: <IconSparkles size={30} />, title: t("skillNew"), desc: t("skillNewDesc"), tint: TINTS[0] },
            { id: "some", icon: <IconStar size={30} />, title: t("skillSome"), desc: t("skillSomeDesc"), tint: TINTS[1] },
            { id: "good", icon: <IconTrophy size={30} />, title: t("skillGood"), desc: t("skillGoodDesc"), tint: TINTS[2] },
          ]}
        />
      ),
    },
    {
      title: t("askGoal"),
      body: (
        <Choice
          label={t("askGoal")}
          value={goal}
          onChange={setGoal}
          options={[
            { id: "learn", icon: <IconRoute size={30} />, title: t("goalLearn"), desc: t("goalLearnDesc"), tint: TINTS[0] },
            { id: "songs", icon: <IconLibrary size={30} />, title: t("goalSongs"), desc: t("goalSongsDesc"), tint: TINTS[1] },
            { id: "free", icon: <IconKeyboard size={30} />, title: t("goalFree"), desc: t("goalFreeDesc"), tint: TINTS[2] },
          ]}
        />
      ),
    },
  ];
  const last = step === steps.length - 1;

  return (
    <Dialog open={open} onClose={finish} width="max-w-xl" closeLabel={t("close")}>
      <div className="relative overflow-hidden pt-2 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.35),transparent)]"
        />
        <div className="relative mb-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-label={t("stepOf", { n: step + 1, total: steps.length })}>
            {steps.map((_, i) => (
              <span
                key={i}
                className={cx(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-brand-400" : i < step ? "w-3 bg-brand-400/50" : "w-3 bg-white/15"
                )}
              />
            ))}
          </div>
          <LanguageSelect
            label={t("language")}
            value={settings.language}
            onChange={(v) => updateSettings({ language: v })}
          />
        </div>
        {step === 0 && (
          <div className="relative mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-300/90">Sonatrio</p>
            <h1 className="mt-1 bg-gradient-to-r from-sky-glow via-brand-300 to-brand-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
              {t("welcomeTitle")}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-300">{t("welcomeBody")}</p>
          </div>
        )}
        <h2 className={cx("mb-3 font-bold", step === 0 ? "mt-1 text-sm tracking-[0.12em] text-mist-400 uppercase" : "mt-2 text-xl")}>
          {steps[step].title}
        </h2>
        {steps[step].body}
        <div className="mt-6 flex items-center justify-center gap-2">
          {step > 0 && (
            <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)}>
              {t("back")}
            </Button>
          )}
          <Button variant="primary" size="lg" className="min-w-40" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? t("start") : t("next")}
          </Button>
        </div>
        {step === 0 && <p className="mt-3 text-xs text-mist-400 [@media(pointer:coarse)]:hidden">{t("tipKeyboard")}</p>}
      </div>
    </Dialog>
  );
}
