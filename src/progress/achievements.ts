import type { Progress, RunRecord } from "./progress";

export interface AchievementContext {
  p: Progress;
  run: RunRecord | null;
  streak: number;
  todaySeconds: number;
  dailyGoalSeconds: number;
  categoryOf: (songId: string) => string | null;
}

export interface Achievement {
  id: string;
  tier: 1 | 2 | 3;
  /** Progress towards it as [current, target], for the locked card's bar. */
  measure?: (c: AchievementContext) => [number, number];
  done: (c: AchievementContext) => boolean;
}

const finished = (p: Progress) => Object.keys(p.songs).length;
const instruments = (p: Progress) => new Set(Object.values(p.songs).flatMap((s) => s.instruments));
const categoriesDone = (c: AchievementContext) =>
  new Set(Object.keys(c.p.songs).map(c.categoryOf).filter((x): x is string => !!x));
const starSum = (p: Progress) => Object.values(p.songs).reduce((n, s) => n + s.stars, 0);

const count = (id: string, tier: 1 | 2 | 3, target: number, of: (c: AchievementContext) => number): Achievement => ({
  id,
  tier,
  measure: (c) => [Math.min(target, of(c)), target],
  done: (c) => of(c) >= target,
});

export const ACHIEVEMENTS: Achievement[] = [
  count("first_song", 1, 1, (c) => finished(c.p)),
  { id: "five_stars", tier: 1, done: (c) => Object.values(c.p.songs).some((s) => s.stars >= 5) },
  count("daily_goal", 1, 1, (c) => (c.todaySeconds >= c.dailyGoalSeconds ? 1 : 0)),
  count("streak_3", 1, 3, (c) => c.streak),
  count("daily_3", 1, 3, (c) => Object.keys(c.p.daily).length),
  count("combo_50", 1, 50, (c) => c.p.bestCombo),
  count("notes_1k", 1, 1000, (c) => c.p.notes),
  count("hour_1", 1, 60, (c) => c.p.seconds / 60),
  count("songs_10", 2, 10, (c) => finished(c.p)),
  count("streak_7", 2, 7, (c) => c.streak),
  count("daily_15", 2, 15, (c) => Object.keys(c.p.daily).length),
  count("combo_200", 2, 200, (c) => c.p.bestCombo),
  count("explorer", 2, 4, (c) => categoriesDone(c).size),
  count("trio", 2, 3, (c) => instruments(c.p).size),
  {
    id: "flawless",
    tier: 2,
    done: (c) => !!c.run && !c.run.practice && c.run.misses === 0 && c.run.notesHit >= 20 && c.run.accuracy >= 0.95,
  },
  {
    id: "no_safety_net",
    tier: 2,
    done: (c) => !!c.run && !c.run.practice && !c.run.waitMode && c.run.speed >= 1 && c.run.stars >= 4,
  },
  count("classical_5", 2, 5, (c) => Object.entries(c.p.songs).filter(([id, s]) => s.stars >= 3 && c.categoryOf(id) === "classical").length),
  count("notes_10k", 3, 10000, (c) => c.p.notes),
  count("hour_10", 3, 600, (c) => c.p.seconds / 60),
  count("songs_25", 3, 25, (c) => finished(c.p)),
  count("streak_30", 3, 30, (c) => c.streak),
  count("stars_100", 3, 100, (c) => starSum(c.p)),
];

/** Steamworks API name; create achievements with exactly these names in the Steamworks partner site. */
export const steamName = (id: string) => `ACH_${id.toUpperCase()}`;

export function newlyUnlocked(c: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => !c.p.unlocked[a.id] && a.done(c)).map((a) => a.id);
}
