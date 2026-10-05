import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useT } from "../i18n";
import { builtinTitle } from "../midi/builtin";
import { combineSides, type DuetHand, type DuetResult, type DuetSide } from "../social/duetScore";
import {
  DUET_SPEEDS,
  duetAvailable,
  duetLink,
  hostDuet,
  inviteToDuet,
  joinDuet,
  leaveDuet,
  setDuetOptions,
  startTogether,
  type DuetRoom,
} from "../social/live";
import { dismissDuetInvite } from "../social/social";
import { shareLink } from "../studio/share";
import { setPanel, toast, useApp } from "../state/store";
import { IconCheck, IconClose, IconDuet, IconPlay, IconShare, IconStar } from "../ui/icons";
import { Button, Dialog, Segmented, cx } from "../ui/primitives";

type T = ReturnType<typeof useT>;
const handLabel = (t: T, h: DuetHand) => (h === "right" ? t("trackRightHand") : t("trackLeftHand"));
const other = (h: DuetHand): DuetHand => (h === "right" ? "left" : "right");
const pct = (v: number) => `${Math.round(v * 100)}%`;

function useSongTitle(id: string | null): string | null {
  const lang = useApp((s) => s.settings.language);
  return id ? builtinTitle(id, lang) : null;
}

function Player({ name, hand, status, me }: { name: string; hand: DuetHand; status?: ReactNode; me?: boolean }) {
  return (
    <div className={cx("min-w-0 flex-1 rounded-2xl px-3 py-2.5 ring-1", me ? "bg-brand-500/15 ring-brand-400/30" : "bg-white/[0.04] ring-white/[0.06]")}>
      <div className="truncate text-sm font-bold">{name}</div>
      <div className={cx("text-xs font-semibold", hand === "right" ? "text-sky-300" : "text-fuchsia-300")}>{hand === "right" ? "→ " : "← "}{status}</div>
    </div>
  );
}

