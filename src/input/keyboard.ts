/** Computer keyboard → notes, by physical key (layout independent). */
export const NOTE_KEYS: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
};

const FALLBACK_LABELS: Record<string, string> = {
  KeyA: "a",
  KeyW: "w",
  KeyS: "s",
  KeyE: "e",
  KeyD: "d",
  KeyF: "f",
  KeyT: "t",
  KeyG: "g",
  KeyY: "y",
  KeyH: "h",
  KeyU: "u",
  KeyJ: "j",
  KeyK: "k",
  KeyO: "o",
  KeyL: "l",
  KeyP: "p",
  Semicolon: ";",
  Quote: "'",
};

let labels: Record<string, string> = { ...FALLBACK_LABELS };

interface KeyboardLayoutMap {
  get(code: string): string | undefined;
}

/** Uses the Keyboard Map API (Chromium) to show the real characters, e.g. Ş / İ on Turkish layouts. */
export async function detectKeyLabels(): Promise<void> {
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<KeyboardLayoutMap> } }).keyboard;
  if (!kb?.getLayoutMap) return;
  try {
    const map = await kb.getLayoutMap();
    const next: Record<string, string> = {};
    for (const code of Object.keys(NOTE_KEYS)) next[code] = map.get(code) ?? FALLBACK_LABELS[code];
    labels = next;
  } catch {
    /* keep fallback */
  }
}

export function keyLabelMap(baseMidi: number): Map<number, string> {
  const out = new Map<number, string>();
  for (const [code, offset] of Object.entries(NOTE_KEYS)) out.set(baseMidi + offset, labels[code]);
  return out;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
