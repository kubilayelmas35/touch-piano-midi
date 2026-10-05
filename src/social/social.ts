import { supabase } from "../auth/account";
import type { InstrumentKind } from "../engine/types";
import { tNow } from "../i18n";
import type { DictKey } from "../i18n/en";
import { SITE_URL } from "../lib/platform";
import { handTracks } from "../midi/song";
import { isBuiltin } from "../midi/builtin";
import { toast, useApp } from "../state/store";

export type DuelHand = "both" | "left" | "right";

export interface BoardRow {
  id: string;
  username: string | null;
  is_me: boolean;
  score: number;
  songs: number;
  starred: number;
}

export interface FriendRef {
  id: string;
  username: string | null;
}

export interface Duel {
  id: number;
  song_id: string;
  instrument: InstrumentKind;
  speed: number;
  hand: DuelHand;
  status: "open" | "done" | "declined";
  created_at: string;
  done_at: string | null;
  /** I sent the challenge. */
  mine: boolean;
  friend: string | null;
  friend_id: string;
  from_score: number;
  from_accuracy: number;
  to_score: number | null;
  to_accuracy: number | null;
}

export interface SocialOverview {
  week: string;
  me: FriendRef | null;
  board: BoardRow[];
  incoming: FriendRef[];
  outgoing: FriendRef[];
  duels: Duel[];
  /** Friends calling me into a live duet room (the last 15 minutes). */
  duet_invites?: DuetInvite[];
}

export interface DuetInvite {
  id: number;
  friend: string | null;
  friend_id: string;
  code: string;
  song_id: string;
  created_at: string;
}

export interface SongScore {
  username: string | null;
  score: number;
  stars: number;
  is_me: boolean;
}

/** Server error codes raised by the social functions, mapped to UI text by the caller. */
export type SocialError =
  | "need_username"
  | "not_found"
  | "self"
  | "rate_limited"
  | "not_friends"
  | "too_many_duels"
  | "duel_closed"
  | "username_taken"
  | "bad_username"
  | "username_set"
  | "offline";

const CODES: SocialError[] = [
  "need_username",
  "not_found",
  "self",
  "rate_limited",
  "not_friends",
  "too_many_duels",
  "duel_closed",
  "username_taken",
  "bad_username",
  "username_set",
];

function codeOf(error: { message?: string } | null): SocialError {
  const msg = error?.message ?? "";
  return CODES.find((c) => msg.includes(c)) ?? "offline";
}

export function socialEnabled(): boolean {
  return !!supabase && useApp.getState().account.status === "signedIn";
}

/** Whether a run can count for friends: everyone has the song (built-in), and it was a real attempt. */
export function scoreable(songId: string | null): songId is string {
  return !!songId && isBuiltin(songId);
}

export async function loadSocial(): Promise<SocialOverview | null> {
  if (!socialEnabled()) return null;
  useApp.setState({ socialLoading: true });
  const { data, error } = await supabase!.rpc("social_overview");
  useApp.setState({ socialLoading: false });
  if (error) {
    console.warn("[social] overview failed", error);
    return null;
  }
  const social = data as SocialOverview;
  useApp.setState({ social });
  return social;
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: SocialError }> {
  if (!socialEnabled()) return { ok: false, error: "offline" };
  const { data, error } = await supabase!.rpc(fn, args);
  if (error) return { ok: false, error: codeOf(error) };
  return { ok: true, data: data as T };
}

export async function setUsername(name: string) {
  const r = await call<string>("set_username", { p_name: name.trim() });
  if (r.ok) {
    useApp.setState((s) => ({ account: { ...s.account, username: r.data } }));
    void loadSocial();
  }
  return r;
}

export async function addFriend(username: string) {
  const r = await call<"sent" | "accepted" | "already">("friend_request", { p_username: username.trim().replace(/^@/, "") });
  if (r.ok) void loadSocial();
  return r;
}

export async function respondFriend(id: string, accept: boolean) {
  const r = await call<null>("friend_respond", { p_user: id, p_accept: accept });
  void loadSocial();
  return r;
}

export async function removeFriend(id: string) {
  const r = await call<null>("friend_remove", { p_user: id });
  void loadSocial();
  return r;
}

/** Records a finished run for the weekly board; resolves to friends' best on the song this week. */
export async function submitScore(run: { songId: string; instrument: InstrumentKind; score: number; accuracy: number; stars: number }) {
  return call<SongScore[]>("submit_score", {
    p_song: run.songId,
    p_instrument: run.instrument,
    p_score: Math.round(run.score),
    p_accuracy: run.accuracy,
    p_stars: run.stars,
  });
}

