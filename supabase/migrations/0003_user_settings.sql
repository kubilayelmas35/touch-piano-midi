-- App settings saved on the account so they follow the member to other devices.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "own settings select" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "own settings insert" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own settings update" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own settings delete" on public.user_settings for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_settings to authenticated;
