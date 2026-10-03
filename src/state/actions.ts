import { setClickVolume } from "../audio/click";
import { setMasterVolume, setReverbAmount } from "../audio/context";
import { engine } from "../engine/engine";
import { accuracyOf, starsFor, type EngineConfig } from "../engine/types";
import { tNow } from "../i18n";
import { BUILTIN_SONGS, isBuiltin, loadBuiltin } from "../midi/builtin";
import { defaultPlayTracks, parseMidi, type Song } from "../midi/song";
import {
  bestKey,
  deleteSong,
  getAllPrefs,
  getSong,
  listSongs,
  newSongId,
  patchPrefs,
  putSong,
  renameSong,
  type SongPrefs,
} from "../storage/db";
import { migrateLegacyLibrary } from "../storage/migrate";
import { saveSettings, type Settings } from "./settings";
import { DEFAULT_SESSION, toast, useApp, type Session } from "./store";

const LAST_SONG = "staveflow-last-song";

export function engineConfig(): Partial<EngineConfig> {
  const { settings, session } = useApp.getState();
  return {
    instrument: settings.instrument,
    guitarTone: settings.guitarTone,
    metronome: settings.metronome,
    countIn: settings.countIn,
    timingWindowMs: settings.timingWindowMs,
    accompVolume: settings.accompVolume,
    playTracks: session.playTracks,
    mutedTracks: session.mutedTracks,
    hand: session.hand,
    speed: session.speed,
    waitMode: session.waitMode,
    autoPlay: session.autoPlay,
    loop: session.loop,
  };
}

function syncFromEngine(): void {
  const s = useApp.getState();
  const patch: Partial<typeof s> = {};
  if (s.status !== engine.status) patch.status = engine.status;
  if (s.waiting !== engine.waiting) patch.waiting = engine.waiting;
  if (s.stats !== engine.stats) patch.stats = engine.stats;
  if (s.audioLoading !== engine.loading) patch.audioLoading = engine.loading;
  if (Math.abs(s.audioProgress - engine.loadProgress) > 0.01 || (engine.loadProgress === 1 && s.audioProgress !== 1))
    patch.audioProgress = engine.loadProgress;
  if (s.audioError !== engine.loadError) patch.audioError = engine.loadError;
  if (s.runDirty !== engine.runDirty) patch.runDirty = engine.runDirty;
  if (s.startTime !== engine.startTime) patch.startTime = engine.startTime;
  if (s.endTime !== engine.endTime) patch.endTime = engine.endTime;
  if (engine.status !== "playing") patch.time = engine.time;
  if (Object.keys(patch).length) useApp.setState(patch);
}

function applyAudioSettings(s: Settings): void {
  setMasterVolume(s.volume);
  setReverbAmount(s.reverb);
  setClickVolume(s.clickVolume);
}

let initialized = false;

export async function initApp(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const { settings } = useApp.getState();
  applyAudioSettings(settings);
  engine.configure(engineConfig());
  engine.subscribe(syncFromEngine);
  engine.onComplete = handleComplete;

  const migrated = await migrateLegacyLibrary();
  await refreshLibrary();
  if (migrated) toast(tNow("migrated", { n: migrated }), "success", 5000);

  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_SONG);
  } catch {
    /* */
  }
  const exists = last && (isBuiltin(last) || useApp.getState().userSongs.some((s) => s.id === last));
  await openSong(exists ? last! : "ode-to-joy", { quiet: true });
  void engine.ensureAudio();
}

export async function refreshLibrary(): Promise<void> {
  try {
    const [userSongs, prefsList] = await Promise.all([listSongs(), getAllPrefs()]);
    const prefs: Record<string, SongPrefs> = {};
    for (const p of prefsList) prefs[p.id] = p;
    useApp.setState({ userSongs, prefs });
  } catch (err) {
    console.warn("[library] IndexedDB unavailable", err);
  }
}

export function updateSettings(patch: Partial<Settings>): void {
  const settings = { ...useApp.getState().settings, ...patch };
  useApp.setState({ settings });
  saveSettings(settings);
  applyAudioSettings(settings);
  engine.configure(engineConfig());
}

let prefsTimer = 0;

function persistSession(): void {
  const { currentId, session } = useApp.getState();
  if (!currentId) return;
  window.clearTimeout(prefsTimer);
  prefsTimer = window.setTimeout(() => {
    void patchPrefs(currentId, {
      playTracks: session.playTracks,
      mutedTracks: session.mutedTracks,
      hand: session.hand,
      speed: session.speed,
      loop: session.loop,
    }).then((p) => useApp.setState((s) => ({ prefs: { ...s.prefs, [p.id]: p } })));
  }, 400);
}

export function updateSession(patch: Partial<Session>): void {
  const session = { ...useApp.getState().session, ...patch };
  useApp.setState({ session });
  engine.configure(engineConfig());
  persistSession();
}

