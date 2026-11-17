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

export type BoardKnob = "volume" | "accomp" | "reverb" | "speed" | "fall" | "click" | "transpose" | "effects" | "voice";

export type BoardAction = { t: "btn"; id: BoardButton } | { t: "knob"; id: BoardKnob; v: number };

export interface BoardHit {
  /** This message is a control, not a piano key. */
  eat: true;
  action: BoardAction | null;
}

/**
 * Factory preset 1 pots, left to right, plus the fader and the learn-friendly presets.
 * Transport buttons are global on the LX25+: 102 cycle … 107 record.
 */
const KNOB: Record<number, BoardKnob> = {
  7: "volume",
  11: "volume",
  3: "volume",
  80: "volume",
  1: "accomp",
  71: "accomp",
  81: "accomp",
  74: "reverb",
  83: "reverb",
  91: "reverb",
  5: "speed",
  82: "speed",
  84: "fall",
  78: "click",
  85: "click",
  76: "transpose",
  86: "transpose",
  77: "effects",
  87: "effects",
  10: "voice",
};

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
