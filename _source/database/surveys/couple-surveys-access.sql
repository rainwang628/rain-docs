
create schema if not exists couple_private;
revoke all on schema couple_private from public,anon,authenticated;
grant usage on schema couple_private to authenticated;
create table couple_private.sessions (
 survey_id uuid primary key references public.site_surveys(id),
 dad_id uuid not null references auth.users(id),
 mom_id uuid not null references auth.users(id),
 completed_at timestamptz, expires_at timestamptz, purged_at timestamptz,
 check(dad_id<>mom_id)
);
create table couple_private.answers (
 survey_id uuid not null references couple_private.sessions(survey_id),
 user_id uuid not null references auth.users(id),
 answers jsonb not null,
 submitted_at timestamptz not null default now(),
 primary key(survey_id,user_id)
);
alter table couple_private.sessions enable row level security;
alter table couple_private.answers enable row level security;
revoke all on couple_private.sessions,couple_private.answers from public,anon,authenticated;

create function couple_private.state(p_survey uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c couple_private.sessions; s public.site_surveys; u uuid:=auth.uid(); mine boolean; result jsonb;
begin
 if u is null then raise exception '请先登录羊爸或羊妈的网站账号'; end if;
 select * into c from couple_private.sessions where survey_id=p_survey;
 if not found or u not in(c.dad_id,c.mom_id) then raise exception '这份问卷仅限羊爸和羊妈访问'; end if;
 if c.purged_at is not null or c.expires_at<=now() then
 return jsonb_build_object('expired',true,'expires_at',c.expires_at,'role',case when u=c.dad_id then 'dad' else 'mom' end);
 end if;
 select * into s from public.site_surveys where id=p_survey;
 select exists(select 1 from couple_private.answers where survey_id=p_survey and user_id=u) into mine;
 result:=jsonb_build_object('expired',false,'role',case when u=c.dad_id then 'dad' else 'mom' end,'submitted',mine,'expires_at',c.expires_at,'completed_at',c.completed_at,
 'survey',jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'questions',s.questions,'is_open',s.is_open));
 if mine then
 result:=result||jsonb_build_object('responses',(select coalesce(jsonb_agg(jsonb_build_object('role',case when a.user_id=c.dad_id then 'dad' else 'mom' end,'answers',a.answers,'submitted_at',a.submitted_at)),'[]'::jsonb) from couple_private.answers a where a.survey_id=p_survey));
 end if;
 return result;
end $$;
revoke all on function couple_private.state(uuid) from public,anon,authenticated;
grant execute on function couple_private.state(uuid) to authenticated;
create function public.couple_survey_state(p_survey uuid) returns jsonb
language sql security invoker set search_path='' as $$ select couple_private.state(p_survey); $$;
revoke all on function public.couple_survey_state(uuid) from public,anon,authenticated;
grant execute on function public.couple_survey_state(uuid) to authenticated;

