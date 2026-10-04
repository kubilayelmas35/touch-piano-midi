-- Accounts only: MIDI files never leave the device. One row per user holding the
-- public username and the Pro entitlement (written by store receipt checks, never by clients).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text check (username is null or username ~ '^[A-Za-z0-9_.]{3,24}$'),
  pro boolean not null default false,
  pro_source text check (pro_source is null or pro_source in ('google_play', 'app_store', 'steam', 'manual')),
  pro_since timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  if wanted is not null
     and (wanted !~ '^[A-Za-z0-9_.]{3,24}$'
          or exists (select 1 from public.profiles p where lower(p.username) = lower(wanted))) then
    wanted := null;
  end if;
  insert into public.profiles (id, username) values (new.id, wanted)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select name ~ '^[A-Za-z0-9_.]{3,24}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(name));
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
