import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { engine } from "../engine/engine";
import { type FretLayout, fretView, PianoLayout } from "../engine/layout";
import { fretted } from "../input/fretted";
import { glider } from "../input/glide";
import { keyLabel, keyLabelMap, keyLabelRevision } from "../input/keyboard";
import { pianoKeyMap } from "../input/keyboardBase";
import { INSTRUMENT_HEIGHT_RANGE } from "../state/settings";
import { visibleLook } from "../state/designs";
import { hasPro } from "../auth/account";
import { niceKeyboardRange } from "../lib/notes";
import { Highway } from "../render/highway";
import { StaffRenderer, staffMetrics } from "../render/staff";
import { BLACK_KEY_RATIO, FretboardRenderer, KeyboardRenderer } from "../render/instrument";
import { toast, useApp } from "../state/store";
import { updateSettings } from "../state/actions";
import { useT } from "../i18n";
import { isNativeApp, platform } from "../lib/platform";
import { Hud } from "./Hud";
import { RecordingBar } from "./RecordingUI";
import { EmptyState } from "./EmptyState";
import { KEY_STRIP_H, KeyStrip } from "./KeyStrip";

const COMPACT_TIP_KEY = "sonatrio-compact-tip";
const MIN_WHITE = 15;
const MAX_WHITE = 46;

/** Touch force, or 0 when it means nothing: iPhones without 3D Touch report a small fixed value for a finger. */
function pressureOf(e: React.PointerEvent): number {
  if (platform === "ios" && e.pointerType !== "pen") return 0;
  return e.pressure && e.pressure !== 0.5 ? e.pressure : 0;
}

function pianoRange(width: number): [number, number] {
  let low = 127;
  let high = 0;
  for (const n of engine.notes) {
    if (n.midi < low) low = n.midi;
    if (n.midi > high) high = n.midi;
  }
  if (low > high) {
    low = 48;
    high = 83;
  }
  const minKeys = width < 520 ? 18 : width < 900 ? 25 : 37;
  let [lo, hi] = niceKeyboardRange(low, high, minKeys);
  const whites = (a: number, b: number) => new PianoLayout(a, b, width).whiteCount;
  // Widen while keys are very wide, so the keyboard doesn't look like a toy.
  let guard = 0;
  while (width / whites(lo, hi) > MAX_WHITE && guard++ < 8) {
    if (lo > 21) lo = Math.max(21, lo - 12);
    if (width / whites(lo, hi) > MAX_WHITE && hi < 108) hi = Math.min(108, hi + 12);
    if (lo === 21 && hi === 108) break;
  }
  [lo, hi] = niceKeyboardRange(lo, hi, 0);
  // Too narrow: keep the song's range only (touch targets stay usable via zoom-free layout).
  if (width / whites(lo, hi) < MIN_WHITE) [lo, hi] = niceKeyboardRange(low, high, 0);
  return [lo, hi];
}

