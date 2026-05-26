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
