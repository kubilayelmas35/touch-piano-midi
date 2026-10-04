-- Feedback (complaints, suggestions, bug reports) sent from the apps; read in the admin panel.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  email text check (email is null or char_length(email) <= 320),
  kind text not null default 'suggestion' check (kind in ('suggestion', 'complaint', 'bug', 'other')),
  message text not null check (char_length(message) between 3 and 4000),
  platform text check (platform is null or char_length(platform) <= 40),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  language text check (language is null or char_length(language) <= 10),
  device text check (device is null or char_length(device) <= 300),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000)
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant all on public.feedback to service_role;

-- Anyone may send feedback (signed in or not); writes only go through this function so they are rate limited.
create or replace function public.submit_feedback(
  p_kind text,
  p_message text,
  p_email text default null,
  p_platform text default null,
  p_app_version text default null,
  p_language text default null,
  p_device text default null
)
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  msg text := btrim(coalesce(p_message, ''));
  new_id bigint;
begin
  if char_length(msg) < 3 then raise exception 'feedback_too_short'; end if;
  if me is not null then
    if (select count(*) from public.feedback f where f.user_id = me and f.created_at > now() - interval '1 hour') >= 5 then
      raise exception 'feedback_rate_limited';
    end if;
  elsif (select count(*) from public.feedback f where f.user_id is null and f.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'feedback_rate_limited';
  end if;
  insert into public.feedback (user_id, email, kind, message, platform, app_version, language, device)
  values (
    me,
    nullif(left(btrim(coalesce(p_email, '')), 320), ''),
    case when p_kind in ('suggestion', 'complaint', 'bug', 'other') then p_kind else 'other' end,
    left(msg, 4000),
    left(p_platform, 40),
    left(p_app_version, 40),
    left(p_language, 10),
    left(p_device, 300)
  )
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_feedback_list(p_status text default 'all', p_limit integer default 200)
returns table (id bigint, created_at timestamptz, user_id uuid, account_email text, username text, email text,
               kind text, message text, platform text, app_version text, language text, device text,
               status text, admin_note text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
  select f.id, f.created_at, f.user_id, u.email::text, p.username, f.email, f.kind, f.message, f.platform,
         f.app_version, f.language, f.device, f.status, f.admin_note
  from public.feedback f
  left join auth.users u on u.id = f.user_id
  left join public.profiles p on p.id = f.user_id
  where coalesce(p_status, 'all') = 'all' or f.status = p_status or (p_status = 'open' and f.status <> 'done')
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

create or replace function public.admin_feedback_counts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  return jsonb_build_object(
    'new', (select count(*) from public.feedback where status = 'new'),
    'read', (select count(*) from public.feedback where status = 'read'),
    'done', (select count(*) from public.feedback where status = 'done'),
    'all', (select count(*) from public.feedback)
  );
end;
$$;

create or replace function public.admin_feedback_update(p_id bigint, p_status text default null, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  if p_status is not null and p_status not in ('new', 'read', 'done') then raise exception 'bad_status'; end if;
  update public.feedback f set
    status = coalesce(p_status, f.status),
    admin_note = case when p_note is null then f.admin_note else nullif(left(p_note, 2000), '') end
  where f.id = p_id;
end;
$$;

create or replace function public.admin_feedback_delete(p_id bigint)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  f record;
begin
  perform public.admin_assert();
  delete from public.feedback x where x.id = p_id returning x.user_id, x.kind into f;
  if not found then return; end if;
  insert into public.admin_audit (admin_id, target_id, action, detail)
  values ((select auth.uid()), f.user_id, 'delete_feedback', jsonb_build_object('id', p_id, 'kind', f.kind));
end;
$$;

revoke all on function public.submit_feedback(text, text, text, text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text, text, text, text) to anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_feedback_list(text, integer)', 'admin_feedback_counts()',
    'admin_feedback_update(bigint, text, text)', 'admin_feedback_delete(bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
