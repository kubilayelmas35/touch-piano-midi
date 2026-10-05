-- A week of Pro for new accounts, +1 day for both sides of an invite, reporting / blocking members,
-- first-party error logs, and the admin views for all of it.

alter table public.profiles
  add column if not exists trial_until timestamptz,
  add column if not exists referred_by uuid references auth.users (id) on delete set null,
  add column if not exists referral_days integer not null default 0;

-- The client reads its own profile row; these columns were missing from the column grant.
grant select (avatar_path, username_changed_at, trial_until, referred_by, referral_days) on public.profiles to authenticated;

-- ------------------------------------------------------------------ trial

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  wanted text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  if wanted is not null
     and (wanted !~ '^[A-Za-z0-9_.]{3,24}$'
          or exists (select 1 from public.profiles p where lower(p.username) = lower(wanted))) then
    wanted := null;
  end if;
  insert into public.profiles (id, username, trial_until) values (new.id, wanted, now() + interval '7 days')
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- Accounts made before trials existed get their week starting now.
update public.profiles set trial_until = now() + interval '7 days' where not pro and trial_until is null;

create or replace function public.has_cloud()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.cloud or p.pro or coalesce(p.trial_until > now(), false)
                   from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function public.cloud_room_for(extra bigint, song text)
returns boolean language sql stable security definer set search_path = '' as $$
  select extra between 1 and 1048576 and coalesce((
    select case
      when p.cloud then
        coalesce((select sum(m.size_bytes) from public.cloud_midis m
                  where m.user_id = p.id and m.song_id <> song), 0) + extra <= p.cloud_quota_mb::bigint * 1048576
      when p.pro or coalesce(p.trial_until > now(), false) then
        (select count(*) from public.cloud_midis m where m.user_id = p.id and m.song_id <> song) < 10
      else false
    end
    from public.profiles p where p.id = (select auth.uid())
  ), false);
$$;

-- --------------------------------------------------------------- referral

-- Called by a new account (at most 3 days old) that arrived through a friend's invite link:
-- both get a day of Pro (the inviter at most 30 days in total) and become friends.
create or replace function public.claim_referral(p_inviter text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  inv uuid;
  inv_name text;
  joined timestamptz;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select u.created_at into joined from auth.users u where u.id = me;
  if joined < now() - interval '3 days' then return jsonb_build_object('ok', false, 'reason', 'too_old'); end if;
  if (select p.referred_by from public.profiles p where p.id = me) is not null then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  select p.id, p.username into inv, inv_name from public.profiles p where lower(p.username) = lower(btrim(coalesce(p_inviter, '')));
  if inv is null or inv = me then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  insert into public.profiles (id) values (me) on conflict (id) do nothing;
  update public.profiles
     set referred_by = inv,
         trial_until = greatest(coalesce(trial_until, now()), now()) + interval '1 day'
   where id = me;
  update public.profiles
     set trial_until = greatest(coalesce(trial_until, now()), now()) + interval '1 day',
         referral_days = referral_days + 1
   where id = inv and referral_days < 30;

  if not exists (select 1 from public.blocks b where (b.user_id = me and b.blocked_id = inv) or (b.user_id = inv and b.blocked_id = me)) then
    insert into public.friendships (user_id, friend_id, status) values (me, inv, 'accepted'), (inv, me, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
  end if;
  return jsonb_build_object('ok', true, 'inviter', inv_name);
end;
$$;

-- ---------------------------------------------------------- report / block

create table if not exists public.blocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('avatar', 'username', 'harassment', 'cheating', 'spam', 'other')),
  details text,
  target_username text,
  target_avatar text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create index if not exists reports_target_idx on public.reports (target_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;

create or replace function public.report_user(p_user uuid, p_reason text, p_details text)
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  rid bigint;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_user is null or p_user = me then raise exception 'self'; end if;
  if p_reason not in ('avatar', 'username', 'harassment', 'cheating', 'spam', 'other') then raise exception 'bad_reason'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user) then raise exception 'not_found'; end if;
  select r.id into rid from public.reports r where r.reporter_id = me and r.target_id = p_user and r.status = 'open';
  if rid is not null then
    update public.reports set reason = p_reason, details = nullif(left(btrim(coalesce(p_details, '')), 1000), '') where id = rid;
    return rid;
  end if;
  if (select count(*) from public.reports r where r.reporter_id = me and r.created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited';
  end if;
  insert into public.reports (reporter_id, target_id, reason, details, target_username, target_avatar)
  select me, p_user, p_reason, nullif(left(btrim(coalesce(p_details, '')), 1000), ''), p.username, p.avatar_path
  from public.profiles p where p.id = p_user
  returning id into rid;
  return rid;
end;
$$;

-- Blocking ends the friendship, drops open challenges and invites, and stops new requests either way.
create or replace function public.block_user(p_user uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_user is null or p_user = me then raise exception 'self'; end if;
  insert into public.blocks (user_id, blocked_id) values (me, p_user) on conflict do nothing;
  delete from public.friendships where (user_id = me and friend_id = p_user) or (user_id = p_user and friend_id = me);
  update public.duels set status = 'declined', done_at = now()
   where status = 'open' and ((from_id = me and to_id = p_user) or (from_id = p_user and to_id = me));
  delete from public.duet_invites where (from_id = me and to_id = p_user) or (from_id = p_user and to_id = me);
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  delete from public.blocks where user_id = (select auth.uid()) and blocked_id = p_user;
end;
$$;

create or replace function public.friend_request(p_username text)
returns text language plpgsql security definer set search_path = '' as $function$
declare
  me uuid := (select auth.uid());
  other uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if (select p.username from public.profiles p where p.id = me) is null then raise exception 'need_username'; end if;
  select p.id into other from public.profiles p where lower(p.username) = lower(btrim(coalesce(p_username, '')));
  if other is null then raise exception 'not_found'; end if;
  if other = me then raise exception 'self'; end if;
  if exists (select 1 from public.blocks b where (b.user_id = other and b.blocked_id = me) or (b.user_id = me and b.blocked_id = other)) then
    raise exception 'not_found';
  end if;
  if public.are_friends(me, other) then return 'already'; end if;
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
$function$;

-- The overview also lists who I've blocked, so they can be unblocked.
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
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.blocked_id, 'username', p.username, 'avatar', p.avatar_path) order by b.created_at desc)
      from public.blocks b join public.profiles p on p.id = b.blocked_id
      where b.user_id = me
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

-- ------------------------------------------------------------- error logs

create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  fingerprint text not null,
  kind text,
  message text not null,
  stack text,
  url text,
  app_version text,
  platform text,
  language text,
  device text
);
create index if not exists error_logs_created_idx on public.error_logs (created_at desc);
create index if not exists error_logs_fp_idx on public.error_logs (fingerprint, created_at desc);
create index if not exists error_logs_user_idx on public.error_logs (user_id);
alter table public.error_logs enable row level security;

