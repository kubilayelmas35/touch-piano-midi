import { tNow } from "../i18n";
import { toast, useApp } from "../state/store";
import { getSong, listSongs, putSong, type StoredSong } from "../storage/db";
import { proOrTrial, supabase } from "./account";

/**
 * Cloud copies of library songs. Pro members keep up to PRO_CLOUD_SONGS songs they pick; members an admin
 * enabled cloud for get their whole library synced within an MB quota. Same limits are enforced by RLS.
 */

const BUCKET = "midis";
export const CLOUD_MAX_BYTES = 1048576;
export const PRO_CLOUD_SONGS = 10;

interface CloudRow {
  id: string;
  song_id: string;
  title: string;
  file_name: string | null;
  size_bytes: number;
  duration: number | null;
  note_count: number | null;
  path: string;
  created_at: string;
}

export function cloudOn(): boolean {
  const a = useApp.getState().account;
  return !!supabase && a.status === "signedIn" && (a.cloud || proOrTrial(a));
}

/** Pro without an admin quota: a fixed number of songs, chosen per song instead of syncing everything. */
export function cloudLimited(): boolean {
  const a = useApp.getState().account;
  return cloudOn() && !a.cloud;
}

type Room = "ok" | "big" | "full";

function roomFor(song: StoredSong): Room {
  const size = song.data.byteLength;
  if (size > CLOUD_MAX_BYTES) return "big";
  const s = useApp.getState();
  if (s.cloudIds.includes(song.id)) return "ok";
  if (cloudLimited()) return s.cloudIds.length < PRO_CLOUD_SONGS ? "ok" : "full";
  return s.cloudBytes + size <= s.account.cloudQuotaMb * 1048576 ? "ok" : "full";
}

async function userId(): Promise<string | null> {
  const { data } = await supabase!.auth.getSession();
  return data.session?.user.id ?? null;
}

async function remoteRows(): Promise<CloudRow[]> {
  const { data, error } = await supabase!.from("cloud_midis").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as CloudRow[];
}

function publish(rows: { song_id: string; size_bytes: number }[]): void {
  useApp.setState({
    cloudIds: rows.map((r) => r.song_id),
    cloudBytes: rows.reduce((sum, r) => sum + r.size_bytes, 0),
  });
}

async function refreshRows(): Promise<void> {
  try {
    publish(await remoteRows());
  } catch {
    /* listing failed; badges refresh on next sync */
  }
}