/** The hand the player is taking right now, as stored on a duel. */
export function currentHand(): DuelHand {
  const { settings, song, session } = useApp.getState();
  if (settings.instrument !== "piano" || !song) return "both";
  const ht = handTracks(song);
  if (!ht) return session.hand;
  const right = session.playTracks.includes(ht.right);
  const left = session.playTracks.includes(ht.left);
  return right && !left ? "right" : left && !right ? "left" : "both";
}

export async function createDuel(friendId: string, run: { songId: string; instrument: InstrumentKind; score: number; accuracy: number }) {
  const r = await call<number>("duel_create", {
    p_friend: friendId,
    p_song: run.songId,
    p_instrument: run.instrument,
    p_speed: useApp.getState().session.speed,
    p_hand: currentHand(),
    p_score: Math.round(run.score),
    p_accuracy: run.accuracy,
  });
  if (r.ok) void loadSocial();
  return r;
}

export async function answerDuel(id: number, score: number, accuracy: number) {
  const r = await call<{ from_score: number; to_score: number }>("duel_answer", { p_id: id, p_score: Math.round(score), p_accuracy: accuracy });
  void loadSocial();
  return r;
}

export async function declineDuel(id: number) {
  const r = await call<null>("duel_decline", { p_id: id });
  void loadSocial();
  return r;
}

/** Calls a friend into a live duet room; their app hears about it at once through their inbox channel. */
export async function sendDuetInvite(friendId: string, code: string, songId: string) {
  const r = await call<number>("duet_invite", { p_friend: friendId, p_code: code, p_song: songId });
  if (r.ok) {
    const ch = supabase!.channel(`inbox:${friendId}`);
    void ch
      .httpSend("duet", {})
      .catch(() => undefined)
      .finally(() => void supabase!.removeChannel(ch));
  }
  return r;
}

export async function dismissDuetInvite(id: number) {
  useApp.setState((s) => (s.social ? { social: { ...s.social, duet_invites: s.social.duet_invites?.filter((i) => i.id !== id) } } : {}));
  return call<null>("duet_invite_dismiss", { p_id: id });
}

/**
 * Sends a finished run to the weekly board and, when it plays an open challenge with the challenger's settings
 * (same instrument, hand, and at least their speed), answers it. The open results dialog then shows both.
 */
export async function reportRun(run: { songId: string; instrument: InstrumentKind; score: number; accuracy: number; stars: number }): Promise<void> {
  if (!socialEnabled()) return;
  const results = useApp.getState().results;
  const duel = useApp.getState().activeDuel;
  const answers =
    duel &&
    duel.song_id === run.songId &&
    duel.instrument === run.instrument &&
    duel.hand === currentHand() &&
    useApp.getState().session.speed >= duel.speed - 1e-6;
  if (duel && duel.song_id === run.songId && !answers) toast(tNow("duelSettingsChanged"), "info", 6000);
  const [scores, answer] = await Promise.all([submitScore(run), answers ? answerDuel(duel.id, run.score, run.accuracy) : null]);
  if (answers) useApp.setState({ activeDuel: null });
  if (answer && !answer.ok) toastSocialError(answer.error);
  useApp.setState((s) => {
    if (!s.results || s.results !== results) return {};
    return {
      results: {
        ...s.results,
        friendScores: scores.ok ? scores.data : undefined,
        duel: answer?.ok ? { friend: duel!.friend, mine: answer.data.to_score, theirs: answer.data.from_score } : undefined,
      },
    };
  });
}

let lastLoad = 0;

/** Keeps the friends overview fresh: on sign-in, when the app comes back to the front, and from invite links. */
export function initSocial(): void {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get("friend");
  if (invite) {
    params.delete("friend");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    useApp.setState({ friendInvite: invite.slice(0, 24), panel: "friends" });
  }
  const refresh = (force = false) => {
    if (!socialEnabled() || (!force && Date.now() - lastLoad < 60_000)) return;
    lastLoad = Date.now();
    void loadSocial();
  };
  useApp.subscribe((s, prev) => {
    if (s.account.status !== prev.account.status) {
      if (s.account.status === "signedIn") refresh(true);
      else useApp.setState({ social: null, activeDuel: null });
    }
    if (s.panel === "friends" && prev.panel !== "friends") refresh(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
  refresh(true);
}

/** Link that opens the app with a friend request to `username` ready to send. */
export function inviteLink(username: string): string {
  return `${SITE_URL}?friend=${encodeURIComponent(username)}`;
}

/** Things waiting for me: friend requests and challenges to answer. */
export function pendingCount(s: SocialOverview | null): number {
  if (!s) return 0;
  return s.incoming.length + s.duels.filter((d) => !d.mine && d.status === "open").length + (s.duet_invites?.length ?? 0);
}

export function socialErrorText(e: SocialError): string {
  return tNow(`social_${e}` as DictKey);
}

export function toastSocialError(e: SocialError): void {
  toast(socialErrorText(e), "error");
}