-- Anyone (signed in or not) may report an error; floods are capped and rows older than 90 days are dropped.
create or replace function public.log_error(p_kind text, p_message text, p_stack text, p_url text,
                                            p_app_version text, p_platform text, p_language text, p_device text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  msg text := left(btrim(coalesce(p_message, '')), 500);
  fp text;
begin
  if msg = '' then return; end if;
  fp := md5(coalesce(left(p_kind, 40), '') || ':' || left(regexp_replace(msg, '[0-9]+', 'N', 'g'), 300));
  if (select count(*) from public.error_logs e where e.created_at > now() - interval '1 minute') >= 200 then return; end if;
  if (select count(*) from public.error_logs e where e.fingerprint = fp and e.created_at > now() - interval '1 hour') >= 100 then return; end if;
  insert into public.error_logs (user_id, fingerprint, kind, message, stack, url, app_version, platform, language, device)
  values ((select auth.uid()), fp, left(p_kind, 40), msg, left(p_stack, 4000), left(p_url, 300), left(p_app_version, 40),
          left(p_platform, 40), left(p_language, 10), left(p_device, 300));
  if random() < 0.02 then delete from public.error_logs where created_at < now() - interval '90 days'; end if;
end;
$$;

-- ------------------------------------------------------------------ admin

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  r jsonb;
  wk date := public.current_week();
begin
  perform public.admin_assert();
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'pro', (select count(*) from public.profiles where pro),
    'cloud', (select count(*) from public.profiles where cloud),
    'admins', (select count(*) from public.profiles where is_admin),
    'unconfirmed', (select count(*) from auth.users where email_confirmed_at is null),
    'banned', (select count(*) from auth.users where banned_until > now()),
    'new7', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new30', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active1', (select count(*) from auth.users where last_sign_in_at > now() - interval '1 day'),
    'active7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'active30', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'files', (select count(*) from public.cloud_midis),
    'bytes', (select coalesce(sum(size_bytes), 0) from public.cloud_midis),
    'trial', (select count(*) from public.profiles where not pro and trial_until > now()),
    'trialEnded', (select count(*) from public.profiles where not pro and trial_until <= now()),
    'trialConverted', (select count(*) from public.profiles where pro and trial_until is not null and pro_since is not null),
    'referrals', (select count(*) from public.profiles where referred_by is not null),
    'referrals7', (select count(*) from public.profiles p join auth.users u on u.id = p.id
                   where p.referred_by is not null and u.created_at > now() - interval '7 days'),
    'reportsOpen', (select count(*) from public.reports where status = 'open'),
    'errors24', (select count(*) from public.error_logs where created_at > now() - interval '1 day'),
    'errorUsers24', (select count(distinct coalesce(user_id::text, device)) from public.error_logs where created_at > now() - interval '1 day'),
    'purchases7', (select count(*) from public.purchases where created_at > now() - interval '7 days'),
    'purchases30', (select count(*) from public.purchases where created_at > now() - interval '30 days'),
    'avatars', (select count(*) from public.profiles where avatar_path is not null),
    'friendships', (select count(*) / 2 from public.friendships where status = 'accepted'),
    'duels7', (select count(*) from public.duels where created_at > now() - interval '7 days'),
    'feedbackNew', (select count(*) from public.feedback where status = 'new'),
    'providers', (select coalesce(jsonb_object_agg(x.provider, x.n), '{}'::jsonb)
                  from (select i.provider, count(distinct i.user_id) as n from auth.identities i group by i.provider) x),
    'proSources', (select coalesce(jsonb_object_agg(y.src, y.n), '{}'::jsonb)
                   from (select coalesce(pro_source, 'unknown') as src, count(*) as n from public.profiles where pro group by 1) y),
    'platforms', (select coalesce(jsonb_object_agg(z.platform, z.n), '{}'::jsonb)
                  from (select coalesce(e.platform, '?') as platform, count(*) as n from public.error_logs e
                        where e.created_at > now() - interval '7 days' group by 1) z),
    'topSongs', (select coalesce(jsonb_agg(jsonb_build_object('song', s.song_id, 'players', s.players, 'best', s.best) order by s.players desc, s.best desc), '[]'::jsonb)
                 from (select w.song_id, count(distinct w.user_id) as players, max(w.score) as best
                       from public.weekly_scores w where w.week = wk group by w.song_id order by 2 desc, 3 desc limit 10) s),
    'signups', (select jsonb_agg(jsonb_build_object('day', d.day, 'n',
                  (select count(*) from auth.users u where u.created_at >= d.day and u.created_at < d.day + 1)) order by d.day)
                from (select (current_date - g)::date as day from generate_series(0, 29) g) d),
    'actives', (select jsonb_agg(jsonb_build_object('day', d.day, 'n',
                  (select count(*) from auth.users u where u.last_sign_in_at >= d.day and u.last_sign_in_at < d.day + 1)) order by d.day)
                from (select (current_date - g)::date as day from generate_series(0, 29) g) d),
    'purchases', (select jsonb_agg(jsonb_build_object('day', d.day, 'n',
                  (select count(*) from public.purchases x where x.created_at >= d.day and x.created_at < d.day + 1)) order by d.day)
                from (select (current_date - g)::date as day from generate_series(0, 29) g) d),
    'errors', (select jsonb_agg(jsonb_build_object('day', d.day, 'n',
                  (select count(*) from public.error_logs x where x.created_at >= d.day and x.created_at < d.day + 1)) order by d.day)
                from (select (current_date - g)::date as day from generate_series(0, 29) g) d)
  ) into r;
  return r;
