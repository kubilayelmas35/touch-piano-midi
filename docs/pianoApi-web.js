/**
 * Tarayıcı / GitHub Pages — Wix Members + Media (iframe köprüsü veya doğrudan HTTP).
 * Electron preload yerine window.pianoApi sağlar.
 */
(function () {
  const MSG_SOURCE = "touch-piano";
  const MSG_REPLY = "touch-piano-wix";
  const pending = new Map();

  const config = {
    /** Wix site kökü, örn. https://sizin-site.wixsite.com/siteniz */
    wixSiteBase: "",
    /** postMessage köprüsü (Wix sayfasında iframe). false = sadece HTTP */
    useParentBridge: true,
    /** İzin verilen Wix parent origin (boş = her origin kabul, geliştirme) */
    allowedParentOrigins: [],
  };

  if (typeof window !== "undefined" && window.__TOUCH_PIANO_WIX_CONFIG) {
    Object.assign(config, window.__TOUCH_PIANO_WIX_CONFIG);
  }

  let session = { memberId: null, email: null };
  let bridgeReady = false;

  function inIframe() {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  function originAllowed(origin) {
    if (!config.allowedParentOrigins?.length) return true;
    return config.allowedParentOrigins.some((o) => {
      if (o === origin) return true;
      if (o.startsWith("*.")) {
        const suffix = o.slice(1);
        return origin.endsWith(suffix);
      }
      return false;
    });
  }

  function bridgeCall(action, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!inIframe() || !config.useParentBridge) {
        reject(new Error("Wix köprüsü yok — oynatıcıyı Wix sitesindeki Piyano sayfasından açın."));
        return;
      }
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("Wix yanıt vermedi (zaman aşımı). Giriş yaptığınızdan emin olun."));
      }, 300000);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      window.parent.postMessage(
        { source: MSG_SOURCE, id, action, payload },
        "*"
      );
    });
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== MSG_REPLY) return;
    if (config.allowedParentOrigins?.length && !originAllowed(event.origin)) return;

    if (data.type === "WIX_SESSION") {
      session = { memberId: data.memberId || null, email: data.email || null };
      bridgeReady = !!session.memberId;
      window.dispatchEvent(
        new CustomEvent("touch-piano:session", { detail: { ...session } })
      );
      return;
    }

    const slot = pending.get(data.id);
    if (!slot) return;
    pending.delete(data.id);
    if (data.error) slot.reject(new Error(data.error));
    else slot.resolve(data.result);
  });

  function requestPing() {
    if (!inIframe() || !config.useParentBridge) return;
    window.parent.postMessage({ source: MSG_SOURCE, type: "PING" }, "*");
  }

  if (inIframe() && config.useParentBridge) {
    requestPing();
    setTimeout(requestPing, 400);
  }

  function parseMidiBytes(bytes) {
    if (typeof Midi === "undefined") {
      return {
        name: "Hata",
        duration: 0,
        bpm: 120,
        tracks: [],
        error: "@tonejs/midi yüklenemedi",
      };
    }
    const midi = new Midi(new Uint8Array(bytes));
    const tracks = midi.tracks.map((track, index) => {
      const notes = track.notes.map((n) => ({
        midi: n.midi,
        name: n.name,
        time: n.time,
        duration: n.duration,
        velocity: n.velocity,
      }));
      return {
        index,
        name: track.name || `İz ${index + 1}`,
        instrument: track.instrument?.name || "",
        noteCount: notes.length,
        notes,
      };
    });
    return {
      name: midi.name || midi.header?.name || "Adsız",
      duration: midi.duration,
      bpm: midi.header.tempos[0]?.bpm ?? 120,
      tracks: tracks.filter((t) => t.noteCount > 0),
    };
  }

  async function apiCall(action, payload) {
    if (config.useParentBridge && inIframe()) {
      return bridgeCall(action, payload);
    }
    if (!config.wixSiteBase) {
      throw new Error("Wix site adresi tanımlı değil (wix-config.js).");
    }
    const url = `${config.wixSiteBase.replace(/\/$/, "")}/_functions/${action}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function pickMidiFiles() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".mid,.midi,audio/midi";
      input.multiple = true;
      input.onchange = () => resolve([...(input.files || [])]);
      input.click();
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result;
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        resolve(btoa(binary));
      };
      reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı"));
      reader.readAsArrayBuffer(file);
    });
  }

  async function readMidi(ref) {
    if (!ref) throw new Error("MIDI yolu yok");
    const str = String(ref);
    if (str.startsWith("cms:")) {
      const songId = str.slice(4);
      const out = await apiCall("pianoGetMidi", { songId });
      const binary = atob(out.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return Array.from(bytes);
    }
    if (/^https?:\/\//i.test(str) || str.startsWith("wix:")) {
      const res = await fetch(str);
      if (!res.ok) throw new Error(`MIDI indirilemedi: ${res.status}`);
      const buf = await res.arrayBuffer();
      return Array.from(new Uint8Array(buf));
    }
    if (config.useParentBridge && inIframe()) {
      const out = await bridgeCall("readMidi", { ref: str });
      return out.bytes;
    }
    throw new Error("Yerel MIDI dosyası web sürümünde desteklenmiyor.");
  }

  window.pianoApi = {
    isWeb: true,
    getSession: () => ({ ...session }),
    isBridgeReady: () => bridgeReady,

    getLibraries: async () => {
      const data = await apiCall("pianoGetLibraries", {});
      return data?.libraries ? data : { libraries: [] };
    },

    saveLibraries: async (data) => {
      if (!data || !Array.isArray(data.libraries)) {
        throw new Error("Geçersiz kütüphane verisi");
      }
      await apiCall("pianoSaveLibraries", { libraries: data.libraries });
      return true;
    },

    importMidi: async (libraryId) => {
      const files = await pickMidiFiles();
      if (!files.length) return [];
      const imported = [];
      for (const file of files) {
        const base64 = await fileToBase64(file);
        const baseName = file.name.replace(/\.(mid|midi)$/i, "") || "parca";
        const entry = await apiCall("pianoUploadMidi", {
          libraryId,
          fileName: file.name,
          base64,
          name: baseName,
        });
        imported.push(entry);
      }
      return imported;
    },

    importMidiPaths: async () => {
      throw new Error("Web sürümünde dosya yolu içe aktarma yok.");
    },

    importAudio: async () => {
      throw new Error("MP3→MIDI yalnızca masaüstü (Electron) uygulamasında.");
    },

    onAudioProgress: () => () => {},

    readMidi,

    deleteMidi: async (ref, meta) => {
      const payload =
        meta && typeof meta === "object"
          ? { midiUrl: ref, songId: meta.songId, libraryId: meta.libraryId }
          : { midiUrl: ref };
      await apiCall("pianoDeleteSong", payload);
      return true;
    },

    parseMidi: (bytes) => parseMidiBytes(bytes),

    toggleFullscreen: async () => {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        return true;
      }
      await document.exitFullscreen();
      return false;
    },

    isFullscreen: async () => !!document.fullscreenElement,
  };

})();
