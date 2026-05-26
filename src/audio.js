/** Sentez enstrüman sesleri — Web Audio */
const AudioEngine = (() => {
  let ctx = null;
  const voices = new Map();

  let dynamicPressure = true;
  let sustainEnabled = true;
  let instrumentId = "piano";
  const RELEASE_FAST = 0.05;
  const RELEASE_SLOW = 0.55;

  const INSTRUMENTS = {
    piano: { label: "Piyano", sustainScale: 1 },
    violin: { label: "Keman", sustainScale: 1.15 },
    guitar: { label: "Gitar", sustainScale: 0.35 },
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

  function setSustain(on) {
    sustainEnabled = !!on;
  }

  function setInstrument(id) {
    if (INSTRUMENTS[id]) instrumentId = id;
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

  function voiceConfig(id) {
    switch (id) {
      case "violin":
        return {
          oscs: [{ type: "sawtooth", gain: 0.42 }, { type: "sine", ratio: 2, gain: 0.12 }],
          peak: 0.42,
          attack: 0.07,
          sustain: 0.32,
          decay1: 0.45,
          decay2: 2.6,
          tail: 0.06,
          filterType: "lowpass",
          filterStart: 2400,
          filterEnd: 900,
          filterVel: 1400,
          filterQ: 1.8,
          vibratoHz: 5.5,
          vibratoDepth: 0.007,
        };
      case "guitar":
        return {
          oscs: [{ type: "triangle", gain: 0.55 }, { type: "sine", ratio: 2, gain: 0.08 }],
          peak: 0.48,
          attack: 0.004,
          sustain: 0.12,
          decay1: 0.08,
          decay2: 0.55,
          tail: 0.02,
          filterType: "bandpass",
          filterStart: 1800,
          filterEnd: 600,
          filterVel: 800,
          filterQ: 1.2,
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
          sustain: 0.45,
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

    if (cfg.vibratoHz && oscNodes[0]) {
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      lfo.frequency.value = cfg.vibratoHz;
      lfoGain.gain.value = freq * (cfg.vibratoDepth || 0.006);
      lfo.connect(lfoGain);
      lfoGain.connect(oscNodes[0].frequency);
      lfo.start(t);
      oscNodes.push(lfo);
    }

    return { oscs: oscNodes, master, filter, started: t, peak: vol };
  }

  function noteOn(midi, velocity = 0.75) {
    const ac = ensure();
    noteOff(midi, true);

    const freq = midiToFreq(midi);
    const vol = velocity * 0.38;
    const cfg = voiceConfig(instrumentId);
    const voice = buildVoice(ac, freq, vol, velocity, cfg);
    voices.set(midi, voice);
  }

  function noteOff(midi, silent = false) {
    const voice = voices.get(midi);
    if (!voice) return;
    voices.delete(midi);

    const ac = ensure();
    const t = ac.currentTime;
    const scale = INSTRUMENTS[instrumentId]?.sustainScale ?? 1;
    const base = silent ? 0.001 : sustainEnabled ? RELEASE_SLOW : RELEASE_FAST;
    const release = Math.min(1.2, base * scale);

    try {
      voice.master.gain.cancelScheduledValues(t);
      const now = Math.max(0.0001, voice.master.gain.value);
      voice.master.gain.setValueAtTime(now, t);
      voice.master.gain.exponentialRampToValueAtTime(0.0001, t + release);

      const stopAt = t + release + 0.06;
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

  function play(midi, velocity = 0.75, duration = 0.35) {
    noteOn(midi, velocity);
    const ms = Math.max(80, duration * 1000);
    setTimeout(() => noteOff(midi), ms);
  }

  function stopAll() {
    for (const midi of [...voices.keys()]) noteOff(midi, true);
  }

  return {
    ensure,
    noteOn,
    noteOff,
    play,
    stopAll,
    setDynamicPressure,
    setSustain,
    setInstrument,
    getInstruments,
    velocityFromPointer,
    midiToFreq,
  };
})();

window.AudioEngine = AudioEngine;
