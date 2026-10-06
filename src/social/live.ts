import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../auth/account";
import { engine, type PlayerInput } from "../engine/engine";
import { accuracyOf, type Stats } from "../engine/types";
import { tNow } from "../i18n";
import { SITE_URL } from "../lib/platform";
import { isBuiltin } from "../midi/builtin";
import { defaultPlayTracks, handTracks } from "../midi/song";
import { engineConfig, NO_LOOP, openSong, restoreSession, updateSession, updateSettings } from "../state/actions";
import { DEFAULT_SESSION, toast, useApp } from "../state/store";
import { newRoomCode, normalizeCode, sideFrom, type DuetHand, type DuetResult, type DuetSide } from "./duetScore";
import { loadSocial, scoreable, sendDuetInvite, toastSocialError } from "./social";

export type { DuetHand, DuetResult, DuetSide };

/**
 * Live duet: two devices in a room, each playing one hand of the same song. The room is a Supabase Realtime
 * broadcast channel; the host picks song, speed and hands. By default each device plays the partner's hand
 * itself as accompaniment, so only the start moment, pauses, running scores and the final results travel.
 * A player can instead hear the partner's real playing (their notes are then sent over) or nothing of it.
 */
export interface DuetRoom {
  code: string;
  role: "host" | "guest";
  phase: "connecting" | "lobby" | "live";
  songId: string | null;
  speed: number;
  myHand: DuetHand;
  partner: { name: string | null; ready: boolean } | null;
  /** The partner's running score while playing. */
  live: { score: number; accuracy: number; combo: number } | null;
  /** performance.now() moment the shared start is set for (countdown). */
  startAt: number | null;
  /** Guest: loading the song and syncing clocks. */
  preparing: boolean;
  /** Measured one-way delay (s) between the two devices while playing together. */
  lag: number | null;
}

export const DUET_SPEEDS = [0.5, 0.75, 1];
const COUNTDOWN_MS = 3500;
const NO_HOST_MS = 7000;
const LIVE_EVERY_MS = 500;
/** Partner notes are batched this long, which keeps the message rate low. */
const NOTES_EVERY_MS = 25;
/** Partner notes sound this long after their song time, so network jitter doesn't shake their rhythm. */
const NOTES_BUFFER_SEC = 0.12;
/** Clock messages kept for the lateness estimate; the quickest of them is the least delayed by the network. */
const CLOCK_SAMPLES = 6;
/** The guest moves its song clock once the two song clocks differ by more than this (s). */
const CLOCK_TOLERANCE = 0.03;

const clientId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
let channel: RealtimeChannel | null = null;
let joinedAt = 0;
/** Host's performance.now() minus ours, in ms (0 on the host). */
let clockOffset = 0;
const pongs = new Map<number, (hostNow: number) => void>();
let prepToken = 0;
/** The run under way was started together; its end is a duet result. */
let together = false;
let partnerFinal: DuetSide | null = null;
let liveTimer = 0;
let lastLive = "";
let noHostTimer = 0;
let inbox: RealtimeChannel | null = null;
/** The partner wants to hear my real playing. */
let partnerListens = false;
/** Notes waiting to go out: [key id, midi (0 = let go), velocity, song time]. */
let outbox: number[][] = [];
let flushTimer = 0;
const keyIds = new Map<string, number>();
/** How late (s) the partner's recent clock messages arrived on my song clock: network delay plus clock mismatch. */
let lateness: number[] = [];
/** The partner's lateness figure for my clock messages, for the current alignment round. */
let partnerLate: number | null = null;
/** Alignment round, bumped by the guest each time it moves its clock; figures from older rounds no longer apply. */
let epoch = 0;
/** One-way network delay (s) between the two devices, once measured. */
let netLag: number | null = null;

