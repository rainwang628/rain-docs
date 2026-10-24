alter table couple_private.answers add column if not exists updated_at timestamptz not null default now(), add column if not exists revision uuid not null default gen_random_uuid();
CREATE OR REPLACE FUNCTION couple_private.state(p_survey uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 result:=result||jsonb_build_object('responses',(select coalesce(jsonb_agg(jsonb_build_object('role',case when a.user_id=c.dad_id then 'dad' else 'mom' end,'answers',a.answers,'submitted_at',a.submitted_at,'updated_at',a.updated_at,'revision',a.revision)),'[]'::jsonb) from couple_private.answers a where a.survey_id=p_survey));
 end if;
 return result;
end $function$

;
create or replace function couple_private.revise(p_survey uuid,answer_data jsonb,expected_revision uuid) returns jsonb
language plpgsql security definer set search_path='' as $function$
declare c couple_private.sessions; s public.site_surveys; u uuid:=auth.uid(); q jsonb; v jsonb; item jsonb; label text; rating text; required boolean; seen text[]; expected integer; mine couple_private.answers;
begin
 if u is null then raise exception '请先登录'; end if;
 select * into c from couple_private.sessions where survey_id=p_survey for update;
 if not found or u not in(c.dad_id,c.mom_id) then raise exception '这份问卷仅限羊爸和羊妈访问'; end if;
 if u is distinct from c.dad_id then raise exception '无权修改答卷' using errcode='42501'; end if;
 if c.purged_at is not null or c.expires_at<=now() then raise exception '答卷已到期，不能修改'; end if;
 select * into s from public.site_surveys where id=p_survey for share;
 if not s.is_open then raise exception '问卷已关闭，不能修改'; end if;
 select * into mine from couple_private.answers where survey_id=p_survey and user_id=u for update;
 if not found then raise exception '请先提交自己的答卷'; end if;
 if expected_revision is null or mine.revision<>expected_revision then raise exception '答卷已在其他页面修改。当前输入已保留，请先复制，再取消修改并刷新后重试。' using errcode='40001'; end if;
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


 update couple_private.answers set answers=answer_data,updated_at=clock_timestamp(),revision=gen_random_uuid() where survey_id=p_survey and user_id=u;
 return couple_private.state(p_survey);
end $function$;
revoke all on function couple_private.revise(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function couple_private.revise(uuid,jsonb,uuid) to authenticated;
create or replace function public.couple_survey_update(p_survey uuid,answer_data jsonb,expected_revision uuid) returns jsonb
language sql security invoker set search_path='' as $function$ select couple_private.revise(p_survey,answer_data,expected_revision); $function$;
revoke all on function public.couple_survey_update(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.couple_survey_update(uuid,jsonb,uuid) to authenticated;
