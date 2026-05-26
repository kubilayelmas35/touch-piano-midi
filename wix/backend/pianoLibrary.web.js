/**
 * Wix Velo — üye bazlı kütüphane + MIDI (Media Manager).
 * CMS koleksiyonu: UserPianoData (memberId, librariesJson)
 */
import wixData from "wix-data";
import { mediaManager } from "wix-media-backend";
import { auth } from "@wix/essentials";
import { Permissions, webMethod } from "wix-web-module";
import { elevate } from "wix-auth";

const COLLECTION = "UserPianoData";
const MEDIA_FOLDER = "/touch-piano-midi";

const elevatedUpload = elevate(mediaManager.upload);

async function requireMemberId() {
  const info = await auth.getTokenInfo();
  if (info.subjectType !== "MEMBER" || !info.subjectId) {
    throw new Error("Üye girişi gerekli. Lütfen Wix sitesinde oturum açın.");
  }
  return info.subjectId;
}

async function loadLibraries(memberId) {
  const result = await wixData.query(COLLECTION).eq("memberId", memberId).limit(1).find();
  if (!result.items.length) {
    return { libraries: [] };
  }
  const row = result.items[0];
  try {
    const raw =
      typeof row.librariesJson === "string"
        ? JSON.parse(row.librariesJson)
        : row.librariesJson;
    if (raw && Array.isArray(raw.libraries)) {
      return { libraries: raw.libraries };
    }
  } catch (e) {
    console.error("librariesJson parse", e);
  }
  return { libraries: [] };
}

async function saveLibraries(memberId, libraries) {
  if (!Array.isArray(libraries)) {
    throw new Error("libraries dizi olmalı");
  }
  const librariesJson = JSON.stringify({ libraries });
  const existing = await wixData.query(COLLECTION).eq("memberId", memberId).limit(1).find();
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

function decodeBase64(base64) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64");
  }
  throw new Error("Buffer desteklenmiyor — Velo ortamını kontrol edin.");
}

export const pianoGetLibraries = webMethod(Permissions.SiteMember, async () => {
  const memberId = await requireMemberId();
  return loadLibraries(memberId);
});

export const pianoSaveLibraries = webMethod(Permissions.SiteMember, async (libraries) => {
  const memberId = await requireMemberId();
  await saveLibraries(memberId, libraries);
  return { ok: true };
});

export const pianoUploadMidi = webMethod(
  Permissions.SiteMember,
  async ({ libraryId, fileName, base64, name }) => {
    const memberId = await requireMemberId();
    if (!libraryId || !fileName || !base64) {
      throw new Error("libraryId, fileName ve base64 gerekli");
    }

    const buf = decodeBase64(base64);
    const safeName = String(fileName).replace(/[<>:"/\\|?*]/g, "_");
    const uploaded = await elevatedUpload(MEDIA_FOLDER, buf, safeName, {
      mediaOptions: {
        mimeType: "audio/midi",
        mediaType: "document",
      },
      metadataOptions: {
        isPrivate: true,
        isVisitorUpload: false,
        context: { memberId, libraryId },
      },
    });

    const midiUrl = uploaded.fileUrl || uploaded.url;
    if (!midiUrl) {
      throw new Error("Yükleme tamamlandı ancak dosya URL’si alınamadı");
    }

    const data = await loadLibraries(memberId);
    const lib = data.libraries.find((l) => l.id === libraryId);
    if (!lib) {
      throw new Error("Kütüphane bulunamadı. Önce kütüphaneyi kaydedin.");
    }
    if (!Array.isArray(lib.songs)) {
      lib.songs = [];
    }

    const entry = {
      id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: (name || safeName).replace(/\.(mid|midi)$/i, ""),
      fileName: safeName,
      midiUrl,
    };
    lib.songs.push(entry);
    await saveLibraries(memberId, data.libraries);
    return entry;
  }
);

export const pianoDeleteSong = webMethod(
  Permissions.SiteMember,
  async ({ songId, libraryId, midiUrl }) => {
    const memberId = await requireMemberId();
    const data = await loadLibraries(memberId);
    let removed = false;

    for (const lib of data.libraries) {
      if (libraryId && lib.id !== libraryId) continue;
      const before = lib.songs?.length || 0;
      lib.songs = (lib.songs || []).filter((s) => {
        if (songId && s.id === songId) {
          removed = true;
          return false;
        }
        if (midiUrl && s.midiUrl === midiUrl) {
          removed = true;
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

    await saveLibraries(memberId, data.libraries);
    return { ok: true };
  }
);
