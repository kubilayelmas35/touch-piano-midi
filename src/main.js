/* Otomatik birleştirilmiş — npm start öncesi üretilir */

/* === settings.js === */
const AppSettings = (() => {
  const KEY = "touch-piano-settings";
  const defaults = {
    octaveStart: 3,
    octaveCount: 2,
    keyWidth: 48,
    keyHeight: 160,
    dynamicPressure: true,
    sustainEnabled: true,
    timingWindow: 200,
    speed: 100,
    labelMode: "note",
    labelPreset: "game",
    customLabels: "Z,X,C,V,B,N,M,A,S,D,F,G,H,J",
    flameIntensity: 1,
    flameStyle: "aurora",
    trimStart: 0,
    trimEnd: 0,
    midiLabels: {},
    keyboardEnabled: true,
    sidebarVisible: true,
    autoKeyboardFromSong: true,
    octaveLockManual: false,
    effectHue: 275,
    keyColorTop: "#e8d4ff",
    keyColorMid: "#a855f7",
    keyColorBottom: "#6b21a8",
    hitLineColor: "#d8b4fe",
    pianoDock: "bottom",
    pianoAlign: "stretch",
    instrumentId: "piano",
    playMode: "piano",
    themesByMode: {},
    instrumentPromptDone: false,
    panelLayout: {},
    stringVibratoSens: 1,
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return { ...defaults };
    }
  }

  function save(partial) {
    const next = { ...load(), ...partial };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  return { load, save, defaults };
})();

window.AppSettings = AppSettings;


/* === theme.js === */
/** Tema — enstrümana göre ayrı renk paletleri */
const AppTheme = (() => {
  const PRESETS = {
    piano: {
      effectHue: 275,
      keyColorTop: "#e8d4ff",
      keyColorMid: "#a855f7",
      keyColorBottom: "#6b21a8",
      hitLineColor: "#d8b4fe",
      surfaceAccent: "#6c9eff",
    },
    guitar: {
      effectHue: 38,
      keyColorTop: "#f5e6c8",
      keyColorMid: "#c9a227",
      keyColorBottom: "#5c4a1e",
      hitLineColor: "#e8c468",
      surfaceAccent: "#d4a017",
    },
    violin: {
      effectHue: 350,
      keyColorTop: "#ffe4ec",
      keyColorMid: "#e11d48",
      keyColorBottom: "#881337",
      hitLineColor: "#fda4af",
      surfaceAccent: "#fb7185",
    },
  };

  function apply(partial) {
    const s = { ...PRESETS.piano, ...partial };
    const r = document.documentElement;
    r.style.setProperty("--effect-hue", String(s.effectHue));
    r.style.setProperty("--key-active-top", s.keyColorTop);
    r.style.setProperty("--key-active-mid", s.keyColorMid);
    r.style.setProperty("--key-active-bottom", s.keyColorBottom);
    r.style.setProperty("--hit-line-color", s.hitLineColor);
    if (s.surfaceAccent) r.style.setProperty("--accent", s.surfaceAccent);
    window.__effectHue = s.effectHue;
    return s;
  }

  function getPreset(mode) {
    return { ...(PRESETS[mode] || PRESETS.piano) };
  }

  function fromSettings(s, playMode) {
    const mode = playMode || s.playMode || "piano";
    const saved = s.themesByMode?.[mode];
    return apply({ ...getPreset(mode), ...saved });
  }

  function readFromInputs(inputs, mode) {
    const base = getPreset(mode);
    return {
      ...base,
      effectHue: Number(inputs.effectHue?.value) || base.effectHue,
      keyColorTop: inputs.keyColorTop?.value || base.keyColorTop,
      keyColorMid: inputs.keyColorMid?.value || base.keyColorMid,
      keyColorBottom: inputs.keyColorBottom?.value || base.keyColorBottom,
      hitLineColor: inputs.hitLineColor?.value || base.hitLineColor,
    };
  }

  function fillInputs(inputs, theme) {
    if (inputs.effectHue) inputs.effectHue.value = String(theme.effectHue);
    if (inputs.keyColorTop) inputs.keyColorTop.value = theme.keyColorTop;
    if (inputs.keyColorMid) inputs.keyColorMid.value = theme.keyColorMid;
    if (inputs.keyColorBottom) inputs.keyColorBottom.value = theme.keyColorBottom;
    if (inputs.hitLineColor) inputs.hitLineColor.value = theme.hitLineColor;
  }

  function saveForMode(mode, theme, settings) {
    const themesByMode = { ...(settings.themesByMode || {}) };
    themesByMode[mode] = { ...themesByMode[mode], ...theme };
    return themesByMode;
  }

  return {
    apply,
    fromSettings,
    getPreset,
    readFromInputs,
    fillInputs,
    saveForMode,
    PRESETS,
  };
})();

window.AppTheme = AppTheme;


/* === audio.js === */
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
          vibratoHz: 5.5,
          vibratoDepth: 0.003,
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

  function setLiveVibrato(midi, depthMultiplier = 0, hz = null) {
    const voice = voices.get(midi);
    if (!voice?.lfoGain) return;
    const ac = ensure();
    const t = ac.currentTime;
    const depth = Math.max(0, depthMultiplier) * (voice.maxVibratoDepth || 0);
    voice.lfoGain.gain.setTargetAtTime(depth, t, 0.025);
    if (hz != null && voice.lfo) {
      voice.lfo.frequency.setTargetAtTime(hz, t, 0.025);
    }
  }


  function setLiveGain(midi, multiplier = 1) {
    const voice = voices.get(midi);
    if (!voice?.master) return;
    const ac = ensure();
    const t = ac.currentTime;
    const m = Math.max(0.12, Math.min(2, multiplier));
    const target = Math.max(0.0003, (voice.sustainGain || 0.08) * m);
    voice.master.gain.cancelScheduledValues(t);
    voice.master.gain.setTargetAtTime(target, t, 0.028);
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
    setLiveVibrato,
    setLiveGain,
    setDynamicPressure,
    setSustain,
    setInstrument,
    getInstruments,
    velocityFromPointer,
    midiToFreq,
  };
})();

window.AudioEngine = AudioEngine;