end;
$function$;

drop function if exists public.admin_list_users(text, text, text, integer, integer);
create function public.admin_list_users(p_search text default '', p_filter text default 'all', p_sort text default 'new',
                                        p_limit integer default 25, p_offset integer default 0)
returns table(id uuid, email text, username text, providers text[], created_at timestamptz, last_sign_in_at timestamptz,
              confirmed boolean, banned boolean, banned_until timestamptz, pro boolean, pro_source text, pro_since timestamptz,
              cloud boolean, cloud_quota_mb integer, files bigint, bytes bigint, is_admin boolean, admin_note text,
              trial_until timestamptz, avatar_path text, open_reports bigint, referrals bigint, total bigint)
language plpgsql stable security definer set search_path = '' as $function$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
  with base as (
    select
      u.id as uid,
      u.email::text as u_email,
      p.username as u_username,
      coalesce(array(select jsonb_array_elements_text(u.raw_app_meta_data -> 'providers')), '{}'::text[]) as u_providers,
      u.created_at as u_created,
      u.last_sign_in_at as u_last,
      (u.email_confirmed_at is not null) as u_confirmed,
      coalesce(u.banned_until > now(), false) as u_banned,
      u.banned_until as u_banned_until,
      coalesce(p.pro, false) as u_pro,
      p.pro_source as u_pro_source,
      p.pro_since as u_pro_since,
      coalesce(p.cloud, false) as u_cloud,
      coalesce(p.cloud_quota_mb, 200) as u_quota,
      (select count(*) from public.cloud_midis m where m.user_id = u.id) as u_files,
      (select coalesce(sum(m.size_bytes), 0) from public.cloud_midis m where m.user_id = u.id)::bigint as u_bytes,
      coalesce(p.is_admin, false) as u_admin,
      p.admin_note as u_note,
      p.trial_until as u_trial,
      p.avatar_path as u_avatar,
      (select count(*) from public.reports r where r.target_id = u.id and r.status = 'open') as u_reports,
      (select count(*) from public.profiles q where q.referred_by = u.id) as u_refs
    from auth.users u
    left join public.profiles p on p.id = u.id
    where coalesce(p_search, '') = ''
       or u.email ilike '%' || p_search || '%'
       or p.username ilike '%' || p_search || '%'
       or u.id::text = p_search
  ), filtered as (
    select * from base b
    where case coalesce(p_filter, 'all')
      when 'pro' then b.u_pro
      when 'free' then not b.u_pro and not coalesce(b.u_trial > now(), false)
      when 'trial' then not b.u_pro and coalesce(b.u_trial > now(), false)
      when 'cloud' then b.u_cloud
      when 'admin' then b.u_admin
      when 'unconfirmed' then not b.u_confirmed
      when 'banned' then b.u_banned
      when 'reported' then b.u_reports > 0
      when 'referrers' then b.u_refs > 0
      else true
    end
  )
  select f.uid, f.u_email, f.u_username, f.u_providers, f.u_created, f.u_last, f.u_confirmed, f.u_banned, f.u_banned_until,
         f.u_pro, f.u_pro_source, f.u_pro_since, f.u_cloud, f.u_quota, f.u_files, f.u_bytes, f.u_admin, f.u_note,
         f.u_trial, f.u_avatar, f.u_reports, f.u_refs,
         count(*) over ()
  from filtered f
  order by
    case when p_sort = 'old' then f.u_created end asc,
    case when p_sort = 'active' then f.u_last end desc nulls last,
    case when p_sort = 'storage' then f.u_bytes end desc,
    case when p_sort = 'name' then lower(coalesce(f.u_username, f.u_email)) end asc,
    case when p_sort = 'reports' then f.u_reports end desc,
    case when p_sort = 'referrals' then f.u_refs end desc,
    f.u_created desc
  limit greatest(1, least(coalesce(p_limit, 25), 500)) offset greatest(0, coalesce(p_offset, 0));
