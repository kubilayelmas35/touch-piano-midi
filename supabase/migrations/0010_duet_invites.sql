-- Live duet invitations between friends: a room code to join, valid for 15 minutes. The duet itself runs over a
-- Realtime broadcast channel; this table only carries the invitation (with the sender checked to be a friend).

create table if not exists public.duet_invites (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[A-Z2-9]{5}$'),
  song_id text not null check (char_length(song_id) between 1 and 80),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index if not exists duet_invites_to_idx on public.duet_invites (to_id, created_at desc);
create index if not exists duet_invites_from_idx on public.duet_invites (from_id, created_at desc);
alter table public.duet_invites enable row level security;
revoke all on public.duet_invites from anon, authenticated;
grant all on public.duet_invites to service_role;

create or replace function public.duet_invite(p_friend uuid, p_code text, p_song text)
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  new_id bigint;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not public.are_friends(me, p_friend) then raise exception 'not_friends'; end if;
  if (select count(*) from public.duet_invites i where i.from_id = me and i.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  -- One live invitation per friend: a new one replaces the old.
  delete from public.duet_invites where from_id = me and to_id = p_friend;
  delete from public.duet_invites where created_at < now() - interval '1 day';
  insert into public.duet_invites (from_id, to_id, code, song_id)
  values (me, p_friend, upper(p_code), left(p_song, 80))
  returning id into new_id;
  return new_id;
end;
$$;

-- Clears an invitation once it was answered (either side may).
create or replace function public.duet_invite_dismiss(p_id bigint)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.duet_invites
  where id = p_id and (to_id = (select auth.uid()) or from_id = (select auth.uid()));
end;
$$;

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
    ), '[]'::jsonb),
    'duet_invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'friend', p.username, 'friend_id', i.from_id, 'code', i.code,
                                          'song_id', i.song_id, 'created_at', i.created_at) order by i.created_at desc)
      from public.duet_invites i join public.profiles p on p.id = i.from_id
      where i.to_id = me and i.created_at > now() - interval '15 minutes' and public.are_friends(me, i.from_id)
    ), '[]'::jsonb)
  );
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array['duet_invite(uuid, text, text)', 'duet_invite_dismiss(bigint)', 'social_overview()'] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
