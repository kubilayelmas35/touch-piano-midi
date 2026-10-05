import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { TRIAL_DAYS, USERNAME_RE, avatarUrl } from "../auth/account";
import { UserAvatar } from "./UserAvatar";
import { useT } from "../i18n";
import { builtinTitle } from "../midi/builtin";
import { playDuel } from "../social/duel";
import {
  addFriend,
  blockUser,
  declineDuel,
  dismissDuetInvite,
  inviteLink,
  removeFriend,
  respondFriend,
  setUsername,
  socialErrorText,
  toastSocialError,
  unblockUser,
  type BoardRow,
  type Duel,
  type FriendRef,
} from "../social/social";
import { shareLink } from "../studio/share";
import { setPanel, toast, useApp } from "../state/store";
import { hostDuet, inviteToDuet, joinDuet } from "../social/live";
import {
  IconBan,
  IconCheck,
  IconClose,
  IconCrown,
  IconDuet,
  IconFlag,
  IconGift,
  IconMore,
  IconPlay,
  IconShare,
  IconSwords,
  IconTrophy,
  IconUser,
  IconUsers,
} from "../ui/icons";
import { Button, Dialog, IconButton, Popover, Segmented, cx } from "../ui/primitives";
import { ReportDialog } from "./ReportDialog";

type Tab = "board" | "duels" | "friends";

const MEDAL = ["text-amber-300", "text-slate-200", "text-amber-600"] as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.03] px-4 py-8 text-center text-sm text-mist-400">
      <div className="text-mist-500">{icon}</div>
      {children}
    </div>
  );
}

function Avatar({ name, path, me }: { name: string | null; path?: string | null; me?: boolean }) {
  return <UserAvatar url={avatarUrl(path)} name={name} me={me} className="h-9 w-9 text-sm" />;
}

function UsernameForm() {
  const t = useT();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!USERNAME_RE.test(name.trim())) return setError(t("usernameHint"));
    setBusy(true);
    const r = await setUsername(name);
    setBusy(false);
    if (!r.ok) setError(socialErrorText(r.error));
  };
  return (
    <form onSubmit={submit} className="rounded-2xl bg-white/[0.04] p-4">
      <div className="text-sm font-bold">{t("friendsPickName")}</div>
      <p className="mt-1 text-xs leading-relaxed text-mist-400">{t("friendsPickNameHint")}</p>
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder={t("username")}
          aria-label={t("username")}
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 text-sm"
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {t("takeSave")}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </form>
  );
}

function AddFriend({ me }: { me: string }) {
  const t = useT();
  const invite = useApp((s) => s.friendInvite);
  const [name, setName] = useState(invite ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!invite) return;
    setName(invite);
    useApp.setState({ friendInvite: null });
  }, [invite]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const r = await addFriend(name);
    setBusy(false);
    if (!r.ok) return toastSocialError(r.error);
    toast(t(r.data === "accepted" ? "friendAccepted" : r.data === "already" ? "friendAlready" : "friendRequestSent", { name: name.trim() }), "success");
    setName("");
  };
  const share = async () => {
    const r = await shareLink(t("friendsInviteTitle"), t("friendsInviteText", { name: me }), inviteLink(me));
    if (r === "copied") toast(t("linkCopied"), "success");
  };
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500/15 to-sky-400/10 p-3 ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-3">
        <Avatar name={me} me />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">@{me}</div>
          <div className="text-xs text-mist-400">{t("friendsYourName")}</div>
        </div>
        <Button size="sm" onClick={() => void share()}>
          <IconShare size={14} /> {t("friendsInvite")}
        </Button>
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={25}
          placeholder={t("friendsAddPlaceholder")}
          aria-label={t("friendsAdd")}
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-800 px-3 text-sm"
        />
        <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
          {t("friendsAdd")}
        </Button>
      </form>
    </div>
  );
}