/* === key-labels.js === */
/** Tuş etiketleri — nota, harf, özel veya tuş başına (sağ tık) */
const KeyLabels = (() => {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

  const PRESET_GAME = "ZXCVBNMASDFGHJ".split("");
  const PRESET_PIANO = "AWSEDRTYUIOPGHJKL".split("");

  let mode = "note";
  let customString = "ZXCVBNMASDFGHJ";
  let letterPreset = "game";
  /** midi → tek harf (beyaz/siyah) */
  const midiLabels = new Map();

  function setMode(m) {
    mode = m || "note";
  }

  function setCustomString(s) {
    customString = String(s || "");
  }

  function setLetterPreset(p) {
    letterPreset = p || "game";
  }

  function getPresetLetters() {
    if (letterPreset === "piano") return PRESET_PIANO;
    return PRESET_GAME;
  }

  function parseCustomList(str) {
    return String(str)
      .split(/[,;\s]+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }

  function setMidiLabel(midi, letter) {
    const m = Number(midi);
    const ch = String(letter || "").trim();
    if (!ch) {
      midiLabels.delete(m);
      return;
    }
    midiLabels.set(m, ch.length === 1 ? ch : ch[0]);
  }

  function getMidiLabel(midi) {
    return midiLabels.get(Number(midi)) || "";
  }

  function getMidiLabelsObject() {
    const o = {};
    midiLabels.forEach((v, k) => {
      o[k] = v;
    });
    return o;
  }

  function loadMidiLabelsObject(obj) {
    midiLabels.clear();
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (v) midiLabels.set(Number(k), String(v).slice(0, 1));
    }
  }

  function noteNameForMidi(midi) {
    const oct = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES[midi % 12]}${oct}`;
  }

  function labelForMidi(midi, startMidi, endMidi) {
    if (midiLabels.has(midi)) {
      return midiLabels.get(midi);
    }

    if (mode === "note") {
      return NOTE_NAMES[midi % 12];
    }

    const pc = midi % 12;
    const isWhite = WHITE_PC.includes(pc);

    if (mode === "letters") {
      if (!isWhite) return "·";
      let whiteIndex = 0;
      for (let m = startMidi; m <= endMidi; m++) {
        if (!WHITE_PC.includes(m % 12)) continue;
        if (m === midi) {
          const letters = getPresetLetters();
          return letters[whiteIndex % letters.length] || "?";
        }
        whiteIndex++;
      }
      return "";
    }

    if (mode === "custom") {
      const chars = parseCustomList(customString);
      if (!isWhite) return chars.length > 20 ? "·" : "";
      let wi = 0;
      for (let m = startMidi; m <= endMidi; m++) {
        if (!WHITE_PC.includes(m % 12)) continue;
        if (m === midi) return chars[wi]?.toUpperCase() || "?";
        wi++;
      }
    }

    return NOTE_NAMES[midi % 12];
  }

  function applyToKeys(keyMap, range) {
    const { startMidi, endMidi } = range;
    keyMap.forEach((el, midi) => {
      const label = el.querySelector(".key-label");
      if (!label) return;
      const text = labelForMidi(midi, startMidi, endMidi);
      label.textContent = text;
      const mapped = midiLabels.has(midi);
      label.classList.toggle("letter-mode", mode !== "note" || mapped);
      el.title = mapped
        ? `${noteNameForMidi(midi)} → "${text}" (sağ tık: değiştir)`
        : `${noteNameForMidi(midi)} — sağ tık ile harf ata`;
    });
  }

  return {
    setMode,
    setCustomString,
    setLetterPreset,
    setMidiLabel,
    getMidiLabel,
    getMidiLabelsObject,
    loadMidiLabelsObject,
    noteNameForMidi,
    labelForMidi,
    applyToKeys,
    getMode: () => mode,
    getCustomString: () => customString,
    hasMidiLabels: () => midiLabels.size > 0,
  };
})();

window.KeyLabels = KeyLabels;


/* === flame-styles.js === */
/** Alev / nota çizim stilleri */
const FlameStyles = (() => {
  const PITCH_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  let current = "aurora";

  function hueToRgb(h, a = 1) {
    const s = h / 360;
    const c = 0.9;
    const x = c * (1 - Math.abs(((s * 6) % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (s < 1 / 6) [r, g, b] = [c, x, 0];
    else if (s < 2 / 6) [r, g, b] = [x, c, 0];
    else if (s < 3 / 6) [r, g, b] = [0, c, x];
    else if (s < 4 / 6) [r, g, b] = [0, x, c];
    else if (s < 5 / 6) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return `${Math.round((r + 0.1) * 255)},${Math.round((g + 0.1) * 255)},${Math.round((b + 0.1) * 255)}`;
  }

  function pitchColor(midi, noteH, velocity, alpha = 1) {
    const hue = PITCH_HUES[midi % 12];
    const isSmall = noteH < 22;
    const sat = isSmall ? 95 : 75;
    const light = isSmall ? 72 : 52 + (velocity || 0.7) * 15;
    return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
  }

  const styles = {
    aurora: {
      name: "Aurora (mor)",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        const hu = (275 + (midi % 12) * 4) % 360;
        const r = Math.min(w * 0.48, 12);
        ctx.save();
        ctx.shadowColor = `hsla(${hu}, 100%, 65%, 0.85)`;
        ctx.shadowBlur = 14 * intensity;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, `hsla(${hu}, 75%, 75%, 0.95)`);
        g.addColorStop(1, `hsla(${hu}, 100%, 48%, 1)`);
        ctx.fillStyle = g;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
      },
      particle(p) {
        p.rgb = "200,120,255";
        p.star = true;
      },
    },

    fire: {
      name: "Alev",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, "rgba(180,255,200,0.4)");
          g.addColorStop(1, "rgba(34,160,80,1)");
          ctx.fillStyle = g;
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(180,50,50,0.55)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          const top = pitchColor(midi, h, vel, 0.85);
          g.addColorStop(0, top);
          g.addColorStop(0.4, `hsla(${(PITCH_HUES[midi % 12] + 40) % 360}, 90%, 65%, 0.9)`);
          g.addColorStop(0.75, "rgba(255,100,30,0.95)");
          g.addColorStop(1, "rgba(255,40,0,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(255,100,40,0.8)";
          ctx.shadowBlur = 14 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p, hot) {
        p.rgb = hot
          ? ["255,245,160", "255,120,32", "255,34,0"][Math.floor(Math.random() * 3)]
          : hueToRgb(PITCH_HUES[(p.midi || 0) % 12], 0.85);
      },
    },

    ice: {
      name: "Buz",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "rgba(120,255,200,0.9)";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(100,80,120,0.5)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, pitchColor(midi, h, vel, 0.9));
          g.addColorStop(0.5, "rgba(150,230,255,0.95)");
          g.addColorStop(1, "rgba(40,120,255,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(100,200,255,0.7)";
          ctx.shadowBlur = 12 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = p.hot ? "170,240,255" : hueToRgb(200);
      },
    },

    neon: {
      name: "Neon",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        const hue = PITCH_HUES[midi % 12];
        if (state === "hit") {
          ctx.fillStyle = `hsla(${hue},100%,60%,1)`;
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(80,80,80,0.4)";
        } else {
          ctx.fillStyle = pitchColor(midi, h, vel, 1);
          ctx.shadowColor = `hsl(${hue},100%,55%)`;
          ctx.shadowBlur = 20 * intensity;
          ctx.strokeStyle = `hsla(${hue},100%,80%,0.9)`;
          ctx.lineWidth = 2;
        }
        roundFill(ctx, x, y, w, h);
        if (state === "pending") roundStroke(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = hueToRgb(PITCH_HUES[(p.midi || 0) % 12]);
      },
    },

    rainbow: {
      name: "Gökkuşağı",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "#4ade80";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(120,80,80,0.45)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          const n = 5;
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const hue = (PITCH_HUES[midi % 12] + t * 120) % 360;
            g.addColorStop(t, `hsla(${hue}, 90%, ${h < 22 ? 70 : 55}%, 0.95)`);
          }
          ctx.fillStyle = g;
          ctx.shadowColor = pitchColor(midi, h, vel, 0.6);
          ctx.shadowBlur = 10 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = hueToRgb((PITCH_HUES[(p.midi || 0) % 12] + Math.random() * 80) % 360);
      },
    },

    minimal: {
      name: "Sade",
      drawNote(ctx, x, y, w, h, state, midi, vel) {
        if (state === "hit") ctx.fillStyle = "rgba(74,222,128,0.85)";
        else if (state === "miss") ctx.fillStyle = "rgba(248,113,113,0.45)";
        else ctx.fillStyle = pitchColor(midi, h, vel, 0.88);
        roundFill(ctx, x, y, w, h);
      },
      particle(p) {
        p.rgb = hueToRgb(PITCH_HUES[(p.midi || 0) % 12]);
      },
    },

    plasma: {
      name: "Plazma",
      drawNote(ctx, x, y, w, h, state, midi, vel, intensity) {
        if (state === "hit") {
          ctx.fillStyle = "#a78bfa";
        } else if (state === "miss") {
          ctx.fillStyle = "rgba(80,40,80,0.5)";
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, pitchColor(midi, h, vel, 0.7));
          g.addColorStop(0.5, "rgba(200,100,255,0.95)");
          g.addColorStop(1, "rgba(120,0,200,1)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(180,80,255,0.9)";
          ctx.shadowBlur = 16 * intensity;
        }
        roundFill(ctx, x, y, w, h);
        ctx.shadowBlur = 0;
      },
      particle(p) {
        p.rgb = p.hot ? "233,213,255" : hueToRgb(280 + ((p.midi || 0) % 12) * 5);
      },
    },
  };

  function roundFill(ctx, x, y, w, h) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(6, w * 0.2));
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }

  function roundStroke(ctx, x, y, w, h) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(6, w * 0.2));
      ctx.stroke();
    }
  }

  function setStyle(id) {
    if (styles[id]) current = id;
  }

  function getStyle() {
    return styles[current] || styles.fire;
  }

  function getStyleIds() {
    return Object.keys(styles);
  }

  function getStyleName(id) {
    return styles[id]?.name || id;
  }

  return {
    setStyle,
    getStyle,
    getStyleIds,
    getStyleName,
    pitchColor,
    styles,
  };
})();

window.FlameStyles = FlameStyles;


/* === note-utils.js === */
/** Nota birleştirme, üst üste binenleri tekilleştirme */
const NoteUtils = (() => {
  function mergeAdjacentNotes(notes, maxGapSec = 0.15) {
    if (!notes?.length) return [];
    const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
    const out = [];

    for (const n of sorted) {
      const last = out[out.length - 1];
      const end = last ? last.time + last.duration : 0;
      if (
        last &&
        last.midi === n.midi &&
        n.time - end <= maxGapSec
      ) {
        const newEnd = Math.max(end, n.time + (n.duration || 0));
        last.duration = Math.max(0.06, newEnd - last.time);
        last.velocity = Math.max(last.velocity || 0, n.velocity || 0);
        continue;
      }
      out.push({
        midi: n.midi,
        time: n.time,
        duration: Math.max(0.06, n.duration || 0.1),
        velocity: n.velocity ?? 0.75,
        name: n.name,
      });
    }
    return out;
  }

  /** Aynı perdede çakışan aralıkları birleştir */
  function mergeOverlappingSamePitch(notes) {
    const groups = new Map();
    for (const n of notes) {
      if (!groups.has(n.midi)) groups.set(n.midi, []);
      groups.get(n.midi).push(n);
    }
    const out = [];
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.time - b.time);
      let cur = { ...arr[0] };
      for (let i = 1; i < arr.length; i++) {
        const n = arr[i];
        const curEnd = cur.time + cur.duration;
        if (n.time < curEnd + 0.04) {
          const newEnd = Math.max(curEnd, n.time + n.duration);
          cur.duration = newEnd - cur.time;
          cur.velocity = Math.max(cur.velocity || 0, n.velocity || 0);
        } else {
          out.push(cur);
          cur = { ...n };
        }
      }
      out.push(cur);
    }
    return out.sort((a, b) => a.time - b.time || a.midi - b.midi);
  }

  function cleanupNotes(notes, minDuration = 0.08) {
    let list = mergeAdjacentNotes(notes, 0.18);
    list = mergeOverlappingSamePitch(list);
    list = mergeAdjacentNotes(list, 0.12);
    return list.filter((n) => (n.duration || 0) >= minDuration);
  }

  return { mergeAdjacentNotes, mergeOverlappingSamePitch, cleanupNotes };
})();

window.NoteUtils = NoteUtils;


/* === note-renderer.js === */
/** Mor/neon düşen notalar, vuruş parıltısı, aurora */
const NoteRenderer = (() => {
  function baseHue() {
    const v = window.__effectHue;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    const css = getComputedStyle(document.documentElement).getPropertyValue("--effect-hue");
    return Number(css) || 275;
  }

  function hue(midi) {
    return (baseHue() + (midi % 12) * 4) % 360;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, rad);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  function drawLane(ctx, x, w, h, hitY, midi, t) {
    const hu = hue(midi);
    const pulse = 0.04 + Math.sin(t * 2.5 + midi * 0.08) * 0.02;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.45, `hsla(${hu}, 80%, 55%, ${pulse})`);
    g.addColorStop(0.55, `hsla(${hu}, 90%, 65%, ${pulse * 1.2})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w * 0.6, 0, w * 1.2, hitY + 8);
  }

  function drawNote(ctx, opts) {
    const { x, y, w, h, midi, vel, state, styleId, intensity, time } = opts;
    if (h < 2) return;

    const style = window.FlameStyles?.styles?.[styleId];
    if (style?.drawNote && styleId && styleId !== "aurora") {
      style.drawNote(ctx, x, y, w, h, state, midi, vel, intensity);
      return;
    }

    const hu = hue(midi);
    const v = vel ?? 0.75;
    const cx = x + w / 2;
    const r = Math.min(w * 0.48, 12);

    if (state === "hit") {
      ctx.save();
      ctx.shadowColor = `hsla(${hu}, 100%, 75%, 1)`;
      ctx.shadowBlur = 22;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, `hsla(${hu}, 90%, 85%, 1)`);
      g.addColorStop(1, `hsla(${hu}, 100%, 55%, 1)`);
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (state === "miss") {
      ctx.fillStyle = "rgba(248, 113, 113, 0.4)";
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.shadowColor = `hsla(${hu}, 100%, 65%, 0.9)`;
    ctx.shadowBlur = (14 + v * 8) * intensity;
    const body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, `hsla(${hu}, 70%, 78%, 0.95)`);
    body.addColorStop(0.35, `hsla(${hu}, 95%, 62%, 1)`);
    body.addColorStop(0.75, `hsla(${hu}, 100%, 52%, 1)`);
    body.addColorStop(1, `hsla(${hu}, 100%, 42%, 1)`);
    ctx.fillStyle = body;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    const shine = ctx.createLinearGradient(x, y, x + w * 0.4, y + h * 0.3);
    shine.addColorStop(0, "rgba(255,255,255,0.4)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    roundRect(ctx, x + w * 0.08, y + 1, w * 0.3, Math.min(h * 0.3, 20), r * 0.4);
    ctx.fill();

    const bottomY = y + h;
    const cap = ctx.createRadialGradient(cx, bottomY, 0, cx, bottomY, w * 0.7);
    cap.addColorStop(0, `rgba(255,255,255,${0.5 + v * 0.3})`);
    cap.addColorStop(0.4, `hsla(${hu}, 100%, 75%, 0.85)`);
    cap.addColorStop(1, `hsla(${hu}, 100%, 50%, 0)`);
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(cx, bottomY, w * 0.5, Math.min(8, h * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function spawnImpactParticles(particles, x, y, w, midi, count = 16) {
    const hu = hue(midi);
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const sp = 2 + Math.random() * 5;
      particles.push({
        x: x + (Math.random() - 0.5) * w * 0.5,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 2 + Math.random() * 4,
        hot: true,
        midi,
        rgb: `${180 + (hu % 60)},${100 + Math.random() * 80},255`,
        star: Math.random() > 0.5,
      });
    }
  }

  function drawKeyAuroras(ctx, auras, hitY, w, t) {
    for (const [midi, aura] of auras) {
      const power = aura.power * Math.max(0, aura.life);
      if (power < 0.02) continue;
      const hu = hue(midi);
      const x = aura.x;
      const kw = aura.w || 40;

      const pillar = ctx.createLinearGradient(x, hitY, x, hitY - 120);
      pillar.addColorStop(0, `hsla(${hu}, 90%, 65%, ${0.45 * power})`);
      pillar.addColorStop(0.5, `hsla(${hu}, 80%, 50%, ${0.2 * power})`);
      pillar.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pillar;
      ctx.fillRect(x - kw * 0.55, hitY - 130, kw * 1.1, 130);

      for (let i = 0; i < 8; i++) {
        const sx = x + Math.sin(t * 3 + midi + i) * kw * 0.35;
        const sy = hitY - 15 - i * 12 - Math.sin(t * 2 + i) * 6;
        const a = 0.35 * power * (0.5 + Math.sin(t * 5 + i) * 0.5);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return {
    drawNote,
    drawLane,
    drawKeyAuroras,
    spawnImpactParticles,
    hue,
  };
})();

window.NoteRenderer = NoteRenderer;


/* === piano-range.js === */
/** 88 tuşlu piyano aralığı (A0 – C8) */
const PianoRange = (() => {
  const MIN_MIDI = 21;
  const MAX_MIDI = 108;
  const MIN_START_OCTAVE = 0;
  const MAX_START_OCTAVE = 8;
  const MAX_OCTAVES = 7;

  function startMidiFromOctave(octave) {
    return (Number(octave) + 1) * 12;
  }

  function clampRange(startOctave, octaveCount) {
    let startOct = Number(startOctave);
    let startMidi = startMidiFromOctave(startOct);
    let count = Math.max(1, Math.min(MAX_OCTAVES, Number(octaveCount)));
    let endMidi = startMidi + count * 12 - 1;

    if (startMidi < MIN_MIDI) {
      startMidi = MIN_MIDI;
      endMidi = startMidi + count * 12 - 1;
      startOct = Math.max(MIN_START_OCTAVE, Math.floor(startMidi / 12) - 1);
    }
    if (endMidi > MAX_MIDI) {
      endMidi = MAX_MIDI;
      const maxCount = Math.floor((MAX_MIDI - startMidi + 1) / 12);
      count = Math.max(1, maxCount);
      endMidi = startMidi + count * 12 - 1;
      if (endMidi > MAX_MIDI) endMidi = MAX_MIDI;
    }

    return {
      startOctave: startOct,
      octaveCount: count,
      startMidi,
      endMidi,
    };
  }

  function getStartOctaveOptions() {
    const opts = [];
    for (let o = MIN_START_OCTAVE; o <= MAX_START_OCTAVE; o++) {
      const midi = startMidiFromOctave(o);
      if (midi > MAX_MIDI - 12) continue;
      const name = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midi % 12];
      const label = `Oktav ${o} (${name}${o})`;
      opts.push({ value: o, label });
    }
    return opts;
  }

  /** Şarkı notalarına göre klavye aralığı (C tabanlı tam oktavlar) */
  function fitRangeToNotes(notes, paddingSemitones = 2) {
    if (!notes?.length) return null;
    let minMidi = MAX_MIDI;
    let maxMidi = MIN_MIDI;
    for (const n of notes) {
      minMidi = Math.min(minMidi, n.midi);
      maxMidi = Math.max(maxMidi, n.midi);
    }
    minMidi = Math.max(MIN_MIDI, minMidi - paddingSemitones);
    maxMidi = Math.min(MAX_MIDI, maxMidi + paddingSemitones);

    let startMidi = minMidi;
    while (startMidi > MIN_MIDI && startMidi % 12 !== 0) startMidi--;

    let count = Math.ceil((maxMidi - startMidi + 1) / 12);
    count = Math.max(1, Math.min(MAX_OCTAVES, count));
    const startOctave = Math.floor(startMidi / 12) - 1;
    return clampRange(startOctave, count);
  }

  function getOctaveCountOptions(startOctave) {
    const opts = [];
    const startMidi = Math.max(MIN_MIDI, startMidiFromOctave(startOctave));
    for (let c = 1; c <= MAX_OCTAVES; c++) {
      const end = startMidi + c * 12 - 1;
      if (end > MAX_MIDI) break;
      opts.push({ value: c, label: `${c} oktav` });
    }
    return opts.length ? opts : [{ value: 1, label: "1 oktav" }];
  }

  return {
    MIN_MIDI,
    MAX_MIDI,
    MAX_OCTAVES,
    clampRange,
    startMidiFromOctave,
    getStartOctaveOptions,
    getOctaveCountOptions,
    fitRangeToNotes,
  };
})();

window.PianoRange = PianoRange;


/* === piano.js === */
/** Dokunmatik piyano — 88 tuş, otomatik boyut */
const Piano = (() => {
  const WHITE_PATTERN = [0, 2, 4, 5, 7, 9, 11];

  let container = null;
  let wrapEl = null;
  let range = { startMidi: 48, endMidi: 83 };
  let keyMap = new Map();
  let activePointers = new Map();
  let keyboardHeld = new Set();
  const holdCount = new Map();
  let onNoteDown = null;
  let onNoteUp = null;
  let keyWidth = 48;
  let keyHeight = 160;
  let autoFitWidth = true;

  function applySize() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--white-key-width", `${keyWidth}px`);
    wrapEl.style.setProperty("--piano-height", `${keyHeight}px`);
    if (window.Game && typeof window.Game.resize === "function") {
      window.Game.resize();
    }
  }

  function autoSizeKeys() {
    if (!wrapEl || !container) return;
    const whites = [...keyMap.keys()].filter((m) => WHITE_PATTERN.includes(m % 12));
    if (!whites.length) return;
    const avail = wrapEl.clientWidth - 16;
    const fit = Math.floor(avail / whites.length) - 1;
    keyWidth = Math.max(20, Math.min(100, fit));
    applySize();
  }

  function setKeySize(width, height) {
    autoFitWidth = false;
    keyWidth = Math.max(20, Math.min(100, width));
    keyHeight = Math.max(90, Math.min(420, height));
    applySize();
  }

  function setAutoFit(on) {
    autoFitWidth = !!on;
    if (autoFitWidth) autoSizeKeys();
  }

  function getKeySize() {
    return { keyWidth, keyHeight };
  }

  function refreshLabels() {
    if (window.KeyLabels && keyMap.size) {
      window.KeyLabels.applyToKeys(keyMap, range);
    }
    window.KeyboardInput?.rebuild?.();
  }

  function buildKeys(startOctave, octaveCount) {
    if (!container) return;

    window.KeyboardInput?.releaseAll?.();

    const clamped = window.PianoRange
      ? window.PianoRange.clampRange(startOctave, octaveCount)
      : {
          startMidi: (startOctave + 1) * 12,
          endMidi: (startOctave + 1) * 12 + octaveCount * 12 - 1,
        };

    range = {
      startMidi: clamped.startMidi,
      endMidi: clamped.endMidi,
    };

    keyMap.clear();
    activePointers.clear();
    keyboardHeld.clear();
    container.innerHTML = "";

    const whites = [];
    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PATTERN.includes(m % 12)) whites.push(m);
    }

    for (const midi of whites) {
      const el = createKey(midi, "white");
      container.appendChild(el);
      keyMap.set(midi, el);
    }

    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PATTERN.includes(m % 12)) continue;
      const el = createKey(m, "black");
      let prev = m - 1;
      while (prev >= range.startMidi && !keyMap.has(prev)) prev--;
      const anchor = keyMap.get(prev);
      if (anchor?.nextSibling) container.insertBefore(el, anchor.nextSibling);
      else container.appendChild(el);
      keyMap.set(m, el);
    }

    if (autoFitWidth) autoSizeKeys();
    else applySize();
    refreshLabels();
  }

  function createKey(midi, kind) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `key ${kind}`;
    el.dataset.midi = String(midi);
    const label = document.createElement("span");
    label.className = "key-label";
    label.textContent = "?";
    el.appendChild(label);
    bindPointer(el, midi);
    bindContextMenu(el, midi);
    return el;
  }

  function openLabelEditor(midi) {
    window.dispatchEvent(
      new CustomEvent("piano:edit-label", { detail: { midi: Number(midi) } })
    );
  }

  function bindContextMenu(el, midi) {
    const openMouse = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      openLabelEditor(midi);
    };

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.__touchPianoTouchInput) return;
      if (e.pointerType === "touch") return;
      openLabelEditor(midi);
    });

    el.addEventListener("auxclick", (e) => {
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.__touchPianoTouchInput || e.pointerType === "touch") return;
      openMouse(e);
    });
  }

  function releaseAll() {
    for (const [, m] of activePointers) {
      window.AudioEngine.noteOff(m);
    }
    activePointers.clear();
    for (const m of keyboardHeld) {
      window.AudioEngine.noteOff(m);
    }
    keyboardHeld.clear();
    holdCount.clear();
    keyMap.forEach((el) => {
      el.classList.remove("active", "hit-target", "miss-flash", "key-burst");
    });
  }

  function bindPointer(el, midi) {
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const vel = window.AudioEngine.velocityFromPointer(e);
      el.classList.add("active");
      activePointers.set(e.pointerId, midi);
      window.AudioEngine.noteOn(midi, vel);
      onNoteDown?.(midi, vel, e);
    };

    const up = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      e.preventDefault();
      activePointers.delete(e.pointerId);
      el.classList.remove("active");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      window.AudioEngine.noteOff(midi);
      onNoteUp?.(midi, e);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", (e) => {
      if (activePointers.get(e.pointerId) === midi) up(e);
    });
  }

  function pressKey(midi, velocity = 0.85) {
    if (!midiInRange(midi)) return;
    const el = keyMap.get(midi);
    if (!el) return;
    const next = (holdCount.get(midi) || 0) + 1;
    holdCount.set(midi, next);
    if (next > 1) return;
    keyboardHeld.add(midi);
    el.classList.add("active");
    window.AudioEngine.noteOn(midi, velocity);
    onNoteDown?.(midi, velocity);
  }

  function releaseKey(midi) {
    const cur = holdCount.get(midi) || 0;
    if (cur <= 0) return;
    const next = cur - 1;
    if (next > 0) {
      holdCount.set(midi, next);
      return;
    }
    holdCount.delete(midi);
    if (!keyboardHeld.has(midi)) return;
    keyboardHeld.delete(midi);
    const el = keyMap.get(midi);
    if (el) el.classList.remove("active");
    window.AudioEngine.noteOff(midi);
    onNoteUp?.(midi);
  }

  function flash(midi, type) {
    const el = keyMap.get(midi);
    if (!el) return;
    el.classList.remove("hit-target", "miss-flash");
    el.classList.add(type === "good" ? "hit-target" : "miss-flash");
    if (type === "good") el.classList.add("key-burst");
    setTimeout(() => el.classList.remove("hit-target", "miss-flash", "key-burst"), 320);
  }

  function init(rootEl, wrap, noteDownCb, noteUpCb) {
    container = rootEl;
    wrapEl = wrap;
    onNoteDown = noteDownCb;
    onNoteUp = noteUpCb;
    window.addEventListener("resize", () => {
      if (autoFitWidth) autoSizeKeys();
    });
  }

  function midiInRange(midi) {
    return midi >= range.startMidi && midi <= range.endMidi;
  }

  return {
    init,
    buildKeys,
    flash,
    refreshLabels,
    pressKey,
    releaseKey,
    setKeySize,
    setAutoFit,
    getKeySize,
    applySize,
    midiInRange,
    getRange: () => ({ ...range }),
    getKeyMap: () => keyMap,
    getKeyElement: (midi) => keyMap.get(midi),
    releaseAll,
  };
})();

