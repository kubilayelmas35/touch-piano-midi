const { contextBridge, ipcRenderer } = require("electron");

let parseMidiBytes;

try {
  const { Midi } = require("@tonejs/midi");
  parseMidiBytes = (bytes) => {
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
  };
} catch (err) {
  console.error("MIDI parser yüklenemedi:", err);
  parseMidiBytes = () => ({
    name: "Hata",
    duration: 0,
    bpm: 120,
    tracks: [],
    error: String(err.message || err),
  });
}

contextBridge.exposeInMainWorld("pianoApi", {
  getLibraries: () => ipcRenderer.invoke("libraries:get"),
  saveLibraries: (data) => ipcRenderer.invoke("libraries:save", data),
  importMidi: (libraryId) => ipcRenderer.invoke("midi:import", { libraryId }),
  importAudio: (libraryId) => ipcRenderer.invoke("audio:import", { libraryId }),
  onAudioProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("audio:progress", handler);
    return () => ipcRenderer.removeListener("audio:progress", handler);
  },
  importMidiPaths: (libraryId, paths) =>
    ipcRenderer.invoke("midi:importPaths", { libraryId, paths }),
  readMidi: (relativePath) => ipcRenderer.invoke("midi:read", relativePath),
  deleteMidi: (relativePath) => ipcRenderer.invoke("midi:delete", relativePath),
  parseMidi: (bytes) => parseMidiBytes(bytes),
  toggleFullscreen: () => ipcRenderer.invoke("window:toggleFullscreen"),
  isFullscreen: () => ipcRenderer.invoke("window:isFullscreen"),
});
