import { useEffect, useRef, useState } from "react";
import { audioCtx, unlockAudio } from "../audio/context";
import { playNote, type Voice } from "../audio/sampler";
import { engine } from "../engine/engine";
import { PianoLayout } from "../engine/layout";
import { useT } from "../i18n";
import { isBlack, noteName } from "../lib/notes";
import { toast, useApp } from "../state/store";
import {
  addNote,
  editableTracks,
  gridStep,
  moveNotes,
  pitchSpan,
  removeNotes,
  removeShort,
  resizeNotes,
  setDuration,
  snap,
  songEnd,
  visibleNotes,
  type EditDoc,
  type EditNote,
} from "../studio/editModel";
import { closeEditor, commit, redo, saveEditor, undo, useEditor, type EditMode } from "../studio/editorStore";
import { IconClose, IconPause, IconPlay, IconTrash } from "../ui/icons";
import { Button, IconButton, Segmented, cx } from "../ui/primitives";
import { Toasts } from "./Toasts";

const TRACK_COLORS = ["#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#fb923c", "#a3e635", "#f87171"];
const MIN_PPS = 30;
const MAX_PPS = 700;

type Drag =
  | { kind: "pan"; id: number; x: number; y: number; t0: number; pan: number; moved: boolean }
  | { kind: "move"; id: number; x: number; y: number; base: EditDoc; ids: number[]; anchor: EditNote; startMidi: number; moved: boolean; lastMidi: number }
  | { kind: "resize"; id: number; y: number; base: EditDoc; ids: number[]; anchor: EditNote; moved: boolean }
  | { kind: "create"; id: number; y: number; base: EditDoc; noteId: number; note: EditNote }
  | { kind: "erase"; id: number; removed: number[] }
  | { kind: "key"; id: number; voice: Voice | null };

interface View {
  /** Song time at the line above the keyboard. */
  t0: number;
  /** Pixels per second. */
  pps: number;
  /** Horizontal scroll of a zoomed keyboard, 0–1. */
  pan: number;
}

/** Falling-notes editor for a library song: tap, drag and resize notes on the same view the game uses. */
export function NoteEditor() {
  const open = useApp((s) => s.panel === "editor");
  const hasDoc = useEditor((s) => !!s.doc);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && hasDoc && !d.open) d.showModal();
    else if ((!open || !hasDoc) && d.open) d.close();
  }, [open, hasDoc]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (useEditor.getState().selected.length) useEditor.setState({ selected: [] });
        else closeEditor();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-ink-950 p-0 text-mist-100"
    >
      {open && hasDoc && <EditorBody />}
      {open && <Toasts />}
    </dialog>
  );
}

