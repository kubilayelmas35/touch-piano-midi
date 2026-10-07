-- Tells the other member's app the moment a friend request, an acceptance or a challenge arrives (or a request is
-- withdrawn, a friendship ends, a challenge is answered), so it reloads the friends overview and its badge at once.
-- The ping only carries a kind; the app fetches the details through social_overview as usual.
create or replace function public.social_ping()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  a uuid;
  b uuid;
  kind text;
begin
  if tg_table_name = 'friendships' then
    if tg_op = 'DELETE' then
      a := old.user_id; b := old.friend_id; kind := 'refresh';
    elsif tg_op = 'UPDATE' and new.status = old.status then
      return null;
    else
      a := new.user_id; b := new.friend_id;
      kind := case new.status when 'pending' then 'request' else 'accepted' end;
    end if;
  else
    if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
    a := new.from_id; b := new.to_id;
    kind := case tg_op when 'INSERT' then 'duel' else 'refresh' end;
  end if;
  -- Ping whoever did not cause the change (both when it came from the server itself).
  if b is distinct from me then
    perform realtime.send(jsonb_build_object('kind', kind), 'social', 'inbox:' || b::text, false);
  end if;
  if a is distinct from me and (me is null or kind = 'refresh') then
    perform realtime.send(jsonb_build_object('kind', 'refresh'), 'social', 'inbox:' || a::text, false);
  end if;
  return null;
exception when others then
  -- A missed ping only delays the update; it must never undo the request itself.
  return null;
end;
$$;

revoke all on function public.social_ping() from public, anon, authenticated;

drop trigger if exists friendships_ping on public.friendships;
create trigger friendships_ping after insert or update or delete on public.friendships
  for each row execute function public.social_ping();

drop trigger if exists duels_ping on public.duels;
create trigger duels_ping after insert or update on public.duels
  for each row execute function public.social_ping();
