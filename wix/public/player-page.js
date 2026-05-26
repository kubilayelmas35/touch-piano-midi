/**
 * Wix sayfa kodu — Piyano sayfası (#pianoHtml = HTML iframe / Embed).
 *
 * Kütüphane listesi: UserPianoData (küçük JSON)
 * MIDI dosyaları: UserPianoMidi (parça başına ayrı satır, ~15 MB)
 */
import wixData from "wix-data";
import { currentMember } from "wix-members-frontend";

/** GitHub Pages kök origin — sonunda / olmadan */
const GITHUB_PAGES_ORIGIN = "https://kubilayelmas35.github.io";

const COLLECTION = "UserPianoData";
const MIDI_COLLECTION = "UserPianoMidi";
const MSG_IN = "touch-piano";
const MSG_OUT = "touch-piano-wix";
/** Parça başına ham MIDI (base64 öncesi) — Wix Long Text alanı */
const MAX_MIDI_BYTES = 15 * 1024 * 1024;

function pagesOrigin() {
  const o = (GITHUB_PAGES_ORIGIN || "").replace(/\/$/, "");
  return o || "*";
}

function formatCmsError(where, err) {
  const msg = err?.message || String(err);
  if (msg.includes("WDE0027") || msg.includes("WDE0177") || msg.includes("permission")) {
    return `CMS izin hatası. ${COLLECTION} ve ${MIDI_COLLECTION} için Create/Update açın.`;
  }
  if (msg.includes("WDE0007") || msg.toLowerCase().includes("not found")) {
    return `CMS koleksiyonu bulunamadı. "${COLLECTION}" ve "${MIDI_COLLECTION}" oluşturun.`;
  }
  return `${where}: ${msg}`;
}

async function requireMemberId() {
  const member = await currentMember.getMember();
  if (!member?._id) {
    throw new Error("Üye girişi gerekli. Wix sitesinde giriş yapıp sayfayı yenileyin.");
  }
  return member._id;
}

