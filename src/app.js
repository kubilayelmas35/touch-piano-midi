/** Ana uygulama */
(function () {
  const APP_VERSION = "v0.9.4";
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
  const guitarGripAllStrings = $("#guitarGripAllStrings");
  const violinGripAllStrings = $("#violinGripAllStrings");
  const guitarNeckHeight = $("#guitarNeckHeight");
  const guitarStringHeight = $("#guitarStringHeight");
  const guitarNeckWidth = $("#guitarNeckWidth");
  const guitarPluckWidth = $("#guitarPluckWidth");
  const guitarNeckHeightLabel = $("#guitarNeckHeightLabel");
  const guitarStringHeightLabel = $("#guitarStringHeightLabel");
  const guitarNeckWidthLabel = $("#guitarNeckWidthLabel");
  const guitarPluckWidthLabel = $("#guitarPluckWidthLabel");
  const appVersion = $("#appVersion");
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
    } else if ((mode === "guitar" || mode === "violin") && window.PlaySurface?.activeModule?.()?.applyLayout) {
      window.PlaySurface.activeModule().applyLayout();
    } else {
      window.PlaySurface?.setKeySize?.(w, h);
    }
  }

  function applyGuitarLayoutFromSliders() {
    const partial = {
      guitarNeckHeight: Number(guitarNeckHeight?.value || 30),
      guitarStringHeight: Number(guitarStringHeight?.value || 30),
      guitarNeckWidth: Number(guitarNeckWidth?.value || 42),
      guitarPluckWidth: Number(guitarPluckWidth?.value || 220),
    };
    if (guitarNeckHeightLabel) guitarNeckHeightLabel.textContent = `${partial.guitarNeckHeight} px`;
    if (guitarStringHeightLabel) guitarStringHeightLabel.textContent = `${partial.guitarStringHeight} px`;
    if (guitarNeckWidthLabel) guitarNeckWidthLabel.textContent = `${partial.guitarNeckWidth} px`;
    if (guitarPluckWidthLabel) guitarPluckWidthLabel.textContent = `${partial.guitarPluckWidth} px`;
    persistSettings(partial);
    window.Guitar?.applyLayout?.();
    setTimeout(() => requireMods().Game.resize(), 60);
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
    if (m === "guitar" || m === "violin") window.PlaySurface?.activeModule?.()?.applyLayout?.();
    else applyInstrumentKeySize(s.keyWidth, s.keyHeight);
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
    if (guitarGripAllStrings) guitarGripAllStrings.checked = !!s.guitarGripAllStrings;
    if (violinGripAllStrings) violinGripAllStrings.checked = !!s.violinGripAllStrings;
    if (guitarNeckHeight) guitarNeckHeight.value = String(s.guitarNeckHeight ?? 30);
    if (guitarStringHeight) guitarStringHeight.value = String(s.guitarStringHeight ?? 30);
    if (guitarNeckWidth) guitarNeckWidth.value = String(s.guitarNeckWidth ?? 42);
    if (guitarPluckWidth) guitarPluckWidth.value = String(s.guitarPluckWidth ?? 220);
    if (guitarNeckHeightLabel) guitarNeckHeightLabel.textContent = `${s.guitarNeckHeight ?? 30} px`;
    if (guitarStringHeightLabel) guitarStringHeightLabel.textContent = `${s.guitarStringHeight ?? 30} px`;
    if (guitarNeckWidthLabel) guitarNeckWidthLabel.textContent = `${s.guitarNeckWidth ?? 42} px`;
    if (guitarPluckWidthLabel) guitarPluckWidthLabel.textContent = `${s.guitarPluckWidth ?? 220} px`;
    if ((s.playMode || "piano") === "guitar" || s.playMode === "violin") {
      window.PlaySurface?.activeModule?.()?.applyLayout?.();
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

  guitarGripAllStrings?.addEventListener("change", () => {
    persistSettings({ guitarGripAllStrings: guitarGripAllStrings.checked });
    if (window.Guitar?.buildKeys) window.Guitar.buildKeys();
  });

  violinGripAllStrings?.addEventListener("change", () => {
    persistSettings({ violinGripAllStrings: violinGripAllStrings.checked });
    if (window.Violin?.buildKeys) window.Violin.buildKeys();
  });

  [guitarNeckHeight, guitarStringHeight, guitarNeckWidth, guitarPluckWidth].forEach((el) => {
    el?.addEventListener("input", applyGuitarLayoutFromSliders);
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
    if (appVersion) appVersion.textContent = `Surum ${APP_VERSION}`;
    window.__appVersion = APP_VERSION;
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
