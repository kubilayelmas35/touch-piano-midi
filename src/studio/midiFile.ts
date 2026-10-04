import { Midi } from "@tonejs/midi";

export interface RawNote {
  midi: number;
  /** Seconds from the start. */
  time: number;
  duration: number;
  /** 0–1 */
  velocity: number;
}

export interface MidiTrackSpec {
  name: string;
  /** General MIDI program (0 piano, 24/25 guitar, 40 violin). */
  program: number;
  notes: RawNote[];
}

export interface MidiFileSpec {
  title: string;
  bpm: number;
  /** Beats per measure / beat unit, e.g. [3, 4]. */
  timeSignature?: [number, number];
  tracks: MidiTrackSpec[];
}

export const PROGRAMS = { piano: 0, guitarNylon: 24, guitarSteel: 25, violin: 40 } as const;

/** Writes a standard MIDI file (format 1); times stay in seconds through the tempo map. */
export function writeMidi(spec: MidiFileSpec): ArrayBuffer {
  const midi = new Midi();
  midi.name = spec.title;
  midi.header.setTempo(spec.bpm);
  if (spec.timeSignature) midi.header.timeSignatures.push({ ticks: 0, timeSignature: spec.timeSignature });
  midi.header.update();
  spec.tracks.forEach((t, i) => {
    if (!t.notes.length) return;
    const track = midi.addTrack();
    track.name = t.name;
    track.channel = i >= 9 ? i + 1 : i;
    track.instrument.number = t.program;
    for (const n of t.notes) {
      track.addNote({
        midi: Math.max(0, Math.min(127, Math.round(n.midi))),
        time: Math.max(0, n.time),
        duration: Math.max(0.03, n.duration),
        velocity: Math.max(0.05, Math.min(1, n.velocity)),
      });
    }
  });
  const bytes = midi.toArray();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Splits one stream of notes into right / left hand tracks at middle C (keeps a single track when one side is empty). */
export function splitHands(notes: RawNote[], program: number, split = 60): MidiTrackSpec[] {
  const right = notes.filter((n) => n.midi >= split);
  const left = notes.filter((n) => n.midi < split);
  if (!right.length || !left.length) return [{ name: right.length ? "Right hand" : "Left hand", program, notes }];
  return [
    { name: "Right hand", program, notes: right },
    { name: "Left hand", program, notes: left },
  ];
}

/** Safe file name for exporting. */
export function midiFileName(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\w\s.-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "sonatrio"}.mid`;
}