async function upload(song: StoredSong, user: string): Promise<boolean> {
  const path = `${user}/${song.id}.mid`;
  const { error } = await supabase!.from("cloud_midis").upsert(
    {
      user_id: user,
      song_id: song.id,
      title: song.title.slice(0, 200) || "MIDI",
      file_name: song.fileName,
      size_bytes: song.data.byteLength,
      duration: song.duration ?? null,
      note_count: song.noteCount ?? null,
      path,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,song_id" }
  );
  if (error) return false;
  const res = await supabase!.storage
    .from(BUCKET)
    .upload(path, new Blob([song.data], { type: "audio/midi" }), { upsert: true, contentType: "audio/midi" });
  if (res.error) {
    if (!useApp.getState().cloudIds.includes(song.id)) {
      await supabase!.from("cloud_midis").delete().eq("user_id", user).eq("song_id", song.id);
    }
    return false;
  }
  useApp.setState((s) =>
    s.cloudIds.includes(song.id) ? {} : { cloudIds: [...s.cloudIds, song.id], cloudBytes: s.cloudBytes + song.data.byteLength }
  );
  return true;
}

/** Uploads one song after checking size and room; tells the player why when it can't. */
async function tryUpload(song: StoredSong, user: string, quiet = false): Promise<Room | "failed"> {
  const room = roomFor(song);
  if (room === "big" && !quiet) toast(tNow("cloudTooBig", { title: song.title }), "error", 5000);
  if (room === "full" && !quiet) {
    toast(cloudLimited() ? tNow("cloudFullSongs", { n: PRO_CLOUD_SONGS }) : tNow("cloudFullQuota"), "error", 6000);
  }
  if (room !== "ok") return room;
  return (await upload(song, user)) ? "ok" : "failed";
}

/**
 * Downloads cloud songs missing on this device. With a quota, also uploads local songs missing in the cloud;
 * Pro members choose which songs go up.
 */
export async function syncCloud(opts: { quiet?: boolean } = {}): Promise<void> {
  if (!cloudOn() || useApp.getState().cloudBusy) return;
  useApp.setState({ cloudBusy: true });
  try {
    const user = await userId();
    if (!user) return;
    let rows = await remoteRows();
    publish(rows);
    const local = await listSongs();
    const localIds = new Set(local.map((s) => s.id));
    const remoteIds = new Set(rows.map((r) => r.song_id));
    let down = 0;
    let up = 0;
    let failed = 0;
    let skipped = 0;

    for (const r of rows) {
      if (localIds.has(r.song_id)) continue;
      const { data, error } = await supabase!.storage.from(BUCKET).download(r.path);
      if (error || !data) {
        failed++;
        continue;
      }
      await putSong({
        id: r.song_id,
        title: r.title,
        fileName: r.file_name ?? `${r.title}.mid`,
        data: await data.arrayBuffer(),
        addedAt: Date.parse(r.created_at) || Date.now(),
        duration: r.duration ?? undefined,
        noteCount: r.note_count ?? undefined,
      });
      down++;
    }

    if (!cloudLimited()) {
      for (const meta of local) {
        if (remoteIds.has(meta.id)) continue;
        const song = await getSong(meta.id);
        if (!song) continue;
        const res = await tryUpload(song, user, true);
        if (res === "ok") up++;
        else if (res === "failed") failed++;
        else skipped++;
      }
    }

    if (up) rows = await remoteRows();
    publish(rows);
    if (down) useApp.setState({ userSongs: await listSongs() });
    if (down || up || !opts.quiet) toast(tNow("cloudSynced", { down, up }), "success");
    if (failed) toast(tNow("cloudSomeFailed", { n: failed }), "error", 5000);
    if (skipped && !opts.quiet) toast(tNow("cloudSkipped", { n: skipped }), "info", 5000);
  } catch (err) {
    console.warn("[cloud] sync failed", err);
    toast(tNow("cloudSyncFailed"), "error");
  } finally {
    useApp.setState({ cloudBusy: false });
  }
}

/** New imports go up while there is room. */
export async function cloudAfterImport(ids: string[]): Promise<void> {
  if (!cloudOn() || !ids.length) return;
  const user = await userId();
  if (!user) return;
  let failed = 0;
  for (const id of ids) {
    const song = await getSong(id);
    if (!song) continue;
    const res = await tryUpload(song, user);
    if (res === "failed") failed++;
    if (res === "full") break;
  }
  await refreshRows();
  if (failed) toast(tNow("cloudSomeFailed", { n: failed }), "error", 5000);
}

/** Replaces the cloud copy after the song was edited on this device. */
export async function cloudAfterEdit(id: string): Promise<void> {
  if (!cloudOn() || !useApp.getState().cloudIds.includes(id)) return;
  const user = await userId();
  const song = await getSong(id);
  if (!user || !song) return;
  const res = await tryUpload(song, user);
  if (res === "failed") toast(tNow("cloudSomeFailed", { n: 1 }), "error", 5000);
  await refreshRows();
}

async function removeRemote(id: string, user: string): Promise<void> {
  await supabase!.storage.from(BUCKET).remove([`${user}/${id}.mid`]);
  await supabase!.from("cloud_midis").delete().eq("user_id", user).eq("song_id", id);
  await refreshRows();
}

export async function cloudAfterDelete(id: string): Promise<void> {
  if (!cloudOn() || !useApp.getState().cloudIds.includes(id)) return;
  const user = await userId();
  if (user) await removeRemote(id, user);
}

/** Pro: puts a song in the cloud or takes it out (the copy on this device stays). */
export async function toggleCloud(id: string): Promise<void> {
  if (!cloudOn() || useApp.getState().cloudBusy) return;
  const user = await userId();
  if (!user) return;
  useApp.setState({ cloudBusy: true });
  try {
    if (useApp.getState().cloudIds.includes(id)) {
      await removeRemote(id, user);
      toast(tNow("cloudRemoved"), "info");
      return;
    }
    const song = await getSong(id);
    if (!song) return;
    const res = await tryUpload(song, user);
    if (res === "ok") toast(tNow("cloudAdded"), "success");
    if (res === "failed") toast(tNow("cloudSomeFailed", { n: 1 }), "error", 5000);
    await refreshRows();
  } finally {
    useApp.setState({ cloudBusy: false });
  }
}

export async function cloudAfterRename(id: string, title: string): Promise<void> {
  if (!cloudOn() || !useApp.getState().cloudIds.includes(id)) return;
  await supabase!.from("cloud_midis").update({ title: title.slice(0, 200), updated_at: new Date().toISOString() }).eq("song_id", id);
}
