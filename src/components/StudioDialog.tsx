import { useMemo, useRef, useState } from "react";
import { canImport } from "../auth/account";
import { useT, type DictKey } from "../i18n";
import { formatTime } from "../lib/notes";
import { addUserMidi } from "../state/actions";
import { setPanel, toast, useApp } from "../state/store";
import { PROGRAMS, guitarProgram, midiFileName, writeMidi } from "../studio/midiFile";
import {
  LETTER_NAMES,
  SOLFEGE_NAMES,
  insertBar,
  insertNote,
  insertRest,
  measureBeats,
  notationToMidi,
  parseVoice,
  removeLastToken,
  type EditResult,
  type NotationError,
} from "../studio/notation";
import { startRecording } from "../studio/recording";
import { shareMidi } from "../studio/share";
import { chooseAudio, convertAudio, resetAudio, saveTranscription, useStudio, type StudioTab } from "../studio/studioStore";
import type { TranscribeInstrument } from "../studio/transcribePost";
import { IconCrown, IconEdit, IconInfo, IconNote, IconRecord, IconShare, IconUpload, IconWave } from "../ui/icons";
import { Button, Dialog, Segmented, Slider, Switch, cx } from "../ui/primitives";

/** Pro check that sends free users to the upgrade dialog. */
function guard(fn: () => void): void {
  if (canImport()) fn();
  else setPanel("pro");
}

function ProNote() {
  const t = useT();
  useApp((s) => s.account);
  if (canImport()) return null;
  return (
    <button
      type="button"
      onClick={() => setPanel("pro")}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-300/15 to-brand-500/15 px-4 py-3 text-left ring-1 ring-amber-200/25"
    >
      <IconCrown size={18} className="shrink-0 text-amber-300" />
      <span className="flex-1 text-sm font-semibold text-amber-100">{t("studioProNote")}</span>
      <span className="rounded-md bg-amber-300 px-1.5 text-[10px] leading-4 font-extrabold text-ink-950">PRO</span>
    </button>
  );
}

function RecordTab() {
  const t = useT();
  const hasSong = useApp((s) => !!s.song?.notes.length);
  const [freePlay, setFreePlay] = useState(true);
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-mist-300">{t("recordIntro")}</p>
      {hasSong && <Switch checked={freePlay} onChange={setFreePlay} label={t("recordFreePlay")} hint={t("recordFreePlayHint")} />}
      <p className="flex gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-mist-400">
        <IconInfo size={14} className="mt-0.5 shrink-0" />
        {t("recordInputsHint")}
      </p>
      <Button
        size="lg"
        className="w-full !bg-none !bg-rose-500 !text-white shadow-[0_8px_24px_-8px_rgba(244,63,94,0.8)] hover:!bg-rose-400"
        onClick={() => guard(() => startRecording(freePlay || !hasSong))}
      >
        <IconRecord size={18} />
        {t("recordStart")}
      </Button>
    </div>
  );
}

