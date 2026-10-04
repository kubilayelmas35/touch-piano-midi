import { tNow } from "../i18n";
import { toast, useApp } from "../state/store";
import { getSong, listSongs, putSong, type StoredSong } from "../storage/db";
import { supabase } from "./account";

/** Cloud copies of library songs, only for members an admin has enabled cloud for. */

const BUCKET = "midis";

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
  return !!supabase && a.status === "signedIn" && a.cloud;
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
    await supabase!.from("cloud_midis").delete().eq("user_id", user).eq("song_id", song.id);
    return false;
  }
  return true;
}

/** Two-way sync: downloads cloud songs missing on this device and uploads local songs missing in the cloud. */
export async function syncCloud(opts: { quiet?: boolean } = {}): Promise<void> {
  if (!cloudOn() || useApp.getState().cloudBusy) return;
  useApp.setState({ cloudBusy: true });
  try {
    const user = await userId();
    if (!user) return;
    let rows = await remoteRows();
    const local = await listSongs();
    const localIds = new Set(local.map((s) => s.id));
    const remoteIds = new Set(rows.map((r) => r.song_id));
    let down = 0;
    let up = 0;
    let failed = 0;

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

    for (const meta of local) {
      if (remoteIds.has(meta.id)) continue;
      const song = await getSong(meta.id);
      if (song && (await upload(song, user))) up++;
      else failed++;
    }

    if (up) rows = await remoteRows();
    publish(rows);
    if (down) useApp.setState({ userSongs: await listSongs() });
    if (down || up || !opts.quiet) toast(tNow("cloudSynced", { down, up }), "success");
    if (failed) toast(tNow("cloudSomeFailed", { n: failed }), "error", 5000);
  } catch (err) {
    console.warn("[cloud] sync failed", err);
    toast(tNow("cloudSyncFailed"), "error");
  } finally {
    useApp.setState({ cloudBusy: false });
  }
}

export async function cloudAfterImport(ids: string[]): Promise<void> {
  if (!cloudOn() || !ids.length) return;
  const user = await userId();
  if (!user) return;
  let failed = 0;
  for (const id of ids) {
    const song = await getSong(id);
    if (!song || !(await upload(song, user))) failed++;
  }
  try {
    publish(await remoteRows());
  } catch {
    /* listing failed; badges refresh on next sync */
  }
  if (failed) toast(tNow("cloudSomeFailed", { n: failed }), "error", 5000);
}

export async function cloudAfterDelete(id: string): Promise<void> {
  if (!cloudOn() || !useApp.getState().cloudIds.includes(id)) return;
  const user = await userId();
  if (!user) return;
  await supabase!.storage.from(BUCKET).remove([`${user}/${id}.mid`]);
  await supabase!.from("cloud_midis").delete().eq("user_id", user).eq("song_id", id);
  try {
    publish(await remoteRows());
  } catch {
    /* */
  }
}

export async function cloudAfterRename(id: string, title: string): Promise<void> {
  if (!cloudOn() || !useApp.getState().cloudIds.includes(id)) return;
  await supabase!.from("cloud_midis").update({ title: title.slice(0, 200), updated_at: new Date().toISOString() }).eq("song_id", id);
}
