import { setClickVolume } from "../audio/click";
import { setMasterVolume, setReverbAmount } from "../audio/context";
import { setPianoSustain } from "../audio/sampler";
import { engine } from "../engine/engine";
import { accuracyOf, starsFor, type EngineConfig } from "../engine/types";
import { tNow } from "../i18n";
import { BUILTIN_SONGS, isBuiltin, loadBuiltin } from "../midi/builtin";
import { defaultPlayTracks, finalizeSong, parseMidi, type Song } from "../midi/song";
import { midiFileName } from "../studio/midiFile";
import { shareMidi } from "../studio/share";
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
import { DEFAULT_SESSION, setPanel, toast, useApp, type Session } from "./store";
import { canImport } from "../auth/account";
import { cloudAfterDelete, cloudAfterImport, cloudAfterRename } from "../auth/cloud";
import { initSettingsSync, pushSettings } from "../auth/settingsSync";
import { OVERLAY_EVENT } from "../ui/primitives";
import { initProgress, recordDaily, recordRun } from "../progress/tracker";
import { DAILY_STARS, dailySong } from "../progress/daily";
import { initReminders } from "../lib/reminders";
import { initSocial, reportRun, scoreable } from "../social/social";
import { duetAfterRun, initDuet } from "../social/live";
import { coachAfterRun } from "../coach/coach";
import { drillAfterPass } from "../coach/drill";
import { analyzeRun, type Hand } from "../coach/insights";
import { HAND_SPLIT, handTracks } from "../midi/song";

export { handTracks };

const LAST_SONG = "staveflow-last-song";

