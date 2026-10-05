-- Personal profile: a picture friends see, and a username that can change at most once every six months.

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists username_changed_at timestamptz;

-- Profile pictures are public (friends lists and leaderboards show them); each user writes only their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 262144, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: read own" on storage.objects;
create policy "avatars: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: insert own" on storage.objects;
create policy "avatars: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.set_avatar(p_path text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_path is not null and p_path !~ ('^' || me::text || '/[0-9]{10,16}\.(webp|jpg|png)$') then raise exception 'bad_path'; end if;
  update public.profiles set avatar_path = p_path where id = me;
end;
$$;

revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;

-- Picking the first username is free; after that it can change once every six months.
create or replace function public.change_username(p_name text)
returns timestamptz language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  n text := btrim(coalesce(p_name, ''));
  cur text;
  changed timestamptz;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if n !~ '^[A-Za-z0-9_.]{3,24}$' then raise exception 'bad_username'; end if;
  select p.username, p.username_changed_at into cur, changed from public.profiles p where p.id = me;
  if cur = n then return changed; end if;
  if cur is not null and changed is not null and changed > now() - interval '6 months' then raise exception 'username_cooldown'; end if;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(n) and p.id <> me) then raise exception 'username_taken'; end if;
  insert into public.profiles (id, username) values (me, n)
  on conflict (id) do update
    set username = excluded.username,
        username_changed_at = case when public.profiles.username is null then public.profiles.username_changed_at else now() end;
  return (select p.username_changed_at from public.profiles p where p.id = me);
end;
$$;

revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

-- Friends' pictures in the overview.
create or replace function public.social_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  me uuid := (select auth.uid());
  wk date := public.current_week();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'week', wk,
    'me', (select jsonb_build_object('id', me, 'username', p.username, 'avatar', p.avatar_path) from public.profiles p where p.id = me),
    'board', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.score desc, b.username)
      from (
        select u.id, p.username, p.avatar_path as avatar, u.id = me as is_me,
               coalesce(sum(w.score), 0)::bigint as score,
               count(w.song_id)::int as songs,
               coalesce(sum(case when w.stars >= 3 then 1 else 0 end), 0)::int as starred
        from (select me as id union select f.friend_id from public.friendships f where f.user_id = me and f.status = 'accepted') u
        join public.profiles p on p.id = u.id
        left join public.weekly_scores w on w.user_id = u.id and w.week = wk
        group by u.id, p.username, p.avatar_path
      ) b
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.user_id, 'username', p.username, 'avatar', p.avatar_path) order by f.created_at desc)
      from public.friendships f join public.profiles p on p.id = f.user_id
      where f.friend_id = me and f.status = 'pending'
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.friend_id, 'username', p.username, 'avatar', p.avatar_path) order by f.created_at desc)
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
$function$;
