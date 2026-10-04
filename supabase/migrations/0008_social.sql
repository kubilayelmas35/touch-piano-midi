-- Friends, weekly scores and score duels. Tables are closed to clients; everything goes through the
-- security-definer functions below, which only ever reveal a friend's username and scores.

create table if not exists public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  -- A request is one 'pending' row (requester → target); accepting stores both directions as 'accepted'.
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friendships_friend_idx on public.friendships (friend_id);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant all on public.friendships to service_role;

-- Best score per user, song and instrument in each week (weeks start on Monday, UTC).
create table if not exists public.weekly_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  week date not null,
  song_id text not null check (char_length(song_id) between 1 and 80),
  instrument text not null check (instrument in ('piano', 'guitar', 'violin')),
  score integer not null check (score between 0 and 50000000),
  accuracy real not null check (accuracy between 0 and 1),
  stars smallint not null check (stars between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, week, song_id, instrument)
);
create index if not exists weekly_scores_week_song_idx on public.weekly_scores (week, song_id);
alter table public.weekly_scores enable row level security;
revoke all on public.weekly_scores from anon, authenticated;
grant all on public.weekly_scores to service_role;

-- A challenge on one song with the challenger's settings; the friend answers with their own run.
create table if not exists public.duels (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  song_id text not null check (char_length(song_id) between 1 and 80),
  instrument text not null check (instrument in ('piano', 'guitar', 'violin')),
  speed real not null check (speed between 0.25 and 2),
  hand text not null check (hand in ('both', 'left', 'right')),
  from_score integer not null check (from_score between 0 and 50000000),
  from_accuracy real not null check (from_accuracy between 0 and 1),
  to_score integer check (to_score between 0 and 50000000),
  to_accuracy real check (to_accuracy between 0 and 1),
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  check (from_id <> to_id)
);
create index if not exists duels_to_idx on public.duels (to_id, status);
create index if not exists duels_from_idx on public.duels (from_id, status);
alter table public.duels enable row level security;
revoke all on public.duels from anon, authenticated;
grant all on public.duels to service_role;

create or replace function public.current_week()
returns date language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'utc')::date;
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.user_id = a and f.friend_id = b and f.status = 'accepted');
$$;

