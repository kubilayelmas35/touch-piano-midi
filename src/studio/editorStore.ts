import { create } from "zustand";
import { canImport } from "../auth/account";
import { cloudAfterEdit } from "../auth/cloud";
import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { parseMidi } from "../midi/song";
import { openSong, refreshLibrary } from "../state/actions";
import { setPanel, toast, useApp } from "../state/store";
import { getSong, putSong } from "../storage/db";
import { docFromMidi, docToSpec, editableTracks, type EditDoc } from "./editModel";
import { writeMidi } from "./midiFile";

export type EditMode = "select" | "add" | "erase";

interface EditorState {
  songId: string | null;
  doc: EditDoc | null;
  selected: number[];
  mode: EditMode;
  snap: boolean;
  /** Track new notes go to. */
  track: number;
  past: EditDoc[];
  future: EditDoc[];
  dirty: boolean;
  saving: boolean;
}

const HISTORY = 200;

export const useEditor = create<EditorState>(() => ({
  songId: null,
  doc: null,
  selected: [],
  mode: "select",
  snap: true,
  track: 0,
  past: [],
  future: [],
  dirty: false,
  saving: false,
}));

/** Opens a library song in the note editor (Pro). */
export async function openEditor(songId: string): Promise<void> {
  if (!canImport()) {
    setPanel("pro");
    return;
  }
  const stored = await getSong(songId);
  if (!stored) return;
  let doc: EditDoc;
  try {
    doc = docFromMidi(stored.data.slice(0), stored.title);
  } catch {
    toast(tNow("songLoadFailed"), "error");
    return;
  }
  if (engine.status === "playing") engine.pause();
  useEditor.setState({
    songId,
    doc,
    selected: [],
    mode: "select",
    track: editableTracks(doc)[0] ?? 0,
    past: [],
    future: [],
    dirty: false,
    saving: false,
  });
  setPanel("editor");
}

/** Records an edit (undoable). */
export function commit(doc: EditDoc, selected?: number[]): void {
  const s = useEditor.getState();
  if (!s.doc || doc === s.doc) return;
  useEditor.setState({
    doc,
    past: [...s.past.slice(-(HISTORY - 1)), s.doc],
    future: [],
    dirty: true,
    selected: (selected ?? s.selected).filter((id) => doc.notes.some((n) => n.id === id)),
  });
}

export function undo(): void {
  const s = useEditor.getState();
  const prev = s.past[s.past.length - 1];
  if (!prev || !s.doc) return;
  useEditor.setState({ doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], dirty: true, selected: [] });
}

export function redo(): void {
  const s = useEditor.getState();
  const next = s.future[0];
  if (!next || !s.doc) return;
  useEditor.setState({ doc: next, past: [...s.past, s.doc], future: s.future.slice(1), dirty: true, selected: [] });
}

export function closeEditor(force = false): void {
  const s = useEditor.getState();
  if (!force && s.dirty && !window.confirm(tNow("editDiscardConfirm"))) return;
  useEditor.setState({ songId: null, doc: null, selected: [], past: [], future: [], dirty: false });
  if (useApp.getState().panel === "editor") setPanel(null);
}

/** Writes the edited notes back into the library song (and its cloud copy) and reopens it. */
export async function saveEditor(): Promise<void> {
  const s = useEditor.getState();
  if (!s.doc || !s.songId || s.saving) return;
  useEditor.setState({ saving: true });
  try {
    const data = writeMidi(docToSpec(s.doc));
    const song = parseMidi(data.slice(0), s.doc.title);
    if (!song.notes.length) {
      toast(tNow("editEmpty"), "error");
      return;
    }
    const stored = await getSong(s.songId);
    if (!stored) return;
    await putSong({ ...stored, data, duration: song.duration, noteCount: song.notes.length });
    await refreshLibrary();
    void cloudAfterEdit(s.songId);
    const id = s.songId;
    closeEditor(true);
    await openSong(id);
    toast(tNow("editSaved"), "success");
  } catch (err) {
    console.warn("[editor] save failed", err);
    toast(tNow("editSaveFailed"), "error");
  } finally {
    useEditor.setState({ saving: false });
  }
}
