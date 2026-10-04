import { emptyProgress, sanitizeProgress, type Progress } from "./progress";

const KEY = "sonatrio-progress-v1";

export function loadProgress(): Progress {
  try {
    return sanitizeProgress(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked */
  }
}
