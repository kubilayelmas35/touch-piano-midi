/**
 * İsteğe bağlı: GitHub Pages’in doğrudan çağırması için HTTP uçları.
 * Birincil yol: Wix sayfa kodu postMessage köprüsü (public/player-page.js).
 */
import { ok, badRequest } from "wix-http-functions";
import {
  pianoGetLibraries,
  pianoSaveLibraries,
  pianoUploadMidi,
  pianoDeleteSong,
} from "backend/pianoLibrary.web";

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
    const data = await pianoGetLibraries();
    return jsonOk(data);
  } catch (e) {
    return jsonErr(e.message || String(e));
  }
}

export async function post_pianoSaveLibraries(request) {
  try {
    const body = await readJson(request);
    await pianoSaveLibraries(body.libraries);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonErr(e.message || String(e));
  }
}

export async function post_pianoUploadMidi(request) {
  try {
    const body = await readJson(request);
    const entry = await pianoUploadMidi(body);
    return jsonOk(entry);
  } catch (e) {
    return jsonErr(e.message || String(e));
  }
}

export async function post_pianoDeleteSong(request) {
  try {
    const body = await readJson(request);
    const result = await pianoDeleteSong(body);
    return jsonOk(result);
  } catch (e) {
    return jsonErr(e.message || String(e));
  }
}
