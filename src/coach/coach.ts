import { engine } from "../engine/engine";
import type { InstrumentKind } from "../engine/types";
import { BUILTIN_SONGS } from "../midi/builtin";
import type { Song } from "../midi/song";
import { handTracks, NO_LOOP, openFreePlay, openSong, setHand, updateSession, updateSettings } from "../state/actions";
import { setPanel, useApp, type CoachOutcome } from "../state/store";
import { savePathState } from "../progress/tracker";
import {
  freshState,
  judgeRun,
  jumpTo,
  partCount,
  partSeconds,
  pathKey,
  pathSteps,
  readPath,
  type PathState,
  type PathStep,
  type Skill,
  type Stage,
} from "./path";

export function coachContext() {
  const { settings, progress } = useApp.getState();
  const { instrument, skill } = settings;
  const steps = pathSteps(instrument, skill);
  const state = readPath(progress.path, instrument, skill);
  return { instrument, skill, steps, state, step: steps[state.step] as PathStep };
}

function save(instrument: InstrumentKind, skill: Skill, state: PathState): void {
  savePathState(pathKey(instrument, skill), state);
}

/** Length of a path song at full speed (seconds). */
export function songSeconds(id: string): number {
  return BUILTIN_SONGS.find((s) => s.id === id)?.seconds ?? useApp.getState().song?.duration ?? 0;
}

/** Seconds of the song the step's current part plays; null = the whole song. */
export function stepPartSeconds(song: string, part: number): number | null {
  return partSeconds(songSeconds(song), part);
}

/** Where a part stops in the song: the first bar line at or after its length, so a phrase isn't cut off. */
function segmentEndFor(song: Song, seconds: number | null): number {
  if (seconds === null) return 0;
  const bar = song.beats.find((b) => b.downbeat && b.time >= seconds - 0.05);
  const end = bar ? bar.time : seconds;
  const last = song.notes.reduce((m, n) => Math.max(m, n.time), 0);
  return end >= last ? 0 : end - 0.01;
}

function applyStage(stage: Stage): void {
  const { settings, song } = useApp.getState();
  if (!song) return;
  if (settings.instrument === "piano") {
    setHand(stage);
    return;
  }
  // Guitar / violin play the melody only; "right" = strike while the frets are pressed for you, "left" = fret while the strings are played.
  const ht = handTracks(song);
  if (ht) updateSession({ playTracks: [ht.right], mutedTracks: [] });
  updateSettings({ autoFret: stage === "right", tapToPlay: stage === "left" });
}

/** Opens the current learning-path step with its hand, speed, wait mode and part of the song. */
export async function startCoach(opts: { play?: boolean } = {}): Promise<boolean> {
  const { state, step } = coachContext();
  if (!step) return false;
  useApp.setState({ coach: { step: state.step }, results: null });
  const ok = await openSong(step.song, { coach: true });
  const song = useApp.getState().song;
  if (!ok || !song) {
    useApp.setState({ coach: null });
    return false;
  }
  applyStage(step.stage);
  const segmentEnd = segmentEndFor(song, stepPartSeconds(step.song, state.part));
  updateSession({ speed: state.speed, waitMode: state.wait, autoPlay: false, loop: { ...NO_LOOP }, segmentEnd });
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
  const parts = partCount(songSeconds(played.song));
  const { verdict, next } = judgeRun({ ...state, step: coach.step }, run, { skill, steps, parts });
  save(instrument, skill, next);
  const upcoming = steps[next.step];
  return {
    verdict,
    played,
    next: upcoming,
    speed: next.speed,
    wait: next.wait,
    total: steps.length,
    stepIndex: next.step,
    partSec: stepPartSeconds(upcoming.song, next.part),
  };
}

/** Moves to the step before or after the current one ("too easy" / "go back"). */
export function moveStep(by: number): void {
  const { instrument, skill, steps, state } = coachContext();
  const target = state.step + by;
  if (target < 0 || target >= steps.length) return;
  save(instrument, skill, jumpTo(state, target, { skill, steps }));
  useApp.setState({ coach: null });
}

/** Moves past the current step without playing it (for players who find it too easy). */
export function skipStep(): void {
  moveStep(1);
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