function AudioTab() {
  const t = useT();
  const { file, title, opts, stage, progress, result, error } = useStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = stage !== null;
  const setOpts = (o: Partial<typeof opts>) => useStudio.setState({ opts: { ...opts, ...o } });
  const stageText = stage ? t(`audioStage_${stage}` as DictKey, { p: Math.round(progress * 100) }) : "";
  const overall = !stage ? 0 : stage === "decode" ? 0.04 : stage === "model" ? 0.08 : stage === "analyze" ? 0.1 + progress * 0.85 : 0.97;

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-mist-300">{t("audioIntro")}</p>
      <p className="flex gap-2 rounded-xl border border-amber-200/20 bg-amber-300/[0.08] px-3 py-2 text-xs leading-relaxed text-amber-100">
        <IconInfo size={14} className="mt-0.5 shrink-0" />
        {t("audioTip")}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) chooseAudio(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => guard(() => fileRef.current?.click())}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-4 text-left transition-colors hover:border-brand-400/50 disabled:opacity-50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-200">
          {file ? <IconWave size={20} /> : <IconUpload size={20} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{file ? file.name : t("audioPick")}</span>
          <span className="block text-xs text-mist-400">{file ? t("audioChange") : t("audioFormats")}</span>
        </span>
      </button>

      {file && !result && (
        <>
          <div>
            <div className="mb-1.5 text-sm font-medium text-mist-100">{t("instrument")}</div>
            <Segmented<TranscribeInstrument>
              label={t("instrument")}
              className="w-full"
              value={opts.instrument}
              onChange={(instrument) => setOpts({ instrument })}
              options={[
                { value: "piano", label: t("piano") },
                { value: "guitar", label: t("guitar") },
                { value: "violin", label: t("violin") },
              ]}
            />
          </div>
          <Slider
            label={t("audioSensitivity")}
            hint={t("audioSensitivityHint")}
            min={0}
            max={1}
            step={0.05}
            value={opts.sensitivity}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(sensitivity) => setOpts({ sensitivity })}
          />
          <Switch checked={opts.quantize} onChange={(quantize) => setOpts({ quantize })} label={t("audioQuantize")} hint={t("audioQuantizeHint")} />
        </>
      )}

      {busy && (
        <div className="rounded-2xl bg-white/[0.04] px-4 py-3" role="status" aria-live="polite">
          <div className="flex justify-between text-sm font-semibold">
            <span>{stageText}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-sky-400 transition-[width] duration-300" style={{ width: `${overall * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-mist-400">{t("audioSlow")}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {t(error === "noNotes" ? "audioNoNotes" : (`audioErr_${error}` as DictKey))}
        </p>
      )}

      {result && (
        <div className="space-y-3 rounded-2xl bg-emerald-400/[0.07] px-4 py-3 ring-1 ring-emerald-300/20">
          <p className="text-sm font-semibold text-emerald-100">
            {t("audioResult", { n: result.noteCount, time: formatTime(result.duration), bpm: result.bpm })}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-mist-300">{t("takeNameLabel")}</span>
            <input
              value={title}
              maxLength={120}
              onChange={(e) => useStudio.setState({ title: e.target.value })}
              className="h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm outline-none focus:border-brand-400/60"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {(result || error) && (
          <Button variant="ghost" onClick={resetAudio}>
            {t("audioReset")}
          </Button>
        )}
        {result ? (
          <>
            <Button onClick={() => void saveTranscription(true)}>
              <IconEdit size={16} />
              {t("audioSaveEdit")}
            </Button>
            <Button variant="primary" onClick={() => void saveTranscription()}>
              {t("audioSaveOpen")}
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={!file || busy} onClick={() => void convertAudio()}>
            <IconWave size={16} />
            {t("audioConvert")}
          </Button>
        )}
      </div>
    </div>
  );
}

const LENGTHS = [
  { beats: 4, label: "1" },
  { beats: 2, label: "1/2" },
  { beats: 1, label: "1/4" },
  { beats: 0.5, label: "1/8" },
  { beats: 0.25, label: "1/16" },
];

const EXAMPLE_RIGHT =
  "Mi4 Mi Fa Sol | Sol Fa Mi Re | Do Do Re Mi | Mi:1.5 Re:0.5 Re:2 |\nMi:1 Mi Fa Sol | Sol Fa Mi Re | Do Do Re Mi | Re:1.5 Do:0.5 Do:2 |";
const EXAMPLE_LEFT =
  "Do3+Sol3:4 | Sol2+Re3:4 | Do3+Sol3:4 | Sol2+Re3:4 |\nDo3+Sol3:4 | Sol2+Re3:4 | Do3+Sol3:4 | Sol2+Re3:2 Do3:2 |";
const SOLFEGE_TO_LETTER: Record<string, string> = { Do: "C", Re: "D", Mi: "E", Fa: "F", Sol: "G", La: "A", Si: "B" };
const toLetters = (s: string) => s.replace(/\b(Do|Re|Mi|Fa|Sol|La|Si)/g, (m) => SOLFEGE_TO_LETTER[m]);