function Board({ rows }: { rows: BoardRow[] }) {
  const t = useT();
  if (rows.length <= 1 && !rows[0]?.score) {
    return <Empty icon={<IconTrophy size={28} />}>{t("boardEmpty")}</Empty>;
  }
  return (
    <div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={cx("flex items-center gap-3 rounded-2xl px-3 py-2", r.is_me ? "bg-brand-500/15 ring-1 ring-brand-400/30" : "bg-white/[0.04]")}
          >
            <span className={cx("w-6 text-center text-sm font-extrabold tabular-nums", MEDAL[i] ?? "text-mist-400")}>
              {i < 3 && r.score > 0 ? <IconCrown size={16} className="mx-auto" /> : i + 1}
            </span>
            <Avatar name={r.username} path={r.avatar} me={r.is_me} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {r.username ?? "?"} {r.is_me && <span className="text-xs font-normal text-mist-400">({t("you")})</span>}
              </div>
              <div className="text-xs text-mist-400">{r.songs ? t("boardSongs", { n: r.songs, stars: r.starred }) : t("boardIdle")}</div>
            </div>
            <div className="text-right text-lg font-extrabold tabular-nums">{r.score.toLocaleString()}</div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-mist-400/80">{t("boardHint")}</p>
    </div>
  );
}

function handLabel(t: ReturnType<typeof useT>, d: Duel): string {
  return d.hand === "right" ? t("trackRightHand") : d.hand === "left" ? t("trackLeftHand") : t("duelBothHands");
}

function DuelRow({ d }: { d: Duel }) {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const title = builtinTitle(d.song_id, lang);
  const meta = `${handLabel(t, d)} · ${Math.round(d.speed * 100)}%`;
  if (d.status === "open" && !d.mine) {
    return (
      <li className="rounded-2xl bg-amber-400/10 px-3 py-2.5 ring-1 ring-amber-300/25">
        <div className="text-sm">{t("duelIncoming", { name: d.friend ?? "?", song: title })}</div>
        <div className="mt-0.5 text-xs text-mist-400">
          {t("duelToBeat", { score: d.from_score.toLocaleString(), acc: pct(d.from_accuracy) })} · {meta}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => void declineDuel(d.id)}>
            {t("decline")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => void playDuel(d)}>
            <IconPlay size={14} /> {t("duelPlay")}
          </Button>
        </div>
      </li>
    );
  }
  if (d.status === "open") {
    return (
      <li className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{t("duelWaiting", { name: d.friend ?? "?", song: title })}</div>
          <div className="text-xs text-mist-400">
            {d.from_score.toLocaleString()} · {meta}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void declineDuel(d.id)} aria-label={t("cancel")}>
          <IconClose size={14} />
        </Button>
      </li>
    );
  }
  if (d.status === "declined") {
    return (
      <li className="rounded-2xl bg-white/[0.02] px-3 py-2 text-xs text-mist-400">{t("duelDeclined", { name: d.friend ?? "?", song: title })}</li>
    );
  }
  const mine = d.mine ? d.from_score : d.to_score ?? 0;
  const theirs = d.mine ? d.to_score ?? 0 : d.from_score;
  const outcome = mine > theirs ? "win" : mine < theirs ? "lose" : "tie";
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <span
        className={cx(
          "rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase",
          outcome === "win" ? "bg-emerald-400/20 text-emerald-200" : outcome === "lose" ? "bg-rose-400/15 text-rose-200" : "bg-white/10 text-mist-200"
        )}
      >
        {t(outcome === "win" ? "duelWon" : outcome === "lose" ? "duelLost" : "duelTie")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">
          {title} · @{d.friend ?? "?"}
        </div>
        <div className="text-xs tabular-nums text-mist-400">
          {t("you")} {mine.toLocaleString()} – {theirs.toLocaleString()}
        </div>
      </div>
    </li>
  );
}

function Duels({ duels }: { duels: Duel[] }) {
  const t = useT();
  const invites = useApp((s) => s.social?.duet_invites) ?? [];
  const lang = useApp((s) => s.settings.language);
  if (!duels.length && !invites.length) return <Empty icon={<IconSwords size={28} />}>{t("duelsEmpty")}</Empty>;
  const order = (d: Duel) => (d.status === "open" && !d.mine ? 0 : d.status === "open" ? 1 : 2);
  return (
    <ul className="space-y-1.5">
      {invites.map((i) => (
        <li key={`inv-${i.id}`} className="flex items-center gap-3 rounded-2xl bg-fuchsia-400/10 px-3 py-2.5 ring-1 ring-fuchsia-300/25">
          <IconDuet size={20} className="shrink-0 text-fuchsia-300" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{t("duetInviteBanner", { name: i.friend ?? "?" })}</div>
            <div className="truncate text-xs text-mist-400">{builtinTitle(i.song_id, lang)}</div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              void dismissDuetInvite(i.id);
              joinDuet(i.code);
            }}
          >
            {t("duetJoin")}
          </Button>
        </li>
      ))}
      {[...duels]
        .sort((a, b) => order(a) - order(b))
        .map((d) => (
          <DuelRow key={d.id} d={d} />
        ))}
    </ul>
  );
}

