import { tNow } from "../i18n";
import type { SocialOverview } from "./social";

/** What arrived between two overviews: new friend requests, accepted requests of mine, new challenges. */
export function socialNews(prev: SocialOverview, next: SocialOverview): string[] {
  const ids = (list: { id: string }[]) => new Set(list.map((f) => f.id));
  const name = (n: string | null | undefined) => n ?? "?";
  const incoming = ids(prev.incoming);
  const outgoing = ids(prev.outgoing);
  const friends = ids(prev.board);
  const duels = new Set(prev.duels.map((d) => d.id));
  return [
    ...next.incoming.filter((f) => !incoming.has(f.id)).map((f) => tNow("notifyFriendRequest", { name: name(f.username) })),
    ...next.board
      .filter((f) => outgoing.has(f.id) && !friends.has(f.id))
      .map((f) => tNow("notifyFriendAccepted", { name: name(f.username) })),
    ...next.duels
      .filter((d) => !d.mine && d.status === "open" && !duels.has(d.id))
      .map((d) => tNow("notifyDuel", { name: name(d.friend) })),
  ];
}
