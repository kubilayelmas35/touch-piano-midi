import { engine, type LoopPass } from "../engine/engine";
import { tNow } from "../i18n";
import { NO_LOOP, closeResults, updateSession } from "../state/actions";
import { toast, useApp } from "../state/store";
import type { WeakSpot } from "./insights";
import { SPEEDS } from "./path";

/** A drill starts about a quarter slower than the speed the song was played at. */
export function drillStartSpeed(target: number): number {
  const want = target * 0.75 + 1e-6;
  return [...SPEEDS].reverse().find((v) => v <= want) ?? SPEEDS[0];
}

/** Loops the stretch slowly; each clean pass speeds it up a notch (see `drillAfterPass`). */
export function startDrill(spot: WeakSpot): void {
  closeResults();
  const target = useApp.getState().session.speed;
  const speed = drillStartSpeed(target);
  updateSession({ speed, loop: { a: spot.from, b: spot.to, enabled: true } });
  useApp.setState({ drill: { from: spot.from, to: spot.to, measureFrom: spot.measureFrom, measureTo: spot.measureTo, target } });
  engine.stop();
  const lead = (useApp.getState().song?.firstBeatSec ?? 0.5) * 2;
  engine.seek(Math.max(engine.startTime, spot.from - lead));
  void engine.play();
  toast(tNow("drillStarted", { speed: Math.round(speed * 100) }), "info", 4500);
}

export function stopDrill(): void {
  if (!useApp.getState().drill) return;
  const target = useApp.getState().drill!.target;
  useApp.setState({ drill: null });
  updateSession({ speed: target, loop: { ...NO_LOOP } });
}

/** A clean pass (nothing missed, at most one stray key) moves up a notch; clean at the target speed ends the drill. */
export function drillAfterPass(p: LoopPass): void {
  const drill = useApp.getState().drill;
  if (!drill) return;
  const clean = p.hit > 0 && p.miss === 0 && p.wrong <= 1;
  if (!clean) return;
  const speed = useApp.getState().session.speed;
  // Changing speed mid-frame would re-anchor the engine while it is jumping back.
  window.setTimeout(() => {
    if (useApp.getState().drill !== drill) return;
    if (speed >= drill.target - 0.001) {
      useApp.setState({ drill: null });
      updateSession({ speed: drill.target, loop: { ...NO_LOOP } });
      engine.stop();
      toast(tNow("drillDone"), "success", 5000);
      return;
    }
    const next = Math.min(drill.target, SPEEDS.find((v) => v > speed + 0.001) ?? drill.target);
    updateSession({ speed: next });
    toast(tNow("drillFaster", { speed: Math.round(next * 100) }), "success");
  }, 0);
}
