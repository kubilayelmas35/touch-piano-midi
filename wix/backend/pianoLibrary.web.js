/**
 * HTTP / harici çağrılar için webMethod sarmalayıcıları.
 * iframe köprüsü: public/player-page.js (wix-data, webMethod değil).
 */
import { Permissions, webMethod } from "wix-web-module";
import {
  requireMemberId,
  loadLibraries,
  saveLibraries,
  formatError,
  COLLECTION,
} from "backend/pianoLibraryCore";

export const pianoPing = webMethod(Permissions.SiteMember, async () => {
  try {
    const memberId = await requireMemberId();
    return { ok: true, memberId, collection: COLLECTION };
  } catch (err) {
    throw new Error(formatError("pianoPing", err));
  }
});

export const pianoGetLibraries = webMethod(Permissions.SiteMember, async () => {
  try {
    const memberId = await requireMemberId();
    return loadLibraries(memberId);
  } catch (err) {
    throw new Error(formatError("pianoGetLibraries", err));
  }
});

export const pianoSaveLibraries = webMethod(Permissions.SiteMember, async (libraries) => {
  try {
    const memberId = await requireMemberId();
    await saveLibraries(memberId, libraries);
    return { ok: true };
  } catch (err) {
    throw new Error(formatError("pianoSaveLibraries", err));
  }
});

export const pianoDeleteSong = webMethod(
  Permissions.SiteMember,
  async ({ songId, libraryId, midiUrl }) => {
    try {
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
    } catch (err) {
      throw new Error(formatError("pianoDeleteSong", err));
    }
  }
);