function EditorBody() {
  const t = useT();
  const doc = useEditor((s) => s.doc)!;
  const selected = useEditor((s) => s.selected);
  const mode = useEditor((s) => s.mode);
  const snapOn = useEditor((s) => s.snap);
  const track = useEditor((s) => s.track);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const dirty = useEditor((s) => s.dirty);
  const saving = useEditor((s) => s.saving);
  const naming = useApp((s) => s.settings.noteNaming);
  const [playing, setPlaying] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const first = visibleNotes(doc)[0];
  const viewRef = useRef<View>({ t0: Math.max(-0.3, (first?.time ?? 0) - 0.3), pps: 150, pan: 0.5 });
  const previewRef = useRef<EditDoc | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const layoutRef = useRef<{ piano: PianoLayout; w: number; h: number; keyH: number; hitY: number } | null>(null);
  const dirtyDraw = useRef(true);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const newLen = useRef(60 / doc.bpm);
  const play = useRef<{ ctxStart: number; songStart: number; until: number; voices: Voice[] } | null>(null);

  const step = gridStep(doc);
  const tracks = editableTracks(doc);
  const sel = doc.notes.filter((n) => selected.includes(n.id));

  const redraw = () => {
    dirtyDraw.current = true;
  };

  useEffect(() => {
    void engine.ensureAudio();
  }, []);

  useEffect(redraw, [doc, selected, mode]);

  // ------------------------------------------------------------ geometry

  const current = () => previewRef.current ?? useEditor.getState().doc!;

  const yOf = (time: number) => {
    const L = layoutRef.current!;
    const v = viewRef.current;
    return L.hitY - (time - v.t0) * v.pps;
  };
  const timeAt = (y: number) => {
    const L = layoutRef.current!;
    const v = viewRef.current;
    return v.t0 + (L.hitY - y) / v.pps;
  };
  const midiAt = (x: number) => layoutRef.current!.piano.hit(x, 0, 1);

  const rectOf = (n: EditNote) => {
    const lane = layoutRef.current!.piano.lane(n.midi);
    if (!lane) return null;
    const bottom = yOf(n.time);
    const top = Math.min(bottom - 5, yOf(n.time + n.duration));
    return { x: lane.x + 1, w: Math.max(3, lane.w - 2), top, bottom, black: lane.black };
  };

  const noteAt = (x: number, y: number, d: EditDoc = current()): EditNote | null => {
    const shown = visibleNotes(d);
    let best: EditNote | null = null;
    for (const n of shown) {
      const r = rectOf(n);
      if (!r) continue;
      if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.top - 3 && y <= r.bottom + 3) {
        // Black-key notes sit on top of white-key notes.
        if (!best || (r.black && !isBlack(best.midi))) best = n;
      }
    }
    return best;
  };

  // ------------------------------------------------------------ sound

  const instrument = () => engine.instrumentId;

  const preview = (midi: number, velocity = 0.75, duration = 0.5) => {
    void unlockAudio();
    playNote(instrument(), midi, velocity, { duration: Math.min(1.2, Math.max(0.15, duration)) });
  };

  const stopPlayback = () => {
    const p = play.current;
    if (!p) return;
    for (const v of p.voices) v.stop(0.08);
    play.current = null;
    setPlaying(false);
    redraw();
  };

  const startPlayback = async () => {
    await unlockAudio();
    if (!(await engine.ensureAudio())) return;
    const ctx = audioCtx();
    const start = Math.max(0, viewRef.current.t0);
    play.current = { ctxStart: ctx.currentTime + 0.08, songStart: start, until: start, voices: [] };
    setPlaying(true);
  };

  useEffect(() => () => stopPlayback(), []);

  // ------------------------------------------------------------ drawing

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const relayout = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.round(w * dpr);
      const bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(wrap);
    relayout();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = play.current;
      const d = useEditor.getState().doc;
      if (!d) return;
      if (p) {
        const ac = audioCtx();
        const now = p.songStart + Math.max(0, ac.currentTime - p.ctxStart);
        const ahead = now + 0.3;
        for (const n of visibleNotes(d)) {
          if (n.time < p.until || n.time >= ahead || n.time < p.songStart) continue;
          const v = playNote(instrument(), n.midi, n.velocity, { when: p.ctxStart + (n.time - p.songStart), duration: n.duration });
          if (v) p.voices.push(v);
        }
        p.until = ahead;
        if (p.voices.length > 200) p.voices = p.voices.filter((v) => !v.done);
        viewRef.current.t0 = now;
        dirtyDraw.current = true;
        if (now > songEnd(d) + 1) stopPlayback();
      }
      if (!dirtyDraw.current) return;
      dirtyDraw.current = false;
      draw(ctx, wrap.clientWidth, wrap.clientHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = (g: CanvasRenderingContext2D, w: number, h: number) => {
    const d = current();
    const st = useEditor.getState();
    const [lo, hi] = pitchSpan(d);
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    let whites = 0;
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++;
    const zoom = Math.max(1, ((coarse ? 30 : 20) * whites) / Math.max(1, w));
    const v = viewRef.current;
    const piano = new PianoLayout(lo, hi, w, { zoom, pan: v.pan });
    const keyH = Math.round(Math.max(56, Math.min(110, h * 0.15)));
    const hitY = h - keyH;
    layoutRef.current = { piano, w, h, keyH, hitY };

    g.clearRect(0, 0, w, h);
    g.fillStyle = "#0b0a14";
    g.fillRect(0, 0, w, hitY);

    // Lanes: darker black-key columns, a line at every C.
    for (const m of piano.keys) {
      const l = piano.lane(m)!;
      if (l.black) {
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(l.x, 0, l.w, hitY);
      } else if (m % 12 === 0) {
        g.fillStyle = "rgba(255,255,255,0.09)";
        g.fillRect(l.x, 0, 1, hitY);
      }
    }

    // Beat and bar lines with bar numbers.
    const beat = 60 / d.bpm;
    const perBar = Math.max(1, d.timeSignature[0]);
    const tTop = timeAt(0);
    const tBottom = timeAt(hitY);
    const firstBeat = Math.max(0, Math.floor(tBottom / beat));
    g.font = "600 10px system-ui, sans-serif";
    g.textBaseline = "bottom";
    for (let b = firstBeat; b * beat <= tTop; b++) {
      const y = Math.round(yOf(b * beat)) + 0.5;
      const bar = b % perBar === 0;
      g.fillStyle = bar ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)";
      g.fillRect(0, y, w, 1);
      if (bar && v.pps * beat * perBar > 26) {
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.fillText(String(b / perBar + 1), 4, y - 2);
      }
    }
    if (st.snap && v.pps * step > 10) {
      g.fillStyle = "rgba(255,255,255,0.025)";
      const s0 = Math.max(0, Math.floor(tBottom / step));
      for (let s = s0; s * step <= tTop; s++) if (s % 4) g.fillRect(0, Math.round(yOf(s * step)), w, 1);
    }

    // Notes.
    const shown = visibleNotes(d).filter((n) => n.time <= tTop + 0.1 && n.time + n.duration >= tBottom - 0.1);
    const ordered = [...shown].sort((a, b) => Number(isBlack(a.midi)) - Number(isBlack(b.midi)));
    const selSet = new Set(st.selected);
    const sounding = new Set<number>();
    for (const n of ordered) {
      const r = rectOf(n);
      if (!r) continue;
      const color = TRACK_COLORS[n.track % TRACK_COLORS.length];
      const isSel = selSet.has(n.id);
      const top = Math.max(-4, r.top);
      const bottom = Math.min(hitY, r.bottom);
      if (bottom <= top) continue;
      if (n.time <= v.t0 && n.time + n.duration > v.t0) sounding.add(n.midi);
      g.globalAlpha = isSel ? 1 : 0.82;
      g.fillStyle = color;
      roundRect(g, r.x, top, r.w, bottom - top, Math.min(5, r.w / 3));
      g.fill();
      g.globalAlpha = 1;
      if (isSel) {
        g.strokeStyle = "#ffffff";
        g.lineWidth = 2;
        roundRect(g, r.x + 1, top + 1, r.w - 2, bottom - top - 2, Math.min(4, r.w / 3));
        g.stroke();
        if (r.top > -4) {
          g.fillStyle = "#ffffff";
          g.fillRect(r.x + r.w * 0.2, r.top + 2, r.w * 0.6, 3);
        }
      }
    }

    // Line at the keyboard (the playback position).
    g.fillStyle = play.current ? "rgba(56,189,248,0.9)" : "rgba(167,139,250,0.7)";
    g.fillRect(0, hitY - 2, w, 2);

    // Keyboard.
    g.fillStyle = "#14121f";
    g.fillRect(0, hitY, w, keyH);
    const blackH = keyH * 0.6;
    for (const m of piano.keys) {
      const l = piano.lane(m)!;
      if (l.black) continue;
      g.fillStyle = sounding.has(m) ? "#c4b5fd" : "#ecebf3";
      g.fillRect(l.x + 0.5, hitY, l.w - 1, keyH - 1);
      if (m % 12 === 0 && l.w > 14) {
        g.fillStyle = "#6b6880";
        g.font = "600 10px system-ui, sans-serif";
        g.textBaseline = "bottom";
        g.textAlign = "center";
        g.fillText(noteName(m, naming, true), l.x + l.w / 2, hitY + keyH - 4);
        g.textAlign = "left";
      }
    }
    for (const m of piano.keys) {
      const l = piano.lane(m)!;
      if (!l.black) continue;
      g.fillStyle = sounding.has(m) ? "#8b5cf6" : "#1d1b29";
      roundRect(g, l.x, hitY, l.w, blackH, 3);
      g.fill();
    }
  };

  // ------------------------------------------------------------ pointer input

  const pos = (e: React.PointerEvent | React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const setPreview = (d: EditDoc | null) => {
    previewRef.current = d;
    redraw();
  };

  const createAt = (x: number, y: number, pointerId: number) => {
    const midi = midiAt(x);
    if (midi == null) return;
    const st = useEditor.getState();
    const base = st.doc!;
    let time = Math.max(0, timeAt(y));
    if (st.snap) time = Math.max(0, Math.floor(time / step) * step);
    const target = base.tracks[st.track] && !base.tracks[st.track].drum ? st.track : (editableTracks(base)[0] ?? 0);
    const { doc: next, id } = addNote(base, { midi, time, duration: newLen.current, velocity: 0.75, track: target });
    const note = next.notes.find((n) => n.id === id)!;
    dragRef.current = { kind: "create", id: pointerId, y, base: next, noteId: id, note };
    setPreview(next);
    preview(midi);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) return;
    const L = layoutRef.current;
    if (!L) return;
    const { x, y } = pos(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    const st = useEditor.getState();

    if (y >= L.hitY) {
      const m = L.piano.hit(x, y - L.hitY, L.keyH * 0.6);
      if (m == null) return;
      void unlockAudio();
      dragRef.current = { kind: "key", id: e.pointerId, voice: playNote(instrument(), m, 0.8) };
      return;
    }

    const hit = noteAt(x, y);
    if (st.mode === "erase") {
      const removed = hit ? [hit.id] : [];
      dragRef.current = { kind: "erase", id: e.pointerId, removed };
      if (hit) setPreview(removeNotes(st.doc!, removed));
      return;
    }

    if (hit) {
      const multi = e.shiftKey || e.ctrlKey || e.metaKey;
      let ids = st.selected.includes(hit.id) ? st.selected : [hit.id];
      if (multi) ids = st.selected.includes(hit.id) ? st.selected.filter((i) => i !== hit.id) : [...st.selected, hit.id];
      useEditor.setState({ selected: ids, track: hit.track });
      if (multi && !ids.includes(hit.id)) return;
      preview(hit.midi, hit.velocity, hit.duration);
      const r = rectOf(hit)!;
      const edge = Math.max(8, Math.min(16, (r.bottom - r.top) * 0.3));
      if (y <= r.top + edge) dragRef.current = { kind: "resize", id: e.pointerId, y, base: st.doc!, ids, anchor: hit, moved: false };
      else {
        dragRef.current = { kind: "move", id: e.pointerId, x, y, base: st.doc!, ids, anchor: hit, startMidi: hit.midi, moved: false, lastMidi: hit.midi };
      }
      return;
    }

    if (st.mode === "add") {
      createAt(x, y, e.pointerId);
      return;
    }

    const now = performance.now();
    const tap = lastTap.current;
    if (tap && now - tap.at < 320 && Math.hypot(tap.x - x, tap.y - y) < 24) {
      lastTap.current = null;
      createAt(x, y, e.pointerId);
      return;
    }
    const v = viewRef.current;
    dragRef.current = { kind: "pan", id: e.pointerId, x, y, t0: v.t0, pan: v.pan, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const dr = dragRef.current;
    if (!dr || dr.id !== e.pointerId) return;
    const { x, y } = pos(e);
    const st = useEditor.getState();
    const L = layoutRef.current!;
    const v = viewRef.current;

    switch (dr.kind) {
      case "pan": {
        if (Math.hypot(x - dr.x, y - dr.y) > 5) dr.moved = true;
        if (!dr.moved) return;
        const end = songEnd(st.doc!) + 2;
        v.t0 = Math.max(-0.5, Math.min(end, dr.t0 + (y - dr.y) / v.pps));
        const spare = L.piano.fullW - L.w;
        if (spare > 0) v.pan = Math.max(0, Math.min(1, dr.pan - (x - dr.x) / spare));
        redraw();
        return;
      }
      case "move": {
        if (!dr.moved && Math.hypot(x - dr.x, y - dr.y) < 5) return;
        dr.moved = true;
        let dt = (dr.y - y) / v.pps;
        if (st.snap) dt = snap(dr.anchor.time + dt, step) - dr.anchor.time;
        const m = midiAt(x);
        const dm = m == null ? dr.lastMidi - dr.startMidi : m - dr.startMidi;
        if (m != null && m !== dr.lastMidi) {
          dr.lastMidi = m;
          preview(dr.anchor.midi + dm, dr.anchor.velocity, 0.3);
        }
        setPreview(moveNotes(dr.base, dr.ids, dt, dm));
        return;
      }
      case "resize": {
        dr.moved = true;
        let end = timeAt(y);
        if (st.snap) end = snap(end, step);
        const delta = end - (dr.anchor.time + dr.anchor.duration);
        setPreview(resizeNotes(dr.base, dr.ids, delta));
        return;
      }
      case "create": {
        let end = timeAt(y);
        if (st.snap) end = snap(end, step);
        const len = Math.abs(dr.y - y) > 6 ? Math.max(st.snap ? step : 0.05, end - dr.note.time) : newLen.current;
        setPreview(setDuration(dr.base, dr.noteId, len));
        return;
      }
      case "erase": {
        const base = previewRef.current ?? st.doc!;
        const hit = noteAt(x, y, base);
        if (hit) {
          dr.removed.push(hit.id);
          setPreview(removeNotes(base, [hit.id]));
        }
        return;
      }
      case "key":
        return;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const dr = dragRef.current;
    if (!dr || dr.id !== e.pointerId) return;
    dragRef.current = null;
    const next = previewRef.current;
    previewRef.current = null;
    const { x, y } = pos(e);
    switch (dr.kind) {
      case "key":
        dr.voice?.stop();
        break;
      case "pan":
        if (!dr.moved) {
          useEditor.setState({ selected: [] });
          lastTap.current = { at: performance.now(), x, y };
        }
        break;
      case "move":
      case "resize":
        if (dr.moved && next) commit(next, dr.ids);
        break;
      case "create":
        if (next) {
          const made = next.notes.find((n) => n.id === dr.noteId);
          if (made) newLen.current = made.duration;
          commit(next, [dr.noteId]);
        }
        break;
      case "erase":
        if (next && dr.removed.length) commit(next, []);
        break;
    }
    redraw();
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const v = viewRef.current;
    const L = layoutRef.current;
    if (!L) return;
    if (e.ctrlKey || e.metaKey) {
      const { y } = pos(e);
      const anchor = timeAt(y);
      v.pps = Math.max(MIN_PPS, Math.min(MAX_PPS, v.pps * Math.exp(-e.deltaY * 0.002)));
      v.t0 = anchor - (L.hitY - y) / v.pps;
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const spare = L.piano.fullW - L.w;
      if (spare > 0) v.pan = Math.max(0, Math.min(1, v.pan + (e.deltaX || e.deltaY) / spare));
    } else {
      const end = songEnd(useEditor.getState().doc!) + 2;
      v.t0 = Math.max(-0.5, Math.min(end, v.t0 - e.deltaY / v.pps));
    }
    redraw();
  };

  // Wheel must not scroll the page behind; React's onWheel is passive.
  useEffect(() => {
    const c = canvasRef.current!;
    const stop = (e: WheelEvent) => e.preventDefault();
    c.addEventListener("wheel", stop, { passive: false });
    return () => c.removeEventListener("wheel", stop);
  }, []);

  // ------------------------------------------------------------ commands

  const setMode = (m: EditMode) => useEditor.setState({ mode: m });
  const deleteSelected = () => {
    if (selected.length) commit(removeNotes(doc, selected), []);
  };
  const lengthen = (dir: 1 | -1) => {
    if (selected.length) commit(resizeNotes(doc, selected, dir * step));
  };
  const zoom = (f: number) => {
    const v = viewRef.current;
    v.pps = Math.max(MIN_PPS, Math.min(MAX_PPS, v.pps * f));
    redraw();
  };
  const cleanup = () => {
    const { doc: next, removed } = removeShort(doc, Math.min(0.12, step));
    if (removed) commit(next, []);
    toast(t("editCleaned", { n: removed }), removed ? "success" : "info");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      const st = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.code === "KeyY") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.code === "KeyS") {
        e.preventDefault();
        void saveEditor();
        return;
      }
      if (mod && e.code === "KeyA") {
        e.preventDefault();
        useEditor.setState({ selected: visibleNotes(st.doc!).map((n) => n.id) });
        return;
      }
      if (mod) return;
      const ids = st.selected;
      const d = st.doc!;
      switch (e.code) {
        case "Delete":
        case "Backspace":
          e.preventDefault();
          if (ids.length) commit(removeNotes(d, ids), []);
          break;
        case "ArrowUp":
        case "ArrowDown":
          if (!ids.length) break;
          e.preventDefault();
          commit(moveNotes(d, ids, 0, (e.code === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 12 : 1)));
          break;
        case "ArrowLeft":
        case "ArrowRight":
          if (!ids.length) break;
          e.preventDefault();
          if (e.shiftKey) commit(resizeNotes(d, ids, (e.code === "ArrowRight" ? 1 : -1) * gridStep(d)));
          else commit(moveNotes(d, ids, (e.code === "ArrowRight" ? 1 : -1) * gridStep(d), 0));
          break;
        case "Space":
          e.preventDefault();
          if (play.current) stopPlayback();
          else void startPlayback();
          break;
        case "Digit1":
          setMode("select");
          break;
        case "Digit2":
          setMode("add");
          break;
        case "Digit3":
          setMode("erase");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const info =
    sel.length === 1
      ? `${noteName(sel[0].midi, naming, true)} · ${sel[0].duration.toFixed(2)} ${t("secondsShort")}`
      : sel.length > 1
        ? t("editSelected", { n: sel.length })
        : t(mode === "add" ? "editHintAdd" : mode === "erase" ? "editHintErase" : "editHintSelect");

  return (
    <div className="flex h-full flex-col pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.06] bg-ink-900/90 px-2 py-1.5">
        <IconButton label={t("close")} onClick={() => closeEditor()}>
          <IconClose size={19} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">
            {doc.title}
            {dirty && <span className="text-brand-300"> •</span>}
          </div>
          <div className="truncate text-[11px] text-mist-400">{t("editTitle")}</div>
        </div>
        <Button size="sm" variant="ghost" disabled={!canUndo} onClick={undo}>
          {t("editUndo")}
        </Button>
        <Button size="sm" variant="ghost" disabled={!canRedo} onClick={redo} className="max-sm:hidden">
          {t("editRedo")}
        </Button>
        <Button size="sm" variant="primary" disabled={!dirty || saving} onClick={() => void saveEditor()}>
          {t("editSave")}
        </Button>
      </div>

      <div className="scroll-thin flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-white/[0.06] bg-ink-900/70 px-2 py-1.5">
        <IconButton label={playing ? t("pause") : t("play")} onClick={() => (playing ? stopPlayback() : void startPlayback())}>
          {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        </IconButton>
        <Segmented
          size="sm"
          label={t("editMode")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "select", label: t("editModeSelect") },
            { value: "add", label: t("editModeAdd") },
            { value: "erase", label: t("editModeErase") },
          ]}
        />
        {tracks.length > 1 && (
          <select
            value={track}
            onChange={(e) => useEditor.setState({ track: Number(e.target.value) })}
            aria-label={t("editTrack")}
            className="h-8 shrink-0 rounded-lg border border-white/[0.1] bg-black/30 px-2 text-xs font-semibold"
            style={{ color: TRACK_COLORS[track % TRACK_COLORS.length] }}
          >
            {tracks.map((i) => (
              <option key={i} value={i}>
                {doc.tracks[i].name}
              </option>
            ))}
          </select>
        )}
        <div className="mx-0.5 h-6 w-px shrink-0 bg-white/10" />
        <Button size="sm" variant="subtle" disabled={!selected.length} onClick={() => lengthen(-1)}>
          {t("editShorten")}
        </Button>
        <Button size="sm" variant="subtle" disabled={!selected.length} onClick={() => lengthen(1)}>
          {t("editLengthen")}
        </Button>
        <IconButton size="sm" label={t("delete")} disabled={!selected.length} onClick={deleteSelected} className="hover:!text-rose-300">
          <IconTrash size={16} />
        </IconButton>
        <div className="mx-0.5 h-6 w-px shrink-0 bg-white/10" />
        <Button size="sm" variant={snapOn ? "primary" : "subtle"} onClick={() => useEditor.setState({ snap: !snapOn })}>
          {t("editSnap")}
        </Button>
        <Button size="sm" variant="subtle" onClick={cleanup} title={t("editCleanupHint")}>
          {t("editCleanup")}
        </Button>
        <div className="mx-0.5 h-6 w-px shrink-0 bg-white/10" />
        <Button size="sm" variant="ghost" onClick={() => zoom(1 / 1.25)} aria-label={t("editZoomOut")}>
          −
        </Button>
        <Button size="sm" variant="ghost" onClick={() => zoom(1.25)} aria-label={t("editZoomIn")}>
          +
        </Button>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 bg-ink-950 px-3 py-1 text-[11px] text-mist-400">
        <span className="line-clamp-2 min-w-0 leading-snug">{info}</span>
        <span className="shrink-0 tabular-nums">{t("notesCount", { n: visibleNotes(doc).length })}</span>
      </div>

      <div ref={wrapRef} className="relative min-h-0 flex-1 touch-none overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          className={cx("absolute inset-0 block h-full w-full", mode === "add" ? "cursor-crosshair" : mode === "erase" ? "cursor-not-allowed" : "cursor-default")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
