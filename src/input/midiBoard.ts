/** What an Impact LX25+ (and the same messages from any keyboard) should do in the app. */

export type BoardButton =
  | "play"
  | "stop"
  | "back"
  | "forward"
  | "record"
  | "metro"
  | "loop"
  | "right"
  | "left"
  | "both";

export type BoardKnob =
  | "volume"
  | "cutoff"
  | "resonance"
  | "env"
  | "glide"
  | "lfoDelay"
  | "lfoRate"
  | "lfoDepth"
  | "pan";

export type BoardAction = { t: "btn"; id: BoardButton } | { t: "knob"; id: BoardKnob; v: number };

export interface BoardHit {
  /** This message is a control, not a piano key. */
  eat: true;
  action: BoardAction | null;
}

/**
 * Factory preset 1, left to right: brightness, harmonic content, portamento, vibrato, pan.
 * The fader is volume. The modulation wheel (CC 1) is vibrato depth.
 * 80–87 repeat the same row for the learn-friendly preset.
 * Transport buttons are global on the LX25+: 102 cycle … 107 record.
 */
const KNOB: Record<number, BoardKnob> = {
  7: "volume",
  11: "volume",
  3: "volume",
  74: "cutoff",
  80: "cutoff",
  71: "resonance",
  81: "resonance",
  5: "env",
  82: "env",
  84: "glide",
  83: "glide",
  78: "lfoDelay",
  85: "lfoDelay",
  76: "lfoRate",
  86: "lfoRate",
  1: "lfoDepth",
  77: "lfoDepth",
  87: "lfoDepth",
  10: "pan",
};

/** Pitch-bend wheel. Centre is 0 cents; a full throw is two semitones either way. */
export function bendCents(lsb: number, msb: number): number {
  const raw = (lsb & 0x7f) + ((msb & 0x7f) << 7);
  return ((raw - 8192) / 8192) * 200;
}

const TRANSPORT: Record<number, BoardButton> = {
  102: "loop",
  103: "back",
  104: "forward",
  105: "stop",
  106: "play",
  107: "record",
};

/** Default pad map 1: C1–G1, below the keybed's usual C3. */
const PAD: Record<number, BoardButton> = {
  36: "play",
  37: "stop",
  38: "record",
  39: "metro",
  40: "right",
  41: "left",
  42: "both",
  43: "loop",
};

const down = new Map<number, boolean>();
let lastPad = -1000;

export function resetBoard(): void {
  down.clear();
  lastPad = -1000;
}

function rising(cc: number, on: boolean): boolean {
  const prev = down.get(cc) ?? false;
  down.set(cc, on);
  return on && !prev;
}

export function nektarDevice(name: string): boolean {
  return /impact|nektar|\blx\s?\d/i.test(name);
}

/** `status` is the high nibble (0x90 note on, 0xb0 control). `now` is milliseconds. */
export function boardHit(status: number, d1: number, d2: number, device: string, now: number): BoardHit | null {
  if (status === 0xb0) {
    const button = TRANSPORT[d1];
    if (button) {
      if (!rising(d1, d2 >= 64)) return { eat: true, action: null };
      return { eat: true, action: { t: "btn", id: button } };
    }
    const knob = KNOB[d1];
    if (knob) return { eat: true, action: { t: "knob", id: knob, v: Math.max(0, Math.min(1, d2 / 127)) } };
    return null;
  }
  if (status === 0x90 || status === 0x80) {
    if (!PAD[d1] || !nektarDevice(device)) return null;
    if (status === 0x80 || d2 === 0) return { eat: true, action: null };
    if (now - lastPad < 220) return { eat: true, action: null };
    lastPad = now;
    return { eat: true, action: { t: "btn", id: PAD[d1] } };
  }
  return null;
}
