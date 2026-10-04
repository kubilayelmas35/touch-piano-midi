import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, newlyUnlocked, steamName, type AchievementContext } from "./achievements";
import {
  addPractice,
  addRun,
  applyFreezes,
  awardFreeze,
  bestStreak,
  dayKey,
  emptyProgress,
  FREEZE_MAX,
  freezesLeft,
  mergeProgress,
  sanitizeProgress,
  streak,
  type RunRecord,
} from "./progress";
import { dailySong } from "./daily";
import { BUILTIN_SONGS } from "../midi/builtin";

const at = (s: string) => new Date(`${s}T15:00:00`);

const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  songId: "ode",
  instrument: "piano",
  stars: 3,
  accuracy: 0.8,
  maxCombo: 30,
  notesHit: 40,
  misses: 5,
  waitMode: false,
  speed: 1,
  practice: false,
  ...over,
});

const ctx = (over: Partial<AchievementContext> = {}): AchievementContext => ({
  p: emptyProgress(),
  run: null,
  streak: 0,
  todaySeconds: 0,
  dailyGoalSeconds: 600,
  categoryOf: () => null,
  ...over,
});

describe("streak", () => {
  it("counts consecutive days ending today", () => {
    let p = emptyProgress();
    for (const d of ["2026-03-01", "2026-03-02", "2026-03-03"]) p = addPractice(p, 90, at(d));
    expect(streak(p, at("2026-03-03"))).toBe(3);
  });

  it("keeps yesterday's streak alive until today is over", () => {
    let p = emptyProgress();
    for (const d of ["2026-03-01", "2026-03-02"]) p = addPractice(p, 90, at(d));
    expect(streak(p, at("2026-03-03"))).toBe(2);
    expect(streak(p, at("2026-03-04"))).toBe(0);
  });

  it("ignores days below the minimum", () => {
    let p = addPractice(emptyProgress(), 90, at("2026-03-01"));
    p = addPractice(p, 20, at("2026-03-02"));
    expect(streak(p, at("2026-03-02"))).toBe(1);
  });

  it("crosses month and DST boundaries", () => {
    let p = emptyProgress();
    for (const d of ["2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31", "2026-04-01"]) p = addPractice(p, 60, at(d));
    expect(streak(p, at("2026-04-01"))).toBe(5);
    expect(bestStreak(p)).toBe(5);
  });

  it("finds the best streak in the past", () => {
    let p = emptyProgress();
    for (const d of ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-10", "2026-01-11"]) p = addPractice(p, 60, at(d));
    expect(bestStreak(p)).toBe(4);
  });
});

describe("streak freezes", () => {
  const days = (list: string[]) => list.reduce((p, d) => addPractice(p, 90, at(d)), emptyProgress());

  it("everyone starts with one, which saves a missed day", () => {
    const p = days(["2026-03-01", "2026-03-02", "2026-03-03"]);
    expect(freezesLeft(p)).toBe(1);
    const { p: saved, used } = applyFreezes(p, at("2026-03-05"));
    expect(used).toEqual(["2026-03-04"]);
    expect(freezesLeft(saved)).toBe(0);
    expect(streak(saved, at("2026-03-05"))).toBe(3);
    expect(streak(addPractice(saved, 90, at("2026-03-05")), at("2026-03-05"))).toBe(4);
    expect(bestStreak(addPractice(saved, 90, at("2026-03-05")))).toBe(4);
  });

  it("does nothing without a streak, or when the gap is longer than the freezes", () => {
    expect(applyFreezes(emptyProgress(), at("2026-03-05")).used).toEqual([]);
    const p = days(["2026-03-01"]);
    expect(applyFreezes(p, at("2026-03-05")).used).toEqual([]);
    expect(applyFreezes(p, at("2026-03-02")).used).toEqual([]);
  });

  it("earns one per streak week, up to the maximum", () => {
    let p = days(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]);
    expect(awardFreeze(p, at("2026-03-06"))).toBeNull();
    p = addPractice(p, 90, at("2026-03-07"));
    const earned = awardFreeze(p, at("2026-03-07"))!;
    expect(freezesLeft(earned)).toBe(FREEZE_MAX);
    expect(awardFreeze(earned, at("2026-03-07"))).toBeNull();
  });

  it("merges without losing used days or earned freezes", () => {
    const a = { ...emptyProgress(), frozen: ["2026-03-04"], freezeEarned: 1 };
    const b = { ...emptyProgress(), frozen: ["2026-02-10"], freezeEarned: 2, daily: { "2026-03-01": "twinkle" } };
    const m = mergeProgress(a, b);
    expect(m.frozen).toEqual(["2026-02-10", "2026-03-04"]);
    expect(m.freezeEarned).toBe(2);
    expect(m.daily["2026-03-01"]).toBe("twinkle");
    expect(sanitizeProgress(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
});

describe("song of the day", () => {
  it("is the same all day, fits the skill, and changes from one day to the next", () => {
    const d1 = dailySong("new", at("2026-03-01"));
    expect(dailySong("new", new Date("2026-03-01T08:00:00"))).toBe(d1);
    for (let i = 1; i < 28; i++) {
      const a = dailySong("some", at(`2026-03-${String(i).padStart(2, "0")}`));
      const b = dailySong("some", at(`2026-03-${String(i + 1).padStart(2, "0")}`));
      expect(a).not.toBe(b);
    }
    expect(BUILTIN_SONGS.find((s) => s.id === d1)?.level).toBe(1);
  });
});

describe("addPractice / addRun", () => {
  it("adds seconds to the total and the day", () => {
    const p = addPractice(addPractice(emptyProgress(), 30, at("2026-05-05")), 45, at("2026-05-05"));
    expect(p.seconds).toBe(75);
    expect(p.days[dayKey(at("2026-05-05"))]).toBe(75);
  });

  it("records best stars, plays and instruments for finished runs", () => {
    let p = addRun(emptyProgress(), run({ stars: 4 }));
    p = addRun(p, run({ stars: 2, instrument: "guitar", maxCombo: 80 }));
    expect(p.songs.ode).toMatchObject({ stars: 4, plays: 2, instruments: ["piano", "guitar"], acc: 0.8 });
    expect(p.runs).toBe(2);
    expect(p.notes).toBe(80);
    expect(p.bestCombo).toBe(80);
    expect(p.recent.map((r) => r.instrument)).toEqual(["guitar", "piano"]);
  });

  it("masters a song only at full speed, without Wait for me, with 4+ stars", () => {
    let p = addRun(emptyProgress(), run({ stars: 5, speed: 0.8 }), 1);
    p = addRun(p, run({ stars: 5, waitMode: true }), 2);
    p = addRun(p, run({ stars: 3 }), 3);
    expect(p.songs.ode.mastered).toBe(0);
    expect(p.songs.ode.speed).toBe(0.8);
    p = addRun(p, run({ stars: 4 }), 4);
    p = addRun(p, run({ stars: 5 }), 5);
    expect(p.songs.ode.mastered).toBe(4);
    expect(p.songs.ode.speed).toBe(1);
    expect(p.songs.ode.last).toBe(5);
  });

  it("splits practice time per instrument", () => {
    let p = addPractice(emptyProgress(), 30, at("2026-05-05"), "piano");
    p = addPractice(p, 20, at("2026-05-05"), "guitar");
    p = addPractice(p, 5, at("2026-05-05"));
    expect(p.inst).toEqual({ piano: 30, guitar: 20 });
    expect(p.seconds).toBe(55);
  });

  it("counts notes but not completion for practice runs", () => {
    const p = addRun(emptyProgress(), run({ practice: true }));
    expect(p.notes).toBe(40);
    expect(p.runs).toBe(0);
    expect(p.songs).toEqual({});
  });
});

describe("mergeProgress", () => {
  it("keeps the best of both copies", () => {
    const a = { ...addRun(addPractice(emptyProgress(), 100, at("2026-06-01")), run({ stars: 5 })), unlocked: { first_song: 200 } };
    const b = {
      ...addRun(addPractice(emptyProgress(), 300, at("2026-06-02")), run({ stars: 2, instrument: "violin" })),
      unlocked: { first_song: 100, combo_50: 50 },
    };
    const m = mergeProgress(a, b);
    expect(m.days).toEqual({ "2026-06-01": 100, "2026-06-02": 300 });
    expect(m.songs.ode.stars).toBe(5);
    expect(m.songs.ode.instruments.sort()).toEqual(["piano", "violin"]);
    expect(m.unlocked).toEqual({ first_song: 100, combo_50: 50 });
    expect(m.songs.ode.mastered).toBeGreaterThan(0);
    expect(mergeProgress(m, m)).toEqual(m);
  });
});

describe("learning path in the progress copy", () => {
  const state = (step: number, at: number) => ({ step, speed: 0.6, wait: false, tries: 0, stars: { 0: 4 }, part: 0, at });

  it("keeps the most recently saved path, so a restart elsewhere sticks", () => {
    const a = { ...emptyProgress(), path: { "piano:new": state(12, 100), "guitar:new": state(3, 50) } };
    const b = { ...emptyProgress(), path: { "piano:new": state(0, 200), "violin:some": state(5, 10) } };
    const m = mergeProgress(a, b);
    expect(m.path["piano:new"].step).toBe(0);
    expect(m.path["guitar:new"].step).toBe(3);
    expect(m.path["violin:some"].step).toBe(5);
    expect(mergeProgress(m, m)).toEqual(m);
  });

  it("drops unknown keys and broken states", () => {
    const p = sanitizeProgress({ path: { "piano:new": state(4, 1), "drums:new": state(1, 1), "guitar:good": { step: "x" } } });
    expect(Object.keys(p.path)).toEqual(["piano:new"]);
    expect(p.path["piano:new"]).toMatchObject({ step: 4, stars: { 0: 4 } });
  });
});

describe("sanitizeProgress", () => {
  it("drops junk and clamps values", () => {
    const p = sanitizeProgress({ seconds: -5, days: { bad: 3, "2026-01-01": 50 }, songs: { x: { stars: 9, plays: 1, instruments: [1, "piano"] } } });
    expect(p.seconds).toBe(0);
    expect(p.days).toEqual({ "2026-01-01": 50 });
    expect(p.songs.x).toEqual({ stars: 5, plays: 1, instruments: ["piano"], acc: 0, speed: 0, mastered: 0, last: 0 });
    expect(sanitizeProgress(null)).toEqual(emptyProgress());
  });
});

describe("achievements", () => {
  it("has unique ids that fit Steam API names", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(steamName(id)).toMatch(/^ACH_[A-Z0-9_]+$/);
  });

  it("unlocks the first song and daily goal", () => {
    const p = addRun(emptyProgress(), run());
    const got = newlyUnlocked(ctx({ p, run: run(), todaySeconds: 600 }));
    expect(got).toContain("first_song");
    expect(got).toContain("daily_goal");
    expect(got).not.toContain("five_stars");
  });

  it("does not repeat unlocked achievements", () => {
    const p = { ...addRun(emptyProgress(), run()), unlocked: { first_song: 1 } };
    expect(newlyUnlocked(ctx({ p }))).not.toContain("first_song");
  });

  it("needs a clean, real run for flawless", () => {
    const clean = run({ misses: 0, accuracy: 0.97 });
    expect(newlyUnlocked(ctx({ run: clean }))).toContain("flawless");
    expect(newlyUnlocked(ctx({ run: { ...clean, practice: true } }))).not.toContain("flawless");
  });

  it("measures progress without overshooting", () => {
    const p = { ...emptyProgress(), notes: 5000 };
    const notes = ACHIEVEMENTS.find((a) => a.id === "notes_1k")!;
    expect(notes.measure!(ctx({ p }))).toEqual([1000, 1000]);
  });
});
