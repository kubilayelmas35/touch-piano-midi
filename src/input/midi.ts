import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { toast, useApp } from "../state/store";

let access: MIDIAccess | null = null;
let started = false;
const known = new Set<string>();

function selectedInput(): string {
  return useApp.getState().settings.midiInput;
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
  const key = `midi:${this.id}:${channel}:${d1}`;
  if (status === 0x90 && d2 > 0) {
    engine.press(key, d1, Math.max(0.08, d2 / 127));
  } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
    engine.release(key);
  } else if (status === 0xb0 && d1 === 64) {
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