export function GameView() {
  const t = useT();
  const instrument = useApp((s) => s.settings.instrument);
  const instrumentHeight = useApp((s) => s.settings.instrumentHeight);
  const lockHeight = useApp((s) => s.settings.lockHeight);
  const hasSong = useApp((s) => !!s.song);
  const keyZoom = useApp((s) => s.settings.keyZoom);
  const compactKeys = useApp((s) => s.settings.compactKeys);
  const keyPan = useApp((s) => s.keyPan);
  const hideNut = useApp((s) => s.settings.hideNut);
  const compactFrets = useApp((s) => s.settings.compactFrets);
  const compactStrings = useApp((s) => s.settings.compactStrings);
  const neckPart = useApp((s) => {
    const { handFocus, autoFret, tapToPlay } = s.settings;
    if (!handFocus || autoFret === tapToPlay) return "both";
    return autoFret ? "strings" : "neck";
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const hwRef = useRef<HTMLCanvasElement>(null);
  const instRef = useRef<HTMLCanvasElement>(null);
  const staffRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const edgeGap = useApp((s) => (isNativeApp && s.settings.edgeGap ? s.settings.edgeGapPx : 0));
  const size = useMemo(() => ({ w: box.w, h: Math.max(0, box.h - edgeGap) }), [box, edgeGap]);
  const [notesRev, setNotesRev] = useState(0);

  // Re-layout when the player's notes change (song, tracks, hand, instrument).
  useEffect(() => {
    let last = engine.notes;
    return engine.subscribe(() => {
      if (engine.notes !== last) {
        last = engine.notes;
        setNotesRev((r) => r + 1);
      }
    });
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fretSpec = instrument === "piano" ? null : engine.fretSpec;
  // Distinct pitches the player has to play, low → high.
  const used = useMemo(
    () => [...new Set(engine.notes.map((n) => n.midi))].sort((a, b) => a - b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notesRev]
  );
  const range = useMemo(() => (size.w ? pianoRange(size.w) : null), [size.w, notesRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const only = compactKeys && used.length ? used : null;

  const calm = useApp((s) => s.settings.onboarded && !s.welcomeOpen && !s.video && !s.panel);
  useEffect(() => {
    if (instrument !== "piano" || !only || !calm || localStorage.getItem(COMPACT_TIP_KEY)) return;
    localStorage.setItem(COMPACT_TIP_KEY, "1");
    toast(t("compactKeysTip"), "info", 9000);
  }, [instrument, only, calm, t]);

  // Zooming in or switching song: centre the song's notes on screen.
  useEffect(() => {
    if (instrument !== "piano" || !range || keyZoom <= 1) return;
    const probe = new PianoLayout(range[0], range[1], size.w, { zoom: keyZoom, only });
    useApp.setState({ keyPan: used.length ? probe.panFor(used[0], used[used.length - 1]) : 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, range, keyZoom, compactKeys, used]);

  const layout = useMemo(() => {
    if (!size.w) return null;
    if (instrument === "piano") {
      const [lo, hi] = range!;
      return { piano: new PianoLayout(lo, hi, size.w, { zoom: keyZoom, pan: keyPan, only }), fret: null };
    }
    const usedFrets = new Set<number>();
    const usedStrings = new Set<number>();
    for (const n of engine.notes) {
      if (n.fret >= 0) usedFrets.add(n.fret);
      if (n.string >= 0) usedStrings.add(n.string);
    }
    const fret = fretView(engine.fretSpec!, size.w, {
      usedFrets: [...usedFrets],
      usedStrings: [...usedStrings],
      hideNut,
      compactFrets,
      compactStrings,
      part: neckPart,
    });
    return { piano: null, fret };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, instrument, notesRev, fretSpec, range, keyZoom, keyPan, only, hideNut, compactFrets, compactStrings, neckPart]);

  useEffect(() => {
    fretted.reset();
  }, [instrument]);

  const instH = useMemo(() => {
    if (!size.h) return 0;
    const want = size.h * instrumentHeight;
    const minH = instrument === "piano" ? 96 : (instrument === "guitar" ? 6 : 4) * 22;
    return Math.round(Math.max(minH, Math.min(want, size.h * INSTRUMENT_HEIGHT_RANGE[1])));
  }, [size.h, instrumentHeight, instrument]);
  const showStrip = !!layout?.piano && (keyZoom > 1 || compactKeys || size.w < 760);
  const stripH = showStrip ? KEY_STRIP_H : 0;
  const staffOn = useApp((s) => s.settings.staffView) && instrument === "piano" && hasSong && used.length > 0;
  const room = size.h - instH - stripH;
  const staff = useMemo(() => (staffOn && room > 0 ? staffMetrics(used, room * 0.32) : null), [staffOn, used, room]);
  const staffH = staff && room - staff.height >= 110 ? staff.height : 0;
  const hwH = Math.max(0, size.h - instH - stripH - staffH);

  // Renderers live for the component lifetime; the frame loop reads the latest view through a ref.
  const renderers = useRef<{ hw: Highway; kb: KeyboardRenderer; fb: FretboardRenderer; staff: StaffRenderer } | null>(null);
  const viewRef = useRef({ layout, instH, hwH, w: size.w, staff: staffH ? staff : null });
  viewRef.current = { layout, instH, hwH, w: size.w, staff: staffH ? staff : null };

  useEffect(() => {
    if (!hwRef.current || !instRef.current || !staffRef.current) return;
    renderers.current = {
      hw: new Highway(hwRef.current, engine),
      kb: new KeyboardRenderer(instRef.current, engine),
      fb: new FretboardRenderer(instRef.current, engine),
      staff: new StaffRenderer(staffRef.current, engine),
    };
    let raf = 0;
    let lastStore = 0;
    const labels: Record<string, string> = {};
    let pianoLabels: { src: unknown; rev: number; map: Map<number, string> } | null = null;
    let fretLabels: { src: unknown; rev: number; strings: string[]; frets: string[] } | null = null;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const r = renderers.current;
      const v = viewRef.current;
      if (!r || !v.layout || !v.w) return;
      const st = useApp.getState();
      const s = visibleLook(st.settings, hasPro());
      const time = engine.frame();
      labels.perfect = t("perfect");
      labels.great = t("great");
      labels.good = t("good");
      labels.miss = t("miss");
      labels.early = t("early");
      labels.late = t("late");
      const rev = keyLabelRevision();
      if (v.layout.piano) {
        const keys = pianoKeyMap(s);
        if (!pianoLabels || pianoLabels.src !== keys || pianoLabels.rev !== rev) {
          pianoLabels = { src: keys, rev, map: keyLabelMap(keys) };
        }
      }
      const fretless = v.layout.piano ? s.glidePiano : s.instrument === "violin" ? s.glideViolin : s.instrument === "guitar" && s.glideGuitar;
      const hideFrets = fretless && s.hideFrets;
      r.hw.resize(v.w, v.hwH);
      r.hw.draw({
        t: time,
        fallSeconds: s.fallSeconds,
        piano: v.layout.piano,
        fret: v.layout.fret,
        hideFrets,
        naming: s.noteNaming,
        showNames: s.showNoteNames,
        keyLabels: v.layout.piano && s.noteKeyLabels ? pianoLabels?.map : null,
        fingers: !!v.layout.piano && s.fingerNumbers,
        effects: s.effects,
        effectLevel: s.effectLevel,
        effectStyle: s.effectStyle,
        dust: s.dust,
        dustLevel: s.dustLevel,
        approach: s.approach,
        noteStyle: s.noteStyle,
        noteColor: s.noteColor,
        colors: { solid: s.solidColor, from: s.gradFrom, to: s.gradTo },
        background: s.background,
        labels,
      });
      if (v.staff) {
        r.staff.resize(v.w, v.staff.height);
        r.staff.draw({ t: time, metrics: v.staff, fingers: s.fingerNumbers, style: s.staffStyle });
      }
      if (v.layout.piano && pianoLabels) {
        r.kb.resize(v.w, v.instH);
        r.kb.draw({
          layout: v.layout.piano,
          t: time,
          naming: s.noteNaming,
          showAllNames: false,
          keyLabels: s.showKeyLabels ? pianoLabels.map : null,
          bare: hideFrets,
          fingers: hideFrets ? [...pointers.current.values()].filter((p) => p.zone === "keys").map((p) => p.lastX) : undefined,
        });
      } else if (v.layout.fret) {
        fretted.autoFret = s.autoFret;
        fretted.tapToPlay = s.tapToPlay;
        fretted.multiNote = s.multiNote;
        fretted.columnPress = s.columnPress;
        fretted.glide = fretless;
        fretted.sustain = s.stringSustain;
        fretted.tick(now);
        const km = s.instrument === "violin" ? s.keymaps.violin : s.keymaps.guitar;
        if (!fretLabels || fretLabels.src !== km || fretLabels.rev !== rev) {
          fretLabels = { src: km, rev, strings: km.strings.map(keyLabel), frets: km.frets.map(keyLabel) };
        }
        r.fb.resize(v.w, v.instH);
        r.fb.draw({
          layout: v.layout.fret,
          t: time,
          naming: s.noteNaming,
          violin: s.instrument === "violin",
          fingers: fretted.heldFrets(),
          struckAt: fretted.struckAt,
          isStruck: (str) => fretted.isStruck(str),
          energyOf: (str) => fretted.energyOf(str),
          keyLabels: s.showKeyLabels && s.fretKeyMode === "strings" ? fretLabels : null,
          hideFrets,
        });
      }
      glider.snap = s.glideSnap;
      glider.tick(now);
      if (engine.status === "playing" && now - lastStore > 90) {
        lastStore = now;
        useApp.setState({ time });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [t]);

  // ----------------------------------------------------------- touch input
  const pointers = useRef(
    new Map<
      number,
      {
        key: string;
        midi: number;
        x0: number;
        y0: number;
        string: number;
        fret: number;
        zone: "keys" | "neck" | "pluck";
        lastX: number;
        trail: { x: number; y: number; t: number }[];
      }
    >()
  );

  /**
   * Finger speed (px/ms) from its net travel over the last ~60 ms. Per-event speed would count the 1 px jitter a
   * resting hand sends through a 1000 Hz mouse as fast bowing.
   */
  const trailSpeed = (trail: { x: number; y: number; t: number }[], x: number, y: number, t: number): number => {
    trail.push({ x, y, t });
    while (trail.length > 2 && t - trail[1].t >= 60) trail.shift();
    const o = trail[0];
    return Math.hypot(x - o.x, y - o.y) / Math.max(16, t - o.t);
  };

  /** Strings under a touch in the strike zone; a fingertip near a boundary catches both strings. */
  const stringsAt = (y: number, e: React.PointerEvent, L: FretLayout): number[] => {
    const h = viewRef.current.instH;
    const rowH = h / L.rows;
    const r = e.pointerType === "touch" ? Math.min(rowH * 0.4, Math.max(6, (e.height || 0) * 0.3)) : 0;
    return L.stringsIn(y, r, h);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const v = viewRef.current;
    if (!v.layout) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const key = `ptr:${e.pointerId}`;
    if (v.layout.piano) {
      const L = v.layout.piano;
      const s = useApp.getState().settings;
      const bare = s.glidePiano && s.hideFrets;
      const midi = bare && !L.compact ? Math.round(L.pitchAt(x)) : L.hit(x, y, v.instH * BLACK_KEY_RATIO);
      if (midi == null) return;
      const vel = pressureOf(e) || 0.55 + 0.4 * Math.min(1, y / v.instH);
      engine.press(key, midi, vel);
      if (s.glidePiano) glider.start(key, bare && !L.compact ? L.pitchAt(x) : midi);
      pointers.current.set(e.pointerId, { key, midi, x0: x, y0: y, string: -1, fret: -1, zone: "keys", lastX: x, trail: [] });
    } else if (v.layout.fret && renderers.current) {
      const L = v.layout.fret;
      const base = { key, midi: -1, x0: x, y0: y, lastX: x, trail: [{ x, y, t: e.timeStamp }] };
      if (L.inPluckZone(x)) {
        const pressure = pressureOf(e);
        const vel = pressure ? 0.4 + pressure * 0.6 : 0.82;
        fretted.strikeSync(e.pointerId, stringsAt(y, e, L), vel);
        pointers.current.set(e.pointerId, { ...base, string: -1, fret: -1, zone: "pluck" });
      } else {
        const string = L.stringAt(y, v.instH);
        const fret = L.fretAt(x);
        fretted.neckDown(e.pointerId, string, fret, stringsAt(y, e, L), L.posAt(x));
        pointers.current.set(e.pointerId, { ...base, string, fret, zone: "neck" });
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointers.current.get(e.pointerId);
    const v = viewRef.current;
    if (!p || !v.layout) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (v.layout.piano) {
      p.lastX = x;
      if (glider.has(p.key)) {
        const L = v.layout.piano;
        const s = useApp.getState().settings;
        const bare = s.hideFrets && !L.compact;
        glider.move(p.key, bare ? L.pitchAt(x) : p.midi + L.pitchAt(x) - L.pitchAt(p.x0));
        return;
      }
      const midi = v.layout.piano.hit(x, y, v.instH * BLACK_KEY_RATIO);
      if (midi != null && midi !== p.midi) {
        engine.release(p.key);
        engine.press(p.key, midi, 0.7);
        p.midi = midi;
      }
    } else if (v.layout.fret) {
      const L = v.layout.fret;
      const count = L.rows;
      const speed = trailSpeed(p.trail, x, y, e.timeStamp);
      if (p.zone === "pluck") {
        // Faster strums hit harder.
        p.lastX = x;
        fretted.strikeSync(e.pointerId, stringsAt(y, e, L), Math.max(0.45, Math.min(1, 0.5 + speed * 0.35)));
        // Moving on a string bows it (violin) or keeps it vibrating (guitar).
        fretted.stroke(e.pointerId, speed);
      } else {
        const pos = L.posAt(x);
        const fret = fretted.glide ? Math.round(pos) : Math.min(L.fretAt(x), L.lastFret);
        if (fretted.multiNote) fretted.neckTouch(e.pointerId, stringsAt(y, e, L));
        if (fretted.glide) {
          // Fretless: the pitch follows the finger; moving keeps the string alive, a vertical wobble adds vibrato.
          fretted.neckMove(e.pointerId, fret, pos);
          p.fret = fret;
          fretted.vibrate(e.pointerId, speed);
          if (!fretted.multiNote) {
            const rowH = v.instH / count;
            const cents = instrument === "violin" ? Math.max(-45, Math.min(45, (p.y0 - y) * 2.2)) : Math.min(200, (Math.abs(y - p.y0) / rowH) * 200);
            fretted.neckBend(e.pointerId, cents);
          }
        } else if (fret !== p.fret) {
          // Slide to another fret on the same string.
          fretted.neckMove(e.pointerId, fret);
          p.fret = fret;
          p.y0 = y;
        } else if (fretted.multiNote) {
          // Sliding across strings plays them instead of bending.
          fretted.vibrate(e.pointerId, speed);
        } else {
          const rowH = v.instH / count;
          const dy = Math.abs(y - p.y0);
          const cents = instrument === "violin" ? Math.max(-45, Math.min(45, (p.y0 - y) * 2.2)) : Math.min(200, (dy / rowH) * 200);
          fretted.neckBend(e.pointerId, cents);
          fretted.vibrate(e.pointerId, speed);
        }
        p.lastX = x;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    pointers.current.delete(e.pointerId);
    if (p.zone === "pluck") fretted.strikeEnd(e.pointerId);
    else if (p.zone === "neck") fretted.neckUp(e.pointerId);
    else {
      glider.end(p.key);
      engine.release(p.key);
    }
  };

  // Resize handle between the highway and the instrument.
  const dragRef = useRef<{ y0: number; h0: number } | null>(null);
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { y0: e.clientY, h0: instH };
  };
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || !size.h) return;
    const next = (d.h0 + (d.y0 - e.clientY)) / size.h;
    useApp.setState((s) => ({ settings: { ...s.settings, instrumentHeight: Math.max(INSTRUMENT_HEIGHT_RANGE[0], Math.min(INSTRUMENT_HEIGHT_RANGE[1], next)) } }));
  };
  const onHandleUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    updateSettings({ instrumentHeight: useApp.getState().settings.instrumentHeight });
  };

  const instLabel = instrument === "piano" ? t("piano") : instrument === "guitar" ? t("guitar") : t("violin");

  return (
    <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
      <canvas
        ref={staffRef}
        className="absolute inset-x-0 top-0 block w-full"
        style={{ height: staffH, display: staffH ? undefined : "none" }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0" style={{ top: staffH, height: hwH }}>
        <canvas ref={hwRef} className="block h-full w-full" aria-hidden="true" />
        {hasSong ? <Hud /> : <EmptyState />}
        <RecordingBar />
      </div>
      {!lockHeight && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("instrumentHeight")}
          className="group absolute inset-x-0 z-10 flex h-3 -translate-y-1/2 cursor-row-resize items-center justify-center touch-none"
          style={{ top: staffH + hwH }}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <div className="h-1 w-12 rounded-full bg-white/15 transition-colors group-hover:bg-brand-400/70" />
        </div>
      )}
      {showStrip && layout?.piano && (
        <div className="absolute inset-x-0" style={{ top: staffH + hwH, height: stripH }}>
          <KeyStrip piano={layout.piano} used={used} />
        </div>
      )}
      <div className="absolute inset-x-0" style={{ height: instH, bottom: edgeGap }}>
        <canvas
          ref={instRef}
          role="application"
          aria-label={instLabel}
          className="surface-touch block h-full w-full"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}
