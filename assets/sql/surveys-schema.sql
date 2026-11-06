-- Run once in the existing Supabase project's SQL Editor, after website access setup.
-- Uses the existing site_is_owner(); never changes existing records or grants.
begin;
create table if not exists public.site_surveys (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 1 and 120),
 description text not null default '' check(length(description)<=2000),
 questions jsonb not null,
 is_open boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.site_survey_responses (
 id uuid primary key,
 survey_id uuid not null references public.site_surveys(id),
 answers jsonb not null check(jsonb_typeof(answers)='object'),
 created_at timestamptz not null default now()
);
create index if not exists survey_responses_lookup on public.site_survey_responses(survey_id,created_at,id);
alter table public.site_surveys enable row level security;
alter table public.site_survey_responses enable row level security;
revoke all on public.site_surveys,public.site_survey_responses from anon,authenticated;
grant select,insert on public.site_surveys to authenticated;
grant update(is_open) on public.site_surveys to authenticated;
grant select on public.site_survey_responses to authenticated;
drop policy if exists "Owner manages surveys" on public.site_surveys;
create policy "Owner manages surveys" on public.site_surveys for all to authenticated
 using((select public.site_is_owner())) with check((select public.site_is_owner()));
drop policy if exists "Owner reads survey responses" on public.site_survey_responses;
create policy "Owner reads survey responses" on public.site_survey_responses for select to authenticated
 using((select public.site_is_owner()));
create or replace function public.survey_validate_definition() returns trigger
language plpgsql set search_path='' as $$
declare q jsonb; opt jsonb; ids text[]:=array[]::text[]; labels text[]; max_count integer;
begin
 if jsonb_typeof(new.questions) is distinct from 'array' then raise exception 'Questions must be an array'; end if;
 if jsonb_array_length(new.questions) not between 1 and 30 then raise exception 'Invalid question count'; end if;
 for q in select value from jsonb_array_elements(new.questions) loop
  if jsonb_typeof(q) is distinct from 'object' or jsonb_typeof(q->'id') is distinct from 'string' or length(q->>'id') not between 1 and 100 or (q->>'id')=any(ids) then raise exception 'Invalid question ID'; end if;
  ids:=array_append(ids,q->>'id');
  if jsonb_typeof(q->'title') is distinct from 'string' or length(btrim(q->>'title')) not between 1 and 500 or coalesce(q->>'type','') not in ('text','single','multiple','rating') or jsonb_typeof(q->'required') is distinct from 'boolean' then raise exception 'Invalid question'; end if;
  if q->>'type'<>'text' then
   if jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'Options must be an array'; end if;
   if jsonb_array_length(q->'options') not between 1 and 30 then raise exception 'Invalid option count'; end if;
   labels:=array[]::text[];
   for opt in select value from jsonb_array_elements(q->'options') loop
    if jsonb_typeof(opt) is distinct from 'string' or length(btrim(opt#>>'{}')) not between 1 and 200 or (opt#>>'{}')=any(labels) then raise exception 'Invalid or duplicate option'; end if;
    labels:=array_append(labels,opt#>>'{}');
   end loop;
   if q->>'type'='multiple' then
    if jsonb_typeof(q->'max') is distinct from 'number' or (q->>'max')!~'^[0-9]+$' then raise exception 'Invalid multiple selection limit'; end if;
    max_count:=(q->>'max')::integer;
    if max_count not between 1 and jsonb_array_length(q->'options') then raise exception 'Invalid selection limit'; end if;
   end if;
  end if;
 end loop;
 return new;
end $$;
revoke all on function public.survey_validate_definition() from public,anon,authenticated;
drop trigger if exists survey_definition_check on public.site_surveys;
create trigger survey_definition_check before insert or update of questions on public.site_surveys for each row execute function public.survey_validate_definition();
-- A share link reveals only its own questionnaire. Listing and all responses stay owner-only.
create or replace function public.survey_get(survey_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'questions',s.questions,'is_open',s.is_open)
 from public.site_surveys s where s.id=survey_id;
$$;
create or replace function public.survey_submit(survey_id uuid,submission_id uuid,answer_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s public.site_surveys; q jsonb; v jsonb; item jsonb; label text; rating text; required boolean; seen text[]; expected integer;
begin
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
end $$;
revoke all on function public.survey_get(uuid),public.survey_submit(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.survey_get(uuid),public.survey_submit(uuid,uuid,jsonb) to anon,authenticated;
-- Seed first activity survey below. Re-running preserves answers and closed state.
insert into public.site_surveys(id,title,description,questions) values('a8c24d1e-074c-4d90-86a0-dc5d94cfb58b','四人小分队 · 下次玩什么？','最近一起玩了不少项目，想听听大家的真实感受，方便安排下一次！喜欢就夸，一般就说，按自己的感受填就好～','[{"id":"q1","type":"rating","title":"最近一起玩过的活动，你觉得怎么样？","options":["王者荣耀","汤泉","羽毛球","麻将","剧本杀","一起吃饭、吃蛋糕"],"required":true},{"id":"q2","type":"multiple","title":"下次组局，你最想再参加哪些？（最多选3项）","options":["王者荣耀","汤泉","羽毛球","麻将","剧本杀","一起吃饭、吃蛋糕","想先试试新活动"],"max":3,"required":true},{"id":"q3","type":"text","title":"有没有哪项活动体验一般？怎样调整会更好？","required":false},{"id":"q4","type":"multiple","title":"接下来想一起尝试什么？（最多选3项）","options":["桌游","密室逃脱","KTV","保龄球 / 台球","徒步 / 公园散步","露营 / 野餐 / 烧烤","手工体验（陶艺、拼豆等）","做饭 / 烘焙","现有活动就挺好","其他（请在下一题补充）"],"max":3,"required":true},{"id":"q5","type":"text","title":"你心中的下一次理想组局是什么样的？也可以补充新活动、时间、预算与频率偏好。","required":false}]'::jsonb) on conflict(id) do nothing;
commit;
