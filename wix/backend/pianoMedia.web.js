/**
 * MIDI yükleme — yalnızca Media Manager (ayrı modül, CMS modülünü kırmaz).
 */
import { mediaManager } from "wix-media-backend";
import { Permissions, webMethod } from "wix-web-module";
import { elevate } from "wix-auth";
import {
  requireMemberId,
  loadLibraries,
  saveLibraries,
  formatError,
} from "backend/pianoLibraryCore";

const MEDIA_FOLDER = "/touch-piano-midi";

function decodeBase64(base64) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64");
  }
  throw new Error("Buffer desteklenmiyor.");
}

export const pianoUploadMidi = webMethod(
  Permissions.SiteMember,
  async ({ libraryId, fileName, base64, name }) => {
    try {
      const memberId = await requireMemberId();
      if (!libraryId || !fileName || !base64) {
        throw new Error("libraryId, fileName ve base64 gerekli");
      }

      const buf = decodeBase64(base64);
      const safeName = String(fileName).replace(/[<>:"/\\|?*]/g, "_");
      const uploadFn = elevate(mediaManager.upload);
      const uploaded = await uploadFn(MEDIA_FOLDER, buf, safeName, {
        mediaOptions: {
          mimeType: "audio/midi",
          mediaType: "document",
        },
        metadataOptions: {
          isPrivate: true,
          isVisitorUpload: false,
        },
      });

      const midiUrl = uploaded?.fileUrl || uploaded?.url;
      if (!midiUrl) {
        throw new Error("MIDI yüklendi ama dosya URL alınamadı");
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
    } catch (err) {
      throw new Error(formatError("pianoUploadMidi", err));
    }
  }
);
