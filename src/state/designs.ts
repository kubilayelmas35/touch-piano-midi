import { APPROACH_STYLES, BACKGROUNDS, DUST_STYLES, EFFECT_STYLES, NOTE_COLORS, NOTE_STYLES } from "../render/appearance";
import { STAFF_STYLES } from "../render/staffThemes";
import { defaultSettings, type Settings } from "./settings";

/** How many designs of each kind (the first ones of its list) are free; the rest need Pro. */
export const FREE_DESIGNS = 3;

const LISTS = {
  background: BACKGROUNDS,
  noteStyle: NOTE_STYLES,
  noteColor: NOTE_COLORS,
  effectStyle: EFFECT_STYLES,
  dust: DUST_STYLES,
  approach: APPROACH_STYLES,
  staffStyle: STAFF_STYLES,
} as const;

export type DesignKind = keyof typeof LISTS;
const KINDS = Object.keys(LISTS) as DesignKind[];

export function designLocked(kind: DesignKind, value: string, pro: boolean): boolean {
  return !pro && (LISTS[kind] as readonly string[]).indexOf(value) >= FREE_DESIGNS;
}

let defaults: Settings | null = null;

/** The settings as drawn: without Pro, a Pro design picked earlier shows as the default one (the choice is kept). */
export function visibleLook(s: Settings, pro: boolean): Settings {
  if (pro || !KINDS.some((k) => designLocked(k, s[k], false))) return s;
  defaults ??= defaultSettings();
  const out: Settings = { ...s };
  for (const k of KINDS) if (designLocked(k, s[k], false)) (out as Record<DesignKind, string>)[k] = defaults[k];
  return out;
}
