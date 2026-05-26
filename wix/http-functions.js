/**
 * İsteğe bağlı HTTP uçları (köprü birincil yol: player-page.js).
 */
import { ok, badRequest } from "wix-http-functions";
import {
  requireMemberId,
  loadLibraries,
  saveLibraries,
  formatError,
} from "backend/pianoLibraryCore";
import { pianoUploadMidi } from "backend/pianoMedia.web";

async function readJson(request) {
  try {
    return await request.body.json();
  } catch {
    return {};
  }
}

function jsonOk(body) {
  return ok({
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function jsonErr(message) {
  return badRequest({
    headers: { "Content-Type": "application/json" },
    body: { error: message },
  });
}

export async function post_pianoGetLibraries(request) {
  try {
    const memberId = await requireMemberId();
    const data = await loadLibraries(memberId);
    return jsonOk(data);
  } catch (e) {
    return jsonErr(formatError("post_pianoGetLibraries", e));
  }
}

export async function post_pianoSaveLibraries(request) {
  try {
    const body = await readJson(request);
    const memberId = await requireMemberId();
    await saveLibraries(memberId, body.libraries);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonErr(formatError("post_pianoSaveLibraries", e));
  }
}

export async function post_pianoUploadMidi(request) {
  try {
    const body = await readJson(request);
    const entry = await pianoUploadMidi(body);
    return jsonOk(entry);
  } catch (e) {
    return jsonErr(formatError("post_pianoUploadMidi", e));
  }
}

export async function post_pianoDeleteSong(request) {
  try {
    const body = await readJson(request);
    const memberId = await requireMemberId();
    const data = await loadLibraries(memberId);
    let removed = false;

    for (const lib of data.libraries) {
      if (body.libraryId && lib.id !== body.libraryId) continue;
      const before = lib.songs?.length || 0;
      lib.songs = (lib.songs || []).filter((s) => {
        if (body.songId && s.id === body.songId) {
          removed = true;
          return false;
        }
        if (body.midiUrl && s.midiUrl === body.midiUrl) {
          removed = true;
          return false;
        }
        return true;
      });
      if (lib.songs.length !== before) removed = true;
    }

    if (!removed) {
      return jsonErr("Şarkı bulunamadı");
    }

    await saveLibraries(memberId, data.libraries);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonErr(formatError("post_pianoDeleteSong", e));
  }
}