end;
$function$;

-- Everything else the member drawer shows about one account.
create or replace function public.admin_user_extra(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  prog jsonb;
begin
  perform public.admin_assert();
  select g.data into prog from public.user_progress g where g.user_id = p_user;
  return jsonb_build_object(
    'trial_until', (select p.trial_until from public.profiles p where p.id = p_user),
    'referral_days', (select p.referral_days from public.profiles p where p.id = p_user),
    'username_changed_at', (select p.username_changed_at from public.profiles p where p.id = p_user),
    'referred_by', (select jsonb_build_object('id', q.id, 'username', q.username)
                    from public.profiles p join public.profiles q on q.id = p.referred_by where p.id = p_user),
    'referrals', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'username', q.username, 'at', u.created_at) order by u.created_at desc)
                           from public.profiles q join auth.users u on u.id = q.id where q.referred_by = p_user), '[]'::jsonb),
    'friends', (select count(*) from public.friendships f where f.user_id = p_user and f.status = 'accepted'),
    'blocks_made', (select count(*) from public.blocks b where b.user_id = p_user),
    'blocked_by', (select count(*) from public.blocks b where b.blocked_id = p_user),
    'reports_made', (select count(*) from public.reports r where r.reporter_id = p_user),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason, 'details', r.details, 'status', r.status,
                                                             'at', r.created_at, 'reporter', rp.username) order by r.created_at desc)
                         from public.reports r left join public.profiles rp on rp.id = r.reporter_id where r.target_id = p_user), '[]'::jsonb),
    'duels', (select count(*) from public.duels d where d.from_id = p_user or d.to_id = p_user),
    'weekly_songs', (select count(*) from public.weekly_scores w where w.user_id = p_user and w.week = public.current_week()),
    'purchases', coalesce((select jsonb_agg(jsonb_build_object('store', x.store, 'product', x.product_id, 'order', x.order_id, 'at', x.created_at) order by x.created_at desc)
                           from public.purchases x where x.user_id = p_user), '[]'::jsonb),
    'errors', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
                          select e.created_at, e.kind, e.message, e.app_version, e.platform from public.error_logs e
                          where e.user_id = p_user order by e.created_at desc limit 10) e), '[]'::jsonb),
    'practice_seconds', coalesce((prog ->> 'seconds')::numeric, 0),
    'runs', coalesce((prog ->> 'runs')::numeric, 0),
    'notes', coalesce((prog ->> 'notes')::numeric, 0),
    'songs_played', coalesce((select count(*) from jsonb_object_keys(coalesce(prog -> 'songs', '{}'::jsonb))), 0),
    'practice_days', coalesce((select count(*) from jsonb_object_keys(coalesce(prog -> 'days', '{}'::jsonb))), 0),
    'last_practice', (select max(k) from jsonb_object_keys(coalesce(prog -> 'days', '{}'::jsonb)) k),
    'synced_at', (select g.updated_at from public.user_progress g where g.user_id = p_user)
  );
