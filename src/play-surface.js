/** Aktif çalma yüzeyi — piyano / gitar / keman */
const PlaySurface = (() => {
  function modeLabel(id) {
    const t = window.I18n?.t?.bind(window.I18n);
    if (!t) return { piano: "Piano", guitar: "Guitar", violin: "Violin" }[id] || id;
    return t(`inst.${id}`);
  }

  const MODES = {
    piano: { icon: "🎹", sound: "piano" },
    guitar: { icon: "🎸", sound: "guitar" },
    violin: { icon: "🎻", sound: "violin" },
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
    /* label via getModes() */
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

    mod?.applyLayout?.();

    window.dispatchEvent(new CustomEvent("touch-piano:play-mode", { detail: { mode } }));
    requestAnimationFrame(() => {
      mod?.applyLayout?.();
      if (window.Game?.isReady?.()) window.Game.resize();
    });
    return mode;
  }

  function getMode() {
    return mode;
  }

  function getModes() {
    const out = {};
    for (const [id, meta] of Object.entries(MODES)) {
      out[id] = { ...meta, label: modeLabel(id) };
    }
    return out;
  }

  function init(noteDown, noteUp) {
    noteDownCb = noteDown;
    noteUpCb = noteUp;
    const s = window.AppSettings?.load?.() || {};
    setMode(s.playMode || "piano", { force: true, syncSound: false });
    if (s.instrumentId) window.AudioEngine?.setInstrument?.(s.instrumentId);
    activeModule()?.applyLayout?.();
    requestAnimationFrame(() => {
      activeModule()?.applyLayout?.();
      window.Game?.refreshView?.() || window.Game?.resize?.();
    });
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
    getMidiTarget: (midi) => delegate("getMidiTarget", midi),
    flash,
    pressKey,
    releaseKey,
    activeModule,
  };
})();

window.PlaySurface = PlaySurface;