window.Piano = Piano;


/* === guitar.js === */
/** Gitar — sol: tek akor/perde şeridi, sağ: tüm teller tek kutuda, çoklu dokunma */
const Guitar = (() => {
  const STRING_OPEN = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
  const DISPLAY_STRINGS = [5, 4, 3, 2, 1, 0];
  const FRET_COUNT = 14;

  let fretsRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 40, endMidi: 78 };
  let onNoteDown = null;
  let onNoteUp = null;
  let globalFret = 0;
  let fretButtons = [];
  let cellW = 48;
  let boardH = 140;

  function midiAt(stringIdx, fret) {
    return STRING_OPEN[stringIdx] + fret;
  }

  function currentMidiForString(stringIdx) {
    return midiAt(stringIdx, globalFret);
  }

  function applySizeVars() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--inst-string-h", `${Math.max(2, boardH / 7)}rem`);
  }

  function applySize() {
    applySizeVars();
    if (window.Game?.isReady?.()) window.Game.resize();
  }

  function setKeySize(width, height) {
    cellW = Math.max(28, Math.min(90, width));
    boardH = Math.max(90, Math.min(420, height));
    applySize();
  }

  function setAutoFit() {
    applySize();
  }

  function getKeySize() {
    return { keyWidth: cellW, keyHeight: boardH };
  }

  function getRange() {
    return { ...range };
  }

  function refreshLabels() {}

  function setGlobalFret(fret) {
    globalFret = Math.max(0, Math.min(FRET_COUNT, fret));
    fretButtons.forEach((btn) => {
      btn.classList.toggle("fret-held", Number(btn.dataset.fret) === globalFret);
    });
    stringsRoot?.querySelectorAll(".guitar-string-stripe").forEach((row) => {
      const label = row.querySelector(".guitar-string-fret");
      if (label) label.textContent = globalFret > 0 ? `perde ${globalFret}` : "açık";
      row.classList.toggle("has-fret", globalFret > 0);
    });
  }

  function releaseAll() {
    globalFret = 0;
    window.AudioEngine?.stopAll?.();
    fretButtons.forEach((btn) => btn.classList.remove("fret-held"));
    stringsRoot?.querySelectorAll(".guitar-string-stripe").forEach((el) => {
      el.classList.remove("active", "string-held", "string-vibrating", "has-fret");
    });
  }

  function buildChordStrip() {
    if (!fretsRoot) return;
    fretsRoot.innerHTML = "";
    fretsRoot.className = "guitar-chord-strip";
    fretButtons = [];

    const head = document.createElement("p");
    head.className = "guitar-chord-hint";
    head.textContent = "Tek akor — perde seçin, sonra sağdaki tellere vurun (birden fazla tel)";
    fretsRoot.appendChild(head);

    const row = document.createElement("div");
    row.className = "guitar-fret-picker";
    for (let f = 0; f <= FRET_COUNT; f++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "guitar-fret-btn";
      btn.dataset.fret = String(f);
      btn.textContent = f === 0 ? "∅" : String(f);
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        setGlobalFret(f);
      });
      row.appendChild(btn);
      fretButtons.push(btn);
    }
    fretsRoot.appendChild(row);

    const names = document.createElement("div");
    names.className = "guitar-open-notes";
    names.textContent = DISPLAY_STRINGS.map((s) => STRING_NAMES[s]).join(" · ");
    fretsRoot.appendChild(names);
    setGlobalFret(0);

    range = { startMidi: STRING_OPEN[0], endMidi: STRING_OPEN[5] + FRET_COUNT };
  }

  function buildStringBundle() {
    if (!stringsRoot) return;
    stringsRoot.innerHTML = "";
    stringsRoot.className = "guitar-strings-bundle";

    const title = document.createElement("div");
    title.className = "strings-bundle-title";
    title.textContent = "Teller (ince ↑ kalın ↓)";
    stringsRoot.appendChild(title);

    const bundle = document.createElement("div");
    bundle.className = "strings-bundle-inner";

    for (const s of DISPLAY_STRINGS) {
      const stripe = document.createElement("div");
      stripe.className = "guitar-string-stripe string-touch-target";
      stripe.dataset.string = String(s);
      stripe.innerHTML = `<span class="guitar-string-name">${STRING_NAMES[s]}</span><span class="guitar-string-fret">açık</span><span class="guitar-string-line string-line"></span>`;
      window.StringTouch?.bind(stripe, () => currentMidiForString(s), {
        onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
        onUp: (m, e) => onNoteUp?.(m, e),
      });
      bundle.appendChild(stripe);
    }
    stringsRoot.appendChild(bundle);
    setGlobalFret(globalFret);
  }

  function buildKeys() {
    buildChordStrip();
    buildStringBundle();
    applySize();
  }

  function init(fretsEl, stringsEl, wrap, noteDownCb, noteUpCb) {
    fretsRoot = fretsEl;
    stringsRoot = stringsEl;
    wrapEl = wrap;
    onNoteDown = noteDownCb;
    onNoteUp = noteUpCb;
    buildKeys();
  }

  function highlightMidi(midi, on) {
    stringsRoot?.querySelectorAll(".guitar-string-stripe").forEach((row) => {
      if (currentMidiForString(Number(row.dataset.string)) === midi) {
        row.classList.toggle("hit-target", on);
      }
    });
  }

  function flash(midi, type) {
    highlightMidi(midi, type === "good");
    setTimeout(() => highlightMidi(midi, false), 320);
  }

  function pressKey(midi, velocity = 0.85) {
    window.AudioEngine.noteOn(midi, velocity);
    onNoteDown?.(midi, velocity);
    highlightMidi(midi, true);
  }

  function releaseKey(midi) {
    window.AudioEngine.noteOff(midi);
    onNoteUp?.(midi);
    highlightMidi(midi, false);
  }

  return {
    init,
    buildKeys,
    getRange,
    releaseAll,
    setKeySize,
    setAutoFit,
    getKeySize,
    refreshLabels,
    highlightMidi,
    flash,
    pressKey,
    releaseKey,
    getWrap: () => wrapEl,
  };
})();

window.Guitar = Guitar;


/* === violin.js === */
/** Keman — sol: tek pozisyon şeridi, sağ: tüm teller tek kutuda */
const Violin = (() => {
  const STRING_OPEN = [55, 62, 69, 76];
  const STRING_NAMES = ["E", "A", "D", "G"];
  const DISPLAY_STRINGS = [3, 2, 1, 0];
  const POSITIONS = 13;

  let boardRoot = null;
  let stringsRoot = null;
  let wrapEl = null;
  let range = { startMidi: 55, endMidi: 88 };
  let onNoteDown = null;
  let onNoteUp = null;
  let globalPos = 0;
  let posButtons = [];
  let cellW = 40;
  let boardH = 160;

  function midiAt(stringIdx, pos) {
    return STRING_OPEN[stringIdx] + pos;
  }

  function currentMidiForString(stringIdx) {
    return midiAt(stringIdx, globalPos);
  }

  function applySizeVars() {
    if (!wrapEl) return;
    wrapEl.style.setProperty("--inst-cell-w", `${Math.max(1.1, cellW * 0.03)}rem`);
    wrapEl.style.setProperty("--inst-string-h", `${Math.max(2, boardH / 5.5)}rem`);
  }

  function applySize() {
    applySizeVars();
    if (window.Game?.isReady?.()) window.Game.resize();
  }

  function setKeySize(width, height) {
    cellW = Math.max(28, Math.min(90, width));
    boardH = Math.max(90, Math.min(420, height));
    applySize();
  }

  function setAutoFit() {
    applySize();
  }

  function getKeySize() {
    return { keyWidth: cellW, keyHeight: boardH };
  }

  function getRange() {
    return { ...range };
  }

  function refreshLabels() {}

  function setGlobalPos(pos) {
    globalPos = Math.max(0, Math.min(POSITIONS, pos));
    posButtons.forEach((btn) => {
      const p = Number(btn.dataset.pos);
      btn.classList.toggle("fret-held", p === globalPos);
    });
    stringsRoot?.querySelectorAll(".violin-string-stripe").forEach((row) => {
      const label = row.querySelector(".violin-string-fret");
      if (label) label.textContent = globalPos > 0 ? `pos ${globalPos}` : "açık";
      row.classList.toggle("has-fret", globalPos > 0);
    });
  }

  function releaseAll() {
    globalPos = 0;
    window.AudioEngine?.stopAll?.();
    posButtons.forEach((btn) => btn.classList.remove("fret-held"));
    stringsRoot?.querySelectorAll(".violin-string-stripe").forEach((el) => {
      el.classList.remove("active", "string-held", "string-vibrating", "has-fret");
    });
  }

  function buildPositionStrip() {
    if (!boardRoot) return;
    boardRoot.innerHTML = "";
    boardRoot.className = "violin-chord-strip";
    posButtons = [];

    const head = document.createElement("p");
    head.className = "guitar-chord-hint";
    head.textContent = "Tek pozisyon — seçin, sonra tellere vurun";
    boardRoot.appendChild(head);

    const row = document.createElement("div");
    row.className = "guitar-fret-picker";
    for (let p = 0; p <= POSITIONS; p++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "guitar-fret-btn";
      btn.dataset.pos = String(p);
      btn.textContent = p === 0 ? "∅" : String(p);
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        setGlobalPos(p);
      });
      row.appendChild(btn);
      posButtons.push(btn);
    }
    boardRoot.appendChild(row);
    setGlobalPos(0);
    range = {
      startMidi: STRING_OPEN[0],
      endMidi: STRING_OPEN[3] + POSITIONS,
    };
  }

  function buildStringBundle() {
    if (!stringsRoot) return;
    stringsRoot.innerHTML = "";
    stringsRoot.className = "violin-strings-bundle";

    const title = document.createElement("div");
    title.className = "strings-bundle-title";
    title.textContent = "Teller — çoklu dokunma";
    stringsRoot.appendChild(title);

    const bundle = document.createElement("div");
    bundle.className = "strings-bundle-inner";

    for (const s of DISPLAY_STRINGS) {
      const stripe = document.createElement("div");
      stripe.className = "violin-string-stripe string-touch-target";
      stripe.dataset.string = String(s);
      stripe.innerHTML = `<span class="violin-string-name">${STRING_NAMES[s]}</span><span class="violin-string-fret">açık</span><span class="violin-string-line string-line"></span>`;

      window.StringTouch?.bind(
        stripe,
        () => currentMidiForString(s),
        {
          onDown: (m, vel, e) => onNoteDown?.(m, vel, e),
          onUp: (m, e) => onNoteUp?.(m, e),
        }
      );
      bundle.appendChild(stripe);
    }
    stringsRoot.appendChild(bundle);
    setGlobalPos(globalPos);
  }

  function buildKeys() {
    buildPositionStrip();
    buildStringBundle();
    applySize();
  }

  function init(boardEl, stringsEl, wrap, noteDownCb, noteUpCb) {
    boardRoot = boardEl;
    stringsRoot = stringsEl;
    wrapEl = wrap;
    onNoteDown = noteDownCb;
    onNoteUp = noteUpCb;
    buildKeys();
  }

  function highlightMidi(midi, on) {
    stringsRoot?.querySelectorAll(".violin-string-stripe").forEach((row) => {
      const s = Number(row.dataset.string);
      if (currentMidiForString(s) === midi) row.classList.toggle("hit-target", on);
    });
  }

  function flash(midi, type) {
    highlightMidi(midi, type === "good");
    setTimeout(() => highlightMidi(midi, false), 320);
  }

  function pressKey(midi, velocity = 0.85) {
    window.AudioEngine.noteOn(midi, velocity);
    onNoteDown?.(midi, velocity);
    highlightMidi(midi, true);
  }

  function releaseKey(midi) {
    window.AudioEngine.noteOff(midi);
    onNoteUp?.(midi);
    highlightMidi(midi, false);
  }

  return {
    init,
    buildKeys,
    getRange,
    releaseAll,
    setKeySize,
    setAutoFit,
    getKeySize,
    refreshLabels,
    highlightMidi,
    flash,
    pressKey,
    releaseKey,
    getWrap: () => wrapEl,
  };
})();

window.Violin = Violin;


/* === string-touch.js === */
/** Dokunmatik tel — basılı tutup sürükleyerek titreşim; midi anlık hesaplanır */
const StringTouch = (() => {
  const pointers = new Map();

  function resolveMidi(getMidi) {
    return typeof getMidi === "function" ? getMidi() : getMidi;
  }

  function vibratoSens() {
    return window.AppSettings?.load?.()?.stringVibratoSens ?? 1;
  }

  function bind(el, getMidi, callbacks = {}) {
    const lineEl =
      el.querySelector(".string-line") ||
      el.querySelector(".guitar-string-line") ||
      el.querySelector(".violin-string-line") ||
      el;

    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const midi = resolveMidi(getMidi);
      if (!midi) return;
      el.setPointerCapture(e.pointerId);
      const vel = window.AudioEngine.velocityFromPointer(e);
      el.classList.add("active", "string-held");
      lineEl?.classList.add("string-line-active");
      window.AudioEngine.noteOn(midi, vel);
      callbacks.onDown?.(midi, vel, e);
      pointers.set(e.pointerId, {
        midi,
        el,
        lineEl,
        getMidi,
        lastX: e.clientX,
        lastY: e.clientY,
        smooth: 0,
      });
    };

    const move = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      const midi = resolveMidi(st.getMidi);
      if (midi !== st.midi) {
        window.AudioEngine.noteOff(st.midi);
        st.midi = midi;
        window.AudioEngine.noteOn(midi, window.AudioEngine.velocityFromPointer(e));
      }
      const dx = e.clientX - st.lastX;
      const dy = e.clientY - st.lastY;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      const speed = Math.hypot(dx, dy);
      st.smooth = st.smooth * 0.65 + speed * 0.35;

      const sens = vibratoSens();
      const depth = Math.min(4, 0.25 + st.smooth * 0.1 * sens);
      const hz = 4.5 + Math.min(5, st.smooth * 0.12 * sens);
      window.AudioEngine.setLiveVibrato?.(st.midi, depth, hz);

      const intensity = Math.min(1, st.smooth / 14);
      st.el.style.setProperty("--vib-intensity", String(intensity));
      st.el.classList.toggle("string-vibrating", intensity > 0.06);
      st.lineEl?.style.setProperty("--vib-intensity", String(intensity));
    };

    const end = (e) => {
      const st = pointers.get(e.pointerId);
      if (!st) return;
      e.preventDefault();
      pointers.delete(e.pointerId);
      st.el.classList.remove("active", "string-held", "string-vibrating");
      st.el.style.removeProperty("--vib-intensity");
      st.lineEl?.classList.remove("string-line-active");
      st.lineEl?.style.removeProperty("--vib-intensity");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      window.AudioEngine.setLiveVibrato?.(st.midi, 0);
      window.AudioEngine.noteOff(st.midi);
      callbacks.onUp?.(st.midi, e);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  return { bind };
})();

