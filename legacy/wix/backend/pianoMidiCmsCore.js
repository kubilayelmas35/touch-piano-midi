/**
 * UserPianoMidi + kütüphane senkronu — suppressAuth ile CMS yazma.
 */
import wixData from "wix-data";
import {
  requireMemberId,
  loadLibraries as loadLibrariesRaw,
  saveLibraries as saveLibrariesRaw,
  formatError,
} from "backend/pianoLibraryCore";

export const MIDI_COLLECTION = "UserPianoMidi";
const DATA_OPTS = { suppressAuth: true };
export const MAX_MIDI_BYTES = 15 * 1024 * 1024;

function clientLibraries(libraries) {
  return libraries.map((lib) => ({
    ...lib,
    songs: (lib.songs || []).map(({ midiBase64, ...song }) => ({
      ...song,
      storage: song.storage || (song.midiUrl || song.relativePath ? undefined : "cms"),
    })),
  }));
}

async function upsertMidiRow(memberId, libraryId, songId, fileName, base64) {
  const existing = await wixData
    .query(MIDI_COLLECTION)
    .eq("memberId", memberId)
    .eq("songId", songId)
    .limit(1)
    .find(DATA_OPTS);

  const row = {
    memberId,
    songId,
    libraryId: libraryId || "",
    fileName: fileName || "",
    midiData: String(base64),
  };

  if (existing.items.length) {
    await wixData.update(MIDI_COLLECTION, { _id: existing.items[0]._id, ...row }, DATA_OPTS);
  } else {
    await wixData.insert(MIDI_COLLECTION, row, DATA_OPTS);
  }
}

async function getMidiRow(memberId, songId) {
  const result = await wixData
    .query(MIDI_COLLECTION)
    .eq("memberId", memberId)
    .eq("songId", songId)
    .limit(1)
    .find(DATA_OPTS);

  if (!result.items.length) {
    throw new Error("MIDI kaydı bulunamadı. Dosyayı yeniden yükleyin.");
  }
  return result.items[0];
}

async function removeMidiRow(memberId, songId) {
  const result = await wixData
    .query(MIDI_COLLECTION)
    .eq("memberId", memberId)
    .eq("songId", songId)
    .limit(1)
    .find(DATA_OPTS);

  if (result.items.length) {
    await wixData.remove(MIDI_COLLECTION, result.items[0]._id, DATA_OPTS);
  }
}

async function migrateInlineMidi(memberId, libraries) {
  let dirty = false;
  for (const lib of libraries) {
    for (const song of lib.songs || []) {
      if (!song.midiBase64) continue;
      await upsertMidiRow(memberId, lib.id, song.id, song.fileName, song.midiBase64);
      delete song.midiBase64;
      song.storage = "cms";
      dirty = true;
    }
  }
  if (dirty) {
    await saveLibrariesRaw(memberId, clientLibraries(libraries));
  }
}

export async function loadLibrariesForClient() {
  const memberId = await requireMemberId();
  const data = await loadLibrariesRaw(memberId);
  await migrateInlineMidi(memberId, data.libraries);
  return { libraries: clientLibraries(data.libraries) };
}

export async function saveLibrariesForClient(libraries) {
  if (!Array.isArray(libraries)) {
    throw new Error("libraries dizi olmalı");
  }
  const memberId = await requireMemberId();
  await saveLibrariesRaw(memberId, clientLibraries(libraries));
}

export async function uploadMidiToCms({ libraryId, fileName, base64, name }) {
  if (!libraryId || !fileName || !base64) {
    throw new Error("libraryId, fileName ve base64 gerekli");
  }

  const approxBytes = Math.floor((String(base64).length * 3) / 4);
  if (approxBytes > MAX_MIDI_BYTES) {
    throw new Error(
      `MIDI çok büyük (~${Math.round(approxBytes / 1024)} KB). Parça başına en fazla ~${Math.round((MAX_MIDI_BYTES / 1024 / 1024) * 10) / 10} MB.`
    );
  }

  const memberId = await requireMemberId();
  const safeName = String(fileName).replace(/[<>:"/\\|?*]/g, "_");
  const songId = `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await upsertMidiRow(memberId, libraryId, songId, safeName, base64);

  const entry = {
    id: songId,
    name: (name || safeName).replace(/\.(mid|midi)$/i, ""),
    fileName: safeName,
    storage: "cms",
  };

  const data = await loadLibrariesForClient();
  const lib = data.libraries.find((l) => l.id === libraryId);
  if (!lib) {
    await removeMidiRow(memberId, songId);
    throw new Error(
      "Kütüphane bulutta bulunamadı. Önce kütüphaneyi kaydedin (+ Yeni), sonra MIDI yükleyin."
    );
  }
  if (!Array.isArray(lib.songs)) lib.songs = [];
  if (!lib.songs.some((s) => s.id === songId)) {
    lib.songs.push(entry);
    await saveLibrariesForClient(data.libraries);
  }

  return entry;
}

export async function getMidiFromCms({ songId }) {
  if (!songId) {
    throw new Error("songId gerekli");
  }
  const memberId = await requireMemberId();
  const row = await getMidiRow(memberId, songId);
  return { base64: row.midiData };
}

export async function deleteSongFromCms(payload) {
  const { songId, libraryId, midiUrl } = payload || {};
  const memberId = await requireMemberId();
  const data = await loadLibrariesRaw(memberId);
  let removed = false;
  let removedSongId = songId;

  for (const lib of data.libraries) {
    if (libraryId && lib.id !== libraryId) continue;
    const before = lib.songs?.length || 0;
    lib.songs = (lib.songs || []).filter((s) => {
      if (songId && s.id === songId) {
        removed = true;
        removedSongId = s.id;
        return false;
      }
      if (midiUrl && s.midiUrl === midiUrl) {
        removed = true;
        removedSongId = s.id;
        return false;
      }
      return true;
    });
    if (lib.songs.length !== before) {
      removed = true;
    }
  }

  if (!removed) {
    throw new Error("Şarkı bulunamadı");
  }

  if (removedSongId) {
    await removeMidiRow(memberId, removedSongId);
  }

  await saveLibrariesRaw(memberId, clientLibraries(data.libraries));
  return { ok: true };
}

export { formatError };
