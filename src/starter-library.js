/** Tüm kullanıcılara telifsiz örnek MIDI (Bach BWV 846 — kamu malı) */
const StarterLibrary = (() => {
  const LIB_ID = "lib-starter";
  const ASSET = "assets/bach_846.mid";

  function songMeta() {
    const t = window.I18n?.t?.bind(window.I18n) || ((k) => k);
    return {
      id: "song-bach-846",
      name: t("starter.song"),
      fileName: "bach_846.mid",
      license: "public-domain",
    };
  }

  function libName() {
    return window.I18n?.t?.("starter.lib") || "Sample tracks (royalty-free)";
  }

  async function fetchBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Örnek MIDI yüklenemedi (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function ensure(LibraryStore) {
    if (!window.pianoApi?.isWeb) return false;
    if (LibraryStore.getLibrary("lib-demo")?.songs?.length) return false;

    const lib = LibraryStore.getLibrary(LIB_ID);
    const SONG_META = songMeta();
    if (lib?.songs?.some((s) => s.id === SONG_META.id || s.fileName === SONG_META.fileName)) {
      return false;
    }

    if (!lib) {
      LibraryStore.dataPushStarter({
        id: LIB_ID,
        name: libName(),
        songs: [],
        createdAt: new Date().toISOString(),
        starter: true,
      });
      await LibraryStore.save();
    }

    let base64;
    try {
      base64 = await fetchBase64(ASSET);
    } catch (err) {
      console.warn("Starter MIDI:", err);
      return false;
    }

    const api = window.pianoApi;
    if (api?.isMember?.()) {
      const entry = await api.uploadMidiBase64(LIB_ID, SONG_META.fileName, base64, SONG_META.name);
      await LibraryStore.importSongs(LIB_ID, [entry]);
      return true;
    }

    await LibraryStore.importSongs(LIB_ID, [
      {
        ...SONG_META,
        midiBase64: base64,
        storage: "local",
      },
    ]);
    return true;
  }

  return { LIB_ID, ensure };
})();

window.StarterLibrary = StarterLibrary;
