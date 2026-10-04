-- Store purchases verified by the verify-purchase edge function. One purchase token unlocks one account only.
create table if not exists public.purchases (
  purchase_token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  store text not null check (store in ('google_play', 'app_store')),
  product_id text not null,
  order_id text,
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_idx on public.purchases (user_id);

alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated;
