import { useState, type ReactNode } from "react";
import { useT } from "../i18n";
import { startMidi } from "../input/midi";
import { updateSettings } from "../state/actions";
import { defaultSettings } from "../state/settings";
import { setPanel, useApp } from "../state/store";
import { IconPlug } from "../ui/icons";
import { Button, Dialog, Segmented, Slider, Switch, cx } from "../ui/primitives";

type Tab = "general" | "sound" | "gameplay" | "input";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-2">
      {title && <h3 className="pt-2 pb-1 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{title}</h3>}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

export function SettingsDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "settings");
  const s = useApp((st) => st.settings);
  const midiSupported = useApp((st) => st.midiSupported);
  const midiDevices = useApp((st) => st.midiDevices);
  const midiAccess = useApp((st) => st.midiAccess);
  const [tab, setTab] = useState<Tab>("general");
  const close = () => setPanel(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: t("general") },
    { id: "sound", label: t("sound") },
    { id: "gameplay", label: t("gameplay") },
    { id: "input", label: t("input") },
  ];

  const shortcuts: [string[], string][] = [
    [["Space"], t("scSpace")],
    [["←", "→"], t("scArrows")],
    [["↓", "↑"], t("scSpeed")],
    [["Home"], t("scHome")],
    [["B"], t("scLoop")],
    [["N"], t("scWait")],
    [["M"], t("scMetro")],
    [["/"], t("scLibrary")],
    [["Esc"], t("scEsc")],
  ];

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("settings")}
      width="max-w-xl"
      closeLabel={t("close")}
      toolbar={
        <div role="tablist" aria-label={t("settings")} className="flex gap-1 rounded-2xl bg-white/[0.04] p-1">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={cx(
                "h-9 flex-1 rounded-xl text-sm font-semibold transition-colors",
                tab === x.id ? "bg-brand-500/25 text-brand-200 ring-1 ring-brand-400/40" : "text-mist-300 hover:bg-white/[0.06]"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      }
    >
      <div role="tabpanel" className="sm:min-h-[22rem]">
        {tab === "general" && (
          <>
            <Section>
              <Row label={t("language")}>
                <Segmented
                  label={t("language")}
                  value={s.language}
                  onChange={(v) => updateSettings({ language: v })}
                  options={[
                    { value: "tr", label: "Türkçe" },
                    { value: "en", label: "English" },
                  ]}
                />
              </Row>
              <Row label={t("noteNaming")}>
                <Segmented
                  label={t("noteNaming")}
                  value={s.noteNaming}
                  onChange={(v) => updateSettings({ noteNaming: v })}
                  options={[
                    { value: "letters", label: "C D E" },
                    { value: "solfege", label: "Do Re Mi" },
                  ]}
                />
              </Row>
              <Switch label={t("showNoteNames")} checked={s.showNoteNames} onChange={(v) => updateSettings({ showNoteNames: v })} />
              <Switch label={t("effects")} checked={s.effects} onChange={(v) => updateSettings({ effects: v })} />
            </Section>
            <Section title={t("about")}>
              <p className="py-2 text-xs leading-relaxed text-mist-400">{t("aboutBody")}</p>
              <div className="pb-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    const d = defaultSettings();
                    updateSettings({ ...d, language: s.language, onboarded: true });
                  }}
                >
                  {t("resetSettings")}
                </Button>
              </div>
            </Section>
          </>
        )}

        {tab === "sound" && (
          <Section>
            <Slider label={t("volume")} value={s.volume} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ volume: v })} format={pct} />
            <Slider label={t("accompVolume")} value={s.accompVolume} min={0} max={1.2} step={0.05} onChange={(v) => updateSettings({ accompVolume: v })} format={pct} />
            <Slider label={t("reverb")} value={s.reverb} min={0} max={0.6} step={0.02} onChange={(v) => updateSettings({ reverb: v })} format={(v) => pct(v / 0.6)} />
            <Slider label={t("clickVolume")} value={s.clickVolume} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ clickVolume: v })} format={pct} />
            <Row label={t("guitarTone")}>
              <Segmented
                label={t("guitarTone")}
                value={s.guitarTone}
                onChange={(v) => updateSettings({ guitarTone: v })}
                options={[
                  { value: "steel", label: t("guitarSteel") },
                  { value: "nylon", label: t("guitarNylon") },
                ]}
              />
            </Row>
          </Section>
        )}

        {tab === "gameplay" && (
          <Section>
            <Switch label={t("countIn")} checked={s.countIn} onChange={(v) => updateSettings({ countIn: v })} />
            <Slider
              label={t("timingWindow")}
              hint={t("timingWindowHint")}
              value={s.timingWindowMs}
              min={60}
              max={300}
              step={10}
              onChange={(v) => updateSettings({ timingWindowMs: v })}
              format={(v) => `±${v} ms`}
            />
            <Slider
              label={t("fallSpeed")}
              hint={t("fallSpeedHint")}
              value={s.fallSeconds}
              min={1}
              max={8}
              step={0.25}
              onChange={(v) => updateSettings({ fallSeconds: v })}
              format={(v) => `${v.toFixed(2).replace(/\.?0+$/, "")} s`}
            />
            <Slider
              label={t("instrumentHeight")}
              value={s.instrumentHeight}
              min={0.16}
              max={0.5}
              step={0.01}
              onChange={(v) => updateSettings({ instrumentHeight: v })}
              format={pct}
            />
          </Section>
        )}

        {tab === "input" && (
          <>
            <Section title={t("midiInput")}>
              {!midiSupported ? (
                <p className="py-2 text-sm text-mist-400">{t("midiUnsupported")}</p>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {midiAccess !== "ready" && (
                      <Button size="sm" onClick={() => void startMidi()}>
                        <IconPlug size={15} /> {t("midiConnect")}
                      </Button>
                    )}
                    <span className="text-xs text-mist-400">
                      {midiAccess === "denied"
                        ? t("midiDenied")
                        : midiAccess === "idle"
                          ? t("midiConnectHint")
                          : midiDevices.length
                            ? t("midiDevices", { n: midiDevices.length })
                            : t("midiNoDevices")}
                    </span>
                  </div>
                  {midiDevices.length > 0 && (
                    <select
                      value={s.midiInput}
                      onChange={(e) => updateSettings({ midiInput: e.target.value })}
                      aria-label={t("midiInput")}
                      className="h-10 w-full rounded-xl border border-white/10 bg-ink-800 px-3 text-sm"
                    >
                      <option value="all">{t("midiAll")}</option>
                      {midiDevices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </Section>
            <Section title={t("computerKeyboard")}>
              <Switch label={t("showKeyLabels")} checked={s.showKeyLabels} onChange={(v) => updateSettings({ showKeyLabels: v })} />
              <Slider
                label={t("keyboardOctave")}
                value={s.keyboardOctave}
                min={1}
                max={7}
                step={1}
                onChange={(v) => updateSettings({ keyboardOctave: v })}
                format={(v) => `C${v}`}
              />
              <p className="pb-2 text-xs leading-relaxed text-mist-400">{t("keyboardHint")}</p>
            </Section>
            <Section title={t("shortcuts")}>
              <dl className="divide-y divide-white/[0.05]">
                {shortcuts.map(([keys, desc]) => (
                  <div key={desc} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <dt className="text-mist-300">{desc}</dt>
                    <dd className="flex shrink-0 gap-1">
                      {keys.map((k) => (
                        <kbd key={k}>{k}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>
          </>
        )}
      </div>
    </Dialog>
  );
}
