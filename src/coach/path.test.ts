import { describe, expect, it } from "vitest";
import { freshState, goalSpeed, judgeRun, pathSongs, pathSteps, SPEEDS, type PathState } from "./path";

const steps = pathSteps("piano", "new");
const ctx = { skill: "new" as const, steps };
const run = (accuracy: number, speed: number, wait = false) => ({ accuracy, speed, wait, stars: accuracy >= 0.95 ? 5 : 3 });

describe("learning path", () => {
  it("starts beginners on an easy song, one hand at a time, at half speed", () => {
    expect(steps.slice(0, 3).map((s) => s.stage)).toEqual(["right", "left", "both"]);
    expect(new Set(steps.slice(0, 3).map((s) => s.song)).size).toBe(1);
    expect(freshState("new").speed).toBe(0.5);
    expect(pathSteps("piano", "good")[0].stage).toBe("both");
    expect(pathSteps("guitar", "new").slice(0, 2).map((s) => s.stage)).toEqual(["right", "both"]);
    expect(pathSongs()[0]).toBe("twinkle");
    expect(new Set(pathSongs()).size).toBe(pathSongs().length);
    expect(pathSongs().indexOf("twinkle")).toBeLessThan(pathSongs().indexOf("minuet-g"));
  });

  it("a low score slows down, and at the slowest speed the song waits for you", () => {
    let s: PathState = freshState("new");
    let r = judgeRun(s, run(0.3, 0.5), ctx);
    expect(r.verdict).toBe("slower");
    expect(r.next.speed).toBe(0.4);
    s = { ...r.next, speed: SPEEDS[0] };
    r = judgeRun(s, run(0.3, SPEEDS[0]), ctx);
    expect(r.verdict).toBe("waitOn");
    expect(r.next.wait).toBe(true);
    r = judgeRun(r.next, run(0.9, SPEEDS[0], true), ctx);
    expect(r.verdict).toBe("waitOff");
    expect(r.next.wait).toBe(false);
    expect(r.next.step).toBe(0);
  });

  it("a near miss gets one more try before slowing down", () => {
    const s = freshState("new");
    const a = judgeRun(s, run(0.65, 0.5), ctx);
    expect(a.verdict).toBe("retry");
    expect(a.next.speed).toBe(0.5);
    const b = judgeRun(a.next, run(0.65, 0.5), ctx);
    expect(b.verdict).toBe("slower");
  });

  it("good runs speed up to the goal, then move on a notch slower", () => {
    expect(goalSpeed("new", 0)).toBe(0.6);
    const s = freshState("new");
    const a = judgeRun(s, run(0.85, 0.5), ctx);
    expect(a.verdict).toBe("faster");
    expect(a.next.speed).toBe(0.6);
    const b = judgeRun(a.next, run(0.9, 0.6), ctx);
    expect(b.verdict).toBe("passed");
    expect(b.next.step).toBe(1);
    expect(b.next.speed).toBe(0.5);
    expect(b.next.stars[0]).toBe(3);
  });

  it("the last step finishes the path", () => {
    const s = { ...freshState("good"), step: pathSteps("piano", "good").length - 1, speed: 1 };
    const r = judgeRun(s, run(0.9, 1), { skill: "good", steps: pathSteps("piano", "good") });
    expect(r.verdict).toBe("finished");
  });
});
