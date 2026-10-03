import { useCallback } from "react";
import { en, type DictKey } from "./en";
import { tr } from "./tr";
import { useApp } from "../state/store";
import type { Language } from "../state/settings";

const DICTS = { en, tr } as const;

export type TFn = (key: DictKey, vars?: Record<string, string | number>) => string;

export function translate(lang: Language, key: DictKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useT(): TFn {
  const lang = useApp((s) => s.settings.language);
  return useCallback<TFn>((key, vars) => translate(lang, key, vars), [lang]);
}

export function tNow(key: DictKey, vars?: Record<string, string | number>): string {
  return translate(useApp.getState().settings.language, key, vars);
}

export type { DictKey };
