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
import {
  uploadMidiToCms,
  getMidiFromCms,
  deleteSongFromCms,
  loadLibrariesForClient,
} from "backend/pianoMidiCmsCore";

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
    const data = await loadLibrariesForClient();
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
    const entry = await uploadMidiToCms(body);
    return jsonOk(entry);
  } catch (e) {
    return jsonErr(formatError("post_pianoUploadMidi", e));
  }
}

export async function post_pianoGetMidi(request) {
  try {
    const body = await readJson(request);
    const data = await getMidiFromCms(body);
    return jsonOk(data);
  } catch (e) {
    return jsonErr(formatError("post_pianoGetMidi", e));
  }
}

export async function post_pianoDeleteSong(request) {
  try {
    const body = await readJson(request);
    const result = await deleteSongFromCms(body);
    return jsonOk(result);
  } catch (e) {
    return jsonErr(formatError("post_pianoDeleteSong", e));
  }
}