window.StringTouch = StringTouch;


/* === play-surface.js === */
/** Aktif çalma yüzeyi — piyano / gitar / keman */
const PlaySurface = (() => {
  const MODES = {
    piano: { label: "Piyano", icon: "🎹", sound: "piano" },
    guitar: { label: "Gitar", icon: "🎸", sound: "guitar" },
    violin: { label: "Keman", icon: "🎻", sound: "violin" },
  };

  let mode = "piano";
  let noteDownCb = null;
  let noteUpCb = null;

  function activeModule() {
    if (mode === "guitar") return window.Guitar;
    if (mode === "violin") return window.Violin;
    return window.Piano;
  }

  function getWrapEl() {
    if (mode === "guitar") return document.getElementById("guitarWrap");
    if (mode === "violin") return document.getElementById("violinWrap");
    return document.getElementById("pianoWrap");
  }

  function showPanel() {
    document.getElementById("pianoWrap")?.classList.toggle("hidden", mode !== "piano");
    document.getElementById("guitarWrap")?.classList.toggle("hidden", mode !== "guitar");
    document.getElementById("violinWrap")?.classList.toggle("hidden", mode !== "violin");
    document.body.dataset.playMode = mode;
    if (window.InstrumentMove) window.InstrumentMove.applyLayout(window.AppSettings.load());
  }

  function setMode(next, opts = {}) {
    const m = MODES[next] ? next : "piano";
    if (m === mode && !opts.force) return mode;

    window.Piano?.releaseAll?.();
    window.Guitar?.releaseAll?.();
    window.Violin?.releaseAll?.();
    window.KeyboardInput?.releaseAll?.();

    mode = m;
    showPanel();

    const mod = activeModule();
    if (mod && noteDownCb) {
      if (mode === "piano") {
        mod.init?.(
          document.getElementById("pianoKeys"),
          document.getElementById("pianoWrap"),
          noteDownCb,
          noteUpCb
        );
      } else if (mode === "guitar") {
        mod.init?.(
          document.getElementById("guitarFrets"),
          document.getElementById("guitarStrings"),
          document.getElementById("guitarWrap"),
          noteDownCb,
          noteUpCb
        );
      } else if (mode === "violin") {
        mod.init?.(
          document.getElementById("violinBoard"),
          document.getElementById("violinStrings"),
          document.getElementById("violinWrap"),
          noteDownCb,
          noteUpCb
        );
      }
    }

    if (opts.syncSound !== false) {
      window.AudioEngine?.setInstrument?.(MODES[mode].sound);
    }

    window.dispatchEvent(new CustomEvent("touch-piano:play-mode", { detail: { mode } }));
    requestAnimationFrame(() => {
      if (window.Game?.isReady?.()) window.Game.resize();
    });
    return mode;
  }

  function getMode() {
    return mode;
  }

  function getModes() {
    return MODES;
  }

  function init(noteDown, noteUp) {
    noteDownCb = noteDown;
    noteUpCb = noteUp;
    const s = window.AppSettings?.load?.() || {};
    setMode(s.playMode || "piano", { force: true, syncSound: false });
    if (s.instrumentId) window.AudioEngine?.setInstrument?.(s.instrumentId);
  }

  function delegate(name, ...args) {
    const mod = activeModule();
    if (mod && typeof mod[name] === "function") return mod[name](...args);
  }

  function flash(midi, type) {
    const mod = activeModule();
    if (mod?.flash) return mod.flash(midi, type);
    if (mod?.highlightMidi) return mod.highlightMidi(midi, type === "good");
  }

  function pressKey(midi, velocity) {
    return delegate("pressKey", midi, velocity);
  }

  function releaseKey(midi) {
    return delegate("releaseKey", midi);
  }

  return {
    init,
    setMode,
    getMode,
    getModes,
    getWrapEl,
    getRange: () => delegate("getRange"),
    releaseAll: () => {
      window.Piano?.releaseAll?.();
      window.Guitar?.releaseAll?.();
      window.Violin?.releaseAll?.();
    },
    buildKeys: (...a) => delegate("buildKeys", ...a),
    setKeySize: (...a) => delegate("setKeySize", ...a),
    setAutoFit: (...a) => delegate("setAutoFit", ...a),
    getKeySize: () => delegate("getKeySize"),
    refreshLabels: () => delegate("refreshLabels"),
    flash,
    pressKey,
    releaseKey,
    activeModule,
  };
})();

window.PlaySurface = PlaySurface;


/* === instrument-move.js === */
/** Enstrüman panellerini sürükleyerek konumlandır */
const InstrumentMove = (() => {
  let moveMode = false;
  let drag = null;

  const PANELS = {
    guitarFrets: { selector: "#guitarFretsPanel", defaultPos: { x: 1, y: 2 } },
    guitarStrings: { selector: "#guitarStringsPanel", defaultPos: { x: 72, y: 4 } },
    violinBoard: { selector: "#violinBoardPanel", defaultPos: { x: 1, y: 4 } },
    violinStrings: { selector: "#violinStringsPanel", defaultPos: { x: 72, y: 6 } },
  };

  function layoutKey(id) {
    return `panel_${id}`;
  }

  function applyPanelPosition(el, pos) {
    if (!el || !pos) return;
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
  }

  function applyLayout(settings) {
    const layout = settings?.panelLayout || {};
    for (const [id, meta] of Object.entries(PANELS)) {
      const el = document.querySelector(meta.selector);
      if (!el) continue;
      const pos = layout[layoutKey(id)] || meta.defaultPos;
      applyPanelPosition(el, pos);
    }
  }

  function savePanelPosition(id, x, y) {
    const s = window.AppSettings.load();
    const layout = { ...(s.panelLayout || {}) };
    layout[layoutKey(id)] = {
      x: Math.max(0, Math.min(92, x)),
      y: Math.max(0, Math.min(92, y)),
    };
    window.AppSettings.save({ panelLayout: layout });
  }

  function setMoveMode(on) {
    moveMode = !!on;
    document.body.classList.toggle("instrument-move-mode", moveMode);
    const btn = document.getElementById("btnMoveInstrument");
    if (btn) {
      btn.classList.toggle("active", moveMode);
      btn.textContent = moveMode ? "✓ Konumu kaydet" : "↔ Hareket ettir";
    }
  }

  function isMoveMode() {
    return moveMode;
  }

  function onPointerDown(e) {
    if (!moveMode) return;
    const handle = e.target.closest(".move-handle");
    if (!handle) return;
    const panel = handle.closest(".movable-panel");
    if (!panel) return;
    e.preventDefault();
    e.stopPropagation();
    const parent = panel.offsetParent || panel.parentElement;
    const pr = parent.getBoundingClientRect();
    const left = parseFloat(panel.style.left) || 0;
    const top = parseFloat(panel.style.top) || 0;
    drag = {
      panel,
      id: panel.dataset.moveId,
      parentW: pr.width,
      parentH: pr.height,
      startX: e.clientX,
      startY: e.clientY,
      origX: left,
      origY: top,
    };
    panel.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag) return;
    e.preventDefault();
    const dx = ((e.clientX - drag.startX) / drag.parentW) * 100;
    const dy = ((e.clientY - drag.startY) / drag.parentH) * 100;
    const x = Math.max(0, Math.min(92, drag.origX + dx));
    const y = Math.max(0, Math.min(92, drag.origY + dy));
    drag.panel.style.left = `${x}%`;
    drag.panel.style.top = `${y}%`;
  }

  function onPointerUp(e) {
    if (!drag) return;
    const x = parseFloat(drag.panel.style.left) || 0;
    const y = parseFloat(drag.panel.style.top) || 0;
    if (drag.id) savePanelPosition(drag.id, x, y);
    try {
      drag.panel.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    drag = null;
    window.Game?.resize?.();
  }

  function bind() {
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("pointermove", onPointerMove, { capture: true });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("pointercancel", onPointerUp, { capture: true });
  }

  bind();

  return { setMoveMode, isMoveMode, applyLayout };
})();

window.InstrumentMove = InstrumentMove;


/* === keyboard-input.js === */
/** Bilgisayar klavyesi → piyano (oktav değişince yeniden eşleme) */
const KeyboardInput = (() => {
  const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

  const WHITE_CODES = [
    "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM",
    "Comma", "KeyL", "Period", "Semicolon", "Slash",
    "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP",
    "BracketLeft", "BracketRight", "Backslash",
    "Digit1", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
    "Minus", "Equal",
  ];

  const BLACK_CODES = [
    "KeyS", "KeyD", "KeyG", "KeyH", "KeyJ",
    "KeyU", "KeyO", "KeyI", "KeyP",
    "KeyY", "KeyT", "KeyR", "KeyE", "KeyW", "KeyQ",
    "Digit2", "Digit3", "Digit5", "Digit6", "Digit7", "Digit9", "Digit0",
    "Minus", "Equal", "Backquote", "BracketLeft", "BracketRight",
  ];

  let enabled = true;
  let codeToMidi = new Map();
  let charToMidi = new Map();
  let held = new Set();
  let bound = false;

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function releaseAll() {
    for (const midi of [...held]) {
      held.delete(midi);
      window.Piano?.releaseKey?.(midi);
    }
  }

  function rebuild() {
    releaseAll();
    codeToMidi.clear();
    charToMidi.clear();
    if (!window.Piano) return;

    const range = window.Piano.getRange();
    const whites = [];
    const blacks = [];

    for (let m = range.startMidi; m <= range.endMidi; m++) {
      if (WHITE_PC.includes(m % 12)) whites.push(m);
      else blacks.push(m);
    }

    whites.forEach((midi, i) => {
      if (WHITE_CODES[i]) codeToMidi.set(WHITE_CODES[i], midi);
    });
    blacks.forEach((midi, i) => {
      if (BLACK_CODES[i]) codeToMidi.set(BLACK_CODES[i], midi);
    });

    for (let m = range.startMidi; m <= range.endMidi; m++) {
      const label = window.KeyLabels?.labelForMidi?.(m, range.startMidi, range.endMidi);
      if (!label || label === "·" || label === "?" || label.length !== 1) continue;
      const ch = label.toUpperCase();
      charToMidi.set(ch, m);
      charToMidi.set(ch.toLowerCase(), m);
    }
  }

  function resolveMidi(e) {
    if (codeToMidi.has(e.code)) return codeToMidi.get(e.code);

    const k = e.key;
    if (k && k.length === 1) {
      const upper = k.toUpperCase();
      if (charToMidi.has(upper)) return charToMidi.get(upper);
      if (charToMidi.has(k)) return charToMidi.get(k);
    }
    return null;
  }

  function noteOn(midi) {
    if (midi == null || held.has(midi)) return;
    if (!window.Piano?.midiInRange?.(midi)) return;
    held.add(midi);
    window.Piano.pressKey(midi, 0.85);
  }

  function noteOff(midi) {
    if (!held.has(midi)) return;
    held.delete(midi);
    window.Piano.releaseKey(midi);
  }

  function onKeyDown(e) {
    if (!enabled) return;
    if (e.repeat) return;
    if (isTypingTarget(e.target)) return;
    if (e.code === "F11" || e.code === "Escape") return;

    const midi = resolveMidi(e);
    if (midi == null) return;

    e.preventDefault();
    noteOn(midi);
  }

  function onKeyUp(e) {
    if (!enabled) return;
    if (isTypingTarget(e.target)) return;

    const midi = resolveMidi(e);
    if (midi == null) return;

    e.preventDefault();
    noteOff(midi);
  }

  function onBlur() {
    releaseAll();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) releaseAll();
  }

  function bind() {
    if (bound) return;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    bound = true;
  }

  function unbind() {
    if (!bound) return;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    releaseAll();
    bound = false;
  }

  return {
    bind,
    unbind,
    rebuild,
    releaseAll,
    setEnabled,
    isEnabled: () => enabled,
    getHeldCount: () => held.size,
  };
})();

window.KeyboardInput = KeyboardInput;


