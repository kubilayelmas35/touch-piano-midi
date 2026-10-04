import { legacyPaths } from "../coach/path";
import { emptyProgress, sanitizeProgress, type Progress } from "./progress";

const KEY = "sonatrio-progress-v1";

export function loadProgress(): Progress {
  let p: Progress;
  try {
    p = sanitizeProgress(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    p = emptyProgress();
  }
  return Object.keys(p.path).length ? p : { ...p, path: legacyPaths() };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked */
  }
}
