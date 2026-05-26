/** Piyano benzeri ses — basılı tutunca doğal sönüm (decay) */
const AudioEngine = (() => {
  let ctx = null;
  const voices = new Map();

  let dynamicPressure = true;
  let sustainEnabled = true;
  const RELEASE_FAST = 0.05;
  const RELEASE_SLOW = 0.55;

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

  function noteOn(midi, velocity = 0.75) {
    const ac = ensure();
    noteOff(midi, true);

    const t = ac.currentTime;
    const freq = midiToFreq(midi);
    const vol = velocity * 0.38;

    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);

    const decay1 = t + 0.35;
    const decay2 = t + 2.8;
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.45), decay1);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.08), decay2);

    const osc1 = ac.createOscillator();
    const osc2 = ac.createOscillator();
    const osc3 = ac.createOscillator();
    osc1.type = "triangle";
    osc2.type = "sine";
    osc3.type = "sine";
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 2.01;
    osc3.frequency.value = freq * 0.5;

    const g1 = ac.createGain();
    const g2 = ac.createGain();
    const g3 = ac.createGain();
    g1.gain.value = 0.5;
    g2.gain.value = 0.22;
    g3.gain.value = 0.1;

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3200 + velocity * 1800, t);
    filter.frequency.exponentialRampToValueAtTime(900 + velocity * 400, decay2);
    filter.Q.value = 0.7;

    osc1.connect(g1);
    osc2.connect(g2);
    osc3.connect(g3);
    g1.connect(filter);
    g2.connect(filter);
    g3.connect(filter);
    filter.connect(master);
    master.connect(ac.destination);

    osc1.start(t);
    osc2.start(t);
    osc3.start(t);

    voices.set(midi, {
      oscs: [osc1, osc2, osc3],
      master,
      filter,
      started: t,
      peak: vol,
    });
  }

  function noteOff(midi, silent = false) {
    const voice = voices.get(midi);
    if (!voice) return;
    voices.delete(midi);

    const ac = ensure();
    const t = ac.currentTime;
    const release = silent ? 0.001 : sustainEnabled ? RELEASE_SLOW : RELEASE_FAST;

    try {
      voice.master.gain.cancelScheduledValues(t);
      const now = Math.max(0.0001, voice.master.gain.value);
      voice.master.gain.setValueAtTime(now, t);
      voice.master.gain.exponentialRampToValueAtTime(0.0001, t + release);

      const stopAt = t + release + 0.06;
      for (const osc of voice.oscs) osc.stop(stopAt);
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
    velocityFromPointer,
    midiToFreq,
  };
})();

window.AudioEngine = AudioEngine;
