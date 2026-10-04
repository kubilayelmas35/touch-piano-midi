-- Pro members get a small cloud: up to 10 songs. Members an admin enabled cloud for keep their MB quota.
-- Every cloud MIDI is limited to 1 MB.

create or replace function public.has_cloud()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.cloud or p.pro from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- `song` is excluded from the totals so replacing a song (upsert) is judged by its new size only.
create or replace function public.cloud_room_for(extra bigint, song text)
returns boolean language sql stable security definer set search_path = '' as $$
  select extra between 1 and 1048576 and coalesce((
    select case
      when p.cloud then
        coalesce((select sum(m.size_bytes) from public.cloud_midis m
                  where m.user_id = p.id and m.song_id <> song), 0) + extra <= p.cloud_quota_mb::bigint * 1048576
      when p.pro then
        (select count(*) from public.cloud_midis m where m.user_id = p.id and m.song_id <> song) < 10
      else false
    end
    from public.profiles p where p.id = (select auth.uid())
  ), false);
$$;

revoke all on function public.cloud_room_for(bigint, text) from public, anon;
grant execute on function public.cloud_room_for(bigint, text) to authenticated;

drop policy if exists "cloud_midis: add own" on public.cloud_midis;
create policy "cloud_midis: add own" on public.cloud_midis
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.has_cloud())
    and path = (select auth.uid())::text || '/' || song_id || '.mid'
    and public.cloud_room_for(size_bytes, song_id)
  );

drop policy if exists "cloud_midis: edit own" on public.cloud_midis;
create policy "cloud_midis: edit own" on public.cloud_midis
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_cloud()))
  with check (
    user_id = (select auth.uid())
    and path = (select auth.uid())::text || '/' || song_id || '.mid'
    and public.cloud_room_for(size_bytes, song_id)
  );

drop function if exists public.cloud_room_for(bigint);

update storage.buckets set file_size_limit = 1048576 where id = 'midis';
