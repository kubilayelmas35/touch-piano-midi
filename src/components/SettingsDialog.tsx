import { useState, type ReactNode } from "react";
import { useT } from "../i18n";
import { startMidi } from "../input/midi";
import { useFullscreen } from "../lib/fullscreen";
import { updateSettings } from "../state/actions";
import { INSTRUMENT_HEIGHT_RANGE, KEY_ZOOM_MAX, defaultSettings } from "../state/settings";
import { openVideo, setPanel, useApp } from "../state/store";
import { isNativeApp } from "../lib/platform";
import { IconMessage, IconPlug, IconSparkles, IconVideo } from "../ui/icons";
import { KeyBindings } from "./KeyBindings";
import { LegalLinks } from "./LegalLinks";
import { ApproachSwatch, BackgroundSwatch, ChoiceCards, ColorPicker, ColorSwatch, DustSwatch, EffectSwatch, NoteSwatch } from "./AppearancePicker";
import {
  APPROACH_STYLES,
  BACKGROUNDS,
  DUST_STYLES,
  EFFECT_STYLES,
  NOTE_COLORS,
  NOTE_STYLES,
  type ApproachStyle,
  type Background,
  type DustStyle,
  type EffectStyle,
  type NoteColor,
  type NoteStyle,
} from "../render/appearance";
import type { DictKey } from "../i18n/en";
import { Button, Dialog, Segmented, Slider, Switch, cx } from "../ui/primitives";

const BG_LABEL: Record<Background, DictKey> = {
  night: "bgNight",
  space: "bgSpace",
  aurora: "bgAurora",
  synth: "bgSynth",
  plain: "bgPlain",
  haze: "bgHaze",
  ocean: "bgOcean",
  sunset: "bgSunset",
  city: "bgCity",
  matrix: "bgMatrix",
};
const NOTE_LABEL: Record<NoteStyle, DictKey> = {
  gem: "nsGem",
  neon: "nsNeon",
  classic: "nsClassic",
  minimal: "nsMinimal",
  block: "nsBlock",
  glass: "nsGlass",
  capsule: "nsCapsule",
  pixel: "nsPixel",
  candy: "nsCandy",
  crystal: "nsCrystal",
};
const FX_LABEL: Record<EffectStyle, DictKey> = {
  sparks: "fxSparks",
  stars: "fxStars",
  fire: "fxFire",
  glow: "fxGlow",
  notes: "fxNotes",
  confetti: "fxConfetti",
  bubbles: "fxBubbles",
  lightning: "fxLightning",
  petals: "fxPetals",
  pixels: "fxPixels",
};
const COLOR_LABEL: Record<NoteColor, DictKey> = {
  auto: "ncAuto",
  solid: "ncSolid",
  custom: "ncCustom",
  rainbow: "ncRainbow",
  octave: "ncOctave",
  gradient: "ncGradient",
  sunset: "ncSunset",
  ocean: "ncOcean",
  aurora: "ncAurora",
  candy: "ncCandy",
  ice: "ncIce",
  pastel: "ncPastel",
  gold: "ncGold",
  silver: "ncSilver",
};
const DUST_LABEL: Record<DustStyle, DictKey> = {
  off: "duOff",
  smoke: "duSmoke",
  fountain: "duFountain",
  plume: "duPlume",
  rays: "duRays",
  sparkle: "duSparkle",
  nebula: "duNebula",
  fog: "duFog",
  embers: "duEmbers",
  stardust: "duStardust",
};
const APPROACH_LABEL: Record<ApproachStyle, DictKey> = {
  off: "apOff",
  beam: "apBeam",
  ring: "apRing",
  comet: "apComet",
  arrows: "apArrows",
  keyglow: "apKeyglow",
};

type Tab = "general" | "look" | "sound" | "gameplay" | "input";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-2">
      {title && <h3 className="pt-2 pb-1 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{title}</h3>}
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-mist-400">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

const touchScreen = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

function HelpButton({ icon, label, hint, onClick }: { icon: ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.08] sm:flex-col sm:gap-2"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-mist-100">{label}</span>
        <span className="mt-0.5 block text-xs text-mist-400">{hint}</span>
      </span>
    </button>
  );
}

