-- Run with request.jwt.claims set to a website-owner account in a test session.
-- All synthetic records are rolled back. Never run with production data as inputs.
begin;
set local role authenticated;
do $test$
declare
  v_id uuid:=gen_random_uuid();
  v_partial uuid:=gen_random_uuid();
  v_s jsonb; v_s2 jsonb; v_list jsonb; v_oldrev text;
  v_blocked boolean; v_stale boolean:=false; v_count int;
begin
  if auth.uid() is null or not public.site_is_owner() then
    raise exception 'Test requires an authenticated site-owner JWT';
  end if;
  v_s:=public.nutrition_save_meal_details(v_id,null,
    '{"meal_date":"2000-01-01","meal_type":"breakfast","food_name":"Synthetic meal"}'::jsonb,true,
    '[{"food_name":"A","portion_text":"one","weight_basis":"unknown","kcal":100,"energy_basis":"estimated","protein_g":3},{"food_name":"B","weight_basis":"unknown","kcal":null,"energy_basis":"unknown","protein_g":2}]'::jsonb);
  if (v_s->'meal'->>'kcal') is not null or jsonb_array_length(v_s->'components')<>2 then
    raise exception 'An unknown item must make the complete-meal energy unknown';
  end if;
  perform set_config('app.nutrition_safe_edit','',true);
  v_blocked:=false;
  begin
    update public.meal_items set kcal=kcal where id=v_id;
  exception when insufficient_privilege then v_blocked:=true;
  end;
  if not v_blocked then raise exception 'Direct update of linked meal was not blocked'; end if;
  v_blocked:=false;
  begin
    update public.meal_components set kcal=kcal where meal_item_id=v_id;
  exception when insufficient_privilege then v_blocked:=true;
  end;
  if not v_blocked then raise exception 'Direct component update was not blocked'; end if;
  v_oldrev:=v_s->>'revision';
  v_list:=jsonb_set(jsonb_set(v_s->'components','{1,kcal}','50'::jsonb),'{1,energy_basis}','"estimated"'::jsonb);
  v_s2:=public.nutrition_save_meal_details(v_id,v_oldrev,null,true,v_list);
  if (v_s2->'meal'->>'kcal')::numeric<>150 or (v_s2->'meal'->>'protein_g')::numeric<>5
      or (v_s2->'meal'->>'sodium_mg') is not null then
    raise exception 'Complete meal totals or unknown nutrients were computed incorrectly';
  end if;
  begin
    perform public.nutrition_save_meal_details(v_id,v_oldrev,null,true,v_list);
  exception when serialization_failure then v_stale:=true;
  end;
  if not v_stale then raise exception 'Stale updates should be rejected'; end if;
  perform public.nutrition_delete_meal(v_id,v_s2->>'revision');
  select count(*) into v_count from public.meal_edit_audit where meal_item_id=v_id and action='delete' and before_data is not null;
  if v_count<>1 then raise exception 'Deleted meal should have an auditable snapshot'; end if;
  insert into public.meal_items(id,owner_id,meal_date,meal_type,food_name,amount_g,kcal,note)
    values(v_partial,auth.uid(),'2000-01-01','lunch','Synthetic legacy meal',null,555,'Original evidence');
  v_s:=public.nutrition_meal_snapshot(v_partial);
  v_s2:=public.nutrition_save_meal_details(v_partial,v_s->>'revision',null,false,
    '[{"food_name":"Partial item","weight_basis":"unknown","kcal":100,"energy_basis":"estimated"}]'::jsonb);
  if (v_s2->'meal'->>'kcal')::numeric<>555 or v_s2->'meal'->>'note'<>'Original evidence' then
    raise exception 'Partial details must not replace an independent historical meal estimate';
  end if;
end;
$test$;
rollback;
