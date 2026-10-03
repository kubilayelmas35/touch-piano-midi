/**
 * CMS MIDI — iframe köprüsü ve HTTP için webMethod uçları.
 */
import { Permissions, webMethod } from "wix-web-module";
import {
  loadLibrariesForClient,
  saveLibrariesForClient,
  uploadMidiToCms,
  getMidiFromCms,
  deleteSongFromCms,
  formatError,
} from "backend/pianoMidiCmsCore";

export const pianoCmsGetLibraries = webMethod(Permissions.SiteMember, async () => {
  try {
    return loadLibrariesForClient();
  } catch (err) {
    throw new Error(formatError("pianoCmsGetLibraries", err));
  }
});

export const pianoCmsSaveLibraries = webMethod(Permissions.SiteMember, async (libraries) => {
  try {
    await saveLibrariesForClient(libraries);
    return { ok: true };
  } catch (err) {
    throw new Error(formatError("pianoCmsSaveLibraries", err));
  }
});

export const pianoCmsUploadMidi = webMethod(Permissions.SiteMember, async (payload) => {
  try {
    return uploadMidiToCms(payload || {});
  } catch (err) {
    throw new Error(formatError("pianoCmsUploadMidi", err));
  }
});

export const pianoCmsGetMidi = webMethod(Permissions.SiteMember, async (payload) => {
  try {
    return getMidiFromCms(payload || {});
  } catch (err) {
    throw new Error(formatError("pianoCmsGetMidi", err));
  }
});

export const pianoCmsDeleteSong = webMethod(Permissions.SiteMember, async (payload) => {
  try {
    return deleteSongFromCms(payload || {});
  } catch (err) {
    throw new Error(formatError("pianoCmsDeleteSong", err));
  }
});
