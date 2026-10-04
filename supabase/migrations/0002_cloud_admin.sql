-- Admin panel + opt-in cloud MIDI storage. Cloud is off for everyone unless an admin enables it per user;
-- everybody else keeps their MIDI files on the device only.

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists cloud boolean not null default false,
  add column if not exists cloud_quota_mb integer not null default 200 check (cloud_quota_mb between 0 and 102400),
  add column if not exists admin_note text;

-- Members may read their own row but never the admin note.
revoke select on public.profiles from authenticated;
grant select (id, username, pro, pro_source, pro_since, created_at, is_admin, cloud, cloud_quota_mb) on public.profiles to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function public.has_cloud()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.cloud from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function public.admin_assert()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------- cloud files

create table if not exists public.cloud_midis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  song_id text not null check (length(song_id) between 1 and 80),
  title text not null check (length(title) between 1 and 200),
  file_name text,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  duration real,
  note_count integer,
  path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, song_id)
);
create index if not exists cloud_midis_user_idx on public.cloud_midis (user_id);
create index if not exists cloud_midis_created_idx on public.cloud_midis (created_at desc);

alter table public.cloud_midis enable row level security;
grant select, insert, update, delete on public.cloud_midis to authenticated;
grant all on public.cloud_midis to service_role;

create or replace function public.cloud_room_for(extra bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(m.size_bytes) from public.cloud_midis m where m.user_id = (select auth.uid())), 0) + extra
         <= coalesce((select p.cloud_quota_mb from public.profiles p where p.id = (select auth.uid())), 0)::bigint * 1048576;
$$;

drop policy if exists "cloud_midis: read own or admin" on public.cloud_midis;
create policy "cloud_midis: read own or admin" on public.cloud_midis
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "cloud_midis: add own" on public.cloud_midis;
create policy "cloud_midis: add own" on public.cloud_midis
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.has_cloud())
    and path = (select auth.uid())::text || '/' || song_id || '.mid'
    and public.cloud_room_for(size_bytes)
  );

drop policy if exists "cloud_midis: edit own" on public.cloud_midis;
create policy "cloud_midis: edit own" on public.cloud_midis
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_cloud()))
  with check (user_id = (select auth.uid()) and path = (select auth.uid())::text || '/' || song_id || '.mid');

drop policy if exists "cloud_midis: delete own or admin" on public.cloud_midis;
create policy "cloud_midis: delete own or admin" on public.cloud_midis
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit)
values ('midis', 'midis', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "midis: read own or admin" on storage.objects;
create policy "midis: read own or admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'midis' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

drop policy if exists "midis: upload own" on storage.objects;
create policy "midis: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'midis'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_cloud())
    and exists (select 1 from public.cloud_midis m where m.path = objects.name and m.user_id = (select auth.uid()))
  );

drop policy if exists "midis: replace own" on storage.objects;
create policy "midis: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'midis' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.has_cloud()));

drop policy if exists "midis: delete own or admin" on storage.objects;
create policy "midis: delete own or admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'midis' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- ---------------------------------------------------------------- audit log

create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid references auth.users (id) on delete set null,
  target_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);
create index if not exists admin_audit_target_idx on public.admin_audit (target_id);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;
grant all on public.admin_audit to service_role;

-- ---------------------------------------------------------------- admin RPCs

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
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
    'providers', (select coalesce(jsonb_object_agg(x.provider, x.n), '{}'::jsonb)
                  from (select i.provider, count(distinct i.user_id) as n from auth.identities i group by i.provider) x),
    'proSources', (select coalesce(jsonb_object_agg(y.src, y.n), '{}'::jsonb)
                   from (select coalesce(pro_source, 'unknown') as src, count(*) as n from public.profiles where pro group by 1) y),
    'signups', (select jsonb_agg(jsonb_build_object('day', d.day, 'n',
                  (select count(*) from auth.users u where u.created_at >= d.day and u.created_at < d.day + 1)) order by d.day)
                from (select (current_date - g)::date as day from generate_series(0, 29) g) d),
    'actives', (select jsonb_agg(jsonb_build_object('day', d.day, 'n',
                  (select count(*) from auth.users u where u.last_sign_in_at >= d.day and u.last_sign_in_at < d.day + 1)) order by d.day)
                from (select (current_date - g)::date as day from generate_series(0, 29) g) d)
  ) into r;
  return r;
end;
$$;

