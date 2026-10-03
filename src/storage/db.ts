import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface StoredSong {
  id: string;
  title: string;
  fileName: string;
  data: ArrayBuffer;
  addedAt: number;
  folder?: string;
  duration?: number;
  noteCount?: number;
}

export type SongMeta = Omit<StoredSong, "data">;

export interface BestScore {
  score: number;
  accuracy: number;
  stars: number;
  maxCombo: number;
  at: number;
}

export interface SongPrefs {
  id: string;
  playTracks?: number[];
  mutedTracks?: number[];
  hand?: "both" | "right" | "left";
  speed?: number;
  loop?: { a: number; b: number; enabled: boolean };
  best?: Record<string, BestScore>;
  lastPlayed?: number;
}

interface StaveFlowDB extends DBSchema {
  songs: { key: string; value: StoredSong; indexes: { addedAt: number } };
  prefs: { key: string; value: SongPrefs };
}

let dbPromise: Promise<IDBPDatabase<StaveFlowDB>> | null = null;

function db(): Promise<IDBPDatabase<StaveFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StaveFlowDB>("staveflow", 1, {
      upgrade(d) {
        const songs = d.createObjectStore("songs", { keyPath: "id" });
        songs.createIndex("addedAt", "addedAt");
        d.createObjectStore("prefs", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function listSongs(): Promise<SongMeta[]> {
  const all = await (await db()).getAllFromIndex("songs", "addedAt");
  return all.reverse().map(({ data: _data, ...meta }) => meta);
}

export async function getSong(id: string): Promise<StoredSong | undefined> {
  return (await db()).get("songs", id);
}

export async function putSong(song: StoredSong): Promise<void> {
  await (await db()).put("songs", song);
}

export async function renameSong(id: string, title: string): Promise<void> {
  const d = await db();
  const s = await d.get("songs", id);
  if (s) await d.put("songs", { ...s, title });
}

export async function deleteSong(id: string): Promise<void> {
  const d = await db();
  await d.delete("songs", id);
  await d.delete("prefs", id);
}

export async function getPrefs(id: string): Promise<SongPrefs> {
  return (await (await db()).get("prefs", id)) ?? { id };
}

export async function getAllPrefs(): Promise<SongPrefs[]> {
  return (await db()).getAll("prefs");
}

export async function patchPrefs(id: string, patch: Partial<SongPrefs>): Promise<SongPrefs> {
  const d = await db();
  const next = { ...((await d.get("prefs", id)) ?? { id }), ...patch, id };
  await d.put("prefs", next);
  return next;
}

export function newSongId(): string {
  return `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function bestKey(instrument: string, waitMode: boolean): string {
  return `${instrument}${waitMode ? ":wait" : ""}`;
}
