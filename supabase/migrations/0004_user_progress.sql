-- Practice time, streaks, song stars and achievements, merged across the member's devices.
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

create policy "own progress select" on public.user_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "own progress insert" on public.user_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own progress update" on public.user_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own progress delete" on public.user_progress for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_progress to authenticated;
