/** Sentez enstrüman sesleri — Web Audio (çoklu ses / tel) */
const AudioEngine = (() => {
  let ctx = null;
  /** id → { midi, voice } */
  const voices = new Map();
  let nextVoiceId = 1;

  let dynamicPressure = true;
  const SUSTAIN_MS_MAX = 10000;
  let sustainMs = 550;
  let instrumentId = "piano";

  const INSTRUMENTS = {
    piano: { label: "Piyano", sustainScale: 1 },
    violin: { label: "Keman", sustainScale: 1.15 },
    guitar: { label: "Gitar", sustainScale: 1 },
    flute: { label: "Flüt", sustainScale: 0.85 },
    brass: { label: "Bakır üflemeli", sustainScale: 0.9 },
    synth: { label: "Synth", sustainScale: 0.75 },
  };

  function ensure() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function setDynamicPressure(on) {
    dynamicPressure = !!on;
  }

  function setSustainMs(ms) {
    sustainMs = Math.max(0, Math.min(SUSTAIN_MS_MAX, Math.round(Number(ms) || 0)));
  }

  function getSustainMs() {
    return sustainMs;
  }

  function setInstrument(id) {
    if (INSTRUMENTS[id]) instrumentId = id;
  }

  /** Gitar/kemanda çalma modu sesi; piyanoda ayarlardaki enstrüman seçimi */
  function effectiveInstrument() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "guitar" || mode === "violin") return mode;
    return instrumentId;
  }

  function getInstruments() {
    return Object.entries(INSTRUMENTS).map(([id, meta]) => ({
      id,
      label: meta.label,
    }));
  }

  function velocityFromPointer(e, fallback = 0.75) {
    if (!dynamicPressure) return fallback;
    let v = fallback;
    if (e.pressure > 0) {
      v = 0.25 + Math.min(1, e.pressure) * 0.75;
    } else if (e.width && e.height) {
      const area = Math.min(1, (e.width * e.height) / 1200);
      v = 0.3 + area * 0.7;
    }
    return Math.max(0.15, Math.min(1, v));
  }

  /**
   * İnsan kulağı düşük frekansları daha zayıf algılar;
   * özellikle kalın teller/sol tuşlar için hafif telafi uygular.
   */
  function loudnessCompensation(freq) {
    if (!Number.isFinite(freq) || freq <= 0) return 1;
    if (freq >= 440) return 1;
    if (freq <= 80) return 1.65;
    if (freq <= 160) return 1.48;
    if (freq <= 240) return 1.32;
    if (freq <= 320) return 1.18;
    return 1.08;
  }

  function voiceConfig(id) {
    switch (id) {
      case "violin":
        return {
          oscs: [
            { type: "sawtooth", gain: 0.5 },
            { type: "sine", ratio: 2, gain: 0.16 },
            { type: "triangle", ratio: 3, gain: 0.06 },
          ],
          peak: 0.46,
          attack: 0.045,
          sustain: 0.26,
          decay1: 0.38,
          decay2: 2.4,
          tail: 0.05,
          filterType: "lowpass",
          filterStart: 3000,
          filterEnd: 1100,
          filterVel: 1600,
          filterQ: 2.1,
          vibratoHz: 5.8,
          vibratoDepth: 0.009,
        };
      case "guitar":
        return {
          oscs: [
            { type: "triangle", gain: 0.58 },
            { type: "sawtooth", gain: 0.14 },
            { type: "sine", ratio: 2, gain: 0.05 },
          ],
          peak: 0.54,
          attack: 0.0015,
          sustain: 0.1,
          decay1: 0.06,
          decay2: 0.72,
          tail: 0.02,
          filterType: "bandpass",
          filterStart: 2400,
          filterEnd: 420,
          filterVel: 520,
          filterQ: 2.8,
          vibratoHz: 5.5,
          vibratoDepth: 0.005,
        };
      case "flute":
        return {
          oscs: [{ type: "sine", gain: 0.5 }, { type: "triangle", ratio: 2, gain: 0.08 }],
          peak: 0.38,
          attack: 0.05,
          sustain: 0.28,
          decay1: 0.35,
          decay2: 1.8,
          tail: 0.05,
          filterType: "lowpass",
          filterStart: 3600,
          filterEnd: 1200,
          filterVel: 900,
          filterQ: 0.5,
          vibratoHz: 4.2,
          vibratoDepth: 0.004,
        };
      case "brass":
        return {
          oscs: [{ type: "square", gain: 0.22 }, { type: "sawtooth", gain: 0.28 }],
          peak: 0.44,
          attack: 0.03,
          sustain: 0.3,
          decay1: 0.4,
          decay2: 1.6,
          tail: 0.05,
          filterType: "lowpass",
          filterStart: 2200,
          filterEnd: 700,
          filterVel: 1100,
          filterQ: 1.4,
        };
      case "synth":
        return {
          oscs: [{ type: "sawtooth", gain: 0.32 }, { type: "square", ratio: 0.5, gain: 0.12 }],
          peak: 0.4,
          attack: 0.01,
          sustain: 0.22,
          decay1: 0.25,
          decay2: 1.2,
          tail: 0.04,
          filterType: "lowpass",
          filterStart: 4200,
          filterEnd: 800,
          filterVel: 2000,
          filterQ: 2.2,
        };
      default:
        return {
          oscs: [
            { type: "triangle", gain: 0.5 },
            { type: "sine", ratio: 2.01, gain: 0.22 },
            { type: "sine", ratio: 0.5, gain: 0.1 },
          ],
          peak: 0.38,
          attack: 0.012,
          sustain: 0.5,
          decay1: 0.35,
          decay2: 2.8,
          tail: 0.08,
          filterType: "lowpass",
          filterStart: 3200,
          filterEnd: 900,
          filterVel: 1800,
          filterQ: 0.7,
        };
    }
  }

  function buildVoice(ac, freq, vol, velocity, cfg) {
    const t = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * cfg.peak), t + cfg.attack);
    master.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, vol * cfg.sustain),
      t + cfg.decay1
    );
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * cfg.tail), t + cfg.decay2);

    const filter = ac.createBiquadFilter();
    filter.type = cfg.filterType || "lowpass";
    filter.frequency.setValueAtTime(cfg.filterStart + velocity * cfg.filterVel, t);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(200, cfg.filterEnd + velocity * cfg.filterVel * 0.25),
      t + cfg.decay2
    );
    filter.Q.value = cfg.filterQ ?? 0.7;
    filter.connect(master);
    master.connect(ac.destination);

    const oscNodes = [];
    for (const spec of cfg.oscs) {
      const osc = ac.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = freq * (spec.ratio || 1);
      const g = ac.createGain();
      g.gain.value = spec.gain;
      osc.connect(g);
      g.connect(filter);
      osc.start(t);
      oscNodes.push(osc);
    }

    let lfo = null;
    let lfoGain = null;
    const vibHz = cfg.vibratoHz ?? 0;
    const vibDepth = cfg.vibratoDepth ?? 0;
    if (vibHz > 0 && oscNodes[0]) {
      lfo = ac.createOscillator();
      lfoGain = ac.createGain();
      lfo.frequency.value = vibHz;
      lfoGain.gain.value = freq * vibDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(oscNodes[0].frequency);
      lfo.start(t);
      oscNodes.push(lfo);
    }

    return {
      oscs: oscNodes,
      master,
      filter,
      lfo,
      lfoGain,
      baseFreq: freq,
      maxVibratoDepth: freq * Math.max(vibDepth, 0.018),
      sustainGain: Math.max(0.0002, vol * cfg.sustain),
      started: t,
      peak: vol,
    };
  }

  function releaseVoiceEntry(entry, silent, releaseOverride) {
    const voice = entry.voice;
    const ac = ensure();
    const t = ac.currentTime;
    const inst = entry.instrument || effectiveInstrument();
    const scale = INSTRUMENTS[inst]?.sustainScale ?? 1;
    const base = silent ? 0.001 : Math.max(0.001, (sustainMs / 1000) * scale);
    const release =
      releaseOverride != null ? releaseOverride : Math.min(SUSTAIN_MS_MAX / 1000 + 0.5, base);

    try {
      voice.master.gain.cancelScheduledValues(t);
      const now = Math.max(0.0001, voice.master.gain.value);
      voice.master.gain.setValueAtTime(now, t);
      voice.master.gain.exponentialRampToValueAtTime(0.0001, t + release);
      const stopAt = t + release + 0.08;
      for (const osc of voice.oscs) {
        try {
          osc.stop(stopAt);
        } catch {
          /* */
        }
      }
    } catch {
      for (const osc of voice.oscs) {
        try {
          osc.stop();
        } catch {
          /* */
        }
      }
    }
  }

  function noteOffVoice(voiceId, silent = false, releaseOverride = null) {
    const entry = voices.get(voiceId);
    if (!entry) return;
    voices.delete(voiceId);
    releaseVoiceEntry(entry, silent, releaseOverride);
  }

  function noteOffMidi(midi, silent = false, releaseOverride = null) {
    for (const [id, entry] of [...voices.entries()]) {
      if (entry.midi === midi) noteOffVoice(id, silent, releaseOverride);
    }
  }

  /** @returns {number} voiceId */
  function noteOn(midi, velocity = 0.75, opts = {}) {
    const ac = ensure();
    if (!opts.poly) noteOffMidi(midi, true);

    const inst = effectiveInstrument();
    const freq = midiToFreq(midi);
    const vol = Math.min(0.92, velocity * 0.38 * loudnessCompensation(freq));
    const cfg = voiceConfig(inst);
    const voice = buildVoice(ac, freq, vol, velocity, cfg);
    const id = nextVoiceId++;
    voices.set(id, { midi, voice, instrument: inst });
    return id;
  }

  function noteOff(midi, silent = false, releaseOverride = null) {
    noteOffMidi(midi, silent, releaseOverride);
  }

  function noteOffPluck(voiceId) {
    const entry = voices.get(voiceId);
    const inst = entry?.instrument || effectiveInstrument();
    const scale = INSTRUMENTS[inst]?.sustainScale ?? 1;
    const rel =
      sustainMs <= 0
        ? 0.001
        : Math.min(SUSTAIN_MS_MAX / 1000 + 0.5, Math.max(0.001, (sustainMs / 1000) * scale));
    noteOffVoice(voiceId, false, rel);
  }

  function play(midi, velocity = 0.75, duration = 0.35) {
    const id = noteOn(midi, velocity);
    const ms = Math.max(80, duration * 1000);
    setTimeout(() => noteOffVoice(id), ms);
  }

  function entryForVoiceId(voiceId) {
    return voices.get(voiceId);
  }

  function setLiveVibrato(voiceIdOrMidi, depthMultiplier = 0, hz = null) {
    let entry = entryForVoiceId(voiceIdOrMidi);
    if (!entry) {
      for (const [, e] of voices) {
        if (e.midi === voiceIdOrMidi) {
          entry = e;
          break;
        }
      }
    }
    if (!entry?.voice?.lfoGain) return;
    const ac = ensure();
    const t = ac.currentTime;
    const depth = Math.max(0, depthMultiplier) * (entry.voice.maxVibratoDepth || 0);
    entry.voice.lfoGain.gain.setTargetAtTime(depth, t, 0.025);
    if (hz != null && entry.voice.lfo) {
      entry.voice.lfo.frequency.setTargetAtTime(hz, t, 0.025);
    }
  }

  function setLiveGain(voiceId, multiplier = 1) {
    const entry = entryForVoiceId(voiceId);
    if (!entry?.voice?.master) return;
    const ac = ensure();
    const t = ac.currentTime;
    const m = Math.max(0.12, Math.min(2, multiplier));
    const target = Math.max(0.0003, (entry.voice.sustainGain || 0.08) * m);
    entry.voice.master.gain.cancelScheduledValues(t);
    entry.voice.master.gain.setTargetAtTime(target, t, 0.028);
  }

  function stopAll() {
    for (const id of [...voices.keys()]) noteOffVoice(id, true);
  }

  return {
    ensure,
    noteOn,
    noteOff,
    noteOffVoice,
    noteOffPluck,
    play,
    stopAll,
    setLiveVibrato,
    setLiveGain,
    setDynamicPressure,
    setSustainMs,
    getSustainMs,
    setInstrument,
    getInstruments,
    velocityFromPointer,
    midiToFreq,
  };
})();

window.AudioEngine = AudioEngine;
