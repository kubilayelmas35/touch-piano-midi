import { supabase } from "../auth/account";
import { engine } from "../engine/engine";
import { tNow, type DictKey } from "../i18n";
import { desktop } from "../lib/platform";
import { BUILTIN_SONGS } from "../midi/builtin";
import { toast, useApp } from "../state/store";
import { ACHIEVEMENTS, newlyUnlocked, steamName, type AchievementContext } from "./achievements";
import {
  addPractice,
  addRun,
  applyFreezes,
  awardFreeze,
  dayKey,
  mergeProgress,
  sanitizeProgress,
  streak,
  STREAK_MIN_SECONDS,
  type Progress,
  type RunRecord,
} from "./progress";
import { saveProgress as save } from "./storage";
import { PATH_LAYOUT, type PathState } from "../coach/path";

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

/** Stores a learning-path state; it travels with the progress copy to the account. */
export function savePathState(key: string, state: PathState): void {
  const p = useApp.getState().progress;
  commit({ ...p, path: { ...p.path, [key]: { ...state, at: Date.now(), v: PATH_LAYOUT } } }, null, false);
}

/** Finished (or abandoned) run: counts notes, completion, stars; returns newly unlocked achievement ids. */
export function recordRun(run: RunRecord): string[] {
  return commit(addRun(useApp.getState().progress, run), run, false);
}

/** A good run of today's daily song; true the first time today. */
export function recordDaily(songId: string): boolean {
  const p = useApp.getState().progress;
  const today = dayKey();
  if (p.daily[today]) return false;
  commit({ ...p, daily: { ...p.daily, [today]: songId } }, null, true);
  return true;
}

/** Spends freezes on days missed since the last visit, telling the player it happened. */
function spendFreezes(): void {
  const { p, used } = applyFreezes(useApp.getState().progress);
  if (!used.length) return;
  commit(p, null, false);
  toast(tNow(used.length > 1 ? "freezeUsedMany" : "freezeUsed", { n: used.length, streak: streak(p) }), "info", 7000);
}

let pending = 0;
let lastDay = dayKey();

function tick(): void {
  const st = useApp.getState();
  const day = dayKey();
  if (day !== lastDay) {
    lastDay = day;
    spendFreezes();
    dayListeners.forEach((fn) => fn());
  }
  if (engine.status !== "playing" || st.session.autoPlay || document.hidden) return;
  const before = st.progress;
  const goal = st.settings.dailyGoalMin * 60;
  const today = before.days[day] ?? 0;
  let next = addPractice(before, 1, new Date(), st.settings.instrument);
  const reachedGoal = today < goal && today + 1 >= goal;
  const counted = today < STREAK_MIN_SECONDS && today + 1 >= STREAK_MIN_SECONDS;
  pending++;
  // Save every few seconds; right away when today starts counting for the streak or the goal is reached.
  if (pending >= 10 || reachedGoal || counted) {
    pending = 0;
    const earned = counted ? awardFreeze(next) : null;
    if (earned) next = earned;
    commit(next, null, true);
    if (reachedGoal) toast(tNow("goalReached"), "success", 4000);
    if (earned) toast(tNow("freezeEarned", { n: streak(next) }), "success", 6000);
    if (counted) dayListeners.forEach((fn) => fn());
  } else {
    useApp.setState({ progress: next });
  }
}

const dayListeners = new Set<() => void>();

/** Called when a new day starts or today starts counting for the streak (reminders follow this). */
export function onStreakDay(fn: () => void): () => void {
  dayListeners.add(fn);
  return () => dayListeners.delete(fn);
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
  spendFreezes();
  await upload();
}

export function initProgress(): void {
  window.setInterval(tick, 1000);
  spendFreezes();
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
