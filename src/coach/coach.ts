import { engine } from "../engine/engine";
import type { InstrumentKind } from "../engine/types";
import { handTracks, NO_LOOP, openFreePlay, openSong, setHand, updateSession, updateSettings } from "../state/actions";
import { setPanel, useApp, type CoachOutcome } from "../state/store";
import { freshState, judgeRun, loadPath, pathSteps, savePath, type PathState, type PathStep, type Skill, type Stage } from "./path";

export function coachContext() {
  const { instrument, skill } = useApp.getState().settings;
  const steps = pathSteps(instrument, skill);
  const state = loadPath(instrument, skill);
  return { instrument, skill, steps, state, step: steps[state.step] as PathStep };
}

function save(instrument: InstrumentKind, skill: Skill, state: PathState): void {
  savePath(instrument, skill, state);
  useApp.setState((s) => ({ pathRev: s.pathRev + 1 }));
}

function applyStage(stage: Stage): void {
  const { settings, song } = useApp.getState();
  if (!song) return;
  if (settings.instrument === "piano") {
    setHand(stage);
    return;
  }
  // Guitar / violin play the melody only; "right" = strike while the frets are pressed for you.
  const ht = handTracks(song);
  if (ht) updateSession({ playTracks: [ht.right], mutedTracks: [] });
  updateSettings({ autoFret: stage === "right", tapToPlay: false });
}

/** Opens the current learning-path step with its hand, speed and wait mode. */
export async function startCoach(opts: { play?: boolean } = {}): Promise<boolean> {
  const { state, step } = coachContext();
  if (!step) return false;
  useApp.setState({ coach: { step: state.step }, results: null });
  const ok = await openSong(step.song, { coach: true });
  if (!ok) {
    useApp.setState({ coach: null });
    return false;
  }
  applyStage(step.stage);
  updateSession({ speed: state.speed, waitMode: state.wait, autoPlay: false, loop: { ...NO_LOOP } });
  setPanel(null);
  if (opts.play) void engine.play();
  return true;
}

/** Scores a finished path run, stores the next attempt and returns what to tell the player. */
export function coachAfterRun(run: { accuracy: number; stars: number; speed: number; wait: boolean }): CoachOutcome | undefined {
  const coach = useApp.getState().coach;
  if (!coach) return undefined;
  const { instrument, skill, steps, state } = coachContext();
  const played = steps[coach.step];
  if (!played) return undefined;
  const { verdict, next } = judgeRun({ ...state, step: coach.step }, run, { skill, steps });
  save(instrument, skill, next);
  return { verdict, played, next: steps[next.step], speed: next.speed, wait: next.wait, total: steps.length, stepIndex: next.step };
}

/** Moves past the current step without playing it (for players who find it too easy). */
export function skipStep(): void {
  const { instrument, skill, steps, state } = coachContext();
  if (state.step >= steps.length - 1) return;
  save(instrument, skill, { ...state, step: state.step + 1, wait: false, tries: 0 });
  useApp.setState({ coach: null });
}

/** Starts the path from the beginning for the current instrument and skill. */
export function resetCoach(): void {
  const { instrument, skill } = useApp.getState().settings;
  save(instrument, skill, freshState(skill));
  useApp.setState({ coach: null });
}

/** After the welcome questions: beginners and learners go straight into the first lesson. */
export function followGoal(): void {
  const { goal, skill } = useApp.getState().settings;
  if (goal === "learn" || skill === "new") void startCoach();
  else if (goal === "free") openFreePlay();
  else setPanel("library");
}
