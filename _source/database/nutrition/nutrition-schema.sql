-- Run in Supabase SQL Editor once. Owner-only dietary journal.
-- Does not modify existing site permissions or health data.
begin;
create table if not exists public.food_library (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 120),
 brand text not null default '',
 basis_g numeric(10,3) not null default 100 check (basis_g > 0),
 kcal numeric(12,3) check (kcal >= 0),
 protein_g numeric(12,3) check (protein_g >= 0),
 fat_g numeric(12,3) check (fat_g >= 0),
 carbs_g numeric(12,3) check (carbs_g >= 0),
 sodium_mg numeric(12,3) check (sodium_mg >= 0),
 source_note text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,owner_id)
);
create table if not exists public.meal_items (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 meal_date date not null,
 meal_type text not null check(meal_type in ('breakfast','lunch','dinner','snack')),
 food_id uuid,
 food_name text not null check(length(trim(food_name)) between 1 and 120),
 brand text not null default '',
 amount_g numeric(10,3) not null check(amount_g > 0),
 -- Frozen actual nutrition for this portion. Null = not known, not zero.
 kcal numeric(12,3) check(kcal >= 0),
 protein_g numeric(12,3) check(protein_g >= 0),
 fat_g numeric(12,3) check(fat_g >= 0),
 carbs_g numeric(12,3) check(carbs_g >= 0),
 sodium_mg numeric(12,3) check(sodium_mg >= 0),
 note text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (food_id,owner_id) references public.food_library(id,owner_id) on delete set null (food_id)
);
create index if not exists meal_items_owner_date on public.meal_items(owner_id,meal_date desc);
create index if not exists food_library_owner_name on public.food_library(owner_id,name);
alter table public.food_library enable row level security;
alter table public.meal_items enable row level security;
revoke all on public.food_library, public.meal_items from anon, authenticated;
grant select,insert,update,delete on public.food_library, public.meal_items to authenticated;
drop policy if exists "Owner manages own foods" on public.food_library;
create policy "Owner manages own foods" on public.food_library for all to authenticated
 using(owner_id=(select auth.uid()) and (select public.site_is_owner()))
 with check(owner_id=(select auth.uid()) and (select public.site_is_owner()));
drop policy if exists "Owner manages own meals" on public.meal_items;
create policy "Owner manages own meals" on public.meal_items for all to authenticated
 using(owner_id=(select auth.uid()) and (select public.site_is_owner()))
 with check(owner_id=(select auth.uid()) and (select public.site_is_owner()));
commit;