function parseLibrariesJson(row) {
  const raw =
    typeof row.librariesJson === "string"
      ? JSON.parse(row.librariesJson)
      : row.librariesJson;

  if (raw && Array.isArray(raw.libraries)) {
    return raw.libraries;
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  return [];
}

/** İstemciye base64 gönderme — sadece metadata */
function clientLibraries(libraries) {
  return libraries.map((lib) => ({
    ...lib,
    songs: (lib.songs || []).map(({ midiBase64, ...song }) => ({
      ...song,
      storage: song.storage || (song.midiUrl || song.relativePath ? undefined : "cms"),
    })),
  }));
}

async function persistLibrariesJson(memberId, libraries) {
  const librariesJson = JSON.stringify({ libraries: clientLibraries(libraries) });

  const existing = await wixData
    .query(COLLECTION)
    .eq("memberId", memberId)
    .limit(1)
    .find();

  if (existing.items.length) {
    await wixData.update(COLLECTION, {
      _id: existing.items[0]._id,
      memberId,
      librariesJson,
    });
  } else {
    await wixData.insert(COLLECTION, { memberId, librariesJson });
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
    await persistLibrariesJson(memberId, libraries);
  }
}

async function loadLibraries() {
  const memberId = await requireMemberId();
  const result = await wixData
    .query(COLLECTION)
    .eq("memberId", memberId)
    .limit(1)
    .find();

  if (!result.items.length) {
    return { libraries: [] };
  }

  const libraries = parseLibrariesJson(result.items[0]);
  await migrateInlineMidi(memberId, libraries);
  return { libraries: clientLibraries(libraries) };
}

async function saveLibraries(libraries) {
  if (!Array.isArray(libraries)) {
    throw new Error("libraries dizi olmalı");
  }
  const memberId = await requireMemberId();
  await persistLibrariesJson(memberId, libraries);
}

async function upsertMidiRow(memberId, libraryId, songId, fileName, base64) {
  const existing = await wixData
    .query(MIDI_COLLECTION)
    .eq("memberId", memberId)
    .eq("songId", songId)
    .limit(1)
    .find();

  const row = {
    memberId,
    songId,
    libraryId: libraryId || "",
    fileName: fileName || "",
    midiData: String(base64),
  };

  if (existing.items.length) {
    await wixData.update(MIDI_COLLECTION, { _id: existing.items[0]._id, ...row });
  } else {
    await wixData.insert(MIDI_COLLECTION, row);
  }
}

async function getMidiRow(memberId, songId) {
  const result = await wixData
    .query(MIDI_COLLECTION)
    .eq("memberId", memberId)
    .eq("songId", songId)
    .limit(1)
    .find();

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
    .find();

  if (result.items.length) {
    await wixData.remove(MIDI_COLLECTION, result.items[0]._id);
  }
}

async function uploadMidi({ libraryId, fileName, base64, name }) {
  if (!libraryId || !fileName || !base64) {
    throw new Error("libraryId, fileName ve base64 gerekli");
  }

  const approxBytes = Math.floor((String(base64).length * 3) / 4);
  if (approxBytes > MAX_MIDI_BYTES) {
    throw new Error(
      `MIDI çok büyük (~${Math.round(approxBytes / 1024)} KB). Parça başına en fazla ~${Math.round(MAX_MIDI_BYTES / 1024 / 1024 * 10) / 10} MB.`
    );
  }

  const memberId = await requireMemberId();
  const safeName = String(fileName).replace(/[<>:"/\\|?*]/g, "_");
  const songId = `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await upsertMidiRow(memberId, libraryId, songId, safeName, base64);

  return {
    id: songId,
    name: (name || safeName).replace(/\.(mid|midi)$/i, ""),
    fileName: safeName,
    storage: "cms",
  };
}

async function getMidiData({ songId }) {
  if (!songId) {
    throw new Error("songId gerekli");
  }
  const memberId = await requireMemberId();
  const row = await getMidiRow(memberId, songId);
  return { base64: row.midiData };
}

async function deleteSong(payload) {
  const { songId, libraryId, midiUrl } = payload || {};
  const memberId = await requireMemberId();
  const data = await loadLibraries();
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

  await saveLibraries(data.libraries);
  return { ok: true };
}

async function sendSession(html) {
  try {
    const member = await currentMember.getMember();
    if (!member?._id) return;
    html.postMessage(
      {
        source: MSG_OUT,
        type: "WIX_SESSION",
        memberId: member._id,
        email: member.loginEmail || "",
      },
      pagesOrigin()
    );
  } catch (e) {
    console.error("sendSession", e);
  }
}

async function handleApi(html, data) {
  const { id, action, payload } = data;
  try {
    let result;
    switch (action) {
      case "pianoGetLibraries":
        result = await loadLibraries();
        break;
      case "pianoSaveLibraries":
        await saveLibraries(payload?.libraries);
        result = { ok: true };
        break;
      case "pianoUploadMidi":
        result = await uploadMidi(payload || {});
        break;
      case "pianoGetMidi":
        result = await getMidiData(payload || {});
        break;
      case "pianoDeleteSong":
        result = await deleteSong(payload);
        break;
      default:
        throw new Error(`Bilinmeyen işlem: ${action}`);
    }
    html.postMessage({ source: MSG_OUT, id, result }, pagesOrigin());
  } catch (err) {
    const message = formatCmsError(action, err);
    console.error(`[player-page] ${action}:`, err);
    html.postMessage(
      { source: MSG_OUT, id, error: message },
      pagesOrigin()
    );
  }
}

$w.onReady(() => {
  const html = $w("#pianoHtml");
  if (!html) {
    console.error('Sayfada ID="pianoHtml" olan Embed/HTML bileşeni yok.');
    return;
  }

  html.onMessage(async (event) => {
    const data = event.data;
    if (!data || data.source !== MSG_IN) return;

    if (data.type === "PING") {
      await sendSession(html);
      return;
    }

    if (data.id && data.action) {
      await handleApi(html, data);
    }
  });

  sendSession(html);
});