/* === game.js === */
/** Düşen notalar — stiller, renkler, süre */
const Game = (() => {
  const NOTE_HEIGHT_PX = 14;
  const LOOKAHEAD_SEC = 3;
  const HIT_LINE_FALLBACK = 0.88;

  let canvas, ctx;
  let notes = [];
  let pendingHits = [];
  let particles = [];
  let playing = false;
  let startTime = 0;
  let pausedAt = 0;
  let speed = 1;
  let animId = null;
  let timingWindowMs = 200;
  let score = 0;
  let combo = 0;
  let songDuration = 0;
  let flameIntensity = 1;
  let flameStyleId = "aurora";
  let trimStartSec = 0;
  let trimEndSec = 0;
  const keyAuras = new Map();
  const impactCooldown = new Map();
  let onScoreChange = null;
  let onFeedback = null;
  let onTimeUpdate = null;
  let keyPositions = new Map();
  let lastFrameT = 0;
  let autoPlayMode = false;

  function init(canvasEl, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
    onScoreChange = callbacks.onScoreChange;
    onFeedback = callbacks.onFeedback;
    onTimeUpdate = callbacks.onTimeUpdate;
    resize();
    window.addEventListener("resize", resize);
    const observeTargets = [
      document.getElementById("instrumentFooter"),
      document.getElementById("pianoWrap"),
      document.getElementById("guitarWrap"),
      document.getElementById("violinWrap"),
    ].filter(Boolean);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        resize();
        updateKeyPositions();
      });
      for (const el of observeTargets) ro.observe(el);
    }
  }

  function setFlameIntensity(level) {
    flameIntensity = Math.max(0.3, Math.min(2, level));
  }

  function setFlameStyle(styleId) {
    flameStyleId = styleId || "aurora";
    window.FlameStyles?.setStyle(flameStyleId);
  }

  function setTrim(startSec, endSec) {
    trimStartSec = Math.max(0, Number(startSec) || 0);
    trimEndSec = Math.max(0, Number(endSec) || 0);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function emitTime(t) {
    const total = songDuration || 0;
    const remaining = Math.max(0, total - t);
    onTimeUpdate?.({
      current: t,
      total,
      remaining,
      currentText: formatTime(t),
      totalText: formatTime(total),
      remainingText: formatTime(remaining),
      percent: total > 0 ? Math.min(100, (t / total) * 100) : 0,
    });
  }

  function isReady() {
    return !!(canvas && canvas.parentElement);
  }

  function resize() {
    if (!canvas?.parentElement) return;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth * devicePixelRatio;
    canvas.height = parent.clientHeight * devicePixelRatio;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    positionHitLine();
  }

  function getHitY() {
    const area = canvas?.parentElement;
    const instWrap =
      window.PlaySurface?.getWrapEl?.() || document.getElementById("pianoWrap");
    if (!area || !instWrap || instWrap.classList.contains("hidden")) {
      return area?.clientHeight * HIT_LINE_FALLBACK || 400;
    }
    const ar = area.getBoundingClientRect();
    const pr = instWrap.getBoundingClientRect();
    return Math.max(48, Math.round(pr.top - ar.top));
  }

  function positionHitLine() {
    const line = document.getElementById("hitLine");
    if (!line) return;
    const y = getHitY();
    line.style.top = `${y - 2}px`;
  }

  function updateKeyPositions() {
    keyPositions.clear();
    if (!canvas?.parentElement) return;
    const surface = window.PlaySurface;
    if (!surface) return;
    const range = surface.getRange();
    if (!range) return;
    const mode = surface.getMode();
    let selector = ".piano-keys .key";
    if (mode === "guitar") selector = ".guitar-string-stripe.string-touch-target";
    if (mode === "violin") selector = ".violin-string-stripe.string-touch-target";

    const area = canvas.parentElement;
    const areaRect = area.getBoundingClientRect();

    document.querySelectorAll(selector).forEach((key) => {
      const midi = Number(key.dataset.midi);
      if (!midi || midi < range.startMidi || midi > range.endMidi) return;
      const r = key.getBoundingClientRect();
      const centerX = r.left + r.width / 2 - areaRect.left;
      keyPositions.set(midi, { x: centerX, w: r.width });
    });
  }

  function clearAutoFlags() {
    for (const n of notes) {
      n._autoStarted = false;
      n._autoEnded = false;
    }
  }

  function setAutoPlayMode(on) {
    autoPlayMode = !!on;
    clearAutoFlags();
  }

  function isAutoPlayMode() {
    return autoPlayMode;
  }

  function releaseAllSound() {
    window.AudioEngine?.stopAll?.();
    window.PlaySurface?.releaseAll?.();
    window.KeyboardInput?.releaseAll?.();
  }

  function loadNotes(trackNotes, range) {
    stop();
    particles = [];
    keyAuras.clear();
    let list = trackNotes;
    if (window.NoteUtils?.cleanupNotes) {
      list = window.NoteUtils.cleanupNotes(trackNotes);
    }
    if (list.length && (trimStartSec > 0 || trimEndSec > 0)) {
      const rawEnd =
        list.length > 0 ? Math.max(...list.map((n) => n.time + n.duration)) : 0;
      const endLimit = Math.max(0, rawEnd - trimEndSec);
      list = list
        .filter((n) => n.time >= trimStartSec && n.time + n.duration <= endLimit + 0.001)
        .map((n) => ({
          ...n,
          time: Math.max(0, n.time - trimStartSec),
        }));
    }
    notes = list
      .filter((n) => n.midi >= range.startMidi && n.midi <= range.endMidi)
      .map((n) => ({
        midi: n.midi,
        time: n.time,
        duration: Math.max(0.08, n.duration),
        velocity: n.velocity,
        hit: false,
        missed: false,
        _autoStarted: false,
        _autoEnded: false,
      }))
      .sort((a, b) => a.time - b.time);

    pendingHits = notes.map((n) => ({ ...n, id: `${n.midi}-${n.time}` }));
    songDuration =
      notes.length > 0
        ? Math.max(...notes.map((n) => n.time + n.duration)) + 1.5
        : 0;
    score = 0;
    combo = 0;
    emitScore();
    emitTime(0);
  }

  function spawnFlame(x, y, w, count, hot, midi) {
    const style = window.FlameStyles?.getStyle();
    const n = Math.floor(count * flameIntensity);
    for (let i = 0; i < n; i++) {
      const p = {
        x: x + (Math.random() - 0.5) * w,
        y,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -1.5 - Math.random() * 2.5,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        size: 2 + Math.random() * 4,
        hot: hot !== false,
        midi: midi || 0,
      };
      style?.particle?.(p, p.hot);
      particles.push(p);
    }
  }

  function spawnHitBurst(x, y, midi) {
    const style = window.FlameStyles?.getStyle();
    for (let i = 0; i < 18 * flameIntensity; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      const p = {
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 3 + Math.random() * 5,
        hot: true,
        midi: midi || 0,
      };
      style?.particle?.(p, true);
      particles.push(p);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.08;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = (p.life / p.maxLife) * 0.9;
      const rgb = p.rgb || "200,120,255";
      if (p.star) {
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        ctx.fillRect(p.x, p.y - 2, 1, 4);
        ctx.fillRect(p.x - 2, p.y, 4, 1);
      } else {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBackground(w, h, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#05060c");
    bg.addColorStop(0.45, "#0c1020");
    bg.addColorStop(1, "#12182a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const hitY = getHitY();
    const vig = ctx.createRadialGradient(w * 0.5, hitY, w * 0.2, w * 0.5, hitY, w * 0.85);
    vig.addColorStop(0, "rgba(80, 120, 255, 0.06)");
    vig.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createLinearGradient(0, hitY - 50, 0, hitY + 30);
    glow.addColorStop(0, "rgba(168, 85, 247, 0)");
    glow.addColorStop(0.45, `rgba(192, 132, 252, ${0.14 + Math.sin(t * 3) * 0.05})`);
    glow.addColorStop(1, "rgba(124, 58, 237, 0.25)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, hitY - 55, w, 90);

    ctx.strokeStyle = "rgba(216, 180, 254, 0.9)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(168, 85, 247, 0.85)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function play() {
    if (!notes.length) return;
    window.AudioEngine.ensure();
    clearAutoFlags();
    keyAuras.clear();
    updateKeyPositions();
    playing = true;
    startTime = performance.now() / 1000 - pausedAt;
    lastFrameT = currentTime();
    tick();
  }

  function stop() {
    playing = false;
    pausedAt = 0;
    autoPlayMode = false;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    releaseAllSound();
    clearAutoFlags();
    keyAuras.clear();
    draw(0);
    emitTime(0);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    pausedAt = currentTime();
    if (animId) cancelAnimationFrame(animId);
    releaseAllSound();
    emitTime(pausedAt);
  }

  function currentTime() {
    if (!playing && pausedAt) return pausedAt;
    return (performance.now() / 1000 - startTime) * speed;
  }

  function setSpeed(s) {
    const t = currentTime();
    speed = s;
    if (playing) {
      startTime = performance.now() / 1000 - t / speed;
    } else {
      pausedAt = t;
    }
  }

  function setTimingWindow(ms) {
    timingWindowMs = ms;
  }

  function playInstrumentApi() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "guitar") return window.Guitar;
    if (mode === "violin") return window.Violin;
    return window.Piano;
  }

  function processAutoPlay(t) {
    if (!autoPlayMode || !playing) return;
    const inst = playInstrumentApi();
    const sound = window.PlaySurface?.getModes?.()?.[window.PlaySurface.getMode()]?.sound;
    if (sound) window.AudioEngine?.setInstrument?.(sound);
    for (const n of notes) {
      if (!n._autoStarted && t >= n.time) {
        n._autoStarted = true;
        const vel = Math.max(0.2, Math.min(1, n.velocity ?? 0.75));
        inst?.pressKey?.(n.midi, vel);
        boostKeyAura(n.midi, 1);
        n.hit = true;
      }
      if (n._autoStarted && !n._autoEnded && t >= n.time + n.duration) {
        n._autoEnded = true;
        inst?.releaseKey?.(n.midi);
      }
    }
  }

  /** Çubuk vuruş çizgisindeyken sürekli aurora */
  function syncHeldLineEffects(t) {
    for (const n of notes) {
      if (t < n.time || t >= n.time + n.duration) continue;
      boostKeyAura(n.midi, 0.2);
      const pos = keyPositions.get(n.midi);
      if (!pos) continue;
      const aura = keyAuras.get(n.midi);
      if (aura) {
        aura.life = 1;
        aura.power = Math.min(1, aura.power + 0.05);
      }
    }
  }

  function boostKeyAura(midi, amount = 0.8) {
    const pos = keyPositions.get(midi);
    if (!pos) return;
    const prev = keyAuras.get(midi);
    keyAuras.set(midi, {
      x: pos.x,
      w: pos.w,
      power: Math.min(1, (prev?.power || 0) + amount),
      life: 1,
    });
  }

  function updateKeyAuras(dt) {
    for (const [midi, a] of keyAuras) {
      a.life -= dt * 1.8;
      a.power *= 0.92;
      if (a.life <= 0 || a.power < 0.03) keyAuras.delete(midi);
    }
    document.querySelectorAll(".piano-keys .key.active").forEach((el) => {
      const midi = Number(el.dataset.midi);
      const pos = keyPositions.get(midi);
      if (!pos) return;
      keyAuras.set(midi, {
        x: pos.x,
        w: pos.w,
        power: 1,
        life: 1,
      });
    });
  }

  function checkNoteImpacts(t, hitY, pxPerSec) {
    const NR = window.NoteRenderer;
    if (!NR?.spawnImpactParticles) return;
    for (const n of notes) {
      if (n.hit || n.missed || n._impactDone) continue;
      const dist = (n.time - t) * pxPerSec;
      if (dist > 0 && dist < 6) {
        n._impactDone = true;
        const pos = keyPositions.get(n.midi);
        if (!pos) continue;
        const key = `${n.midi}-${Math.floor(n.time * 20)}`;
        if (impactCooldown.has(key)) continue;
        impactCooldown.set(key, t);
        NR.spawnImpactParticles(particles, pos.x, hitY, pos.w, n.midi, 14);
        boostKeyAura(n.midi, 0.7);
        window.Piano?.flash?.(n.midi, "good");
      }
    }
    for (const [k, when] of impactCooldown) {
      if (t - when > 0.5) impactCooldown.delete(k);
    }
  }

  function tick() {
    if (!playing) return;
    const t = currentTime();
    const dt = Math.min(0.05, t - lastFrameT || 0.016);
    lastFrameT = t;
    processAutoPlay(t);
    syncHeldLineEffects(t);
    if (!autoPlayMode) checkMisses(t);
    draw(t, dt);
    emitTime(t);
    if (songDuration > 0 && t >= songDuration) {
      playing = false;
      window.AudioEngine?.stopAll?.();
      onFeedback?.("complete");
      emitTime(songDuration);
      return;
    }
    animId = requestAnimationFrame(tick);
  }

  function checkMisses(t) {
    const windowSec = timingWindowMs / 1000;
    for (const n of pendingHits) {
      if (n.hit || n.missed) continue;
      if (t > n.time + windowSec) {
        n.missed = true;
        combo = 0;
        onFeedback?.("miss");
        window.PlaySurface?.flash?.(n.midi, "miss");
        emitScore();
      }
    }
  }

  function handleKeyPress(midi) {
    if (autoPlayMode) return false;
    if (!playing && !pausedAt) return false;
    const t = currentTime();
    const windowSec = timingWindowMs / 1000;

    let best = null;
    let bestDelta = Infinity;
    for (const n of pendingHits) {
      if (n.hit || n.missed || n.midi !== midi) continue;
      const delta = Math.abs(t - n.time);
      if (delta <= windowSec && delta < bestDelta) {
        best = n;
        bestDelta = delta;
      }
    }

    if (!best) return false;

    best.hit = true;
    const points = Math.round(100 + Math.max(0, 50 - bestDelta * 200));
    combo += 1;
    score += points + combo * 5;
    onFeedback?.("good", points);

    const pos = keyPositions.get(midi);
    const hitY = getHitY();
    if (pos) {
      window.NoteRenderer?.spawnImpactParticles?.(particles, pos.x, hitY, pos.w, midi, 18);
      spawnHitBurst(pos.x, hitY - 4, midi);
      boostKeyAura(midi, 1);
    }

    window.PlaySurface?.flash?.(midi, "good");
    emitScore();
    return true;
  }

  function emitScore() {
    onScoreChange?.({ score, combo });
  }

  function draw(t, dt = 0.016) {
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    updateParticles(dt);
    drawBackground(w, h, t);

    const hitY = getHitY();
    const pxPerSec = hitY / LOOKAHEAD_SEC;
    positionHitLine();
    const NR = window.NoteRenderer;

    updateKeyAuras(dt);
    checkNoteImpacts(t, hitY, pxPerSec);
    NR?.drawKeyAuroras?.(ctx, keyAuras, hitY, w, t);

    const seenLanes = new Set();
    for (const n of notes) {
      if (n.time > t + LOOKAHEAD_SEC || n.time + n.duration < t - 0.2) continue;
      const pos = keyPositions.get(n.midi);
      if (!pos || seenLanes.has(n.midi)) continue;
      seenLanes.add(n.midi);
      NR?.drawLane(ctx, pos.x, pos.w, h, hitY, n.midi, t);
    }

    for (const n of notes) {
      if (n.time > t + LOOKAHEAD_SEC || n.time + n.duration < t - 0.2) continue;
      const pos = keyPositions.get(n.midi);
      if (!pos) continue;

      const noteBottom = hitY - (n.time - t) * pxPerSec;
      const noteH = Math.max(NOTE_HEIGHT_PX, n.duration * pxPerSec);
      const width = pos.w * 0.92;
      const x = pos.x - width / 2;
      const y = noteBottom - noteH;
      const state = n.hit ? "hit" : n.missed ? "miss" : "pending";

      if (NR) {
        NR.drawNote(ctx, {
          x,
          y,
          w: width,
          h: noteH,
          midi: n.midi,
          vel: n.velocity,
          state,
          styleId: flameStyleId,
          intensity: flameIntensity,
          time: t,
        });
      }

    }

    drawParticles();
  }

  function resetScore() {
    score = 0;
    combo = 0;
    emitScore();
  }

  function resetRound() {
    autoPlayMode = false;
    stop();
    particles = [];
    impactCooldown.clear();
    for (const n of notes) {
      n.hit = false;
      n.missed = false;
      n._autoStarted = false;
      n._autoEnded = false;
      n._impactDone = false;
    }
    pendingHits = notes.map((n) => ({ ...n, id: `${n.midi}-${n.time}` }));
    resetScore();
    draw(0);
  }

  return {
    init,
    loadNotes,
    play,
    stop,
    pause,
    setSpeed,
    setTimingWindow,
    setFlameIntensity,
    setFlameStyle,
    setTrim,
    setAutoPlayMode,
    isAutoPlayMode,
    handleKeyPress,
    resetScore,
    resetRound,
    getSongDuration: () => songDuration,
    isPlaying: () => playing,
    hasNotes: () => notes.length > 0,
    isReady,
    resize: () => {
      resize();
      updateKeyPositions();
    },
  };
})();

window.Game = Game;


/* === library.js === */
/** Kütüphane ve şarkı verisi */
const LibraryStore = (() => {
  let data = { libraries: [] };
  let activeLibraryId = null;
  let activeSongId = null;
  let parsedMidi = null;
  let selectedTrackIndex = 0;

  async function load() {
    data = await window.pianoApi.getLibraries();
    if (!data.libraries) data = { libraries: [] };
    return data;
  }

  async function save() {
    await window.pianoApi.saveLibraries(data);
  }

  function createLibrary(name) {
    const lib = {
      id: `lib-${Date.now()}`,
      name: name.trim(),
      songs: [],
      createdAt: new Date().toISOString(),
    };
    data.libraries.push(lib);
    return lib;
  }

  function getLibraries() {
    return data.libraries;
  }

  function getLibrary(id) {
    return data.libraries.find((l) => l.id === id);
  }

  function setActiveLibrary(id) {
    activeLibraryId = id;
    activeSongId = null;
    parsedMidi = null;
  }

  function setActiveSong(songId) {
    activeSongId = songId;
    parsedMidi = null;
  }

  function songStorageRef(song) {
    return song.midiUrl || song.relativePath;
  }

  async function importSongs(libraryId, imported) {
    const lib = getLibrary(libraryId);
    if (!lib) return;
    for (const item of imported) {
      const entry = {
        id: item.id,
        name: item.name,
        fileName: item.fileName,
      };
      if (item.midiUrl) entry.midiUrl = item.midiUrl;
      if (item.midiBase64) entry.midiBase64 = item.midiBase64;
      if (item.storage) entry.storage = item.storage;
      if (item.relativePath) entry.relativePath = item.relativePath;
      lib.songs.push(entry);
    }
    await save();
  }

  async function loadSongMidi(song) {
    if (song.midiBase64) {
      const binary = atob(song.midiBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      parsedMidi = window.pianoApi.parseMidi(Array.from(bytes));
      return parsedMidi;
    }
    if (
      window.pianoApi.isWeb &&
      (song.storage === "cms" || (!song.midiUrl && !song.relativePath && song.id))
    ) {
      const bytes = await window.pianoApi.readMidi(`cms:${song.id}`);
      parsedMidi = window.pianoApi.parseMidi(bytes);
      return parsedMidi;
    }
    const ref = songStorageRef(song);
    if (!ref) throw new Error("Şarkı dosya adresi yok");
    const bytes = await window.pianoApi.readMidi(ref);
    parsedMidi = window.pianoApi.parseMidi(bytes);
    return parsedMidi;
  }

  function getParsedMidi() {
    return parsedMidi;
  }

  function getActiveSong() {
    const lib = getLibrary(activeLibraryId);
    return lib?.songs.find((s) => s.id === activeSongId);
  }

  function setTrackIndex(index) {
    selectedTrackIndex = index;
  }

  function getTrackNotes() {
    if (!parsedMidi?.tracks?.length) return [];
    const track = parsedMidi.tracks[selectedTrackIndex];
    const raw = track?.notes ?? [];
    if (window.NoteUtils?.cleanupNotes) {
      return window.NoteUtils.cleanupNotes(raw);
    }
    return raw;
  }

  async function deleteSong(libraryId, songId) {
    const lib = getLibrary(libraryId);
    if (!lib) return;
    const idx = lib.songs.findIndex((s) => s.id === songId);
    if (idx < 0) return;
    const song = lib.songs[idx];
    const ref = songStorageRef(song);
    if (window.pianoApi.isWeb) {
      await window.pianoApi.deleteMidi(ref, {
        songId: song.id,
        libraryId,
      });
    } else {
      await window.pianoApi.deleteMidi(ref);
    }
    lib.songs.splice(idx, 1);
    if (activeSongId === songId) {
      activeSongId = null;
      parsedMidi = null;
    }
    await save();
  }

  return {
    load,
    save,
    createLibrary,
    getLibraries,
    getLibrary,
    setActiveLibrary,
    setActiveSong,
    importSongs,
    loadSongMidi,
    getParsedMidi,
    getActiveSong,
    setTrackIndex,
    getTrackNotes,
    deleteSong,
    getActiveLibraryId: () => activeLibraryId,
    getActiveSongId: () => activeSongId,
    getSelectedTrackIndex: () => selectedTrackIndex,
  };
})();

window.LibraryStore = LibraryStore;


window.mainJsOk = true;


window.mainJsOk = true;


window.mainJsOk = true;

/* === app.js === */
/** Ana uygulama */
(function () {
  const $ = (sel) => document.querySelector(sel);

  function mods() {
    return {
      Piano: window.Piano,
      PlaySurface: window.PlaySurface,
      Game: window.Game,
      LibraryStore: window.LibraryStore,
      AppSettings: window.AppSettings,
      AudioEngine: window.AudioEngine,
    };
  }

  function requireStore() {
    if (!window.LibraryStore) {
      throw new Error("Kütüphane modülü yüklenemedi. Uygulamayı kapatıp npm start ile açın.");
    }
    return window.LibraryStore;
  }

  function requireMods() {
    const m = mods();
    if (!m.Piano || !m.Game || !m.PlaySurface) {
      throw new Error("Piyano modülü yüklenemedi. Uygulamayı kapatıp npm start ile açın.");
    }
    if (!m.LibraryStore) throw new Error("Kütüphane modülü yüklenemedi.");
    return m;
  }

  function playInstrument() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "guitar") return window.Guitar;
    if (mode === "violin") return window.Violin;
    return window.Piano;
  }

  if (!window.mainJsOk || !window.LibraryStore) {
    $("#apiError")?.classList.remove("hidden");
    $("#apiError").innerHTML =
      "Ana program yüklenemedi. Terminalde klasöre gidip: <code>npm start</code>";
    return;
  }

  if (!window.Piano || !window.PianoRange) {
    $("#apiError")?.classList.remove("hidden");
    $("#apiError").innerHTML =
      "Piyano modülü yüklenemedi; kütüphane yine de kullanılabilir. <code>npm start</code> ile yeniden açın.";
  }

  if (!window.pianoApi) {
    $("#apiError")?.classList.remove("hidden");
    return;
  }

  const libraryList = $("#libraryList");
  const songList = $("#songList");
  const trackSelect = $("#trackSelect");
  const scoreValue = $("#scoreValue");
  const comboValue = $("#comboValue");
  const btnPlay = $("#btnPlay");
  const btnAutoPlay = $("#btnAutoPlay");
  const btnStop = $("#btnStop");
  const btnImport = $("#btnImportMidi");
  const btnImportAudio = $("#btnImportAudio");
  const audioImportOverlay = $("#audioImportOverlay");
  const audioImportBarFill = $("#audioImportBarFill");
  const audioImportStatus = $("#audioImportStatus");
  const audioImportFile = $("#audioImportFile");
  const btnNewLib = $("#btnNewLibrary");
  const octaveStart = $("#octaveStart");
  const octaveCount = $("#octaveCount");
  const keyWidthRange = $("#keyWidthRange");
  const keyHeightRange = $("#keyHeightRange");
  const keyWidthLabel = $("#keyWidthLabel");
  const keyHeightLabel = $("#keyHeightLabel");
  const pianoDock = $("#pianoDock");
  const pianoAlign = $("#pianoAlign");
  const instrumentSelect = $("#instrumentSelect");
  const pianoWrap = $("#pianoWrap");
  const playModeSelect = $("#playModeSelect");
  const btnMoveInstrument = $("#btnMoveInstrument");
  const instrumentPickerModal = $("#instrumentPickerModal");
  const stabKeys = $("#stabKeys");
  const keyWidthDesc = $("#keyWidthDesc");
  const keyHeightDesc = $("#keyHeightDesc");
  const dockDesc = $("#dockDesc");
  const alignDesc = $("#alignDesc");
  const stringVibratoSens = $("#stringVibratoSens");
  const vibratoSensLabel = $("#vibratoSensLabel");
  const dynamicPressure = $("#dynamicPressure");
  const sustainEnabled = $("#sustainEnabled");
  const speedRange = $("#speedRange");
  const speedLabel = $("#speedLabel");
  const timingWindow = $("#timingWindow");
  const timingLabel = $("#timingLabel");
  const libraryModal = $("#libraryModal");
  const libraryForm = $("#libraryForm");
  const libraryNameInput = $("#libraryNameInput");
  const libraryCancel = $("#libraryCancel");
  const libraryBackdrop = $("#libraryBackdrop");
  const inlineLibraryForm = $("#inlineLibraryForm");
  const inlineLibraryName = $("#inlineLibraryName");
  const libraryHint = $("#libraryHint");
  const songHint = $("#songHint");
  const toastEl = $("#toast");
  const timeCurrent = $("#timeCurrent");
  const timeTotal = $("#timeTotal");
  const timeRemaining = $("#timeRemaining");
  const progressFill = $("#progressFill");
  const labelMode = $("#labelMode");
  const labelPreset = $("#labelPreset");
  const labelPresetWrap = $("#labelPresetWrap");
  const customLabelsWrap = $("#customLabelsWrap");
  const customLabels = $("#customLabels");
  const btnApplyLabels = $("#btnApplyLabels");
  const flameRange = $("#flameRange");
  const flameLabel = $("#flameLabel");
  const flameStyle = $("#flameStyle");
  const trimStartInput = $("#trimStart");
  const trimEndInput = $("#trimEnd");
  const effectHueInput = $("#effectHue");
  const keyColorTopInput = $("#keyColorTop");
  const keyColorMidInput = $("#keyColorMid");
  const keyColorBottomInput = $("#keyColorBottom");
  const hitLineColorInput = $("#hitLineColor");
  const labelAssignModal = $("#labelAssignModal");
  const labelAssignTitle = $("#labelAssignTitle");
  const labelAssignHint = $("#labelAssignHint");
  const labelAssignInput = $("#labelAssignInput");
  const labelAssignSave = $("#labelAssignSave");
  const labelAssignCancel = $("#labelAssignCancel");
  const labelAssignClear = $("#labelAssignClear");
  const labelAssignBackdrop = $("#labelAssignBackdrop");
  const keyboardEnabled = $("#keyboardEnabled");
  const btnToggleSidebar = $("#btnToggleSidebar");
  const btnFullscreen = $("#btnFullscreen");
  const comboFlare = $("#comboFlare");

  let editingLibraryId = null;
  let labelEditMidi = null;
  let lastComboShown = 0;
  let toastTimer = null;

  function setupSettingsTabs() {
    const tabs = document.querySelectorAll(".settings-tabs .stab");
    const panels = document.querySelectorAll(".stab-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === id));
      });
    });
  }

  const themeInputs = () => ({
    effectHue: effectHueInput,
    keyColorTop: keyColorTopInput,
    keyColorMid: keyColorMidInput,
    keyColorBottom: keyColorBottomInput,
    hitLineColor: hitLineColorInput,
  });

  function applyThemeFromSettings(s, playMode) {
    const mode = playMode || s?.playMode || window.PlaySurface?.getMode?.() || "piano";
    window.AppTheme?.fromSettings?.(s || AppSettings.load(), mode);
    window.AppTheme?.fillInputs?.(themeInputs(), {
      ...(window.AppTheme.getPreset(mode)),
      ...((s || AppSettings.load()).themesByMode?.[mode] || {}),
    });
    document.body.dataset.themeMode = mode;
  }

  function persistThemeFromInputs() {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    const theme = window.AppTheme.readFromInputs(themeInputs(), mode);
    const s = AppSettings.load();
    const themesByMode = window.AppTheme.saveForMode(mode, theme, s);
    persistSettings({ themesByMode });
    applyThemeFromSettings(AppSettings.load(), mode);
  }

  function openLabelAssignModal(midi) {
    labelEditMidi = midi;
    const name = KeyLabels?.noteNameForMidi?.(midi) || `MIDI ${midi}`;
    labelAssignTitle.textContent = "Tuş harfi ata";
    labelAssignHint.textContent = `${name} — tek harf veya boş`;
    labelAssignInput.value = KeyLabels?.getMidiLabel?.(midi) || "";
    labelAssignModal.classList.remove("hidden");
    labelAssignModal.setAttribute("aria-hidden", "false");
    setTimeout(() => labelAssignInput.focus(), 50);
  }

  function closeLabelAssignModal() {
    labelAssignModal.classList.add("hidden");
    labelAssignModal.setAttribute("aria-hidden", "true");
    labelEditMidi = null;
  }

  function saveLabelAssign() {
    if (labelEditMidi == null) return;
    const ch = labelAssignInput.value.trim();
    KeyLabels.setMidiLabel(labelEditMidi, ch);
    persistSettings({
      labelMode: "custom",
      midiLabels: KeyLabels.getMidiLabelsObject(),
    });
    applyLabelSettings(AppSettings.load());
    window.KeyboardInput?.rebuild?.();
    toast(ch ? `Tuş → "${ch}"` : "Harf kaldırıldı");
    closeLabelAssignModal();
  }

  function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("error", isError);
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 3200);
  }

  function openModal(editId = null) {
    editingLibraryId = editId;
    $("#libraryDialogTitle").textContent = editId ? "Kütüphaneyi yeniden adlandır" : "Yeni kütüphane";
    libraryNameInput.value = editId ? requireStore().getLibrary(editId)?.name ?? "" : "";
    libraryModal.classList.remove("hidden");
    libraryModal.setAttribute("aria-hidden", "false");
    setTimeout(() => libraryNameInput.focus(), 50);
  }

  function closeModal() {
    libraryModal.classList.add("hidden");
    libraryModal.setAttribute("aria-hidden", "true");
    editingLibraryId = null;
  }

  async function saveLibraryName(name) {
    const LibraryStore = requireStore();
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Kütüphane adı boş olamaz.", true);
      return false;
    }
    try {
      if (editingLibraryId) {
        const lib = LibraryStore.getLibrary(editingLibraryId);
        if (lib) {
          lib.name = trimmed;
          toast(`Kütüphane adı güncellendi.`);
        }
      } else {
        const lib = LibraryStore.createLibrary(trimmed);
        LibraryStore.setActiveLibrary(lib.id);
        toast(`"${trimmed}" kütüphanesi eklendi.`);
      }
      await LibraryStore.save();
      if (!libraryModal.classList.contains("hidden")) closeModal();
      renderLibraries();
      renderSongs();
      updateHints();
      return true;
    } catch (err) {
      toast(`Kayıt hatası: ${err.message}`, true);
      return false;
    }
  }

  function applyLabelSettings(s) {
    if (!window.KeyLabels) return;
    KeyLabels.loadMidiLabelsObject(s.midiLabels);
    KeyLabels.setMode(s.labelMode);
    KeyLabels.setLetterPreset(s.labelPreset);
    KeyLabels.setCustomString(s.customLabels);
    labelMode.value = s.labelMode;
    labelPreset.value = s.labelPreset;
    customLabels.value = s.customLabels;
    labelPresetWrap.classList.toggle("hidden", s.labelMode !== "letters");
    customLabelsWrap.classList.toggle("hidden", s.labelMode !== "custom");
    try {
      requireMods().Piano.refreshLabels();
      window.KeyboardInput?.rebuild?.();
    } catch {
      /* henüz hazır değil */
    }
  }

  function vibratoSensLabelText(v) {
    if (v < 70) return "Hafif";
    if (v < 130) return "Normal";
    if (v < 170) return "Güçlü";
    return "Çok güçlü";
  }

  function applyInstrumentKeySize(w, h) {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "piano") {
      requireMods().Piano.setKeySize(w, h);
    } else {
      window.PlaySurface?.setKeySize?.(w, h);
    }
  }

  function updateSettingsForPlayMode(mode) {
    const m = mode || window.PlaySurface?.getMode?.() || "piano";
    document.body.dataset.playMode = m;
    const tabLabels = { piano: "Klavye", guitar: "Gitar", violin: "Keman" };
    if (stabKeys) stabKeys.textContent = tabLabels[m] || "Klavye";

    const widthLabels = {
      piano: "Tuş genişliği",
      guitar: "Perde hücre genişliği",
      violin: "Perde hücre genişliği",
    };
    const heightLabels = {
      piano: "Klavye yüksekliği",
      guitar: "Panel yüksekliği",
      violin: "Panel yüksekliği",
    };
    if (keyWidthDesc) keyWidthDesc.textContent = widthLabels[m] || widthLabels.piano;
    if (keyHeightDesc) keyHeightDesc.textContent = heightLabels[m] || heightLabels.piano;
    if (dockDesc) {
      dockDesc.textContent =
        m === "piano" ? "Klavye konumu (dikey)" : "Enstrüman konumu (dikey)";
    }
    if (alignDesc) {
      alignDesc.textContent =
        m === "piano" ? "Klavye hizası (yatay)" : "Enstrüman hizası (yatay)";
    }

    if (pianoAlign && m !== "piano") {
      pianoAlign.querySelector('option[value="stretch"]')?.toggleAttribute(
        "disabled",
        true
      );
      if (pianoAlign.value === "stretch") pianoAlign.value = "center";
    } else {
      pianoAlign?.querySelector('option[value="stretch"]')?.removeAttribute("disabled");
    }
  }

  function flameLabelText(v) {
    if (v < 60) return "Hafif";
    if (v < 120) return "Normal";
    if (v < 160) return "Güçlü";
    return "Alevli!";
  }

  function applyPlayMode(mode, opts = {}) {
    const { PlaySurface, AudioEngine } = requireMods();
    const m = PlaySurface.setMode(mode, opts);
    const sound = PlaySurface.getModes()[m]?.sound || "piano";
    AudioEngine.setInstrument(sound);
    if (playModeSelect) playModeSelect.value = m;
    if (instrumentSelect) instrumentSelect.value = sound;
    persistSettings({ playMode: m, instrumentId: sound, ...(opts.markPrompt ? { instrumentPromptDone: true } : {}) });
    applyPianoLayout(AppSettings.load());
    updateSettingsForPlayMode(m);
    applyThemeFromSettings(AppSettings.load(), m);
    const s = AppSettings.load();
    applyInstrumentKeySize(s.keyWidth, s.keyHeight);
    setTimeout(() => requireMods().Game.resize(), 100);
    return m;
  }

  function showInstrumentPickerIfNeeded() {
    const s = AppSettings.load();
    if (!instrumentPickerModal) return;
    if (s.instrumentPromptDone) {
      instrumentPickerModal.classList.add("hidden");
      instrumentPickerModal.setAttribute("aria-hidden", "true");
      return;
    }
    instrumentPickerModal.classList.remove("hidden");
    instrumentPickerModal.setAttribute("aria-hidden", "false");
    instrumentPickerModal.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.onclick = () => {
        applyPlayMode(btn.dataset.mode, { force: true, markPrompt: true });
        instrumentPickerModal.classList.add("hidden");
        instrumentPickerModal.setAttribute("aria-hidden", "true");
        toast(`Enstrüman: ${window.PlaySurface.getModes()[btn.dataset.mode]?.label || btn.dataset.mode}`);
      };
    });
  }

  function applyPianoLayout(s) {
    const dock = s.pianoDock || "bottom";
    const align = s.pianoAlign || "stretch";
    document.body.classList.remove("piano-dock-bottom", "piano-dock-top", "piano-dock-middle");
    document.body.classList.add(`piano-dock-${dock}`);
    if (pianoWrap) {
      pianoWrap.classList.remove(
        "piano-align-stretch",
        "piano-align-left",
        "piano-align-center",
        "piano-align-right"
      );
      pianoWrap.classList.add(`piano-align-${align}`);
    }
    if (pianoDock) pianoDock.value = dock;
    if (pianoAlign) pianoAlign.value = align;
    setTimeout(() => {
      try {
        requireMods().Game.resize();
      } catch {
        /* */
      }
    }, 80);
  }

  function applySettings(s) {
    const { Piano, Game, AudioEngine } = requireMods();
    keyWidthRange.value = String(s.keyWidth);
    keyHeightRange.value = String(s.keyHeight);
    keyWidthLabel.textContent = `${s.keyWidth} px`;
    keyHeightLabel.textContent = `${s.keyHeight} px`;
    dynamicPressure.checked = s.dynamicPressure;
    sustainEnabled.checked = s.sustainEnabled;
    timingWindow.value = String(s.timingWindow);
    timingLabel.textContent = `${s.timingWindow} ms`;
    speedRange.value = String(s.speed);
    speedLabel.textContent = `${s.speed}%`;
    flameRange.value = String(Math.round((s.flameIntensity || 1) * 100));
    flameLabel.textContent = flameLabelText(Number(flameRange.value));
    flameStyle.value = s.flameStyle || "aurora";
    if (trimStartInput) trimStartInput.value = String(s.trimStart ?? 0);
    if (trimEndInput) trimEndInput.value = String(s.trimEnd ?? 0);
    keyboardEnabled.checked = s.keyboardEnabled !== false;

    AudioEngine.setDynamicPressure(s.dynamicPressure);
    AudioEngine.setSustain(s.sustainEnabled);
    const playMode = s.playMode || "piano";
    const modeSound = window.PlaySurface?.getModes?.()?.[playMode]?.sound || s.instrumentId || "piano";
    AudioEngine.setInstrument(modeSound);
    if (instrumentSelect) instrumentSelect.value = modeSound;
    Game.setTimingWindow(s.timingWindow);
    Game.setSpeed(s.speed / 100);
    Game.setFlameIntensity(s.flameIntensity || 1);
    Game.setTrim(s.trimStart ?? 0, s.trimEnd ?? 0);
    Game.setFlameStyle(s.flameStyle || "aurora");
    window.KeyboardInput?.setEnabled(s.keyboardEnabled !== false);
    if (effectHueInput) effectHueInput.value = String(s.effectHue ?? 275);
    if (keyColorTopInput) keyColorTopInput.value = s.keyColorTop || "#e8d4ff";
    if (keyColorMidInput) keyColorMidInput.value = s.keyColorMid || "#a855f7";
    if (keyColorBottomInput) keyColorBottomInput.value = s.keyColorBottom || "#6b21a8";
    if (hitLineColorInput) hitLineColorInput.value = s.hitLineColor || "#d8b4fe";
    applyThemeFromSettings(s);
    applyLabelSettings(s);
    setSidebarVisible(s.sidebarVisible !== false, false);
    applyPianoLayout(s);
    populateOctaveSelects(s.octaveStart, s.octaveCount);
    if (playModeSelect) playModeSelect.value = playMode;
    const { PlaySurface } = requireMods();
    PlaySurface.setMode(playMode, { force: true, syncSound: false });
    updateSettingsForPlayMode(playMode);
    applyInstrumentKeySize(s.keyWidth, s.keyHeight);
    if (stringVibratoSens) {
      const vib = Math.round((s.stringVibratoSens ?? 1) * 100);
      stringVibratoSens.value = String(vib);
      if (vibratoSensLabel) vibratoSensLabel.textContent = vibratoSensLabelText(vib);
    }
    if (playMode === "piano") {
      Piano.setAutoFit((s.pianoAlign || "stretch") === "stretch");
      Piano.setKeySize(s.keyWidth, s.keyHeight);
      const clamped = PianoRange.clampRange(s.octaveStart, s.octaveCount);
      Piano.buildKeys(clamped.startOctave, clamped.octaveCount);
    }
  }

  function setSidebarVisible(visible, save = true) {
    document.body.classList.toggle("sidebar-hidden", !visible);
    btnToggleSidebar.textContent = visible ? "☰ Menü" : "☰ Menüyü aç";
    if (save) persistSettings({ sidebarVisible: visible });
    setTimeout(() => requireMods().Game.resize(), 120);
  }

  async function toggleFullscreen() {
    if (!window.pianoApi?.toggleFullscreen) return;
    const on = await window.pianoApi.toggleFullscreen();
    btnFullscreen.textContent = on ? "⛶ Pencere" : "⛶ Tam ekran";
    toast(on ? "Tam ekran açık (F11 / Esc)" : "Pencere modu");
    setTimeout(() => {
      try {
        requireMods().Game.resize();
      } catch {
        /* */
      }
    }, 200);
  }

  function persistSettings(partial) {
    window.AppSettings.save(partial);
  }

  function populateOctaveSelects(startVal, countVal) {
    if (!window.PianoRange) return;
    const start = startVal ?? (Number(octaveStart.value) || 3);
    const count = countVal ?? (Number(octaveCount.value) || 2);

    octaveStart.innerHTML = "";
    for (const o of PianoRange.getStartOctaveOptions()) {
      const opt = document.createElement("option");
      opt.value = String(o.value);
      opt.textContent = o.label;
      octaveStart.appendChild(opt);
    }

    octaveCount.innerHTML = "";
    const countOpts = PianoRange.getOctaveCountOptions(start);
    for (const o of countOpts) {
      const opt = document.createElement("option");
      opt.value = String(o.value);
      opt.textContent = o.label;
      octaveCount.appendChild(opt);
    }

    const clamped = PianoRange.clampRange(start, count);
    octaveStart.value = String(clamped.startOctave);
    octaveCount.value = String(clamped.octaveCount);
    return clamped;
  }

  function getOctaveRange() {
    return PianoRange
      ? PianoRange.clampRange(Number(octaveStart.value), Number(octaveCount.value))
      : {
          startOctave: Number(octaveStart.value),
          octaveCount: Number(octaveCount.value),
        };
  }

  function rebuildPiano() {
    if (window.PlaySurface?.getMode?.() !== "piano") {
      toast("Oktav ayarları yalnızca piyano modunda geçerlidir.");
      return;
    }
    const { Piano, Game } = requireMods();
    window.KeyboardInput?.releaseAll?.();

    const clamped =
      populateOctaveSelects(
        Number(octaveStart.value),
        Number(octaveCount.value)
      ) || getOctaveRange();

    Piano.setAutoFit((AppSettings.load().pianoAlign || "stretch") === "stretch");
    Piano.buildKeys(clamped.startOctave, clamped.octaveCount);
    window.KeyboardInput?.rebuild?.();
    applyLabelSettings(AppSettings.load());
    persistSettings({
      octaveStart: clamped.startOctave,
      octaveCount: clamped.octaveCount,
      octaveLockManual: true,
      autoKeyboardFromSong: false,
    });

    setTimeout(() => {
      Game.resize();
      reloadTrackNotes();
    }, 80);

    toast(`Klavye: oktav ${clamped.startOctave}, ${clamped.octaveCount} oktav`);
  }

  function fitKeyboardToSong(notes) {
    const s = AppSettings.load();
    if ((window.PlaySurface?.getMode?.() || s.playMode || "piano") !== "piano") return null;
    if (s.octaveLockManual || !s.autoKeyboardFromSong || !notes?.length) return null;
    if (!window.PianoRange?.fitRangeToNotes) return null;

    const fit = PianoRange.fitRangeToNotes(notes);
    populateOctaveSelects(fit.startOctave, fit.octaveCount);
    const { Piano } = requireMods();
    Piano.setAutoFit((s.pianoAlign || "stretch") === "stretch");
    Piano.buildKeys(fit.startOctave, fit.octaveCount);
    persistSettings({
      octaveStart: fit.startOctave,
      octaveCount: fit.octaveCount,
      autoKeyboardFromSong: true,
    });
    return fit;
  }

  async function reloadTrackNotes() {
    const { Piano, Game, LibraryStore } = requireMods();
    const notes = LibraryStore.getTrackNotes();
    const s = AppSettings.load();
    Game.setTrim(s.trimStart ?? 0, s.trimEnd ?? 0);
    const fit = fitKeyboardToSong(notes);
    if (fit) {
      toast(
        `Klavye şarkıya göre: ${fit.octaveCount} oktav (tam genişlik)`,
        false
      );
    } else if ((window.PlaySurface?.getMode?.() || "piano") === "piano") {
      Piano.setAutoFit((s.pianoAlign || "stretch") === "stretch");
      if (typeof Piano.autoSizeKeys === "function") {
        /* buildKeys içinde autoSizeKeys çağrılır */
      }
    }
    const range = playInstrument().getRange();
    Game.loadNotes(notes, range);
    btnPlay.disabled = !Game.hasNotes();
    if (btnAutoPlay) btnAutoPlay.disabled = !Game.hasNotes();
    setTimeout(() => Game.resize(), 100);
  }

  function updateHints() {
    const LibraryStore = requireStore();
    const libId = LibraryStore.getActiveLibraryId();
    const lib = libId ? LibraryStore.getLibrary(libId) : null;
    const isWeb = !!window.pianoApi?.isWeb;
    libraryHint.textContent = lib
      ? `Seçili: ${lib.name} — MIDI eklemek için + MIDI`
      : isWeb
        ? "Kütüphane seçin veya yukarıdan ekleyin. Veriler Wix hesabınızda saklanır."
        : "Kütüphane seçin veya yukarıdan ekleyin.";
    const activeSong = LibraryStore.getActiveSongId();
    let playReady = false;
    try {
      playReady = !!requireMods().Game.hasNotes();
    } catch {
      /* */
    }
    if (lib && activeSong && playReady) {
      songHint.textContent = isWeb
        ? "▶ Oynat — düşen notalar üstte başlar. Dokunmatik veya bilgisayar klavyesi ile çalın."
        : "▶ Oynat ile başlayın. Dokunmatik veya klavye ile çalın.";
    } else if (lib) {
      songHint.textContent = lib.songs.length
        ? "Çalmak için listeden bir şarkı seçin."
        : "Bu kütüphaneye + MIDI ile dosya ekleyin.";
    } else {
      songHint.textContent = "Önce bir kütüphane seçin.";
    }
  }

  function renderLibraries() {
    const LibraryStore = requireStore();
    const libs = LibraryStore.getLibraries();
    libraryList.innerHTML = "";
    const activeId = LibraryStore.getActiveLibraryId();
    if (!libs.length) {
      const empty = document.createElement("li");
      empty.className = "hint";
      empty.textContent = "Henüz kütüphane yok.";
      libraryList.appendChild(empty);
    }
    for (const lib of libs) {
      const li = document.createElement("li");
      li.textContent = lib.name;
      li.title = "Çift tık: yeniden adlandır";
      li.className = lib.id === activeId ? "active" : "";
      li.addEventListener("click", () => selectLibrary(lib.id));
      li.addEventListener("dblclick", (e) => {
        e.preventDefault();
        openModal(lib.id);
      });
      libraryList.appendChild(li);
    }
    btnImport.disabled = !activeId;
    if (btnImportAudio) btnImportAudio.disabled = !activeId;
    updateHints();
  }

  function showAudioImportProgress(show) {
    audioImportOverlay.classList.toggle("hidden", !show);
    if (!show) {
      audioImportBarFill.style.width = "0%";
      audioImportStatus.textContent = "";
      audioImportFile.textContent = "";
    }
  }

  function updateAudioImportProgress({ pct, message, file }) {
    const p = Math.round((pct || 0) * 100);
    audioImportBarFill.style.width = `${p}%`;
    audioImportStatus.textContent = message || "";
    if (file) audioImportFile.textContent = file;
  }

  function renderSongs() {
    const LibraryStore = requireStore();
    const lib = LibraryStore.getLibrary(LibraryStore.getActiveLibraryId());
    songList.innerHTML = "";
    if (!lib) {
      updateHints();
      return;
    }
    const activeSongId = LibraryStore.getActiveSongId();
    if (!lib.songs.length) {
      const empty = document.createElement("li");
      empty.className = "hint";
      empty.textContent = "Henüz şarkı yok.";
      songList.appendChild(empty);
    }
    for (const song of lib.songs) {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = song.name;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn small";
      del.textContent = "×";
      del.title = "Sil";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSong(song.id);
      });
      li.appendChild(name);
      li.appendChild(del);
      li.className = song.id === activeSongId ? "active" : "";
      li.addEventListener("click", () => selectSong(song.id));
      songList.appendChild(li);
    }
    updateHints();
  }

  async function selectLibrary(id) {
    const LibraryStore = requireStore();
    LibraryStore.setActiveLibrary(id);
    renderLibraries();
    renderSongs();
    trackSelect.innerHTML = '<option value="">Şarkı seçin</option>';
    trackSelect.disabled = true;
    btnPlay.disabled = true;
    try {
      requireMods().Game.stop();
    } catch {
      /* oyun modülü yok */
    }
  }

  async function selectSong(songId) {
    const LibraryStore = requireStore();
    try {
      LibraryStore.setActiveSong(songId);
      renderSongs();
      const song = LibraryStore.getActiveSong();
      if (!song) return;

      const parsed = await LibraryStore.loadSongMidi(song);
      if (parsed.error) {
        toast(parsed.error, true);
        return;
      }
      if (!parsed.tracks.length) {
        toast("Bu MIDI dosyasında nota bulunamadı.", true);
        return;
      }

      trackSelect.innerHTML = "";
      parsed.tracks.forEach((t, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        const inst = t.instrument ? ` — ${t.instrument}` : "";
        opt.textContent = `${t.name} (${t.noteCount} nota)${inst}`;
        trackSelect.appendChild(opt);
      });
      trackSelect.disabled = false;
      LibraryStore.setTrackIndex(0);
      trackSelect.value = "0";
      await reloadTrackNotes();
      try {
        btnPlay.disabled = !requireMods().Game.hasNotes();
      } catch {
        btnPlay.disabled = false;
      }
      toast(`"${song.name}" yüklendi.`);
    } catch (err) {
      toast(`Şarkı yüklenemedi: ${err.message}`, true);
    }
  }

  async function deleteSong(songId) {
    const LibraryStore = requireStore();
    try {
      await LibraryStore.deleteSong(LibraryStore.getActiveLibraryId(), songId);
      renderSongs();
      trackSelect.innerHTML = '<option value="">Şarkı seçin</option>';
      trackSelect.disabled = true;
      try {
        requireMods().Game.stop();
      } catch {
        /* */
      }
      btnPlay.disabled = true;
      toast("Şarkı silindi.");
    } catch (err) {
      toast(`Silinemedi: ${err.message}`, true);
    }
  }

  function showFeedback(type, points) {
    if (type === "complete") {
      toast("Parça bitti! ■ ile yeniden başlayın.");
      try {
        requireMods().Game.setAutoPlayMode(false);
      } catch {
        /* */
      }
      btnPlay.textContent = "▶ Oynat (sen çal)";
      if (btnAutoPlay) btnAutoPlay.textContent = "🎹 Sen çal";
      return;
    }
    const el = document.createElement("div");
    el.className = `feedback-pop ${type}`;
    el.textContent = type === "good" ? `+${points}` : "Kaçırdın!";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  function onTimeUpdate(t) {
    timeCurrent.textContent = t.currentText;
    timeTotal.textContent = t.totalText;
    timeRemaining.textContent = t.remainingText;
    progressFill.style.width = `${t.percent}%`;
  }

  function onScoreChange({ score, combo }) {
    scoreValue.textContent = String(score);
    comboValue.textContent = combo > 1 ? `×${combo}` : "";
    if (combo >= 5 && combo % 5 === 0 && combo !== lastComboShown) {
      lastComboShown = combo;
      comboFlare.textContent = `COMBO ×${combo}!`;
      comboFlare.classList.remove("hidden");
      setTimeout(() => comboFlare.classList.add("hidden"), 500);
    }
  }

  btnNewLib.addEventListener("click", () => openModal());
  libraryCancel.addEventListener("click", closeModal);
  libraryBackdrop.addEventListener("click", closeModal);

  libraryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveLibraryName(libraryNameInput.value);
  });

  inlineLibraryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    editingLibraryId = null;
    const ok = await saveLibraryName(inlineLibraryName.value);
    if (ok) inlineLibraryName.value = "";
  });

  btnImport.addEventListener("click", async () => {
    const LibraryStore = requireStore();
    const libId = LibraryStore.getActiveLibraryId();
    if (!libId) {
      toast("Önce bir kütüphane seçin veya oluşturun.", true);
      return;
    }
    try {
      try {
        requireMods().AudioEngine.ensure();
      } catch {
        /* ses yoksa da MIDI eklenebilir */
      }
      const imported = await window.pianoApi.importMidi(libId);
      if (!imported.length) return;
      await LibraryStore.importSongs(libId, imported);
      renderSongs();
      toast(`${imported.length} MIDI dosyası eklendi.`);
    } catch (err) {
      toast(`MIDI eklenemedi: ${err.message}`, true);
    }
  });

  let unbindAudioProgress = null;
  btnImportAudio?.addEventListener("click", async () => {
    const LibraryStore = requireStore();
    const libId = LibraryStore.getActiveLibraryId();
    if (!libId) {
      toast("Önce bir kütüphane seçin veya oluşturun.", true);
      return;
    }
    if (!window.pianoApi?.importAudio) {
      toast("Ses içe aktarma bu sürümde yok.", true);
      return;
    }
    if (btnImportAudio) btnImportAudio.disabled = true;
    btnImport.disabled = true;
    showAudioImportProgress(true);
    unbindAudioProgress?.();
    unbindAudioProgress = window.pianoApi.onAudioProgress(updateAudioImportProgress);

    try {
      const imported = await window.pianoApi.importAudio(libId);
      if (!imported.length) {
        toast("İşlem iptal edildi veya dosya seçilmedi.");
        return;
      }
      await LibraryStore.importSongs(libId, imported);
      renderSongs();
      const totalNotes = imported.reduce((s, x) => s + (x.noteCount || 0), 0);
      toast(
        `${imported.length} parça MIDI'ye çevrildi (${totalNotes} nota). Şarkıyı seçip oynatın.`
      );
      if (imported.length === 1) {
        LibraryStore.setActiveSong(imported[0].id);
        await selectSong(imported[0].id);
      }
    } catch (err) {
      toast(`Ses dönüştürülemedi: ${err.message}`, true);
    } finally {
      unbindAudioProgress?.();
      unbindAudioProgress = null;
      showAudioImportProgress(false);
      const activeId = LibraryStore.getActiveLibraryId();
      btnImport.disabled = !activeId;
      if (btnImportAudio) btnImportAudio.disabled = !activeId;
    }
  });

  trackSelect.addEventListener("change", () => reloadTrackNotes());
  octaveStart.addEventListener("change", () => {
    persistSettings({ octaveLockManual: true, autoKeyboardFromSong: false });
    populateOctaveSelects(Number(octaveStart.value), Number(octaveCount.value));
    rebuildPiano();
  });
  octaveCount.addEventListener("change", () => {
    persistSettings({ octaveLockManual: true, autoKeyboardFromSong: false });
    rebuildPiano();
  });

  keyWidthRange.addEventListener("input", () => {
    const w = Number(keyWidthRange.value);
    keyWidthLabel.textContent = `${w} px`;
    const h = Number(keyHeightRange.value);
    applyInstrumentKeySize(w, h);
    persistSettings({ keyWidth: w, octaveLockManual: true });
    reloadTrackNotes();
  });

  keyHeightRange.addEventListener("input", () => {
    const h = Number(keyHeightRange.value);
    keyHeightLabel.textContent = `${h} px`;
    const w = Number(keyWidthRange.value);
    applyInstrumentKeySize(w, h);
    persistSettings({ keyHeight: h, octaveLockManual: true });
    reloadTrackNotes();
  });

  stringVibratoSens?.addEventListener("input", () => {
    const v = Number(stringVibratoSens.value);
    if (vibratoSensLabel) vibratoSensLabel.textContent = vibratoSensLabelText(v);
    persistSettings({ stringVibratoSens: v / 100 });
  });

  window.addEventListener("touch-piano:play-mode", (e) => {
    updateSettingsForPlayMode(e.detail?.mode);
  });

  pianoDock?.addEventListener("change", () => {
    persistSettings({ pianoDock: pianoDock.value });
    applyPianoLayout(AppSettings.load());
  });

  pianoAlign?.addEventListener("change", () => {
    const align = pianoAlign.value;
    persistSettings({ pianoAlign: align });
    const s = AppSettings.load();
    requireMods().Piano.setAutoFit(align === "stretch");
    applyPianoLayout(s);
    rebuildKeyboardFromSettings();
  });

  instrumentSelect?.addEventListener("change", () => {
    const id = instrumentSelect.value;
    requireMods().AudioEngine.setInstrument(id);
    persistSettings({ instrumentId: id });
    toast(`Ses: ${instrumentSelect.selectedOptions[0]?.textContent || id}`);
  });

  playModeSelect?.addEventListener("change", () => {
    try {
      const m = applyPlayMode(playModeSelect.value, { force: true });
      reloadTrackNotes();
      updateSettingsForPlayMode(m);
      toast(`Enstrüman: ${window.PlaySurface.getModes()[m]?.label || m}`);
    } catch (err) {
      console.error(err);
      updateSettingsForPlayMode(playModeSelect.value);
      toast(`Enstrüman değişti; bazı ayarlar yenilenemedi: ${err.message}`, true);
    }
  });

  btnMoveInstrument?.addEventListener("click", () => {
    const mode = window.PlaySurface?.getMode?.() || "piano";
    if (mode === "piano") {
      toast("Piyano konumu: Ayarlar → Klavye → konum / hiza.");
      return;
    }
    if (!window.InstrumentMove) return;
    const next = !window.InstrumentMove.isMoveMode();
    window.InstrumentMove.setMoveMode(next);
    toast(next ? "Panelleri sürükleyin, bitince tekrar tıklayın." : "Konum kaydedildi.");
  });

  dynamicPressure.addEventListener("change", () => {
    requireMods().AudioEngine.setDynamicPressure(dynamicPressure.checked);
    persistSettings({ dynamicPressure: dynamicPressure.checked });
    toast(dynamicPressure.checked ? "Dinamik basınç açık." : "Sabit ses şiddeti.");
  });

  sustainEnabled.addEventListener("change", () => {
    requireMods().AudioEngine.setSustain(sustainEnabled.checked);
    persistSettings({ sustainEnabled: sustainEnabled.checked });
    toast(
      sustainEnabled.checked
        ? "Sustain açık — bırakınca ses yumuşak söner."
        : "Sustain kapalı — bırakınca ses hemen kesilir."
    );
  });

  speedRange.addEventListener("input", () => {
    const pct = Number(speedRange.value);
    speedLabel.textContent = `${pct}%`;
    requireMods().Game.setSpeed(pct / 100);
    persistSettings({ speed: pct });
  });

  timingWindow.addEventListener("input", () => {
    const ms = Number(timingWindow.value);
    timingLabel.textContent = `${ms} ms`;
    requireMods().Game.setTimingWindow(ms);
    persistSettings({ timingWindow: ms });
  });

  labelMode.addEventListener("change", () => {
    const mode = labelMode.value;
    persistSettings({ labelMode: mode });
    applyLabelSettings(AppSettings.load());
  });

  labelPreset.addEventListener("change", () => {
    persistSettings({ labelPreset: labelPreset.value });
    applyLabelSettings(AppSettings.load());
  });

  btnApplyLabels.addEventListener("click", () => {
    persistSettings({ customLabels: customLabels.value });
    applyLabelSettings(AppSettings.load());
    toast("Tuş harfleri güncellendi.");
  });

  customLabels.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnApplyLabels.click();
  });

  flameRange.addEventListener("input", () => {
    const v = Number(flameRange.value);
    const intensity = v / 100;
    flameLabel.textContent = flameLabelText(v);
    requireMods().Game.setFlameIntensity(intensity);
    persistSettings({ flameIntensity: intensity });
  });

  flameStyle.addEventListener("change", () => {
    const id = flameStyle.value;
    requireMods().Game.setFlameStyle(id);
    persistSettings({ flameStyle: id });
    toast(`Alev stili: ${window.FlameStyles?.getStyleName(id) || id}`);
  });

  function applyTrim() {
    const start = Number(trimStartInput?.value) || 0;
    const end = Number(trimEndInput?.value) || 0;
    persistSettings({ trimStart: start, trimEnd: end });
    try {
      requireMods().Game.setTrim(start, end);
      reloadTrackNotes();
      toast(`Kırpma: baş ${start} sn, son ${end} sn`);
    } catch {
      /* */
    }
  }

  trimStartInput?.addEventListener("change", applyTrim);
  trimEndInput?.addEventListener("change", applyTrim);

  setupSettingsTabs();
  effectHueInput?.addEventListener("input", persistThemeFromInputs);
  keyColorTopInput?.addEventListener("input", persistThemeFromInputs);
  keyColorMidInput?.addEventListener("input", persistThemeFromInputs);
  keyColorBottomInput?.addEventListener("input", persistThemeFromInputs);
  hitLineColorInput?.addEventListener("input", persistThemeFromInputs);

  labelAssignSave?.addEventListener("click", saveLabelAssign);
  labelAssignCancel?.addEventListener("click", closeLabelAssignModal);
  labelAssignBackdrop?.addEventListener("click", closeLabelAssignModal);
  labelAssignClear?.addEventListener("click", () => {
    labelAssignInput.value = "";
    saveLabelAssign();
  });
  labelAssignInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveLabelAssign();
    if (e.key === "Escape") closeLabelAssignModal();
  });

  window.addEventListener("piano:edit-label", (e) => {
    openLabelAssignModal(e.detail?.midi);
  });

  keyboardEnabled.addEventListener("change", () => {
    const on = keyboardEnabled.checked;
    window.KeyboardInput?.setEnabled(on);
    if (on) window.KeyboardInput?.rebuild?.();
    persistSettings({ keyboardEnabled: on });
    toast(on ? "Klavye ile çalma açık." : "Klavye ile çalma kapalı.");
  });

  btnToggleSidebar.addEventListener("click", () => {
    const hidden = document.body.classList.contains("sidebar-hidden");
    setSidebarVisible(hidden);
  });

  btnFullscreen.addEventListener("click", () => toggleFullscreen());

  window.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.code === "Escape" && document.body.classList.contains("sidebar-hidden") === false) {
      /* Esc tam ekrandan çıkar — Electron halleder */
    }
  });

  btnPlay.addEventListener("click", () => {
    const { AudioEngine, Game } = requireMods();
    Game.setAutoPlayMode(false);
    AudioEngine.ensure();
    if (Game.isPlaying()) {
      Game.pause();
      btnPlay.textContent = "▶ Oynat (sen çal)";
    } else {
      Game.play();
      btnPlay.textContent = "⏸ Duraklat";
      btnStop.disabled = false;
    }
  });

  btnAutoPlay?.addEventListener("click", () => {
    const { AudioEngine, Game } = requireMods();
    AudioEngine.ensure();
    Game.setAutoPlayMode(true);
    if (Game.isPlaying()) {
      Game.pause();
      btnAutoPlay.textContent = "🎹 Sen çal";
      btnPlay.textContent = "▶ Oynat (sen çal)";
    } else {
      Game.play();
      btnAutoPlay.textContent = "⏸ Bilgisayar duraklat";
      btnPlay.textContent = "▶ Oynat (sen çal)";
      btnStop.disabled = false;
      toast("Bilgisayar çalıyor — notalar otomatik vuruluyor.");
    }
  });

  btnStop.addEventListener("click", () => {
    const { Game, PlaySurface } = requireMods();
    Game.setAutoPlayMode(false);
    PlaySurface.releaseAll?.();
    window.KeyboardInput?.releaseAll?.();
    Game.resetRound();
    btnPlay.textContent = "▶ Oynat (sen çal)";
    btnAutoPlay.textContent = "🎹 Sen çal";
    btnPlay.disabled = !Game.hasNotes();
    btnAutoPlay.disabled = !Game.hasNotes();
    btnStop.disabled = true;
  });

  applyThemeFromSettings(AppSettings.load());

  (async function boot() {
    window.__bootStatus = "başlıyor";
    try {
      await requireStore().load();
      window.__bootStatus = "kütüphane yüklendi";
      renderLibraries();
      renderSongs();
    } catch (err) {
      window.__bootStatus = "hata: " + err.message;
      toast(`Kütüphane hatası: ${err.message}`, true);
      console.error(err);
      return;
    }

    try {
      const { PlaySurface, Game, AppSettings } = requireMods();
      Game.init($("#notesCanvas"), {
        onScoreChange,
        onFeedback: showFeedback,
        onTimeUpdate,
      });
      PlaySurface.init(
        (midi) => Game.handleKeyPress(midi),
        () => {}
      );
      if (window.InstrumentMove) window.InstrumentMove.applyLayout(AppSettings.load());
      applySettings(AppSettings.load());
      window.KeyboardInput?.bind?.();
      window.KeyboardInput?.rebuild?.();
      showInstrumentPickerIfNeeded();
      updateSettingsForPlayMode(PlaySurface.getMode());
      window.__bootStatus = "piyano hazır";
    } catch (err) {
      window.__bootStatus = "piyano hata: " + err.message;
      toast(`Piyano uyarısı: ${err.message}`, true);
      console.error(err);
    }

    try {
      const demo = requireStore().getLibrary("lib-demo");
      if (demo) {
        requireStore().setActiveLibrary(demo.id);
        renderLibraries();
        renderSongs();
        if (demo.songs.length) {
          await selectSong(demo.songs[0].id);
        }
        window.__bootStatus = "hazır";
      }
    } catch (err) {
      window.__bootStatus = "demo hata: " + err.message;
      toast(`Demo şarkı: ${err.message}`, true);
      console.error(err);
    }
  })();
})();