export function SettingsDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "settings");
  const s = useApp((st) => st.settings);
  const midiSupported = useApp((st) => st.midiSupported);
  const midiDevices = useApp((st) => st.midiDevices);
  const midiAccess = useApp((st) => st.midiAccess);
  const fs = useFullscreen();
  const [tab, setTab] = useState<Tab>("general");
  const close = () => setPanel(null);
  const choice = { solid: s.solidColor, from: s.gradFrom, to: s.gradTo };

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: t("general") },
    { id: "look", label: t("appearance") },
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
    [["Shift"], t("scPedal")],
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
        <div role="tablist" aria-label={t("settings")} className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-white/[0.04] p-1">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={cx(
                "h-9 min-w-[3.5rem] flex-1 shrink-0 rounded-xl px-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors sm:text-sm",
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
              {fs.supported && <Switch label={t("fullscreen")} hint="F11" checked={fs.full} onChange={fs.toggle} />}
              {isNativeApp && (
                <Switch
                  label={t("landscapeLock")}
                  hint={t("landscapeLockHint")}
                  checked={s.landscapeLock}
                  onChange={(v) => updateSettings({ landscapeLock: v })}
                />
              )}
              {touchScreen && (
                <Switch label={t("rotateHintSetting")} hint={t("rotateHintSettingHint")} checked={s.rotateHint} onChange={(v) => updateSettings({ rotateHint: v })} />
              )}
            </Section>
            <Section title={t("helpSection")}>
              <div className="grid gap-2 py-2 sm:grid-cols-3">
                <HelpButton icon={<IconVideo size={18} />} label={t("tutorialWatch")} hint={t("tutorialWatchHint")} onClick={() => openVideo("tutorial")} />
                <HelpButton icon={<IconSparkles size={18} />} label={t("promoWatch")} hint={t("promoWatchHint")} onClick={() => openVideo("promo")} />
                <HelpButton icon={<IconMessage size={18} />} label={t("feedback")} hint={t("feedbackHint")} onClick={() => setPanel("feedback")} />
              </div>
            </Section>
            <Section title={t("about")}>
              <div className="space-y-1.5 py-2 text-xs leading-relaxed text-mist-400">
                <p className="font-semibold text-mist-300">{t("aboutBody")}</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>{t("creditPiano")}</li>
                  <li>{t("creditStrings")}</li>
                  <li>{t("creditBach")}</li>
                  <li>{t("creditMutopia")}</li>
                  <li>{t("creditSongs")}</li>
                  <li>{t("creditBasicPitch")}</li>
                </ul>
                <LegalLinks className="pt-1" />
              </div>
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

        {tab === "look" && (
          <>
            <Section>
              <ChoiceCards
                label={t("background")}
                value={s.background}
                onChange={(v) => updateSettings({ background: v })}
                options={BACKGROUNDS.map((b) => ({ value: b, label: t(BG_LABEL[b]), preview: <BackgroundSwatch bg={b} /> }))}
              />
              <ChoiceCards
                label={t("noteStyle")}
                value={s.noteStyle}
                onChange={(v) => updateSettings({ noteStyle: v })}
                options={NOTE_STYLES.map((n) => ({ value: n, label: t(NOTE_LABEL[n]), preview: <NoteSwatch style={n} /> }))}
              />
              <ChoiceCards
                label={t("noteColor")}
                value={s.noteColor}
                onChange={(v) => updateSettings({ noteColor: v })}
                options={NOTE_COLORS.map((c) => ({ value: c, label: t(COLOR_LABEL[c]), preview: <ColorSwatch color={c} choice={choice} /> }))}
              />
              {s.noteColor === "solid" && (
                <ColorPicker label={t("pickColor")} value={s.solidColor} onChange={(v) => updateSettings({ solidColor: v })} />
              )}
              {s.noteColor === "custom" && (
                <>
                  <ColorPicker label={t("gradTop")} value={s.gradFrom} onChange={(v) => updateSettings({ gradFrom: v })} />
                  <ColorPicker label={t("gradBottom")} value={s.gradTo} onChange={(v) => updateSettings({ gradTo: v })} />
                </>
              )}
            </Section>
            <Section>
              <Switch label={t("effects")} checked={s.effects} onChange={(v) => updateSettings({ effects: v })} />
              {s.effects && (
                <>
                  <Slider
                    label={t("effectLevel")}
                    value={s.effectLevel}
                    min={0.1}
                    max={1}
                    step={0.05}
                    onChange={(v) => updateSettings({ effectLevel: v })}
                    format={pct}
                  />
                  <ChoiceCards
                    label={t("effectStyle")}
                    value={s.effectStyle}
                    onChange={(v) => updateSettings({ effectStyle: v })}
                    options={EFFECT_STYLES.map((e) => ({ value: e, label: t(FX_LABEL[e]), preview: <EffectSwatch style={e} /> }))}
                  />
                </>
              )}
            </Section>
            <Section>
              <ChoiceCards
                label={t("dust")}
                value={s.dust}
                onChange={(v) => updateSettings({ dust: v })}
                options={DUST_STYLES.map((d) => ({ value: d, label: t(DUST_LABEL[d]), preview: <DustSwatch style={d} /> }))}
              />
              {s.dust !== "off" && (
                <Slider
                  label={t("dustLevel")}
                  value={s.dustLevel}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onChange={(v) => updateSettings({ dustLevel: v })}
                  format={pct}
                />
              )}
            </Section>
            <Section>
              <ChoiceCards
                label={t("approach")}
                value={s.approach}
                onChange={(v) => updateSettings({ approach: v })}
                options={APPROACH_STYLES.map((a) => ({ value: a, label: t(APPROACH_LABEL[a]), preview: <ApproachSwatch style={a} /> }))}
              />
            </Section>
          </>
        )}

        {tab === "sound" && (
          <Section>
            <Slider label={t("volume")} value={s.volume} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ volume: v })} format={pct} />
            <Slider label={t("accompVolume")} value={s.accompVolume} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ accompVolume: v })} format={pct} />
            <Slider label={t("reverb")} value={s.reverb} min={0} max={0.6} step={0.02} onChange={(v) => updateSettings({ reverb: v })} format={(v) => pct(v / 0.6)} />
            <Slider label={t("clickVolume")} value={s.clickVolume} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ clickVolume: v })} format={pct} />
            <Switch label={t("pianoPedal")} hint={t("pianoPedalHint")} checked={s.pianoPedal} onChange={(v) => updateSettings({ pianoPedal: v })} />
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
              min={INSTRUMENT_HEIGHT_RANGE[0]}
              max={INSTRUMENT_HEIGHT_RANGE[1]}
              step={0.01}
              onChange={(v) => updateSettings({ instrumentHeight: v })}
              format={pct}
            />
            <Switch label={t("lockHeight")} hint={t("lockHeightHint")} checked={s.lockHeight} onChange={(v) => updateSettings({ lockHeight: v })} />
          </Section>
        )}
        {tab === "gameplay" && (
          <Section title={t("piano")}>
            <Slider
              label={t("keyZoom")}
              hint={t("keyZoomHint")}
              value={s.keyZoom}
              min={1}
              max={KEY_ZOOM_MAX}
              step={0.25}
              onChange={(v) => updateSettings({ keyZoom: v })}
              format={(v) => `${v.toFixed(2).replace(/\.?0+$/, "")}×`}
            />
            <Switch label={t("compactKeys")} hint={t("compactKeysHint")} checked={s.compactKeys} onChange={(v) => updateSettings({ compactKeys: v })} />
          </Section>
        )}
        {tab === "gameplay" && (
          <Section title={t("frettedPlay")}>
            <Switch label={t("autoFret")} hint={t("autoFretHint")} checked={s.autoFret} onChange={(v) => updateSettings({ autoFret: v })} />
            <Switch label={t("tapToPlay")} hint={t("tapToPlayHint")} checked={s.tapToPlay} onChange={(v) => updateSettings({ tapToPlay: v })} />
            <Switch label={t("multiNote")} hint={t("multiNoteHint")} checked={s.multiNote} onChange={(v) => updateSettings({ multiNote: v })} />
            <Switch label={t("columnPress")} hint={t("columnPressHint")} checked={s.columnPress} onChange={(v) => updateSettings({ columnPress: v })} />
          </Section>
        )}
        {tab === "gameplay" && (
          <Section title={t("glideSection")}>
            <p className="text-xs leading-relaxed text-mist-400">{t("glideIntro")}</p>
            <Switch label={t("glidePiano")} hint={t("glidePianoHint")} checked={s.glidePiano} onChange={(v) => updateSettings({ glidePiano: v })} />
            <Switch label={t("glideGuitar")} checked={s.glideGuitar} onChange={(v) => updateSettings({ glideGuitar: v })} />
            <Switch label={t("glideViolin")} checked={s.glideViolin} onChange={(v) => updateSettings({ glideViolin: v })} />
            {(s.glidePiano || s.glideGuitar || s.glideViolin) && (
              <Row label={t("glideTuning")} hint={s.glideSnap ? t("glideSnapHint") : t("glideFreeHint")}>
                <Segmented
                  label={t("glideTuning")}
                  value={s.glideSnap ? "snap" : "free"}
                  onChange={(v) => updateSettings({ glideSnap: v === "snap" })}
                  options={[
                    { value: "snap", label: t("glideSnap") },
                    { value: "free", label: t("glideFree") },
                  ]}
                />
              </Row>
            )}
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
            <Section title={t("keyBindings")}>
              <KeyBindings />
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
