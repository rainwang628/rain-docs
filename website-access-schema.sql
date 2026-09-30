-- Run once in the existing Supabase project's SQL Editor.
-- Website owner: the current confirmed account for __OWNER_EMAIL__.
-- Creates module permissions and public article classifications. Keeps purchase records.
begin;
create table if not exists public.site_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  approved boolean not null default false,
  is_owner boolean not null default false
);
create table if not exists public.site_module_permissions (
  user_id uuid not null references public.site_members(user_id) on delete cascade,
  module text not null check (module in ('usd-purchases','article-categories','games')),
  primary key (user_id, module)
);
alter table public.site_members enable row level security;
alter table public.site_module_permissions enable row level security;
revoke all on public.site_members, public.site_module_permissions from anon, authenticated;
grant select, insert on public.site_members to authenticated;
grant select on public.site_module_permissions to authenticated;
-- Bind ownership to the current verified Auth user, not to client-supplied metadata.
do $$
declare owner_id uuid; owner_email text;
begin
  select id, email into strict owner_id, owner_email from auth.users
    where lower(email)='__OWNER_EMAIL__' and email_confirmed_at is not null;
  update public.site_members set is_owner=false where is_owner and user_id<>owner_id;
  insert into public.site_members(user_id,email,approved,is_owner) values(owner_id,owner_email,true,true)
    on conflict (user_id) do update set email=excluded.email,approved=true,is_owner=true;
exception when no_data_found then
  raise exception 'Please confirm the website account __OWNER_EMAIL__ in Authentication > Users first.';
end $$;
create or replace function public.site_is_owner() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.site_members where user_id=(select auth.uid()) and is_owner);
$$;
create or replace function public.site_can_access(requested_module text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.site_members m where m.user_id=(select auth.uid()) and
    (m.is_owner or (m.approved and exists(select 1 from public.site_module_permissions p
      where p.user_id=m.user_id and p.module=requested_module))))
    and requested_module in ('usd-purchases','article-categories','games');
$$;
revoke all on function public.site_is_owner(), public.site_can_access(text) from public, anon;
grant execute on function public.site_is_owner(), public.site_can_access(text) to authenticated;
drop policy if exists "Members read own profile or owner" on public.site_members;
create policy "Members read own profile or owner" on public.site_members for select to authenticated
  using (user_id=(select auth.uid()) or (select public.site_is_owner()));
drop policy if exists "Members apply as themselves" on public.site_members;
create policy "Members apply as themselves" on public.site_members for insert to authenticated
  with check (user_id=(select auth.uid()) and lower(email)=lower((select auth.jwt())->>'email') and not approved and not is_owner);
drop policy if exists "Read own module grants or owner" on public.site_module_permissions;
create policy "Read own module grants or owner" on public.site_module_permissions for select to authenticated
  using (user_id=(select auth.uid()) or (select public.site_is_owner()));
-- Owner grants approval and specific modules together in one transaction.
create or replace function public.site_set_permissions(target_user uuid, allow_user boolean, allowed_modules text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.site_is_owner() then raise exception 'Only the website owner can approve users.'; end if;
  if exists(select 1 from public.site_members where user_id=target_user and is_owner) then
    raise exception 'Owner permissions cannot be changed here.';
  end if;
  if not exists(select 1 from public.site_members where user_id=target_user) then raise exception 'Unknown applicant.'; end if;
  if allowed_modules is null or exists(select 1 from unnest(allowed_modules) as u(module) where module is null or module not in ('usd-purchases','article-categories','games')) then
    raise exception 'Invalid modules.';
  end if;
  update public.site_members set approved=allow_user where user_id=target_user;
  delete from public.site_module_permissions where user_id=target_user;
  if allow_user then
    insert into public.site_module_permissions(user_id,module) select target_user,module from (select distinct unnest(allowed_modules) module) grants;
  end if;
end $$;
revoke all on function public.site_set_permissions(uuid,boolean,text[]) from public, anon;
grant execute on function public.site_set_permissions(uuid,boolean,text[]) to authenticated;
create table if not exists public.site_article_categories (
  id text primary key check(id='main'),
  assignments jsonb not null default '{}'::jsonb check(jsonb_typeof(assignments)='object'),
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);
alter table public.site_article_categories enable row level security;
revoke all on public.site_article_categories from anon, authenticated;
grant select on public.site_article_categories to anon, authenticated;
grant update(assignments,revision,updated_at) on public.site_article_categories to authenticated;
insert into public.site_article_categories(id) values('main') on conflict(id) do nothing;
drop policy if exists "Public article classifications" on public.site_article_categories;
create policy "Public article classifications" on public.site_article_categories for select to anon,authenticated using(true);
drop policy if exists "Owner edits article classifications" on public.site_article_categories;
drop policy if exists "Authorized classification editors" on public.site_article_categories;
create policy "Authorized classification editors" on public.site_article_categories for update to authenticated
  using((select public.site_can_access('article-categories'))) with check((select public.site_can_access('article-categories')));
-- Extra module gate, combined with existing ownership RLS. Approved friends see only their own purchases.
drop policy if exists "Purchase module access" on public.usd_purchases;
create policy "Purchase module access" on public.usd_purchases as restrictive for all to authenticated
  using((select public.site_can_access('usd-purchases'))) with check((select public.site_can_access('usd-purchases')));
commit;
-- Re-run after owner account recreation to bind ownership to its new user ID.
-- Existing saved classifications and purchase records are not reset by this script.