const room = () => useApp.getState().duet;
const myName = () => useApp.getState().account.username;
const who = (name: string | null | undefined) => (name ? `@${name}` : tNow("duetGuest"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function patch(p: Partial<DuetRoom>): void {
  const r = room();
  if (r) useApp.setState({ duet: { ...r, ...p } });
}

function send(event: string, payload: Record<string, unknown> = {}): void {
  void channel?.send({ type: "broadcast", event, payload });
}

/** Tells the partner whether to send me their notes. */
function sendSound(): void {
  send("sound", { live: useApp.getState().settings.duetSound === "live" });
}

function queueNote(e: PlayerInput): void {
  if (!together || !partnerListens || engine.status !== "playing") return;
  if (e.type !== "on" && e.type !== "off" && e.type !== "mute") return;
  let id = keyIds.get(e.key);
  if (id === undefined) {
    id = keyIds.size;
    keyIds.set(e.key, id);
  }
  const t = Math.round(engine.time * 1000) / 1000;
  outbox.push(e.type === "on" ? [id, e.midi, Math.round(e.velocity * 100) / 100, t] : [id, 0, 0, t]);
  if (!flushTimer) flushTimer = window.setTimeout(flushNotes, NOTES_EVERY_MS);
}

function flushNotes(): void {
  flushTimer = 0;
  if (!outbox.length) return;
  send("notes", { n: outbox });
  outbox = [];
}

function receiveNotes(p: Record<string, unknown>): void {
  if (!together || useApp.getState().settings.duetSound !== "live" || !Array.isArray(p.n)) return;
  for (const e of p.n.slice(0, 64)) {
    if (!Array.isArray(e) || e.length !== 4 || !e.every((v) => typeof v === "number" && Number.isFinite(v))) continue;
    const [id, midi, velocity, t] = e as number[];
    const on = midi >= 21 && midi <= 108;
    engine.remoteNote(`duet:${id}`, on ? Math.round(midi) : null, Math.min(1, Math.max(0.05, velocity)), t, noteBuffer());
  }
}

/** Just enough delay for the partner's notes to arrive in time, so they keep their rhythm without lagging more. */
function noteBuffer(): number {
  return netLag === null ? NOTES_BUFFER_SEC : Math.min(0.4, Math.max(0.06, netLag + 0.04));
}

function myLateness(): number | null {
  return lateness.length >= 3 ? Math.min(...lateness) : null;
}

function sendClock(): void {
  send("clk", { t: Math.round(engine.time * 1000) / 1000, late: myLateness(), e: epoch });
}

/**
 * Both devices send their song time; each measures how late the other's arrive. The guest's lag minus the host's
 * is twice the gap between their song clocks (the network delay cancels out), which the guest then closes.
 */
function receiveClock(p: Record<string, unknown>): void {
  const r = room();
  if (!r || !together || engine.status !== "playing" || typeof p.t !== "number" || !Number.isFinite(p.t)) return;
  const e = typeof p.e === "number" ? p.e : 0;
  if (r.role === "host") {
    if (e < epoch) return;
    if (e > epoch) {
      epoch = e;
      lateness = [];
      partnerLate = null;
    }
  }
  lateness.push((engine.time - p.t) / engine.config.speed);
  if (lateness.length > CLOCK_SAMPLES) lateness.shift();
  if (e === epoch && typeof p.late === "number" && Number.isFinite(p.late)) partnerLate = p.late;
  const mine = myLateness();
  if (mine === null || partnerLate === null) return;
  const lag = Math.max(0, (mine + partnerLate) / 2);
  if (netLag === null || Math.abs(lag - netLag) > 0.01) {
    netLag = lag;
    patch({ lag: Math.round(lag * 100) / 100 });
  }
  if (r.role !== "guest") return;
  const behind = (partnerLate - mine) / 2;
  if (Math.abs(behind) <= CLOCK_TOLERANCE) return;
  engine.shiftClock(behind);
  epoch++;
  lateness = [];
  partnerLate = null;
}

function resetClockSync(): void {
  lateness = [];
  partnerLate = null;
  epoch = 0;
  netLag = null;
}

export function duetAvailable(): boolean {
  return !!supabase;
}

export function duetLink(code: string): string {
  return `${SITE_URL}?duet=${code}`;
}

/** Plays my hand, hears the other one; no loops, waiting or autoplay, so both devices run the same timeline. */
function applySession(): void {
  const { song, duet } = useApp.getState();
  if (!song || !duet?.songId) return;
  useApp.setState({ coach: null, drill: null, activeDuel: null });
  const ht = handTracks(song);
  const base = { ...DEFAULT_SESSION, mutedTracks: [], speed: duet.speed, loop: { ...NO_LOOP } };
  updateSession(
    ht
      ? { ...base, playTracks: [duet.myHand === "right" ? ht.right : ht.left], hand: "both" }
      : { ...base, playTracks: defaultPlayTracks(song), hand: duet.myHand }
  );
}

function ensurePiano(): void {
  if (useApp.getState().settings.instrument !== "piano") updateSettings({ instrument: "piano" });
}

/** Opens a room with the current song (a built-in one, so the partner has it too). */
export function hostDuet(): DuetRoom | null {
  if (!supabase) return null;
  const existing = room();
  if (existing?.role === "host") {
    useApp.setState({ panel: "duet" });
    return existing;
  }
  leaveDuet();
  ensurePiano();
  const { currentId, session } = useApp.getState();
  const speed = DUET_SPEEDS.reduce((b, s) => (Math.abs(s - session.speed) < Math.abs(b - session.speed) ? s : b), 1);
  const r: DuetRoom = {
    code: newRoomCode(),
    role: "host",
    phase: "connecting",
    songId: scoreable(currentId) ? currentId : null,
    speed,
    myHand: "right",
    partner: null,
    live: null,
    startAt: null,
    preparing: false,
    lag: null,
  };
  useApp.setState({ duet: r, panel: "duet" });
  applySession();
  connect(r);
  return r;
}

export function joinDuet(input: string): boolean {
  if (!supabase) return false;
  const code = normalizeCode(input);
  if (!code) {
    toast(tNow("duetBadCode"), "error");
    return false;
  }
  if (room()?.code === code) {
    useApp.setState({ panel: "duet" });
    return true;
  }
  leaveDuet();
  const r: DuetRoom = {
    code,
    role: "guest",
    phase: "connecting",
    songId: null,
    speed: 1,
    myHand: "left",
    partner: null,
    live: null,
    startAt: null,
    preparing: false,
    lag: null,
  };
  useApp.setState({ duet: r, panel: "duet" });
  connect(r);
  return true;
}

function connect(r: DuetRoom): void {
  const ch = supabase!.channel(`duet:${r.code}`, { config: { broadcast: { self: false }, presence: { key: clientId } } });
  channel = ch;
  ch.on("broadcast", { event: "*" }, (msg) => {
    if (channel === ch) onMessage(msg.event, (msg.payload ?? {}) as Record<string, unknown>);
  });
  ch.on("presence", { event: "sync" }, () => {
    if (channel === ch) onPresence(ch);
  });
  ch.subscribe((status) => {
    if (channel !== ch) return;
    if (status === "SUBSCRIBED") {
      if (room()?.phase !== "connecting") return;
      joinedAt = Date.now();
      void ch.track({ role: r.role, name: myName(), at: joinedAt });
      patch({ phase: "lobby" });
      if (r.role === "guest") {
        window.clearTimeout(noHostTimer);
        noHostTimer = window.setTimeout(() => {
          if (room()?.code === r.code && !room()?.partner) {
            toast(tNow("duetNoRoom"), "error", 5000);
            leaveDuet();
          }
        }, NO_HOST_MS);
      }
    } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && room()?.phase === "connecting") {
      toast(tNow("duetConnectFailed"), "error");
      leaveDuet();
    }
  });
}

interface PresenceMeta {
  role: "host" | "guest";
  name: string | null;
  at: number;
}

function onPresence(ch: RealtimeChannel): void {
  const r = room();
  if (!r) return;
  const others = Object.entries(ch.presenceState<PresenceMeta>())
    .filter(([key]) => key !== clientId)
    .map(([, metas]) => metas[0] as PresenceMeta | undefined)
    .filter((m): m is PresenceMeta => !!m);
  // Two players per room: a later guest leaves.
  if (r.role === "guest" && others.some((m) => m.role === "guest" && m.at < joinedAt)) {
    toast(tNow("duetFull"), "error", 5000);
    leaveDuet();
    return;
  }
  const peer = others.filter((m) => m.role === (r.role === "host" ? "guest" : "host")).sort((a, b) => a.at - b.at)[0];
  if (!peer) {
    if (r.partner) {
      toast(tNow("duetPartnerLeft", { name: who(r.partner.name) }), "info", 5000);
      if (together) engine.halt();
      together = false;
      partnerListens = false;
      patch({ partner: null, live: null, phase: r.phase === "live" ? "lobby" : r.phase, startAt: null });
    }
    return;
  }
  const name = typeof peer.name === "string" ? peer.name.slice(0, 24) : null;
  if (!r.partner) {
    window.clearTimeout(noHostTimer);
    patch({ partner: { name, ready: false } });
    sendSound();
    if (r.role === "host") {
      toast(tNow("duetPartnerJoined", { name: who(name) }), "success");
      sendSetup();
    }
  } else if (r.partner.name !== name) {
    patch({ partner: { ...r.partner, name } });
  }
}

function sendSetup(): void {
  const r = room();
  if (r?.role !== "host") return;
  send("setup", { songId: r.songId, speed: r.speed, hand: r.myHand === "right" ? "left" : "right" });
}

function onMessage(event: string, p: Record<string, unknown>): void {
  const r = room();
  if (!r) return;
  switch (event) {
    case "setup":
      if (r.role === "guest") void prepare(p);
      break;
    case "ready":
      if (r.role === "host" && r.partner) patch({ partner: { ...r.partner, ready: p.ok === true } });
      break;
    case "ping":
      if (r.role === "host" && typeof p.t0 === "number") send("pong", { t0: p.t0, th: performance.now() });
      break;
    case "pong":
      if (typeof p.t0 === "number" && typeof p.th === "number") pongs.get(p.t0)?.(p.th);
      break;
    case "start":
      if (r.role === "guest" && typeof p.pos === "number" && typeof p.at === "number") {
        if (useApp.getState().currentId !== r.songId || r.preparing) return;
        begin(p.pos, p.at - clockOffset);
      }
      break;
    case "go":
      if (r.role === "host") startTogether();
      break;
    case "pause":
      engine.halt();
      break;
    case "stop":
      together = false;
      engine.rewind();
      useApp.setState({ results: null });
      patch({ phase: "lobby", startAt: null, live: null });
      break;
    case "live":
      if (typeof p.s === "number" && typeof p.a === "number" && typeof p.c === "number")
        patch({ live: { score: Math.max(0, p.s), accuracy: Math.min(1, Math.max(0, p.a)), combo: Math.max(0, p.c) } });
      break;
    case "final":
      receiveFinal(p);
      break;
    case "sound":
      partnerListens = p.live === true;
      break;
    case "notes":
      receiveNotes(p);
      break;
    case "clk":
      receiveClock(p);
      break;
  }
}

/** Guest: gets the host's song and hand ready, lines the clocks up, then says so. */
async function prepare(p: Record<string, unknown>): Promise<void> {
  const token = ++prepToken;
  const songId = typeof p.songId === "string" && isBuiltin(p.songId) ? p.songId : null;
  const myHand: DuetHand = p.hand === "right" ? "right" : "left";
  const speed = typeof p.speed === "number" && DUET_SPEEDS.includes(p.speed) ? p.speed : 1;
  patch({ songId, speed, myHand, preparing: !!songId });
  send("ready", { ok: false });
  if (!songId) return;
  ensurePiano();
  if (useApp.getState().currentId !== songId || !useApp.getState().song) {
    const ok = await openSong(songId, { quiet: true });
    if (token !== prepToken) return;
    if (!ok) {
      toast(tNow("songLoadFailed"), "error");
      patch({ preparing: false });
      return;
    }
  }
  if (engine.status === "playing") engine.halt();
  applySession();
  await engine.ensureAudio();
  if (token !== prepToken) return;
  await syncClock();
  if (token !== prepToken) return;
  patch({ preparing: false });
  send("ready", { ok: true });
}

/** Ping-pong with the host; the quickest round trip gives the best estimate of how far apart our clocks are. */
async function syncClock(): Promise<void> {
  let best = Infinity;
  for (let i = 0; i < 6; i++) {
    const t0 = performance.now();
    const hostNow = await new Promise<number | null>((resolve) => {
      const timer = window.setTimeout(() => {
        pongs.delete(t0);
        resolve(null);
      }, 1500);
      pongs.set(t0, (v) => {
        window.clearTimeout(timer);
        pongs.delete(t0);
        resolve(v);
      });
      send("ping", { t0 });
    });
    const t1 = performance.now();
    if (hostNow !== null && t1 - t0 < best) {
      best = t1 - t0;
      clockOffset = hostNow - (t0 + t1) / 2;
    }
    await sleep(60);
  }
}

/** Host: starts both devices on the same moment, a short countdown from now. */
export function startTogether(): void {
  const r = room();
  if (r?.role !== "host" || engine.status === "playing") return;
  if (!r.songId || useApp.getState().currentId !== r.songId) {
    toast(tNow("duetPickSong"), "info");
    return;
  }
  if (!r.partner?.ready) {
    toast(tNow("duetWaitPartner"), "info");
    return;
  }
  const pos = engine.status === "paused" ? engine.time : engine.startTime;
  const at = performance.now() + COUNTDOWN_MS;
  send("start", { pos, at });
  begin(pos, at);
}

function begin(pos: number, at: number): void {
  const r = room();
  if (!r) return;
  together = true;
  partnerFinal = null;
  lastLive = "";
  keyIds.clear();
  resetClockSync();
  sendSound();
  useApp.setState({ results: null, panel: null, duet: { ...r, phase: "live", startAt: at, live: null, lag: null } });
  engine.configure(engineConfig());
  void engine.startAt(pos, at);
  window.clearInterval(liveTimer);
  liveTimer = window.setInterval(() => {
    if (engine.status !== "playing") return;
    sendClock();
    const s = engine.stats;
    const msg = { s: s.score, a: Math.round(accuracyOf(s) * 1000) / 1000, c: s.combo };
    const key = `${msg.s}|${msg.a}|${msg.c}`;
    if (key === lastLive) return;
    lastLive = key;
    send("live", msg);
  }, LIVE_EVERY_MS);
}

function receiveFinal(p: Record<string, unknown>): void {
  const side = sideFrom(p, room()?.partner?.name ?? null);
  if (!side) return;
  const results = useApp.getState().results;
  if (results?.duet && !results.duet.partner) useApp.setState({ results: { ...results, duet: { ...results.duet, partner: side } } });
  else partnerFinal = side;
}

/** Called when a run ends: for a run started together, sends ours over and returns both sides for the results. */
export function duetAfterRun(stats: Stats, accuracy: number, stars: number): DuetResult | undefined {
  const r = room();
  if (!r || !together) return undefined;
  together = false;
  window.clearInterval(liveTimer);
  window.clearTimeout(flushTimer);
  flushNotes();
  const me: DuetSide = { name: myName(), hand: r.myHand, stats, accuracy, stars };
  send("final", { stats, hand: r.myHand, name: me.name });
  const partner = partnerFinal;
  partnerFinal = null;
  patch({ phase: "lobby", startAt: null });
  return { me, partner };
}

/** Host lobby controls: which hand I take (the partner gets the other) and the speed. */
export function setDuetOptions(o: { myHand?: DuetHand; speed?: number }): void {
  const r = room();
  if (r?.role !== "host" || r.phase === "live") return;
  patch({ ...o, partner: r.partner ? { ...r.partner, ready: false } : null });
  applySession();
  sendSetup();
}

export async function inviteToDuet(friendId: string, name: string | null): Promise<boolean> {
  const r = room();
  if (r?.role !== "host" || !r.songId) {
    toast(tNow("duetPickSong"), "info");
    return false;
  }
  const res = await sendDuetInvite(friendId, r.code, r.songId);
  if (!res.ok) {
    toastSocialError(res.error);
    return false;
  }
  toast(tNow("duetInviteSent", { name: name ?? "?" }), "success");
  return true;
}

export function leaveDuet(): void {
  const ch = channel;
  channel = null;
  prepToken++;
  together = false;
  partnerFinal = null;
  partnerListens = false;
  outbox = [];
  window.clearInterval(liveTimer);
  window.clearTimeout(noHostTimer);
  window.clearTimeout(flushTimer);
  flushTimer = 0;
  pongs.clear();
  if (ch) {
    void ch.untrack().finally(() => void supabase?.removeChannel(ch));
  }
  const s = useApp.getState();
  if (!s.duet) return;
  engine.halt();
  useApp.setState({ duet: null, panel: s.panel === "duet" ? null : s.panel });
  restoreSession();
}

function watchInbox(userId: string | null): void {
  if (inbox) void supabase!.removeChannel(inbox);
  inbox = null;
  if (!userId) return;
  inbox = supabase!
    .channel(`inbox:${userId}`)
    .on("broadcast", { event: "duet" }, () => void loadSocial())
    .subscribe();
}

/** Takes over play / pause / seek while in a duet, follows the host's song changes, and joins rooms from links. */
export function initDuet(): void {
  if (!supabase) return;
  engine.transportHook = (action) => {
    const r = room();
    if (!r?.partner || !r.songId || useApp.getState().currentId !== r.songId) return false;
    switch (action) {
      case "play":
        if (r.role === "host") startTogether();
        else if (r.preparing) toast(tNow("duetPreparing"), "info");
        else {
          send("go");
          toast(tNow("duetAskedHost", { name: who(r.partner.name) }), "info");
        }
        return true;
      case "pause":
        send("pause");
        return false;
      case "stop":
        together = false;
        send("stop");
        patch({ phase: "lobby", startAt: null, live: null });
        return false;
      case "seek":
        toast(tNow("duetNoSeek"), "info");
        return true;
    }
  };

  useApp.subscribe((s, prev) => {
    const r = s.duet;
    if (r && s.currentId !== prev.currentId) {
      if (r.role === "host" && r.phase !== "live") {
        const songId = scoreable(s.currentId) ? s.currentId : null;
        if (!songId) toast(tNow("duetBuiltinOnly"), "info", 5000);
        useApp.setState({ duet: { ...r, songId, partner: r.partner ? { ...r.partner, ready: false } : null } });
        applySession();
        sendSetup();
      } else if (r.role === "guest" && !r.preparing && prev.currentId === r.songId) {
        send("ready", { ok: false });
      }
    }
    // A host's song re-opened from its own prefs (e.g. after closing a dialog) keeps the duet hand.
    else if (r?.songId && s.session !== prev.session && s.currentId === r.songId && s.song !== prev.song) applySession();
    if (r?.partner && s.settings.duetSound !== prev.settings.duetSound) sendSound();
    const id = s.social?.me?.id ?? null;
    if (id !== (prev.social?.me?.id ?? null)) watchInbox(id);
  });
  engine.addInputListener(queueNote);

  const params = new URLSearchParams(window.location.search);
  const code = params.get("duet");
  if (code) {
    params.delete("duet");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    joinDuet(code);
  }
}
