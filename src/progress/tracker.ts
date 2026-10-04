import { supabase } from "../auth/account";
import { engine } from "../engine/engine";
import { tNow, type DictKey } from "../i18n";
import { desktop } from "../lib/platform";
import { BUILTIN_SONGS } from "../midi/builtin";
import { toast, useApp } from "../state/store";
import { ACHIEVEMENTS, newlyUnlocked, steamName, type AchievementContext } from "./achievements";
import { addPractice, addRun, dayKey, mergeProgress, sanitizeProgress, streak, type Progress, type RunRecord } from "./progress";
import { saveProgress as save } from "./storage";

const categories = new Map(BUILTIN_SONGS.map((s) => [s.id, s.category]));

function context(p: Progress, run: RunRecord | null): AchievementContext {
  return {
    p,
    run,
    streak: streak(p),
    todaySeconds: p.days[dayKey()] ?? 0,
    dailyGoalSeconds: useApp.getState().settings.dailyGoalMin * 60,
    categoryOf: (id) => categories.get(id) ?? null,
  };
}

export function achievementContext(): AchievementContext {
  return context(useApp.getState().progress, null);
}

function mirrorToSteam(ids: string[]): void {
  if (!desktop?.steam) return;
  for (const id of ids) void desktop.unlockAchievement(steamName(id));
}

/** Applies a new copy, unlocks whatever it earns and returns the ids unlocked just now. */
function commit(next: Progress, run: RunRecord | null, announce: boolean): string[] {
  const fresh = newlyUnlocked(context(next, run));
  if (fresh.length) {
    const at = Date.now();
    next = { ...next, unlocked: { ...next.unlocked, ...Object.fromEntries(fresh.map((id) => [id, at])) } };
    mirrorToSteam(fresh);
    if (announce)
      for (const id of fresh) toast(`${tNow("achievementUnlocked")}: ${tNow(`ach_${id}` as DictKey)}`, "success", 4500);
  }
  useApp.setState({ progress: next });
  save(next);
  schedulePush();
  return fresh;
}

/** Finished (or abandoned) run: counts notes, completion, stars; returns newly unlocked achievement ids. */
export function recordRun(run: RunRecord): string[] {
  return commit(addRun(useApp.getState().progress, run), run, false);
}

let pending = 0;

function tick(): void {
  const st = useApp.getState();
  if (engine.status !== "playing" || st.session.autoPlay || document.hidden) return;
  const before = st.progress;
  const goal = st.settings.dailyGoalMin * 60;
  const today = before.days[dayKey()] ?? 0;
  const next = addPractice(before, 1, new Date(), st.settings.instrument);
  pending++;
  // Save every few seconds; check achievements right away when today's goal is reached.
  if (pending >= 10 || (today < goal && today + 1 >= goal)) {
    pending = 0;
    commit(next, null, true);
    if (today < goal && today + 1 >= goal) toast(tNow("goalReached"), "success", 4000);
  } else {
    useApp.setState({ progress: next });
  }
}

// ----------------------------------------------------------------- account copy

let pushTimer = 0;
let pulledFor: string | null = null;

async function userId(): Promise<string | null> {
  if (!supabase || useApp.getState().account.status !== "signedIn") return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function upload(): Promise<void> {
  const user = await userId();
  if (!user) return;
  const { error } = await supabase!
    .from("user_progress")
    .upsert({ user_id: user, data: useApp.getState().progress, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.warn("[progress] upload failed", error.message);
}

function schedulePush(): void {
  if (!supabase || useApp.getState().account.status !== "signedIn") return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void upload(), 15000);
}

async function pull(): Promise<void> {
  const user = await userId();
  if (!user || pulledFor === user) return;
  pulledFor = user;
  const { data, error } = await supabase!.from("user_progress").select("data").eq("user_id", user).maybeSingle();
  if (error) {
    pulledFor = null;
    console.warn("[progress] download failed", error.message);
    return;
  }
  const merged = data ? mergeProgress(useApp.getState().progress, sanitizeProgress(data.data)) : useApp.getState().progress;
  commit(merged, null, false);
  await upload();
}

export function initProgress(): void {
  window.setInterval(tick, 1000);
  window.addEventListener("pagehide", () => save(useApp.getState().progress));
  // Steam may have missed unlocks earned on another device or before the Steam build.
  mirrorToSteam(Object.keys(useApp.getState().progress.unlocked));
  useApp.subscribe((s, prev) => {
    if (s.account.status === prev.account.status) return;
    if (s.account.status === "signedIn") void pull();
    else if (s.account.status === "signedOut") pulledFor = null;
  });
  if (useApp.getState().account.status === "signedIn") void pull();
}

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;
