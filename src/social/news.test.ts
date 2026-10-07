import { describe, expect, it } from "vitest";
import { socialNews } from "./news";
import type { Duel, SocialOverview } from "./social";

const overview = (o: Partial<SocialOverview> = {}): SocialOverview => ({
  week: "2026-10-05",
  me: { id: "me", username: "me" },
  board: [{ id: "me", username: "me", is_me: true, score: 0, songs: 0, starred: 0 }],
  incoming: [],
  outgoing: [],
  duels: [],
  ...o,
});

const friend = (id: string) => ({ id, username: id, is_me: false, score: 0, songs: 0, starred: 0 });

const duel = (id: number, mine: boolean): Duel => ({
  id,
  song_id: "ode",
  instrument: "piano",
  speed: 1,
  hand: "both",
  status: "open",
  created_at: "",
  done_at: null,
  mine,
  friend: "ayse",
  friend_id: "ayse",
  from_score: 100,
  from_accuracy: 0.9,
  to_score: null,
  to_accuracy: null,
});

describe("social news", () => {
  it("announces a new friend request, an accepted request and a new challenge", () => {
    const prev = overview({ outgoing: [{ id: "ali", username: "ali" }] });
    const next = overview({
      incoming: [{ id: "ayse", username: "ayse" }],
      board: [...prev.board, friend("ali")],
      duels: [duel(1, false)],
    });
    expect(socialNews(prev, next)).toHaveLength(3);
  });

  it("stays quiet about what was already there and about my own actions", () => {
    const prev = overview({ incoming: [{ id: "ayse", username: "ayse" }], duels: [duel(1, false)] });
    // I accepted Ayşe (incoming → board) and sent a challenge myself.
    const next = overview({ board: [...prev.board, friend("ayse")], duels: [duel(1, false), duel(2, true)] });
    expect(socialNews(prev, next)).toEqual([]);
    expect(socialNews(next, next)).toEqual([]);
  });
});