/** Opens a room with the current song (or reuses mine) and calls the friend into it. */
async function duetWith(id: string, name: string | null): Promise<void> {
  const room = hostDuet();
  if (room?.songId) await inviteToDuet(id, name);
}

function DuetEntry() {
  const t = useT();
  const room = useApp((s) => s.duet);
  return (
    <button
      type="button"
      onClick={() => setPanel("duet")}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-fuchsia-400/15 to-brand-500/15 px-3 py-2.5 text-left ring-1 ring-fuchsia-300/25 hover:ring-fuchsia-300/45"
    >
      <IconDuet size={24} className="shrink-0 text-fuchsia-300" />
      <div className="min-w-0 flex-1">
        <div className="font-bold">{t("duet")}</div>
        <div className="truncate text-xs text-mist-400">{room ? `${t("duetRoomCode")}: ${room.code}` : t("duetEntryHint")}</div>
      </div>
      <IconPlay size={14} className="text-mist-400" />
    </button>
  );
}

/** Remove / report / block, folded into one button per member. */
function MemberMenu({ member, onRemove, onReport }: { member: FriendRef; onRemove?: () => void; onReport: () => void }) {
  const t = useT();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const item = "flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold transition-colors hover:bg-white/[0.07]";
  return (
    <Popover
      label={t("memberActions")}
      align="end"
      trigger={({ open, toggle, ref }) => (
        <IconButton
          size="sm"
          label={t("memberActions")}
          active={open}
          ref={ref}
          aria-expanded={open}
          onClick={() => {
            setConfirmBlock(false);
            toggle();
          }}
        >
          <IconMore size={16} />
        </IconButton>
      )}
    >
      {(close) => (
        <div className="-m-1 w-52 space-y-0.5">
          {onRemove && (
            <button
              type="button"
              className={item}
              onClick={() => {
                close();
                onRemove();
              }}
            >
              <IconClose size={15} className="text-mist-400" /> {t("friendRemove")}
            </button>
          )}
          <button
            type="button"
            className={item}
            onClick={() => {
              close();
              onReport();
            }}
          >
            <IconFlag size={15} className="text-amber-300" /> {t("reportUser")}
          </button>
          {confirmBlock ? (
            <button
              type="button"
              className={cx(item, "bg-rose-500/20 text-rose-100 hover:bg-rose-500/30")}
              onClick={() => {
                close();
                void blockUser(member.id).then((r) => (r.ok ? toast(t("blockedToast", { name: member.username ?? "?" }), "success") : toastSocialError(r.error)));
              }}
            >
              <IconBan size={15} /> {t("blockConfirm")}
            </button>
          ) : (
            <button type="button" className={cx(item, "text-rose-200")} onClick={() => setConfirmBlock(true)}>
              <IconBan size={15} /> {t("blockUser")}
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}

function Friends() {
  const t = useT();
  const social = useApp((s) => s.social)!;
  const friends = social.board.filter((r) => !r.is_me);
  const blocked = social.blocked ?? [];
  const [confirm, setConfirm] = useState<string | null>(null);
  const [reporting, setReporting] = useState<FriendRef | null>(null);
  return (
    <div className="space-y-4">
      <ReportDialog target={reporting} onClose={() => setReporting(null)} />
      {social.incoming.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("friendRequests")}</h3>
          <ul className="space-y-1.5">
            {social.incoming.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-2xl bg-sky-400/10 px-3 py-2 ring-1 ring-sky-300/25">
                <Avatar name={f.username} path={f.avatar} />
                <div className="min-w-0 flex-1 truncate font-semibold">@{f.username ?? "?"}</div>
                <Button size="sm" variant="ghost" onClick={() => void respondFriend(f.id, false)}>
                  {t("decline")}
                </Button>
                <Button size="sm" variant="primary" onClick={() => void respondFriend(f.id, true)}>
                  <IconCheck size={14} /> {t("accept")}
                </Button>
                <MemberMenu member={f} onReport={() => setReporting(f)} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="mb-2 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">
          {t("friendsList")} · {friends.length}
        </h3>
        {friends.length === 0 ? (
          <Empty icon={<IconUsers size={28} />}>{t("friendsEmpty")}</Empty>
        ) : (
          <ul className="space-y-1.5">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2">
                <Avatar name={f.username} path={f.avatar} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">@{f.username ?? "?"}</div>
                  <div className="text-xs text-mist-400">{t("friendWeek", { score: f.score.toLocaleString() })}</div>
                </div>
                {confirm === f.id ? (
                  <Button size="sm" variant="danger" onClick={() => void removeFriend(f.id).then(() => setConfirm(null))}>
                    {t("friendRemoveConfirm")}
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={() => void duetWith(f.id, f.username)}>
                      <IconDuet size={14} /> {t("duetShort")}
                    </Button>
                    <MemberMenu member={f} onRemove={() => setConfirm(f.id)} onReport={() => setReporting(f)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {blocked.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">
            {t("blockedList")} · {blocked.length}
          </h3>
          <ul className="space-y-1.5">
            {blocked.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.02] px-3 py-2 text-sm text-mist-300">
                <IconBan size={15} className="shrink-0 text-rose-300/70" />
                <span className="min-w-0 flex-1 truncate">@{f.username ?? "?"}</span>
                <Button size="sm" variant="ghost" onClick={() => void unblockUser(f.id)}>
                  {t("unblock")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {social.outgoing.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold tracking-[0.12em] text-mist-400 uppercase">{t("friendsPending")}</h3>
          <ul className="space-y-1.5">
            {social.outgoing.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.02] px-3 py-2 text-sm text-mist-300">
                <span className="min-w-0 flex-1 truncate">@{f.username ?? "?"}</span>
                <Button size="sm" variant="ghost" onClick={() => void removeFriend(f.id)}>
                  {t("cancel")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function FriendsDialog() {
  const t = useT();
  const open = useApp((s) => s.panel === "friends");
  const account = useApp((s) => s.account);
  const social = useApp((s) => s.social);
  const loading = useApp((s) => s.socialLoading);
  const [tab, setTab] = useState<Tab>("board");
  const close = () => setPanel(null);

  const incomingDuels = (social?.duels.filter((d) => !d.mine && d.status === "open").length ?? 0) + (social?.duet_invites?.length ?? 0);
  const signedIn = account.status === "signedIn";
  const username = social?.me?.username ?? account.username;
  const invitedBy = useApp((s) => s.friendInvite);

  let body: ReactNode;
  if (account.status === "disabled") body = <Empty icon={<IconUsers size={28} />}>{t("friendsUnavailable")}</Empty>;
  else if (!signedIn)
    body = (
      <div className="rounded-2xl bg-gradient-to-br from-sky-400/20 to-brand-500/15 p-4 text-center ring-1 ring-sky-300/30">
        {invitedBy ? <IconGift size={30} className="mx-auto text-amber-300" /> : <IconUsers size={30} className="mx-auto text-sky-300" />}
        <div className="mt-2 font-bold">{invitedBy ? t("referralInvitedTitle", { name: invitedBy }) : t("friendsSignInTitle")}</div>
        <p className="mt-1 text-sm text-mist-300">{invitedBy ? t("referralInvitedBody", { days: TRIAL_DAYS + 1 }) : t("friendsSignInBody")}</p>
        <Button className="mt-3" variant="primary" onClick={() => setPanel("account")}>
          <IconUser size={15} /> {t("signIn")} / {t("signUp")}
        </Button>
      </div>
    );
  else if (!username) body = <UsernameForm />;
  else if (!social) body = <Empty icon={<IconUsers size={28} />}>{loading ? t("loading") : t("friendsOffline")}</Empty>;
  else
    body = (
      <>
        <AddFriend me={username} />
        <Segmented
          label={t("friends")}
          className="my-4 w-full [&>*]:flex-1"
          value={tab}
          onChange={setTab}
          options={[
            { value: "board", label: t("boardTab") },
            { value: "duels", label: incomingDuels ? `${t("duelsTab")} · ${incomingDuels}` : t("duelsTab") },
            { value: "friends", label: social.incoming.length ? `${t("friendsTab")} · ${social.incoming.length}` : t("friendsTab") },
          ]}
        />
        {tab === "board" && <Board rows={social.board} />}
        {tab === "duels" && <Duels duels={social.duels} />}
        {tab === "friends" && <Friends />}
      </>
    );

  return (
    <Dialog open={open} onClose={close} title={t("friends")} width="max-w-lg" closeLabel={t("close")}>
      {account.status !== "disabled" && <DuetEntry />}
      {body}
    </Dialog>
  );
}
