import { engine } from "../engine/engine";
import { tNow } from "../i18n";
import { cycleLoop, setHand, updateSession, updateSettings } from "../state/actions";
import { toast, useApp } from "../state/store";
import { setVoiceGain } from "../studio/voicePlay";
import { setVoiceMonitor } from "../studio/voiceTake";
import { startRecording, stopRecording } from "../studio/recording";
import type { BoardAction } from "./midiBoard";

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.012;
}

function knob(id: BoardAction & { t: "knob" }): void {
  const v = id.v;
  const s = useApp.getState().settings;
  if (id.id === "volume") {
    if (!near(s.volume, v)) updateSettings({ volume: v });
  } else if (id.id === "accomp") {
    if (!near(s.accompVolume, v)) updateSettings({ accompVolume: v });
  } else if (id.id === "reverb") {
    const r = v * 0.6;
    if (!near(s.reverb, r)) updateSettings({ reverb: r });
  } else if (id.id === "click") {
    if (!near(s.clickVolume, v)) updateSettings({ clickVolume: v });
  } else if (id.id === "effects") {
    const level = 0.1 + v * 0.9;
    if (!near(s.effectLevel, level)) updateSettings({ effectLevel: level, effects: v > 0.04 });
  } else if (id.id === "fall") {
    const fall = 1 + v * 7;
    if (!near(s.fallSeconds, fall)) updateSettings({ fallSeconds: fall });
  } else if (id.id === "speed") {
    const speed = Math.round((0.25 + v * 1.25) * 20) / 20;
    if (!near(useApp.getState().session.speed, speed)) updateSession({ speed });
  } else if (id.id === "transpose") {
    const n = Math.max(-12, Math.min(12, Math.round((v - 0.5) * 24)));
    if (n !== s.midiTranspose) updateSettings({ midiTranspose: n });
  } else {
    if (!near(s.recordVoiceGain, v)) updateSettings({ recordVoiceGain: v });
    setVoiceGain(v);
    setVoiceMonitor(v);
  }
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
