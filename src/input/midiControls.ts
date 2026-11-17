import { setCutoff, setResonance, setStereoPan, setTremolo } from "../audio/context";
import { setGlideDepth, setGlideTime, setVibratoDelay, setVibratoDepth, setVibratoRate } from "../audio/sampler";
import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import type { DictKey } from "../i18n/en";
import { cycleLoop, setHand, updateSettings } from "../state/actions";
import { toast, useApp } from "../state/store";
import { startRecording, stopRecording } from "../studio/recording";
import type { BoardAction, BoardKnob } from "./midiBoard";

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.012;
}

const told = new Map<string, number>();

function hint(id: string, key: DictKey, v: number): void {
  const now = performance.now();
  if (now - (told.get(id) ?? 0) < 900) return;
  told.set(id, now);
  toast(tNow(key, { n: Math.round(v * 100) }));
}

const LABEL: Record<BoardKnob, DictKey> = {
  volume: "ctlVol",
  cutoff: "ctlCutoff",
  resonance: "ctlReso",
  glideTime: "ctlEnv",
  glideDepth: "ctlGlide",
  lfoDelay: "ctlLfoDelay",
  lfoRate: "ctlLfoRate",
  lfoDepth: "ctlLfo",
  pan: "ctlPan",
};

function knob(id: BoardAction & { t: "knob" }): void {
  const v = id.v;
  if (id.id === "volume") {
    if (!near(useApp.getState().settings.volume, v)) updateSettings({ volume: v });
  } else if (id.id === "cutoff") {
    setCutoff(v);
  } else if (id.id === "resonance") {
    setResonance(v);
  } else if (id.id === "glideTime") {
    setGlideTime(v);
  } else if (id.id === "glideDepth") {
    setGlideDepth(v);
  } else if (id.id === "lfoDelay") {
    setVibratoDelay(v * 0.7);
  } else if (id.id === "lfoRate") {
    setVibratoRate(0.4 + v * 7.6);
  } else if (id.id === "lfoDepth") {
    setVibratoDepth(v * 140);
    setTremolo(v);
  } else {
    setStereoPan(v);
  }
  hint(id.id, LABEL[id.id], v);
}

function bar(): number {
  const song = useApp.getState().song;
  if (!song) return 2;
  return song.firstBeatSec * Math.max(1, song.beatsPerMeasure);
}

function button(id: Exclude<BoardAction, { t: "knob" }>["id"]): void {
  if (id === "play") {
    if (engine.status === "playing") {
      engine.pause();
      toast(tNow("ctlPause"));
    } else {
      void engine.play();
      toast(tNow("ctlPlay"));
    }
  } else if (id === "stop") {
    engine.stop();
    toast(tNow("ctlStop"));
  } else if (id === "back") {
    engine.seek(engine.time - bar());
  } else if (id === "forward") {
    engine.seek(engine.time + bar());
  } else if (id === "record") {
    if (useApp.getState().recording) {
      stopRecording();
      toast(tNow("ctlRecStop"));
    } else {
      startRecording(false);
      if (useApp.getState().recording) toast(tNow("ctlRec"));
    }
  } else if (id === "metro") {
    const on = !useApp.getState().settings.metronome;
    updateSettings({ metronome: on });
    toast(tNow(on ? "ctlMetroOn" : "ctlMetroOff"));
  } else if (id === "loop") {
    cycleLoop();
  } else if (id === "right" || id === "left" || id === "both") {
    const hand = id === "right" ? "right" : id === "left" ? "left" : "both";
    setHand(hand);
    toast(tNow(hand === "right" ? "ctlRight" : hand === "left" ? "ctlLeft" : "ctlBoth"));
  }
}

export function applyBoard(action: BoardAction): void {
  if (action.t === "knob") knob(action);
  else button(action.id);
}
