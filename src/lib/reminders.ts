import { tNow } from "../i18n";
import { builtinTitle } from "../midi/builtin";
import { dailySong } from "../progress/daily";
import { dayKey, practisedOn, streak } from "../progress/progress";
import { onStreakDay } from "../progress/tracker";
import { toast, useApp } from "../state/store";
import { isNativeApp } from "./platform";

/** One notification per day for the coming week; rebuilt whenever the app opens or today gets practised. */
const DAYS = 7;
const FIRST_ID = 7001;
const IDS = Array.from({ length: DAYS }, (_, i) => ({ id: FIRST_ID + i }));

export const remindersSupported = isNativeApp;

async function plugin() {
  return (await import("@capacitor/local-notifications")).LocalNotifications;
}

/** Notification texts for the coming days; skips today once practised or once the time has passed. */
export function reminderPlan(now: Date = new Date()): { at: Date; title: string; body: string }[] {
  const { settings, progress } = useApp.getState();
  const todayDone = practisedOn(progress, dayKey(now));
  const n = streak(progress, now);
  const out: { at: Date; title: string; body: string }[] = [];
  for (let i = 0; i < DAYS; i++) {
    const at = new Date(now);
    at.setDate(at.getDate() + i);
    at.setHours(Math.floor(settings.reminderAt / 60), settings.reminderAt % 60, 0, 0);
    if (i === 0 && (todayDone || at <= now)) continue;
    const song = builtinTitle(dailySong(settings.skill, at), settings.language);
    // Only the next reminder knows the streak for sure; later ones assume nothing.
    const atRisk = n > 0 && (i === 0 || (i === 1 && todayDone));
    out.push({
      at,
      title: atRisk ? tNow("reminderStreakTitle", { n }) : tNow("reminderTitle"),
      body: atRisk ? tNow("reminderStreakBody", { song }) : tNow("reminderBody", { song }),
    });
  }
  return out;
}

let syncing: Promise<void> | null = null;

/** Replaces the scheduled reminders with a fresh plan (or clears them when switched off). */
export function syncReminders(): Promise<void> {
  if (!remindersSupported) return Promise.resolve();
  const run = async () => {
    try {
      const ln = await plugin();
      await ln.cancel({ notifications: IDS });
      if (!useApp.getState().settings.reminder) return;
      if ((await ln.checkPermissions()).display !== "granted") return;
      const plan = reminderPlan();
      await ln.schedule({
        notifications: plan.map((p, i) => ({ id: FIRST_ID + i, title: p.title, body: p.body, schedule: { at: p.at } })),
      });
    } catch (err) {
      console.warn("[reminders] scheduling failed", err);
    }
  };
  syncing = (syncing ?? Promise.resolve()).then(run);
  return syncing;
}

/** Asks for notification permission; true when reminders can be shown. */
export async function askReminderPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  try {
    const ln = await plugin();
    let state = (await ln.checkPermissions()).display;
    if (state !== "granted") state = (await ln.requestPermissions()).display;
    if (state !== "granted") toast(tNow("reminderDenied"), "error", 5000);
    return state === "granted";
  } catch {
    return false;
  }
}

export function initReminders(): void {
  if (!remindersSupported) return;
  void syncReminders();
  onStreakDay(() => void syncReminders());
  useApp.subscribe((s, prev) => {
    const a = s.settings;
    const b = prev.settings;
    if (a.reminder !== b.reminder || a.reminderAt !== b.reminderAt || a.language !== b.language || a.skill !== b.skill) void syncReminders();
  });
  void import("@capacitor/app").then(({ App }) =>
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void syncReminders();
    })
  );
}
