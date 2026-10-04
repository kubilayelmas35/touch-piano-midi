import { useEffect } from "react";
import { unlockAudio } from "../audio/context";
import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { fretted } from "../input/fretted";
import { isEditableTarget } from "../input/keyboard";
import { keyboardBase, keyboardOctaveNow } from "../input/keyboardBase";
import { cycleLoop, importFiles, updateSession, updateSettings } from "../state/actions";
import { setPanel, toast, useApp } from "../state/store";
import { chooseAudio } from "../studio/studioStore";

/** Keyboard shortcuts, computer-keyboard notes, drag & drop import and background auto-pause. */
export function useGlobalInput(): void {
  useEffect(() => {
    /** Keys held down and what they do. */
    const down = new Map<string, "note" | "fret" | "string">();

    const anyDialogOpen = () => {
      const s = useApp.getState();
      return !!(s.panel || s.results || s.welcomeOpen);
    };

    /** Which instrument action a key triggers under the current settings. */
    const actionFor = (code: string): { kind: "note"; offset: number } | { kind: "fret" | "string"; index: number } | null => {
      const s = useApp.getState().settings;
      if (s.instrument !== "piano" && s.fretKeyMode === "strings") {
        const km = s.instrument === "violin" ? s.keymaps.violin : s.keymaps.guitar;
        const si = km.strings.indexOf(code);
        if (si >= 0) return { kind: "string", index: si };
        const fi = km.frets.indexOf(code);
        if (fi >= 0) return { kind: "fret", index: fi + 1 };
        return null;
      }
      const offset = s.keymaps.piano[code];
      return offset === undefined ? null : { kind: "note", offset };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        if (!e.repeat) engine.setSustain(true, "shift");
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const st = useApp.getState();

      if (anyDialogOpen()) return;

      const action = actionFor(e.code);
      if (action) {
        e.preventDefault();
        if (e.repeat || down.has(e.code)) return;
        down.set(e.code, action.kind);
        void unlockAudio();
        if (action.kind === "note") engine.press(`key:${e.code}`, keyboardBase(st.settings) + action.offset, 0.8);
        else if (action.kind === "string") fretted.stringKeyDown(e.code, action.index);
        else fretted.fretKeyDown(e.code, action.index);
        return;
      }
      if (e.repeat && e.code !== "ArrowLeft" && e.code !== "ArrowRight") return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur?.();
          if (engine.notes.length || engine.status === "playing") engine.toggle();
          break;
        case "ArrowLeft":
          e.preventDefault();
          engine.seek(engine.time - (e.shiftKey ? 10 : 5));
          useApp.setState({ time: engine.time });
          break;
        case "ArrowRight":
          e.preventDefault();
          engine.seek(engine.time + (e.shiftKey ? 10 : 5));
          useApp.setState({ time: engine.time });
          break;
        case "ArrowUp":
          e.preventDefault();
          updateSession({ speed: Math.min(1.5, Math.round((st.session.speed + 0.05) * 100) / 100) });
          break;
        case "ArrowDown":
          e.preventDefault();
          updateSession({ speed: Math.max(0.25, Math.round((st.session.speed - 0.05) * 100) / 100) });
          break;
        case "Home":
        case "Backspace":
          e.preventDefault();
          engine.stop();
          break;
        case "KeyB":
        case "F2":
          e.preventDefault();
          cycleLoop();
          break;
        case "KeyN":
        case "F4":
          e.preventDefault();
          updateSession({ waitMode: !st.session.waitMode });
          toast(`${tNow("waitMode")}: ${tNow(!st.session.waitMode ? "on" : "off")}`, "info", 1400);
          break;
        case "KeyM":
        case "F8":
          e.preventDefault();
          updateSettings({ metronome: !st.settings.metronome });
          toast(`${tNow("metronome")}: ${tNow(!st.settings.metronome ? "on" : "off")}`, "info", 1400);
          break;
        case "KeyZ":
        case "PageDown":
        case "KeyX":
        case "PageUp": {
          e.preventDefault();
          const up = e.code === "KeyX" || e.code === "PageUp";
          const oct = Math.max(1, Math.min(7, keyboardOctaveNow(st.settings) + (up ? 1 : -1)));
          updateSettings({ keyboardOctave: oct, autoOctave: false });
          toast(tNow("keyboardOctaveNow", { o: `C${oct}` }), "info", 1400);
          break;
        }
        case "Slash":
          e.preventDefault();
          setPanel("library");
          break;
        case "Comma":
          setPanel("settings");
          break;
      }
    };

    const releaseKey = (code: string) => {
      const kind = down.get(code);
      down.delete(code);
      if (kind === "note") engine.release(`key:${code}`);
      else if (kind === "string") fretted.stringKeyUp(code);
      else if (kind === "fret") fretted.fretKeyUp(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") engine.setSustain(false, "shift");
      if (down.has(e.code)) releaseKey(e.code);
    };

    const releaseKeys = () => {
      for (const code of [...down.keys()]) releaseKey(code);
      engine.setSustain(false, "shift");
    };

    const onVisibility = () => {
      if (document.hidden) {
        releaseKeys();
        fretted.reset();
        engine.releaseAll();
        if (engine.status === "playing") {
          engine.pause();
          toast(tNow("pausedHidden"), "info", 3500);
        }
      }
    };

    const firstGesture = () => {
      void unlockAudio();
    };

    // Drag & drop MIDI anywhere.
    let dragDepth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth++;
      useApp.setState({ dragOver: true });
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) useApp.setState({ dragOver: false });
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      useApp.setState({ dragOver: false });
      const all = Array.from(e.dataTransfer?.files ?? []);
      const audio = all.find((f) => f.type.startsWith("audio/") && !/midi/i.test(f.type));
      const files = all.filter((f) => f !== audio);
      if (audio && !files.length) {
        chooseAudio(audio);
        setPanel("studio");
        return;
      }
      if (files.length) void importFiles(files).then((ok) => ok && setPanel(null));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseKeys);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", firstGesture, { capture: true });
    window.addEventListener("keydown", firstGesture, { capture: true, once: true });
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseKeys);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", firstGesture, { capture: true });
      window.removeEventListener("keydown", firstGesture, { capture: true });
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
}
