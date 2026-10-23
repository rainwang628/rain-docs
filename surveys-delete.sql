
create or replace function couple_private.delete_survey(p_survey uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.site_is_owner(),false) then raise exception '仅网站主人可以删除问卷' using errcode='42501'; end if;
 -- Match the lock order used by couple submission and expiry.
 perform 1 from couple_private.sessions where survey_id=p_survey for update;
 perform 1 from public.site_surveys where id=p_survey for update;
 if not found then return false; end if;
 delete from couple_private.answers where survey_id=p_survey;
 delete from couple_private.sessions where survey_id=p_survey;
 delete from public.site_survey_responses where survey_id=p_survey;
 delete from public.site_surveys where id=p_survey;
 return true;
end $$;
revoke all on function couple_private.delete_survey(uuid) from public,anon,authenticated;
grant execute on function couple_private.delete_survey(uuid) to authenticated;
create or replace function public.survey_delete(p_survey uuid) returns boolean
language sql security invoker set search_path='' as $$ select couple_private.delete_survey(p_survey); $$;
revoke all on function public.survey_delete(uuid) from public,anon,authenticated;
grant execute on function public.survey_delete(uuid) to authenticated;