function Start() {
  const t = useT();
  const [code, setCode] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    joinDuet(code);
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-brand-500/20 to-fuchsia-400/10 p-4 ring-1 ring-white/[0.06]">
        <IconDuet size={30} className="text-brand-200" />
        <p className="mt-2 text-sm leading-relaxed text-mist-200">{t("duetIntro")}</p>
        <Button variant="primary" size="lg" className="mt-3 w-full" onClick={() => hostDuet()}>
          <IconDuet size={18} /> {t("duetHost")}
        </Button>
      </div>
      <form onSubmit={submit} className="rounded-2xl bg-white/[0.04] p-3">
        <div className="mb-2 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("duetJoinTitle")}</div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={7}
            placeholder={t("duetCodePlaceholder")}
            aria-label={t("duetCodePlaceholder")}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 text-center font-mono text-lg font-bold tracking-[0.3em] uppercase"
          />
          <Button type="submit" variant="primary" size="md" className="h-11" disabled={code.trim().length < 5}>
            {t("duetJoin")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function InviteFriends({ room }: { room: DuetRoom }) {
  const t = useT();
  const board = useApp((s) => s.social?.board);
  const [sent, setSent] = useState<string[]>([]);
  const friends = board?.filter((r) => !r.is_me) ?? [];
  if (!friends.length || room.partner) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("duetInviteFriends")}</h3>
      <ul className="max-h-44 space-y-1 overflow-y-auto">
        {friends.map((f) => (
          <li key={f.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">@{f.username ?? "?"}</span>
            <Button
              size="sm"
              variant={sent.includes(f.id) ? "ghost" : "primary"}
              disabled={sent.includes(f.id) || !room.songId}
              onClick={() => void inviteToDuet(f.id, f.username).then((ok) => ok && setSent((s) => [...s, f.id]))}
            >
              {sent.includes(f.id) ? (
                <>
                  <IconCheck size={13} /> {t("duetInvited")}
                </>
              ) : (
                t("duetInvite")
              )}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Lobby({ room }: { room: DuetRoom }) {
  const t = useT();
  const me = useApp((s) => s.account.username);
  const title = useSongTitle(room.songId);
  const host = room.role === "host";
  const share = async () => {
    const r = await shareLink(t("duet"), t("duetShareText", { song: title ?? "", code: room.code }), duetLink(room.code));
    if (r === "copied") toast(t("linkCopied"), "success");
  };
  const partnerName = room.partner ? (room.partner.name ? `@${room.partner.name}` : t("duetGuest")) : null;
  const partnerStatus = !room.partner
    ? t("duetWaiting")
    : host
      ? room.partner.ready
        ? `${handLabel(t, other(room.myHand))} · ${t("duetReady")}`
        : `${handLabel(t, other(room.myHand))} · ${t("duetGettingReady")}`
      : handLabel(t, other(room.myHand));
  const myStatus = host || !room.songId ? handLabel(t, room.myHand) : `${handLabel(t, room.myHand)} · ${room.preparing ? t("duetGettingReady") : t("duetReady")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-500/20 to-fuchsia-400/10 p-3 ring-1 ring-white/[0.06]">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.14em] text-mist-400 uppercase">{t("duetRoomCode")}</div>
          <div className="font-mono text-3xl font-extrabold tracking-[0.25em] text-white">{room.code}</div>
        </div>
        <Button size="sm" onClick={() => void share()}>
          <IconShare size={14} /> {t("duetShare")}
        </Button>
      </div>

      {room.phase === "connecting" ? (
        <p className="text-center text-sm text-mist-400">{t("duetConnecting")}</p>
      ) : (
        <div className="flex gap-2">
          <Player me name={me ? `@${me}` : t("you")} hand={room.myHand} status={myStatus} />
          {partnerName ? (
            <Player name={partnerName} hand={other(room.myHand)} status={partnerStatus} />
          ) : (
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-mist-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-300" />
              {partnerStatus}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.12em] text-mist-400 uppercase">{t("duetSong")}</div>
          <div className="truncate font-semibold">{title ?? (host ? t("duetPickSong") : t("duetHostPicking"))}</div>
          {!host && room.songId && (
            <div className="text-xs text-mist-400">
              {t("duetSpeed")}: {pct(room.speed)}
            </div>
          )}
        </div>
        {host && (
          <Button size="sm" onClick={() => setPanel("library")}>
            {t("duetChangeSong")}
          </Button>
        )}
      </div>

      {host && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs text-mist-400">{t("duetYourHand")}</div>
            <Segmented
              label={t("duetYourHand")}
              className="w-full [&>*]:flex-1"
              value={room.myHand}
              onChange={(h) => setDuetOptions({ myHand: h })}
              options={[
                { value: "right", label: t("trackRightHand") },
                { value: "left", label: t("trackLeftHand") },
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-xs text-mist-400">{t("duetSpeed")}</div>
            <Segmented
              label={t("duetSpeed")}
              className="w-full [&>*]:flex-1"
              value={String(room.speed)}
              onChange={(v) => setDuetOptions({ speed: Number(v) })}
              options={DUET_SPEEDS.map((s) => ({ value: String(s), label: pct(s) }))}
            />
          </div>
        </div>
      )}

      {host && <InviteFriends room={room} />}
      {!host && room.partner && room.songId && !room.preparing && (
        <p className="text-center text-sm text-mist-300">{t("duetHostWillStart", { name: room.partner.name ? `@${room.partner.name}` : t("duetGuest") })}</p>
      )}
    </div>
  );
}

export function DuetDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "duet");
  const room = useApp((s) => s.duet);
  const close = () => setPanel(null);
  const host = room?.role === "host";
  const canStart = host && !!room.partner?.ready && !!room.songId;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("duet")}
      width="max-w-md"
      closeLabel={t("close")}
      footer={
        room ? (
          <>
            <Button variant="ghost" onClick={() => leaveDuet()}>
              {t("duetLeave")}
            </Button>
            {host && (
              <Button variant="primary" disabled={!canStart} onClick={startTogether}>
                <IconPlay size={15} /> {t("duetStart")}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {!duetAvailable() ? (
        <p className="text-sm text-mist-400">{t("friendsUnavailable")}</p>
      ) : room ? (
        <Lobby room={room} />
      ) : (
        <Start />
      )}
    </Dialog>
  );
}

/** In-game: the room while waiting, the partner's running score while playing, and the shared countdown. */
export function DuetHud() {
  const t = useT();
  const room = useApp((s) => s.duet);
  const [now, setNow] = useState(() => performance.now());
  const counting = !!room?.startAt && room.startAt > now;

  useEffect(() => {
    if (!room?.startAt) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      if (performance.now() < room.startAt! + 200) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [room?.startAt]);

  if (!room) return null;
  const partner = room.partner?.name ? `@${room.partner.name}` : t("duetGuest");
  return (
    <>
      {room.phase === "live" && room.partner ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-fuchsia-400/15 py-1 pr-3 pl-2 text-sm font-semibold text-fuchsia-50 shadow-lg backdrop-blur animate-pop">
          <IconDuet size={16} />
          <span className="max-w-[9rem] truncate">{partner}</span>
          <span className="text-xs text-fuchsia-200">{handLabel(t, other(room.myHand))}</span>
          {room.live && (
            <span className="tabular-nums">
              {room.live.score.toLocaleString()} · {pct(room.live.accuracy)}
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPanel("duet")}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-fuchsia-400/15 py-1 pr-3 pl-2 text-sm font-semibold text-fuchsia-50 shadow-lg backdrop-blur hover:bg-fuchsia-400/25"
        >
          <IconDuet size={16} />
          <span className="font-mono tracking-widest">{room.code}</span>
          <span className="text-xs text-fuchsia-200">{room.partner ? partner : t("duetWaiting")}</span>
        </button>
      )}
      {counting && (
        <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/30">
          <div key={Math.ceil((room.startAt! - now) / 1000)} className="text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(217,70,239,0.7)] animate-pop">
            {Math.ceil((room.startAt! - now) / 1000)}
          </div>
          <div className="mt-2 rounded-full bg-black/40 px-4 py-1 text-sm font-semibold text-white">
            {t("duetYouPlay", { hand: handLabel(t, room.myHand) })}
          </div>
        </div>
      )}
    </>
  );
}

function SideCard({ label, side, accent }: { label: string; side: { stats: { score: number }; accuracy: number; stars: number } | null; accent: string }) {
  const t = useT();
  return (
    <div className={cx("min-w-0 rounded-2xl px-2 py-3 text-center ring-1", accent)}>
      <div className="truncate text-xs font-bold">{label}</div>
      {side ? (
        <>
          <div className="mt-1 text-xl font-extrabold tabular-nums">{side.stats.score.toLocaleString()}</div>
          <div className="text-xs tabular-nums text-mist-300">{pct(side.accuracy)}</div>
          <div className="mt-1 flex justify-center gap-0.5" role="img" aria-label={t("starsOf", { n: side.stars })}>
            {Array.from({ length: 5 }, (_, i) => (
              <IconStar key={i} size={11} filled={i < side.stars} className={i < side.stars ? "text-amber-300" : "text-white/15"} />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-3 animate-pulse text-xs text-mist-400">{t("duetWaitingResult")}</div>
      )}
    </div>
  );
}

/** Results of a duet: my hand, the partner's hand and the two together. */
export function DuetResults({ result }: { result: DuetResult }) {
  const t = useT();
  const { me, partner } = result;
  const both = partner ? combineSides(me, partner) : null;
  const name = (s: DuetSide) => (s.name ? `@${s.name}` : t("duetGuest"));
  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand-500/15 to-fuchsia-400/10 p-3 ring-1 ring-white/[0.06]">
      <div className="mb-2 flex items-center justify-center gap-2 text-sm font-extrabold">
        <IconDuet size={17} /> {t("duetResultTitle")}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SideCard label={`${t("you")} · ${handLabel(t, me.hand)}`} side={me} accent="bg-brand-500/15 ring-brand-400/30" />
        <SideCard
          label={partner ? `${name(partner)} · ${handLabel(t, partner.hand)}` : handLabel(t, other(me.hand))}
          side={partner}
          accent="bg-white/[0.04] ring-white/[0.08]"
        />
        <SideCard label={t("duetTogether")} side={both} accent="bg-amber-400/15 ring-amber-300/35" />
      </div>
      {both && <p className="mt-2 text-center text-sm font-semibold text-mist-200">{t(both.stars >= 4 ? "duetGreat" : both.stars >= 3 ? "duetGood" : "duetKeepGoing")}</p>}
    </div>
  );
}

/** A friend calling me into their room, shown over everything until answered. */
export function DuetInviteBanner() {
  const t = useT();
  const invites = useApp((s) => s.social?.duet_invites);
  const inRoom = useApp((s) => !!s.duet);
  const lang = useApp((s) => s.settings.language);
  const invite = !inRoom ? invites?.[0] : undefined;
  if (!invite) return null;
  return (
    <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-fuchsia-300/30 bg-ink-900/95 p-3 shadow-2xl backdrop-blur animate-pop">
        <IconDuet size={26} className="shrink-0 text-fuchsia-300" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{t("duetInviteBanner", { name: invite.friend ?? "?" })}</div>
          <div className="truncate text-xs text-mist-400">{builtinTitle(invite.song_id, lang)}</div>
        </div>
        <Button size="sm" variant="ghost" aria-label={t("decline")} onClick={() => void dismissDuetInvite(invite.id)}>
          <IconClose size={14} />
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            void dismissDuetInvite(invite.id);
            joinDuet(invite.code);
          }}
        >
          {t("duetJoin")}
        </Button>
      </div>
    </div>
  );
}