function sessionFor(song: Song, prefs: SongPrefs | undefined): Session {
  const prev = useApp.getState().session;
  const valid = (list: number[] | undefined) =>
    (list ?? []).filter((i) => song.tracks.some((t) => t.index === i && !t.isDrum));
  let playTracks = valid(prefs?.playTracks);
  if (!playTracks.length) playTracks = defaultPlayTracks(song);
  return {
    ...DEFAULT_SESSION,
    playTracks,
    mutedTracks: valid(prefs?.mutedTracks),
    hand: prefs?.hand ?? "both",
    speed: prefs?.speed ?? 1,
    waitMode: prev.waitMode,
    autoPlay: false,
    loop: prefs?.loop ? { ...prefs.loop } : { ...NO_LOOP },
  };
}

export async function openSong(id: string, opts: { quiet?: boolean } = {}): Promise<boolean> {
  useApp.setState({ songLoading: true });
  try {
    let song: Song;
    if (isBuiltin(id)) {
      song = await loadBuiltin(id);
    } else {
      const stored = await getSong(id);
      if (!stored) throw new Error("missing");
      song = parseMidi(stored.data, stored.title);
      song.title = stored.title;
    }
    const prefs = useApp.getState().prefs[id];
    const session = sessionFor(song, prefs);
    useApp.setState({ song, currentId: id, session, results: null });
    engine.load(song, engineConfig() as EngineConfig);
    try {
      localStorage.setItem(LAST_SONG, id);
    } catch {
      /* */
    }
    void patchPrefs(id, { lastPlayed: Date.now() }).then((p) =>
      useApp.setState((s) => ({ prefs: { ...s.prefs, [p.id]: p } }))
    );
    return true;
  } catch (err) {
    console.warn("[song] open failed", err);
    if (!opts.quiet) toast(tNow("songLoadFailed"), "error");
    return false;
  } finally {
    useApp.setState({ songLoading: false });
  }
}

export async function importFiles(files: File[]): Promise<void> {
  const midiFiles = files.filter((f) => /\.(mid|midi|kar)$/i.test(f.name) || f.type.includes("midi"));
  let firstId: string | null = null;
  let count = 0;
  let t = Date.now();
  for (const file of midiFiles) {
    try {
      const data = await file.arrayBuffer();
      const title = file.name.replace(/\.(mid|midi|kar)$/i, "").replace(/[_]+/g, " ").trim() || "MIDI";
      const song = parseMidi(data.slice(0), title);
      if (!song.notes.length) throw new Error("empty");
      const id = newSongId();
      await putSong({
        id,
        title,
        fileName: file.name,
        data,
        addedAt: t++,
        duration: song.duration,
        noteCount: song.notes.length,
      });
      firstId ??= id;
      count++;
    } catch {
      toast(tNow("importFailed", { name: file.name }), "error", 4500);
    }
  }
  if (count) {
    await refreshLibrary();
    toast(tNow("imported", { n: count }), "success");
    if (firstId) await openSong(firstId);
  }
}

export async function removeSong(id: string): Promise<void> {
  await deleteSong(id);
  await refreshLibrary();
  if (useApp.getState().currentId === id) await openSong(BUILTIN_SONGS[0].id, { quiet: true });
}

export async function renameUserSong(id: string, title: string): Promise<void> {
  const clean = title.trim().slice(0, 120);
  if (!clean) return;
  await renameSong(id, clean);
  await refreshLibrary();
  const st = useApp.getState();
  if (st.currentId === id && st.song) useApp.setState({ song: { ...st.song, title: clean } });
}

/** L key / loop button cycle: set A → set B → clear. */
export function cycleLoop(): void {
  const loop = useApp.getState().session.loop;
  const t = Math.max(0, engine.time);
  if (loop.enabled) updateSession({ loop: { ...NO_LOOP } });
  else if (loop.a < 0 || t <= loop.a + 0.5) updateSession({ loop: { a: t, b: -1, enabled: false } });
  else updateSession({ loop: { a: loop.a, b: t, enabled: true } });
}

export const NO_LOOP = { a: -1, b: -1, enabled: false };

function handleComplete(r: { stats: import("../engine/types").Stats; dirty: boolean; config: EngineConfig }): void {
  if (r.config.autoPlay) return;
  const { currentId, prefs } = useApp.getState();
  const accuracy = accuracyOf(r.stats);
  const stars = starsFor(accuracy);
  const practice = r.dirty || r.config.autoPlay || r.config.loop.enabled;
  const key = bestKey(r.config.instrument, r.config.waitMode);
  const prev = currentId ? prefs[currentId]?.best?.[key] : undefined;
  const newBest = !practice && r.stats.score > 0 && (!prev || r.stats.score > prev.score);
  useApp.setState({
    results: {
      stats: r.stats,
      accuracy,
      stars,
      dirty: practice,
      newBest,
      bestScore: newBest ? r.stats.score : prev?.score ?? null,
    },
  });
  if (newBest && currentId) {
    const best = {
      ...(prefs[currentId]?.best ?? {}),
      [key]: { score: r.stats.score, accuracy, stars, maxCombo: r.stats.maxCombo, at: Date.now() },
    };
    void patchPrefs(currentId, { best }).then((p) => useApp.setState((s) => ({ prefs: { ...s.prefs, [p.id]: p } })));
  }
}

export function closeResults(): void {
  useApp.setState({ results: null });
}
