import { newSongId, putSong } from "./db";

const FLAG = "staveflow-migrated-v2";
const LEGACY_LIBRARIES = "touch-piano-guest-libraries";

interface LegacySong {
  name?: string;
  fileName?: string;
  midiBase64?: string;
}

function collectSongs(node: unknown, folder: string | undefined, out: { song: LegacySong; folder?: string }[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectSongs(item, folder, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.midiBase64 === "string") {
    out.push({ song: obj as LegacySong, folder });
    return;
  }
  const name = typeof obj.name === "string" ? obj.name : folder;
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") collectSongs(value, name, out);
  }
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** One-time import of songs saved by the old app in localStorage. Returns how many were imported. */
export async function migrateLegacyLibrary(): Promise<number> {
  try {
    if (localStorage.getItem(FLAG)) return 0;
    const raw = localStorage.getItem(LEGACY_LIBRARIES);
    let imported = 0;
    if (raw) {
      const found: { song: LegacySong; folder?: string }[] = [];
      collectSongs(JSON.parse(raw), undefined, found);
      let t = Date.now() - found.length;
      for (const { song, folder } of found) {
        try {
          const data = base64ToBuffer(song.midiBase64!);
          await putSong({
            id: newSongId(),
            title: song.name || song.fileName?.replace(/\.(mid|midi)$/i, "") || "MIDI",
            fileName: song.fileName || "song.mid",
            data,
            addedAt: t++,
            folder,
          });
          imported++;
        } catch {
          /* skip corrupt entry */
        }
      }
    }
    localStorage.setItem(FLAG, "1");
    return imported;
  } catch {
    return 0;
  }
}

export interface LegacySettings {
  locale?: string;
  instrumentId?: string;
  playMode?: string;
  timingWindow?: number;
  labelMode?: string;
}

export function readLegacySettings(): LegacySettings | null {
  try {
    const raw = localStorage.getItem("touch-piano-settings");
    return raw ? (JSON.parse(raw) as LegacySettings) : null;
  } catch {
    return null;
  }
}
