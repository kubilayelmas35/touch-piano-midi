-- Accounts made with Google/Apple start without a username; friends find each other by it, so let them pick one once.

create or replace function public.set_username(p_name text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  n text := btrim(coalesce(p_name, ''));
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if n !~ '^[A-Za-z0-9_.]{3,24}$' then raise exception 'bad_username'; end if;
  if (select p.username from public.profiles p where p.id = me) is not null then raise exception 'username_set'; end if;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(n)) then raise exception 'username_taken'; end if;
  insert into public.profiles (id, username) values (me, n)
  on conflict (id) do update set username = excluded.username;
  return n;
end;
$$;

revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;
