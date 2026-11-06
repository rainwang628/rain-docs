-- Run once in the SQL Editor of your own Supabase project.
create table public.usd_purchases (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  purchase_date date not null,
  usd numeric(16,2) not null check (usd > 0 and usd <= 100000000),
  cny numeric(16,2) not null check (cny > 0 and cny <= 1000000000),
  note text not null default '' check (char_length(note) <= 300),
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create index usd_purchases_owner_date on public.usd_purchases(user_id, purchase_date desc);
alter table public.usd_purchases enable row level security;
revoke all on public.usd_purchases from anon;
grant select, insert, update, delete on public.usd_purchases to authenticated;
create policy "Read own purchases" on public.usd_purchases for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own purchases" on public.usd_purchases for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own purchases" on public.usd_purchases for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own purchases" on public.usd_purchases for delete to authenticated using ((select auth.uid()) = user_id);