create or replace function public.friend_request(p_username text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  other uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if (select p.username from public.profiles p where p.id = me) is null then raise exception 'need_username'; end if;
  select p.id into other from public.profiles p where lower(p.username) = lower(btrim(coalesce(p_username, '')));
  if other is null then raise exception 'not_found'; end if;
  if other = me then raise exception 'self'; end if;
  if public.are_friends(me, other) then return 'already'; end if;
  -- They already asked us: asking back accepts.
  if exists (select 1 from public.friendships f where f.user_id = other and f.friend_id = me and f.status = 'pending') then
    update public.friendships set status = 'accepted' where user_id = other and friend_id = me;
    insert into public.friendships (user_id, friend_id, status) values (me, other, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
    return 'accepted';
  end if;
  if (select count(*) from public.friendships f
      where f.user_id = me and f.status = 'pending' and f.created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into public.friendships (user_id, friend_id, status) values (me, other, 'pending')
  on conflict (user_id, friend_id) do nothing;
  return 'sent';
end;
$$;

create or replace function public.friend_respond(p_user uuid, p_accept boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.friendships f where f.user_id = p_user and f.friend_id = me and f.status = 'pending') then
    return;
  end if;
  if p_accept then
    update public.friendships set status = 'accepted' where user_id = p_user and friend_id = me;
    insert into public.friendships (user_id, friend_id, status) values (me, p_user, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
  else
    delete from public.friendships where user_id = p_user and friend_id = me;
  end if;
end;
$$;

-- Unfriends, or cancels a request either way.
create or replace function public.friend_remove(p_user uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  delete from public.friendships
  where (user_id = me and friend_id = p_user) or (user_id = p_user and friend_id = me);
  update public.duels set status = 'declined'
  where status = 'open' and ((from_id = me and to_id = p_user) or (from_id = p_user and to_id = me));
end;
$$;

-- Everything the friends screen needs in one call: requests, the weekly board (friends and me) and duels.
create or replace function public.social_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  wk date := public.current_week();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'week', wk,
    'me', (select jsonb_build_object('id', me, 'username', p.username) from public.profiles p where p.id = me),
    'board', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.score desc, b.username)
      from (
        select u.id, p.username, u.id = me as is_me,
               coalesce(sum(w.score), 0)::bigint as score,
               count(w.song_id)::int as songs,
               coalesce(sum(case when w.stars >= 3 then 1 else 0 end), 0)::int as starred
        from (select me as id union select f.friend_id from public.friendships f where f.user_id = me and f.status = 'accepted') u
        join public.profiles p on p.id = u.id
        left join public.weekly_scores w on w.user_id = u.id and w.week = wk
        group by u.id, p.username
      ) b
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.user_id, 'username', p.username) order by f.created_at desc)
      from public.friendships f join public.profiles p on p.id = f.user_id
      where f.friend_id = me and f.status = 'pending'
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.friend_id, 'username', p.username) order by f.created_at desc)
      from public.friendships f join public.profiles p on p.id = f.friend_id
      where f.user_id = me and f.status = 'pending'
    ), '[]'::jsonb),
    'duels', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.created_at desc)
      from (
        select x.id, x.song_id, x.instrument, x.speed, x.hand, x.status, x.created_at, x.done_at,
               x.from_id = me as mine,
               case when x.from_id = me then pt.username else pf.username end as friend,
               case when x.from_id = me then x.to_id else x.from_id end as friend_id,
               x.from_score, x.from_accuracy, x.to_score, x.to_accuracy
        from public.duels x
        join public.profiles pf on pf.id = x.from_id
        join public.profiles pt on pt.id = x.to_id
        where (x.from_id = me or x.to_id = me)
          and (x.status = 'open' or x.done_at > now() - interval '14 days')
        order by x.created_at desc
        limit 40
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

-- Records a finished run (keeps the week's best) and returns friends' best on that song this week.
create or replace function public.submit_score(p_song text, p_instrument text, p_score integer, p_accuracy real, p_stars integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  wk date := public.current_week();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from public.weekly_scores w where w.user_id = me and w.updated_at > now() - interval '1 hour') < 200 then
    insert into public.weekly_scores as w (user_id, week, song_id, instrument, score, accuracy, stars)
    values (me, wk, left(p_song, 80), p_instrument, greatest(0, least(p_score, 50000000)),
            greatest(0, least(p_accuracy, 1)), greatest(0, least(p_stars, 5)))
    on conflict (user_id, week, song_id, instrument) do update
      set score = excluded.score, accuracy = excluded.accuracy, stars = excluded.stars, updated_at = now()
      where excluded.score > w.score;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('username', p.username, 'score', w.score, 'stars', w.stars, 'is_me', w.user_id = me)
                     order by w.score desc)
    from public.weekly_scores w join public.profiles p on p.id = w.user_id
    where w.week = wk and w.song_id = p_song and w.instrument = p_instrument
      and (w.user_id = me or public.are_friends(me, w.user_id))
  ), '[]'::jsonb);
end;
$$;

create or replace function public.duel_create(p_friend uuid, p_song text, p_instrument text, p_speed real, p_hand text,
                                              p_score integer, p_accuracy real)
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  new_id bigint;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not public.are_friends(me, p_friend) then raise exception 'not_friends'; end if;
  if (select count(*) from public.duels d where d.from_id = me and d.to_id = p_friend and d.status = 'open') >= 5 then
    raise exception 'too_many_duels';
  end if;
  insert into public.duels (from_id, to_id, song_id, instrument, speed, hand, from_score, from_accuracy)
  values (me, p_friend, left(p_song, 80), p_instrument, p_speed, p_hand,
          greatest(0, least(p_score, 50000000)), greatest(0, least(p_accuracy, 1)))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.duel_answer(p_id bigint, p_score integer, p_accuracy real)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  update public.duels x
     set to_score = greatest(0, least(p_score, 50000000)), to_accuracy = greatest(0, least(p_accuracy, 1)),
         status = 'done', done_at = now()
   where x.id = p_id and x.to_id = me and x.status = 'open'
  returning * into d;
  if d.id is null then raise exception 'duel_closed'; end if;
  return jsonb_build_object('id', d.id, 'from_score', d.from_score, 'to_score', d.to_score,
                            'from_accuracy', d.from_accuracy, 'to_accuracy', d.to_accuracy);
end;
$$;

create or replace function public.duel_decline(p_id bigint)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.duels set status = 'declined', done_at = now()
  where id = p_id and status = 'open' and (to_id = (select auth.uid()) or from_id = (select auth.uid()));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'friend_request(text)', 'friend_respond(uuid, boolean)', 'friend_remove(uuid)', 'social_overview()',
    'submit_score(text, text, integer, real, integer)',
    'duel_create(uuid, text, text, real, text, integer, real)', 'duel_answer(bigint, integer, real)', 'duel_decline(bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.current_week() from public, anon;
grant execute on function public.current_week() to authenticated;
