import { hasPro } from "../auth/account";
import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { noteName } from "../lib/notes";
import { updateSettings } from "../state/actions";
import { setPanel, toast, useApp } from "../state/store";
import { applyBoard } from "./midiControls";
import { boardHit } from "./midiBoard";
import { mapMidiNote, playedSpan, songPitchBounds, shapeVelocity, type MidiMap } from "./midiKeyboard";

let access: MIDIAccess | null = null;
let started = false;
let askedPro = false;
const known = new Set<string>();

function selectedInput(): string {
  return useApp.getState().settings.midiInput;
}

function midiMap(): MidiMap {
  const s = useApp.getState().settings;
  return { keys: s.midiKeys, low: s.midiLow, octave: s.midiOctave, transpose: s.midiTranspose, fit: s.midiFit };
}

/** Span the piano is showing for the keyboard, so a key lines up with the note it plays. */
function liveSpan(map: MidiMap): [number, number] | null {
  const { settings, song, session, duet } = useApp.getState();
  if (duet?.songId || settings.instrument !== "piano" || !map.keys) return null;
  return playedSpan(map, songPitchBounds(song, session.playTracks, session.hand));
}

function playedMidi(raw: number): number {
  const s = useApp.getState().settings;
  const map = midiMap();
  const span = liveSpan(map);
  return mapMidiNote(raw, map, span, s.midiFold && !!span);
}

function onMessage(this: MIDIInput, ev: MIDIMessageEvent): void {
  const sel = selectedInput();
  if (sel !== "all" && sel !== this.id) return;
  const data = ev.data;
  if (!data || data.length < 2) return;
  const status = data[0] & 0xf0;
  const channel = data[0] & 0x0f;
  const d1 = data[1];
  const d2 = data.length > 2 ? data[2] : 0;
  const settings = useApp.getState().settings;
  if (settings.midiChannel > 0 && channel !== settings.midiChannel - 1) return;
  const key = `midi:${this.id}:${channel}:${d1}`;
  if (!hasPro()) {
    // A MIDI keyboard is a Pro feature: the first key pressed explains it once per session.
    if (status === 0x90 && d2 > 0 && !askedPro) {
      askedPro = true;
      toast(tNow("midiPro"), "info", 5000);
      setPanel("pro");
    }
    return;
  }
  const control = boardHit(status, d1, d2, this.name || "", performance.now());
  if (control) {
    if (control.action) applyBoard(control.action);
    return;
  }
  if (status === 0x90 && d2 > 0) {
    if (useApp.getState().midiLearn === "low") {
      updateSettings({ midiLow: d1, midiOctave: 0, midiTranspose: 0, midiFit: false });
      useApp.setState({ midiLearn: null });
      toast(tNow("midiLowSet", { note: noteName(d1, useApp.getState().settings.noteNaming, true) }), "success");
    }
    const note = playedMidi(d1);
    useApp.setState({ midiHeard: note });
    engine.press(key, note, shapeVelocity(d2 / 127, useApp.getState().settings.midiVelocity));
  } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
    engine.release(key);
  } else if (status === 0xb0 && d1 === 64 && useApp.getState().settings.midiPedal) {
    engine.setSustain(d2 >= 64);
  } else if (status === 0xb0 && (d1 === 120 || d1 === 123)) {
    engine.releaseAll();
  }
}

function refresh(announce: boolean): void {
  if (!access) return;
  const devices: { id: string; name: string }[] = [];
  access.inputs.forEach((input) => {
    input.onmidimessage = onMessage;
    devices.push({ id: input.id, name: input.name || "MIDI" });
    if (!known.has(input.id)) {
      known.add(input.id);
      if (announce) toast(tNow("midiConnected", { name: input.name || "MIDI" }), "success");
    }
  });
  useApp.setState({ midiDevices: devices });
}

export async function startMidi(): Promise<void> {
  if (started || !("requestMIDIAccess" in navigator)) return;
  started = true;
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    useApp.setState({ midiAccess: "ready" });
    refresh(false);
    access.onstatechange = () => refresh(true);
  } catch (err) {
    console.warn("[midi] access denied", err);
    started = false;
    useApp.setState({ midiAccess: "denied" });
  }
}