function NotesTab() {
  const t = useT();
  const naming = useApp((s) => s.settings.noteNaming);
  const instrument = useApp((s) => s.settings.instrument);
  const guitarTone = useApp((s) => s.settings.guitarTone);
  const n = useStudio((s) => s.notes);
  const setN = (o: Partial<typeof n>) => useStudio.setState({ notes: { ...n, ...o } });
  const [part, setPart] = useState<"right" | "left">("right");
  const [octave, setOctave] = useState(4);
  const [length, setLength] = useState(1);
  const [dotted, setDotted] = useState(false);
  const [chord, setChord] = useState(false);
  const refs = { right: useRef<HTMLTextAreaElement>(null), left: useRef<HTMLTextAreaElement>(null) };
  const names = naming === "solfege" ? SOLFEGE_NAMES : LETTER_NAMES;
  const beats = length * (dotted ? 1.5 : 1);

  const bar = measureBeats(n.timeSignature);
  const right = useMemo(() => parseVoice(n.right, bar), [n.right, bar]);
  const left = useMemo(() => parseVoice(n.left, bar), [n.left, bar]);
  const noteCount = right.notes.length + left.notes.length;
  const seconds = (Math.max(right.length, left.length) * 60) / n.bpm;
  const errors: NotationError[] = [...right.errors, ...left.errors];

  const edit = (fn: (text: string, cursor: number) => EditResult) => {
    const el = refs[part].current;
    const text = n[part];
    const cursor = el && document.activeElement === el ? el.selectionStart : (el?.selectionStart ?? text.length);
    const r = fn(text, Math.min(cursor, text.length));
    setN({ [part]: r.text });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(r.cursor, r.cursor);
    });
  };

  const program =
    instrument === "piano" ? PROGRAMS.piano : instrument === "violin" ? PROGRAMS.violin : guitarProgram(guitarTone);
  const build = () => {
    const title = n.title.trim() || t("notesTitleDefault");
    const spec = notationToMidi({
      title,
      bpm: n.bpm,
      timeSignature: n.timeSignature,
      program,
      parts: [
        { name: "Right hand", text: n.right },
        { name: "Left hand", text: n.left },
      ],
    });
    return { title, data: writeMidi(spec) };
  };
  const create = () =>
    guard(() => {
      const { title, data } = build();
      void addUserMidi(title, data).then(() => setPanel(null));
    });
  const share = () =>
    guard(() => {
      const { title, data } = build();
      void shareMidi(data, midiFileName(title), title).catch(() => toast(t("exportFailed"), "error"));
    });

  const area = (p: "right" | "left") => (
    <label className="block">
      <span className={cx("mb-1 block text-xs font-semibold", part === p ? "text-brand-200" : "text-mist-300")}>
        {t(p === "right" ? "notesRight" : "notesLeft")}
      </span>
      <textarea
        ref={refs[p]}
        value={n[p]}
        rows={p === "right" ? 4 : 3}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onFocus={() => setPart(p)}
        onChange={(e) => setN({ [p]: e.target.value })}
        placeholder={p === "right" ? (naming === "solfege" ? "Do4 Re Mi:2 | Sol:4 |" : "C4 D E:2 | G:4 |") : ""}
        className={cx(
          "w-full resize-y rounded-xl border bg-black/30 px-3 py-2 font-mono text-sm leading-relaxed outline-none",
          part === p ? "border-brand-400/60" : "border-white/[0.1]"
        )}
      />
    </label>
  );

  const chip = "h-9 min-w-9 rounded-lg px-2 text-sm font-semibold transition-colors";

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-mist-300">{t("notesIntro")}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-mist-300">{t("notesTitleLabel")}</span>
          <input
            value={n.title}
            maxLength={120}
            placeholder={t("notesTitleDefault")}
            onChange={(e) => setN({ title: e.target.value })}
            className="h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm outline-none focus:border-brand-400/60"
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-mist-300">{t("notesTimeSig")}</span>
          <Segmented<string>
            label={t("notesTimeSig")}
            value={n.timeSignature.join("/")}
            onChange={(v) => setN({ timeSignature: v.split("/").map(Number) as [number, number] })}
            options={["2/4", "3/4", "4/4", "6/8"].map((v) => ({ value: v, label: v }))}
          />
        </div>
      </div>
      <Slider label={t("notesTempo")} min={40} max={200} step={1} value={n.bpm} format={(v) => `${v} BPM`} onChange={(bpm) => setN({ bpm })} />

      {area("right")}
      {area("left")}

      <div className="space-y-2 rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.06]">
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
          {names.map((name, pc) => (
            <button
              key={name}
              type="button"
              onClick={() => edit((txt, c) => insertNote(txt, c, { name, octave, duration: beats, chord }))}
              className={cx(chip, name.includes("#") ? "bg-black/50 text-mist-200 hover:bg-black/70" : "bg-white/[0.09] hover:bg-white/[0.15]")}
              aria-label={`${name}${octave}`}
              data-pc={pc}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-mist-400">{t("notesOctave")}</span>
          <button type="button" className={cx(chip, "bg-white/[0.06]")} onClick={() => setOctave((o) => Math.max(1, o - 1))} aria-label="−">
            −
          </button>
          <span className="w-5 text-center text-sm font-bold tabular-nums">{octave}</span>
          <button type="button" className={cx(chip, "bg-white/[0.06]")} onClick={() => setOctave((o) => Math.min(7, o + 1))} aria-label="+">
            +
          </button>
          <span className="ml-2 text-xs text-mist-400">{t("notesLength")}</span>
          {LENGTHS.map((l) => (
            <button
              key={l.beats}
              type="button"
              aria-pressed={length === l.beats}
              onClick={() => setLength(l.beats)}
              className={cx(chip, length === l.beats ? "bg-brand-500/30 text-brand-100 ring-1 ring-brand-400/50" : "bg-white/[0.06]")}
            >
              {l.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={dotted}
            onClick={() => setDotted((d) => !d)}
            className={cx(chip, dotted ? "bg-brand-500/30 text-brand-100 ring-1 ring-brand-400/50" : "bg-white/[0.06]")}
          >
            {t("notesDotted")}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={chord}
            title={t("notesChordHint")}
            onClick={() => setChord((c) => !c)}
            className={cx(chip, chord ? "bg-brand-500/30 text-brand-100 ring-1 ring-brand-400/50" : "bg-white/[0.06]")}
          >
            + {t("notesChord")}
          </button>
          <button type="button" className={cx(chip, "bg-white/[0.06]")} onClick={() => edit((txt, c) => insertRest(txt, c, beats))}>
            {t("notesRest")}
          </button>
          <button type="button" className={cx(chip, "bg-white/[0.06]")} onClick={() => edit(insertBar)}>
            | {t("notesBar")}
          </button>
          <button type="button" className={cx(chip, "bg-white/[0.06]")} onClick={() => edit(removeLastToken)}>
            ⌫ {t("notesUndo")}
          </button>
          <button
            type="button"
            className={cx(chip, "ml-auto text-brand-200 hover:bg-white/[0.06]")}
            onClick={() =>
              setN({
                title: n.title || "Ode to Joy",
                bpm: 100,
                timeSignature: [4, 4],
                right: naming === "solfege" ? EXAMPLE_RIGHT : toLetters(EXAMPLE_RIGHT),
                left: naming === "solfege" ? EXAMPLE_LEFT : toLetters(EXAMPLE_LEFT),
              })
            }
          >
            {t("notesExample")}
          </button>
        </div>
      </div>

      <div className="text-xs" aria-live="polite">
        <p className="font-semibold text-mist-200">{t("notesSummary", { n: noteCount, time: formatTime(seconds) })}</p>
        {errors.slice(0, 4).map((e, i) => (
          <p key={i} className="mt-1 text-rose-300">
            {t(`notesErr_${e.kind}` as DictKey, { line: e.line, token: e.token })}
          </p>
        ))}
        {right.badBars.length > 0 && (
          <p className="mt-1 text-amber-200">{t("notesBadBars", { part: t("notesRight"), bars: right.badBars.join(", ") })}</p>
        )}
        {left.badBars.length > 0 && (
          <p className="mt-1 text-amber-200">{t("notesBadBars", { part: t("notesLeft"), bars: left.badBars.join(", ") })}</p>
        )}
      </div>

      <details className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-mist-300">
        <summary className="cursor-pointer font-semibold text-mist-200">{t("notesHelpTitle")}</summary>
        <p className="mt-2">{t("notesHelp1")}</p>
        <p className="mt-1">{t("notesHelp2")}</p>
        <p className="mt-1 font-mono">{t("notesHelp3")}</p>
      </details>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="subtle" disabled={!noteCount} onClick={share}>
          <IconShare size={16} />
          {t("notesShare")}
        </Button>
        <Button variant="primary" disabled={!noteCount} onClick={create} title={noteCount ? undefined : t("notesEmpty")}>
          <IconNote size={16} />
          {t("notesCreate")}
        </Button>
      </div>
    </div>
  );
}

export function StudioDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "studio");
  const tab = useStudio((s) => s.tab);
  const close = () => setPanel(null);
  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("studio")}
      width="max-w-xl"
      closeLabel={t("close")}
      toolbar={
        <Segmented<StudioTab>
          label={t("studio")}
          className="w-full"
          value={tab}
          onChange={(v) => useStudio.setState({ tab: v })}
          options={[
            { value: "record", label: <><IconRecord size={14} className="max-sm:hidden" /> {t("studioRecordTab")}</> },
            { value: "audio", label: <><IconWave size={14} className="max-sm:hidden" /> {t("studioAudioTab")}</> },
            { value: "notes", label: <><IconNote size={14} className="max-sm:hidden" /> {t("studioNotesTab")}</> },
          ]}
        />
      }
    >
      <ProNote />
      {tab === "record" ? <RecordTab /> : tab === "audio" ? <AudioTab /> : <NotesTab />}
    </Dialog>
  );
}