create function couple_private.submit(p_survey uuid,answer_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c couple_private.sessions; s public.site_surveys; u uuid:=auth.uid(); q jsonb; v jsonb; item jsonb; label text; rating text; required boolean; seen text[]; expected integer;
begin
 if u is null then raise exception '请先登录'; end if;
 select * into c from couple_private.sessions where survey_id=p_survey for update;
 if not found or u not in(c.dad_id,c.mom_id) then raise exception '这份问卷仅限羊爸和羊妈访问'; end if;
 if c.purged_at is not null or c.expires_at<=now() then raise exception '答卷已到期，不再接受提交'; end if;
 if exists(select 1 from couple_private.answers where survey_id=p_survey and user_id=u) then return couple_private.state(p_survey); end if;
 select * into s from public.site_surveys where id=p_survey for share;
 if not s.is_open then raise exception '问卷已经关闭'; end if;
  if jsonb_typeof(answer_data) is distinct from 'object' or octet_length(answer_data::text)>100000 then raise exception 'Invalid answer payload'; end if;
 if exists(select 1 from jsonb_object_keys(answer_data) as k(key) where not exists(select 1 from jsonb_array_elements(s.questions) as definition(value) where definition.value->>'id'=k.key)) then raise exception 'Unknown question'; end if;
 for q in select value from jsonb_array_elements(s.questions) loop
  v:=answer_data->(q->>'id'); required:=(q->>'required')::boolean;
  if q->>'type'='text' then
   if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>2000 or (required and length(btrim(v#>>'{}'))=0) then raise exception 'Invalid text answer'; end if;
  elsif q->>'type'='single' then
   if jsonb_typeof(v) is distinct from 'string' then raise exception 'Invalid single choice'; end if;
   if not (q->'options' @> jsonb_build_array(v)) and (required or v#>>'{}'<>'') then raise exception 'Invalid single choice'; end if;
  elsif q->>'type'='multiple' then
   if jsonb_typeof(v) is distinct from 'array' then raise exception 'Invalid multiple choice'; end if;
   if jsonb_array_length(v)>(q->>'max')::integer or (required and jsonb_array_length(v)=0) then raise exception 'Invalid selection count'; end if;
   seen:=array[]::text[];
   for item in select value from jsonb_array_elements(v) loop
    if jsonb_typeof(item) is distinct from 'string' or not (q->'options' @> jsonb_build_array(item)) or (item#>>'{}')=any(seen) then raise exception 'Invalid multiple choice'; end if;
    seen:=array_append(seen,item#>>'{}');
   end loop;
  else
   if jsonb_typeof(v) is distinct from 'object' then raise exception 'Invalid rating'; end if;
   select count(*) into expected from jsonb_object_keys(v);
   if expected<>jsonb_array_length(q->'options') then raise exception 'Invalid rating items'; end if;
   for label in select value from jsonb_array_elements_text(q->'options') loop
    rating:=v->>label;
    if jsonb_typeof(v->label) is distinct from 'string' or (rating not in ('0','1','2','3','4') and (required or rating<>'')) then raise exception 'Invalid rating value'; end if;
   end loop;
  end if;
 end loop;

 insert into couple_private.answers(survey_id,user_id,answers) values(p_survey,u,answer_data);
 if (select count(*) from couple_private.answers where survey_id=p_survey)=2 then
 update couple_private.sessions set completed_at=now(),expires_at=now()+interval '7 days' where survey_id=p_survey;
 end if;
 return couple_private.state(p_survey);
end $$;
revoke all on function couple_private.submit(uuid,jsonb) from public,anon,authenticated;
grant execute on function couple_private.submit(uuid,jsonb) to authenticated;
create function public.couple_survey_submit(p_survey uuid,answer_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select couple_private.submit(p_survey,answer_data); $$;
revoke all on function public.couple_survey_submit(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.couple_survey_submit(uuid,jsonb) to authenticated;

create function couple_private.purge_expired() returns integer
language plpgsql security invoker set search_path='' as $$
declare c record; n integer:=0;
begin
 for c in select survey_id from couple_private.sessions where expires_at<=now() and purged_at is null for update loop
 delete from couple_private.answers where survey_id=c.survey_id;
 update couple_private.sessions set purged_at=now() where survey_id=c.survey_id;
 update public.site_surveys set is_open=false where id=c.survey_id;
 n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function couple_private.purge_expired() from public,anon,authenticated;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('couple-survey-expiry','* * * * *','select couple_private.purge_expired()');

CREATE OR REPLACE FUNCTION public.survey_submit(survey_id uuid, submission_id uuid, answer_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.site_surveys; q jsonb; v jsonb; item jsonb; label text; rating text; required boolean; seen text[]; expected integer;
begin
 if exists(select 1 from couple_private.sessions c where c.survey_id=survey_submit.survey_id) then raise exception '夫妻问卷需要登录并使用专属提交入口'; end if;
 if survey_id is null or submission_id is null then raise exception 'Missing questionnaire or submission ID'; end if;
 select * into s from public.site_surveys where id=survey_submit.survey_id for share;
 if not found then raise exception '问卷不存在'; end if;
 -- Same browser retries use the same opaque ID, avoiding duplicate successful writes.
 if exists(select 1 from public.site_survey_responses r where r.id=submission_id and r.survey_id=survey_submit.survey_id) then return; end if;
 if not s.is_open then raise exception '问卷已经结束收集'; end if;
 if jsonb_typeof(answer_data) is distinct from 'object' or octet_length(answer_data::text)>100000 then raise exception 'Invalid answer payload'; end if;
 if exists(select 1 from jsonb_object_keys(answer_data) as k(key) where not exists(select 1 from jsonb_array_elements(s.questions) as definition(value) where definition.value->>'id'=k.key)) then raise exception 'Unknown question'; end if;
 for q in select value from jsonb_array_elements(s.questions) loop
  v:=answer_data->(q->>'id'); required:=(q->>'required')::boolean;
  if q->>'type'='text' then
   if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>2000 or (required and length(btrim(v#>>'{}'))=0) then raise exception 'Invalid text answer'; end if;
  elsif q->>'type'='single' then
   if jsonb_typeof(v) is distinct from 'string' then raise exception 'Invalid single choice'; end if;
   if not (q->'options' @> jsonb_build_array(v)) and (required or v#>>'{}'<>'') then raise exception 'Invalid single choice'; end if;
  elsif q->>'type'='multiple' then
   if jsonb_typeof(v) is distinct from 'array' then raise exception 'Invalid multiple choice'; end if;
   if jsonb_array_length(v)>(q->>'max')::integer or (required and jsonb_array_length(v)=0) then raise exception 'Invalid selection count'; end if;
   seen:=array[]::text[];
   for item in select value from jsonb_array_elements(v) loop
    if jsonb_typeof(item) is distinct from 'string' or not (q->'options' @> jsonb_build_array(item)) or (item#>>'{}')=any(seen) then raise exception 'Invalid multiple choice'; end if;
    seen:=array_append(seen,item#>>'{}');
   end loop;
  else
   if jsonb_typeof(v) is distinct from 'object' then raise exception 'Invalid rating'; end if;
   select count(*) into expected from jsonb_object_keys(v);
   if expected<>jsonb_array_length(q->'options') then raise exception 'Invalid rating items'; end if;
   for label in select value from jsonb_array_elements_text(q->'options') loop
    rating:=v->>label;
    if jsonb_typeof(v->label) is distinct from 'string' or (rating not in ('0','1','2','3','4') and (required or rating<>'')) then raise exception 'Invalid rating value'; end if;
   end loop;
  end if;
 end loop;
 insert into public.site_survey_responses(id,survey_id,answers) values(submission_id,survey_id,answer_data)
 on conflict(id) do nothing;
 if not exists(select 1 from public.site_survey_responses r where r.id=submission_id and r.survey_id=survey_submit.survey_id) then raise exception 'Invalid submission ID'; end if;
end $function$
;
create or replace function public.survey_get(survey_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from couple_private.sessions c where c.survey_id=survey_get.survey_id) then
 return couple_private.state(survey_id)->'survey';
 end if;
 return (select jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'questions',s.questions,'is_open',s.is_open)
 from public.site_surveys s where s.id=survey_get.survey_id);
end $$;
