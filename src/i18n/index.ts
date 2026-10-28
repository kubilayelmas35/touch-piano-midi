import { useCallback } from "react";
import { en, type DictKey } from "./en";
import { tr } from "./tr";
import { ja } from "./ja";
import { ko } from "./ko";
import { zh } from "./zh";
import { zht } from "./zht";
import { id } from "./id";
import { es } from "./es";
import { pt } from "./pt";
import { de } from "./de";
import { fr } from "./fr";
import { it } from "./it";
import { nl } from "./nl";
import { pl } from "./pl";
import { ru } from "./ru";
import { ar } from "./ar";
import { vi } from "./vi";
import { th } from "./th";
import { sv } from "./sv";
import { hi } from "./hi";
import { uk } from "./uk";
import { cs } from "./cs";
import { ro } from "./ro";
import { el } from "./el";
import { hu } from "./hu";
import { da } from "./da";
import { fi } from "./fi";
import { no } from "./no";
import { sk } from "./sk";
import { bg } from "./bg";
import { hr } from "./hr";
import { he } from "./he";
import { ms } from "./ms";
import { fa } from "./fa";
import { bn } from "./bn";
import { ca } from "./ca";
import { sr } from "./sr";
import { sl } from "./sl";
import { fil } from "./fil";
import { ta } from "./ta";
import { te } from "./te";
import { mr } from "./mr";
import { ur } from "./ur";
import { et } from "./et";
import { lv } from "./lv";
import { lt } from "./lt";
import { az } from "./az";
import { kk } from "./kk";
import { sw } from "./sw";
import { af } from "./af";
import { gu } from "./gu";
import { kn } from "./kn";
import { ml } from "./ml";
import { is } from "./is";
import { eu } from "./eu";
import { gl } from "./gl";
import { hy } from "./hy";
import { ka } from "./ka";
import { be } from "./be";
import { mk } from "./mk";
import { sq } from "./sq";
import { my } from "./my";
import { km } from "./km";
import { ne } from "./ne";
import { si } from "./si";
import { pa } from "./pa";
import { am } from "./am";
import { zu } from "./zu";
import { mn } from "./mn";
import { lo } from "./lo";
import { ky } from "./ky";
import { useApp } from "../state/store";
import type { Language } from "../state/settings";

const DICTS = {
  en,
  tr,
  ja,
  ko,
  zh,
  zht,
  id,
  es,
  pt,
  de,
  fr,
  it,
  nl,
  pl,
  ru,
  ar,
  vi,
  th,
  sv,
  hi,
  uk,
  cs,
  ro,
  el,
  hu,
  da,
  fi,
  no,
  sk,
  bg,
  hr,
  he,
  ms,
  fa,
  bn,
  ca,
  sr,
  sl,
  fil,
  ta,
  te,
  mr,
  ur,
  et,
  lv,
  lt,
  az,
  kk,
  sw,
  af,
  gu,
  kn,
  ml,
  is,
  eu,
  gl,
  hy,
  ka,
  be,
  mk,
  sq,
  my,
  km,
  ne,
  si,
  pa,
  am,
  zu,
  mn,
  lo,
  ky,
} as const;

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
export {
  LANGUAGE_OPTIONS,
  LANGUAGE_SHORT,
  LOCALE_TAG,
  LANGUAGES,
  isLanguage,
  isRtl,
  localeTag,
  videoLang,
  songTitleLang,
} from "./langs";
