-- Queue only owner-authorized removal requests; GitHub Actions processes them.
begin;
create table if not exists public.site_article_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  kind text not null check (kind='story'),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=80),
  status text not null default 'pending' check (status in ('pending','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  processed_commit text check (processed_commit is null or processed_commit ~ '^[0-9a-f]{40}$'),
  last_error text check (last_error is null or length(last_error)<=300)
);
alter table public.site_article_deletion_requests drop constraint if exists site_article_deletion_requests_kind_check;
alter table public.site_article_deletion_requests add constraint site_article_deletion_requests_kind_check check (kind='story');
create unique index if not exists article_delete_one_pending
  on public.site_article_deletion_requests(owner_id,kind,slug) where status='pending';
alter table public.site_article_deletion_requests enable row level security;
revoke all on public.site_article_deletion_requests from public,anon,authenticated,service_role;
grant select on public.site_article_deletion_requests to authenticated;
grant insert (owner_id,kind,slug) on public.site_article_deletion_requests to authenticated;
grant select,update on public.site_article_deletion_requests to service_role;
drop policy if exists "Owner reads article deletion requests" on public.site_article_deletion_requests;
drop policy if exists "Owner requests article deletion" on public.site_article_deletion_requests;
create policy "Owner reads article deletion requests" on public.site_article_deletion_requests
  for select to authenticated using (owner_id=(select auth.uid()) and (select public.site_is_owner()));
create policy "Owner requests article deletion" on public.site_article_deletion_requests
  for insert to authenticated with check (
    owner_id=(select auth.uid()) and (select public.site_is_owner()) and status='pending'
    and completed_at is null and processed_commit is null and last_error is null
  );
comment on table public.site_article_deletion_requests is
  'Owner-only story removal queue. A verified GitHub Actions job removes story HTML files and requests a Pages rebuild; technical articles are outside this workflow.';
commit;