end;
$function$;

create or replace function public.admin_set_trial(p_user uuid, p_days integer)
returns timestamptz language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  before timestamptz;
  after timestamptz;
begin
  perform public.admin_assert();
  if p_days < 0 or p_days > 365 then raise exception 'bad_days'; end if;
  insert into public.profiles (id) values (p_user) on conflict (id) do nothing;
  select p.trial_until into before from public.profiles p where p.id = p_user;
  update public.profiles
     set trial_until = case when p_days = 0 then now() else greatest(coalesce(trial_until, now()), now()) + make_interval(days => p_days) end
   where id = p_user
  returning trial_until into after;
  insert into public.admin_audit (admin_id, target_id, action, detail)
  values (me, p_user, 'trial', jsonb_build_object('days', p_days, 'before', before, 'after', after));
  return after;
end;
$$;

create or replace function public.admin_reset_username(p_user uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  old text;
begin
  perform public.admin_assert();
  select p.username into old from public.profiles p where p.id = p_user;
  update public.profiles set username = null, username_changed_at = null where id = p_user;
  insert into public.admin_audit (admin_id, target_id, action, detail)
  values ((select auth.uid()), p_user, 'reset_username', jsonb_build_object('username', old));
end;
$$;

create or replace function public.admin_reports(p_status text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  perform public.admin_assert();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select r.id, r.created_at, r.reason, r.details, r.status, r.admin_note, r.resolved_at,
             r.target_id, tp.username as target_username, tu.email::text as target_email, tp.avatar_path as target_avatar,
             r.target_username as reported_username, r.target_avatar as reported_avatar,
             coalesce(tu.banned_until > now(), false) as target_banned,
             (select count(*) from public.reports o where o.target_id = r.target_id) as target_reports,
             r.reporter_id, rp.username as reporter_username, ru.email::text as reporter_email,
             ra.email::text as resolved_by_email
      from public.reports r
      left join public.profiles tp on tp.id = r.target_id
      left join auth.users tu on tu.id = r.target_id
      left join public.profiles rp on rp.id = r.reporter_id
      left join auth.users ru on ru.id = r.reporter_id
      left join auth.users ra on ra.id = r.resolved_by
      where coalesce(p_status, 'open') = 'all' or r.status = coalesce(p_status, 'open')
      order by r.created_at desc
      limit greatest(1, least(coalesce(p_limit, 200), 500))
    ) x
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.admin_report_update(p_id bigint, p_status text, p_note text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  t uuid;
begin
  perform public.admin_assert();
  if p_status is not null and p_status not in ('open', 'resolved', 'dismissed') then raise exception 'bad_status'; end if;
  update public.reports
     set status = coalesce(p_status, status),
         admin_note = case when p_note is null then admin_note else nullif(left(p_note, 2000), '') end,
         resolved_at = case when p_status in ('resolved', 'dismissed') then now() when p_status = 'open' then null else resolved_at end,
         resolved_by = case when p_status in ('resolved', 'dismissed') then me when p_status = 'open' then null else resolved_by end
   where id = p_id
  returning target_id into t;
  if p_status is not null then
    insert into public.admin_audit (admin_id, target_id, action, detail)
    values (me, t, 'report_' || p_status, jsonb_build_object('report', p_id));
  end if;
end;
$$;

create or replace function public.admin_errors(p_days integer, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  perform public.admin_assert();
  return coalesce((
    select jsonb_agg(to_jsonb(g) order by g.last_seen desc)
    from (
      select e.fingerprint,
             (array_agg(e.kind order by e.created_at desc))[1] as kind,
             (array_agg(e.message order by e.created_at desc))[1] as message,
             (array_agg(e.stack order by e.created_at desc) filter (where e.stack is not null))[1] as stack,
             (array_agg(e.url order by e.created_at desc))[1] as url,
             (array_agg(e.device order by e.created_at desc))[1] as device,
             count(*) as count,
             count(distinct coalesce(e.user_id::text, e.device)) as users,
             min(e.created_at) as first_seen,
             max(e.created_at) as last_seen,
             array_agg(distinct e.app_version) filter (where e.app_version is not null) as versions,
             array_agg(distinct e.platform) filter (where e.platform is not null) as platforms
      from public.error_logs e
      where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
      group by e.fingerprint
      order by max(e.created_at) desc
      limit greatest(1, least(coalesce(p_limit, 100), 300))
    ) g
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.admin_error_resolve(p_fingerprint text)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer;
begin
  perform public.admin_assert();
  delete from public.error_logs where fingerprint = p_fingerprint;
  get diagnostics n = row_count;
  insert into public.admin_audit (admin_id, target_id, action, detail)
  values ((select auth.uid()), null, 'resolve_error', jsonb_build_object('fingerprint', p_fingerprint, 'rows', n));
  return n;
end;
$$;

create or replace function public.admin_referrals(p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  perform public.admin_assert();
  return jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.n desc)
      from (
        select q.referred_by as id, ip.username, iu.email::text as email, count(*) as n, ip.referral_days,
               max(u.created_at) as last_at
        from public.profiles q
        join auth.users u on u.id = q.id
        left join public.profiles ip on ip.id = q.referred_by
        left join auth.users iu on iu.id = q.referred_by
        where q.referred_by is not null
        group by q.referred_by, ip.username, iu.email, ip.referral_days
        order by count(*) desc
        limit 20
      ) t
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.at desc)
      from (
        select q.id, q.username, u.email::text as email, u.created_at as at, q.pro,
               q.referred_by as inviter_id, ip.username as inviter
        from public.profiles q
        join auth.users u on u.id = q.id
        left join public.profiles ip on ip.id = q.referred_by
        where q.referred_by is not null
        order by u.created_at desc
        limit greatest(1, least(coalesce(p_limit, 100), 500))
      ) r
    ), '[]'::jsonb)
  );
end;
$function$;

-- ----------------------------------------------------------------- grants

revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.report_user(uuid, text, text) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.report_user(uuid, text, text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;

revoke all on function public.log_error(text, text, text, text, text, text, text, text) from public;
grant execute on function public.log_error(text, text, text, text, text, text, text, text) to anon, authenticated;

revoke all on function public.admin_list_users(text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_user_extra(uuid) from public, anon;
revoke all on function public.admin_set_trial(uuid, integer) from public, anon;
revoke all on function public.admin_reset_username(uuid) from public, anon;
revoke all on function public.admin_reports(text, integer) from public, anon;
revoke all on function public.admin_report_update(bigint, text, text) from public, anon;
revoke all on function public.admin_errors(integer, integer) from public, anon;
revoke all on function public.admin_error_resolve(text) from public, anon;
revoke all on function public.admin_referrals(integer) from public, anon;
grant execute on function public.admin_list_users(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_user_extra(uuid) to authenticated;
grant execute on function public.admin_set_trial(uuid, integer) to authenticated;
grant execute on function public.admin_reset_username(uuid) to authenticated;
grant execute on function public.admin_reports(text, integer) to authenticated;
grant execute on function public.admin_report_update(bigint, text, text) to authenticated;
grant execute on function public.admin_errors(integer, integer) to authenticated;
grant execute on function public.admin_error_resolve(text) to authenticated;
grant execute on function public.admin_referrals(integer) to authenticated;