export function engineConfig(): Partial<EngineConfig> {
  const { settings, session, duet } = useApp.getState();
  // In a live duet both devices must run the very same timeline.
  const together = !!duet?.songId;
  return {
    instrument: settings.instrument,
    guitarTone: settings.guitarTone,
    metronome: settings.metronome,
    countIn: settings.countIn || together,
    timingWindowMs: settings.timingWindowMs,
    accompVolume: settings.accompVolume,
    pianoPedal: settings.pianoPedal,
    pianoSustain: settings.pianoSustain,
    playTracks: session.playTracks,
    mutedTracks: session.mutedTracks,
    // On guitar/violin the hands split the playing technique (strike vs. fret), not the notes.
    hand: settings.instrument === "piano" ? session.hand : "both",
    speed: together ? duet.speed : session.speed,
    waitMode: session.waitMode && !together,
    autoPlay: session.autoPlay && !together,
    loop: together ? NO_LOOP : session.loop,
    segmentEnd: together ? 0 : session.segmentEnd,
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
  setPianoSustain(s.pianoSustain);
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
  // Leaving the path mid-song: the song plays to its end again.
  useApp.subscribe((s, prev) => {
    if (!s.coach && prev.coach && s.session.segmentEnd) updateSession({ segmentEnd: 0 });
    // Turning the loop off or changing songs ends a drill.
    if (s.drill && (!s.session.loop.enabled || s.currentId !== prev.currentId || s.song !== prev.song)) useApp.setState({ drill: null });
    if (s.activeDuel && s.currentId !== s.activeDuel.song_id) useApp.setState({ activeDuel: null });
  });
  engine.onLoopPass = drillAfterPass;
  window.addEventListener(OVERLAY_EVENT, () => engine.pause());
  initSettingsSync(applyRemoteSettings);
  initProgress();
  initReminders();
  initSocial();

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
  initDuet();
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
  const prev = useApp.getState().settings;
  const settings = { ...prev, ...patch };
  // A path step belongs to one instrument and skill level.
  const leaveCoach = settings.instrument !== prev.instrument || settings.skill !== prev.skill;
  useApp.setState(leaveCoach ? { settings, coach: null } : { settings });
  saveSettings(settings);
  applyAudioSettings(settings);
  engine.configure(engineConfig());
  pushSettings(settings);
}

/** Replaces the settings wholesale with the copy saved on the account (no upload back). */
export function applyRemoteSettings(settings: Settings): void {
  useApp.setState({ settings });
  saveSettings(settings);
  applyAudioSettings(settings);
  engine.configure(engineConfig());
}

let prefsTimer = 0;

function persistSession(): void {
  const { currentId, session, coach, duet } = useApp.getState();
  // Path lessons and duets set their own hand and speed; the song keeps the player's own choices.
  if (!currentId || coach || duet) return;
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

/** Back to the player's own tracks, hand and speed for the open song (after a duet set its own). */
export function restoreSession(): void {
  const { song, currentId, prefs } = useApp.getState();
  if (song && currentId) updateSession(sessionFor(song, prefs[currentId]));
}

/** Which hand the player takes. Piano: picks the hand tracks (or splits at middle C). Guitar / violin: strike vs. fret. */
export function setHand(h: "both" | "right" | "left"): void {
  const { settings, song, session } = useApp.getState();
  if (!song) return;
  if (settings.instrument !== "piano") {
    updateSettings({ autoFret: h === "right", tapToPlay: h === "left" });
    return;
  }
  const ht = handTracks(song);
  if (!ht) {
    updateSession({ hand: h });
    return;
  }
  const others = session.playTracks.filter((x) => x !== ht.right && x !== ht.left);
  const next = h === "right" ? [ht.right] : h === "left" ? [ht.left] : [ht.right, ht.left];
  updateSession({
    hand: "both",
    playTracks: [...others, ...next].sort((a, b) => a - b),
    mutedTracks: session.mutedTracks.filter((x) => !next.includes(x)),
  });
}

export async function openSong(id: string, opts: { quiet?: boolean; coach?: boolean } = {}): Promise<boolean> {
  useApp.setState(opts.coach ? { songLoading: true } : { songLoading: true, coach: null });
  try {
    let song: Song;
    if (isBuiltin(id)) {
      song = await loadBuiltin(id);
      const trTitle = BUILTIN_SONGS.find((s) => s.id === id)?.titleTr;
      if (trTitle && useApp.getState().settings.language === "tr") song.title = trTitle;
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

/** Imports MIDI files into the local library; returns false when Pro is required first. */
export async function importFiles(files: File[]): Promise<boolean> {
  if (!canImport()) {
    setPanel("pro");
    return false;
  }
  const midiFiles = files.filter((f) => /\.(mid|midi|kar)$/i.test(f.name) || f.type.includes("midi"));
  let firstId: string | null = null;
  const added: string[] = [];
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
      added.push(id);
      count++;
    } catch {
      toast(tNow("importFailed", { name: file.name }), "error", 4500);
    }
  }
  if (count) {
    await refreshLibrary();
    toast(tNow("imported", { n: count }), "success");
    void cloudAfterImport(added);
    if (firstId) await openSong(firstId);
  }
  return true;
}

/** Stores a MIDI file made in the studio (recording, audio or notes) as a library song and opens it. */
export async function addUserMidi(title: string, data: ArrayBuffer): Promise<string> {
  const clean = title.trim().slice(0, 120) || "MIDI";
  const song = parseMidi(data.slice(0), clean);
  const id = newSongId();
  await putSong({
    id,
    title: clean,
    fileName: midiFileName(clean),
    data,
    addedAt: Date.now(),
    duration: song.duration,
    noteCount: song.notes.length,
  });
  await refreshLibrary();
  void cloudAfterImport([id]);
  await openSong(id);
  return id;
}

/** Shares / downloads a library song as a .mid file. */
export async function exportUserSong(id: string): Promise<void> {
  const stored = await getSong(id);
  if (!stored) return;
  try {
    const r = await shareMidi(stored.data, midiFileName(stored.title), stored.title);
    if (r === "saved") toast(tNow("exportSaved", { name: midiFileName(stored.title) }), "success");
  } catch (err) {
    console.warn("[export] failed", err);
    toast(tNow("exportFailed"), "error");
  }
}

/** An empty stage with no falling notes, for playing (and recording) freely. */
export function openFreePlay(): void {
  const song = finalizeSong(tNow("freePlay"), [], [], [], 120, 4);
  useApp.setState({ song, currentId: null, session: { ...DEFAULT_SESSION, loop: { ...NO_LOOP } }, results: null, coach: null });
  engine.load(song, engineConfig() as EngineConfig);
}

export async function removeSong(id: string): Promise<void> {
  await deleteSong(id);
  void cloudAfterDelete(id);
  await refreshLibrary();
  if (useApp.getState().currentId === id) await openSong(BUILTIN_SONGS[0].id, { quiet: true });
}

export async function renameUserSong(id: string, title: string): Promise<void> {
  const clean = title.trim().slice(0, 120);
  if (!clean) return;
  await renameSong(id, clean);
  void cloudAfterRename(id, clean);
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
  if (r.config.autoPlay || !useApp.getState().song?.notes.length) return;
  const { currentId, prefs } = useApp.getState();
  const accuracy = accuracyOf(r.stats);
  const stars = starsFor(accuracy);
  const practice = r.dirty || r.config.autoPlay || r.config.loop.enabled;
  const key = bestKey(r.config.instrument, r.config.waitMode);
  const prev = currentId ? prefs[currentId]?.best?.[key] : undefined;
  // A path segment is only part of the song: it neither sets a best score nor masters the song.
  const partial = r.config.segmentEnd > 0;
  const newBest = !practice && !partial && r.stats.score > 0 && (!prev || r.stats.score > prev.score);
  const achievements = recordRun({
    songId: currentId,
    instrument: r.config.instrument,
    stars,
    accuracy,
    maxCombo: r.stats.maxCombo,
    notesHit: r.stats.perfect + r.stats.great + r.stats.good,
    misses: r.stats.miss,
    waitMode: r.config.waitMode,
    speed: r.config.speed,
    practice: practice || partial,
  });
  const duet = duetAfterRun(r.stats, accuracy, stars);
  // Skipping around or looping doesn't say how the whole step went.
  const coach =
    duet || r.dirty || r.config.loop.enabled ? undefined : coachAfterRun({ accuracy, stars, speed: r.config.speed, wait: r.config.waitMode });
  const insights = runInsights(r.config);
  const daily =
    !practice && !partial && stars >= DAILY_STARS && currentId === dailySong(useApp.getState().settings.skill) && recordDaily(currentId);
  // Wait mode can't be missed, so it doesn't compete; a duet is half the song.
  const social = !duet && !practice && !partial && !r.config.waitMode && r.stats.score > 0 && scoreable(currentId);
  useApp.setState({
    results: {
      stats: r.stats,
      accuracy,
      stars,
      dirty: practice,
      newBest,
      bestScore: newBest ? r.stats.score : prev?.score ?? null,
      achievements,
      coach,
      insights,
      daily,
      social,
      duet,
    },
  });
  if (social) void reportRun({ songId: currentId, instrument: r.config.instrument, score: r.stats.score, accuracy, stars });
  if (newBest && currentId) {
    const best = {
      ...(prefs[currentId]?.best ?? {}),
      [key]: { score: r.stats.score, accuracy, stars, maxCombo: r.stats.maxCombo, at: Date.now() },
    };
    void patchPrefs(currentId, { best }).then((p) => useApp.setState((s) => ({ prefs: { ...s.prefs, [p.id]: p } })));
  }
}

/** Which hand a note belongs to: the hand tracks when the song has them, else either side of middle C. */
function handOf(cfg: EngineConfig, song: Song): (n: { track: number; midi: number }) => Hand | null {
  if (cfg.instrument !== "piano") return () => null;
  const ht = handTracks(song);
  if (ht) return (n) => (n.track === ht.right ? "right" : n.track === ht.left ? "left" : null);
  if (cfg.hand !== "both") return () => null;
  return (n) => (n.midi < HAND_SPLIT ? "left" : "right");
}

function runInsights(cfg: EngineConfig) {
  const song = engine.song;
  if (!song) return undefined;
  const hand = handOf(cfg, song);
  return analyzeRun(
    engine.notes.map((n) => ({ time: n.time, state: n.state, judgement: n.judgement, offsetMs: n.offsetMs, hand: hand(n) })),
    engine.wrongTimes,
    song.beats
  );
}

export function closeResults(): void {
  useApp.setState({ results: null });
}