create or replace function public.admin_list_users(
  p_search text default '',
  p_filter text default 'all',
  p_sort text default 'new',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, email text, username text, providers text[], created_at timestamptz, last_sign_in_at timestamptz,
  confirmed boolean, banned boolean, banned_until timestamptz, pro boolean, pro_source text, pro_since timestamptz,
  cloud boolean, cloud_quota_mb integer, files bigint, bytes bigint, is_admin boolean, admin_note text, total bigint
)
language plpgsql stable security definer set search_path = '' as $$
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
      p.admin_note as u_note
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
      when 'free' then not b.u_pro
      when 'cloud' then b.u_cloud
      when 'admin' then b.u_admin
      when 'unconfirmed' then not b.u_confirmed
      when 'banned' then b.u_banned
      else true
    end
  )
  select f.uid, f.u_email, f.u_username, f.u_providers, f.u_created, f.u_last, f.u_confirmed, f.u_banned, f.u_banned_until,
         f.u_pro, f.u_pro_source, f.u_pro_since, f.u_cloud, f.u_quota, f.u_files, f.u_bytes, f.u_admin, f.u_note,
         count(*) over ()
  from filtered f
  order by
    case when p_sort = 'old' then f.u_created end asc,
    case when p_sort = 'active' then f.u_last end desc nulls last,
    case when p_sort = 'storage' then f.u_bytes end desc,
    case when p_sort = 'name' then lower(coalesce(f.u_username, f.u_email)) end asc,
    f.u_created desc
  limit greatest(1, least(coalesce(p_limit, 25), 500)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.admin_update_user(p_user uuid, p_patch jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  before jsonb;
begin
  perform public.admin_assert();
  if p_user = me and p_patch ? 'is_admin' and not (p_patch ->> 'is_admin')::boolean then
    raise exception 'cannot_demote_self';
  end if;
  insert into public.profiles (id) values (p_user) on conflict (id) do nothing;
  select jsonb_build_object('pro', p.pro, 'cloud', p.cloud, 'cloud_quota_mb', p.cloud_quota_mb, 'is_admin', p.is_admin)
    into before from public.profiles p where p.id = p_user;
  update public.profiles p set
    pro = coalesce((p_patch ->> 'pro')::boolean, p.pro),
    pro_source = case
      when not p_patch ? 'pro' then p.pro_source
      when (p_patch ->> 'pro')::boolean then coalesce(p_patch ->> 'pro_source', p.pro_source, 'manual')
      else null end,
    pro_since = case
      when not p_patch ? 'pro' then p.pro_since
      when (p_patch ->> 'pro')::boolean then coalesce(p.pro_since, now())
      else null end,
    cloud = coalesce((p_patch ->> 'cloud')::boolean, p.cloud),
    cloud_quota_mb = coalesce((p_patch ->> 'cloud_quota_mb')::integer, p.cloud_quota_mb),
    is_admin = coalesce((p_patch ->> 'is_admin')::boolean, p.is_admin),
    admin_note = case when p_patch ? 'admin_note' then nullif(left(p_patch ->> 'admin_note', 2000), '') else p.admin_note end
  where p.id = p_user;
  insert into public.admin_audit (admin_id, target_id, action, detail)
  values (me, p_user, 'update', jsonb_build_object('patch', p_patch - 'admin_note', 'before', before,
          'note', p_patch ? 'admin_note'));
end;
$$;

create or replace function public.admin_files(p_user uuid default null, p_limit integer default 100)
returns table (id uuid, user_id uuid, email text, username text, song_id text, title text, file_name text,
               size_bytes integer, duration real, note_count integer, path text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
  select m.id, m.user_id, u.email::text, p.username, m.song_id, m.title, m.file_name, m.size_bytes, m.duration,
         m.note_count, m.path, m.created_at
  from public.cloud_midis m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where p_user is null or m.user_id = p_user
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 1000));
end;
$$;

create or replace function public.admin_storage_by_user(p_limit integer default 10)
returns table (user_id uuid, email text, username text, files bigint, bytes bigint, quota_mb integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
  select m.user_id, u.email::text, p.username, count(*), sum(m.size_bytes)::bigint, coalesce(p.cloud_quota_mb, 0)
  from public.cloud_midis m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  group by m.user_id, u.email, p.username, p.cloud_quota_mb
  order by sum(m.size_bytes) desc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
end;
$$;

create or replace function public.admin_delete_file(p_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  f record;
begin
  perform public.admin_assert();
  delete from public.cloud_midis m where m.id = p_id returning m.user_id, m.path, m.title into f;
  if not found then return null; end if;
  insert into public.admin_audit (admin_id, target_id, action, detail)
  values ((select auth.uid()), f.user_id, 'delete_file', jsonb_build_object('title', f.title, 'path', f.path));
  return f.path;
end;
$$;

create or replace function public.admin_audit_log(p_user uuid default null, p_limit integer default 100)
returns table (id bigint, at timestamptz, admin_email text, target_id uuid, target_email text, action text, detail jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
  select a.id, a.at, ua.email::text, a.target_id, ut.email::text, a.action, a.detail
  from public.admin_audit a
  left join auth.users ua on ua.id = a.admin_id
  left join auth.users ut on ut.id = a.target_id
  where p_user is null or a.target_id = p_user
  order by a.at desc
  limit greatest(1, least(coalesce(p_limit, 100), 1000));
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'is_admin()', 'has_cloud()', 'admin_assert()', 'cloud_room_for(bigint)', 'admin_stats()',
    'admin_list_users(text, text, text, integer, integer)', 'admin_update_user(uuid, jsonb)',
    'admin_files(uuid, integer)', 'admin_storage_by_user(integer)', 'admin_delete_file(uuid)',
    'admin_audit_log(uuid, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
