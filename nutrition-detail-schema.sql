-- Run after nutrition-schema.sql. The meal summary is the sole source for
-- daily totals; its components are attached and never counted a second time.
begin;
create unique index if not exists meal_items_id_owner_id_unique_for_components
  on public.meal_items(id,owner_id);
create table if not exists public.meal_components (
  id uuid primary key default gen_random_uuid(),
  meal_item_id uuid not null, owner_id uuid not null default auth.uid(),
  component_order integer not null check (component_order > 0),
  food_id uuid,
  food_name text not null check (length(btrim(food_name)) between 1 and 120),
  brand text not null default '', portion_text text not null default '',
  amount_g numeric(12,3) check (amount_g is null or amount_g > 0),
  weight_basis text not null check (weight_basis in ('weighed','reported','calculated','estimated','unknown')),
  kcal numeric(12,3) check (kcal is null or kcal >= 0),
  energy_basis text not null check (energy_basis in ('label','reference','estimated','unknown')),
  protein_g numeric(12,3) check (protein_g is null or protein_g >= 0),
  fat_g numeric(12,3) check (fat_g is null or fat_g >= 0),
  carbs_g numeric(12,3) check (carbs_g is null or carbs_g >= 0),
  sodium_mg numeric(12,3) check (sodium_mg is null or sodium_mg >= 0),
  source_note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint meal_components_order_unique unique (meal_item_id,component_order),
  constraint meal_components_parent_owner_fk foreign key (meal_item_id,owner_id)
    references public.meal_items(id,owner_id) on delete cascade,
  constraint meal_components_food_owner_fk foreign key (food_id,owner_id)
    references public.food_library(id,owner_id) on delete set null (food_id),
  constraint meal_components_weight_presence_check check
    ((amount_g is null and weight_basis='unknown') or (amount_g is not null and weight_basis<>'unknown')),
  constraint meal_components_energy_presence_check check
    ((kcal is null and energy_basis='unknown') or (kcal is not null and energy_basis<>'unknown'))
);
create index if not exists meal_components_owner_parent on public.meal_components(owner_id,meal_item_id);
create index if not exists meal_components_food_owner on public.meal_components(food_id,owner_id) where food_id is not null;
alter table public.meal_components enable row level security;
revoke all on public.meal_components from public,anon,authenticated;
grant select,insert,update,delete on public.meal_components to authenticated,service_role;
drop policy if exists "Owner manages own meal components" on public.meal_components;
create policy "Owner manages own meal components" on public.meal_components for all to authenticated
  using (owner_id=(select auth.uid()) and (select public.site_is_owner()))
  with check (owner_id=(select auth.uid()) and (select public.site_is_owner()));
comment on table public.meal_components is '食物明细附属于 meal_items 的餐次汇总，不能再次累计。记录实际摄入、重量或份数、营养和来源，未知保持 NULL，估算应标注；写前查重、写后回读。';
comment on column public.meal_components.portion_text is '原始份量，例如2个、250毫升、少许；不将毫升自动当作克。';
comment on column public.meal_components.amount_g is '食用重量；无法可靠获得时为NULL。干重与熟重须在说明中区分。';
comment on column public.meal_components.source_note is '用户报告、包装标签、照片估算、参考值与更正依据；区分估算和实测。';

alter table public.meal_items alter column amount_g drop not null;
alter table public.meal_items add column if not exists components_complete boolean;
comment on column public.meal_items.components_complete is
  'TRUE: all foods listed; FALSE: partial details; NULL: completeness not assessed. NULL or FALSE does not imply zero consumption.';

create table if not exists public.meal_edit_audit (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  meal_item_id uuid not null,
  action text not null check (action in ('create', 'edit', 'delete')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists meal_edit_audit_owner_meal on public.meal_edit_audit(owner_id, meal_item_id, created_at desc);
alter table public.meal_edit_audit enable row level security;
revoke all on public.meal_edit_audit from public, anon, authenticated;
grant select, insert on public.meal_edit_audit to authenticated;
grant select, insert on public.meal_edit_audit to service_role;
drop policy if exists "Owner reads meal edit history" on public.meal_edit_audit;
drop policy if exists "Owner records meal edit history" on public.meal_edit_audit;
create policy "Owner reads meal edit history" on public.meal_edit_audit
  for select to authenticated using (owner_id = (select auth.uid()) and (select public.site_is_owner()));
create policy "Owner records meal edit history" on public.meal_edit_audit
  for insert to authenticated with check (owner_id = (select auth.uid()) and (select public.site_is_owner()));
comment on table public.meal_edit_audit is '保存网站编辑或删除餐次前后的快照，便于追溯原始食物和估算依据；不计入营养总量。';

create or replace function public.nutrition_meal_snapshot(p_meal_id uuid)
returns jsonb language sql volatile security invoker set search_path = pg_catalog, public as $$
  select jsonb_build_object('meal', to_jsonb(m), 'components', c.items,
    'revision', md5(to_jsonb(m)::text || c.items::text))
  from public.meal_items m
  cross join lateral (
    select coalesce(jsonb_agg(to_jsonb(d) order by d.component_order, d.id), '[]'::jsonb) as items
    from public.meal_components d where d.meal_item_id = m.id and d.owner_id = m.owner_id
  ) c
  where m.id = p_meal_id and m.owner_id = (select auth.uid());
$$;

create or replace function public.nutrition_save_meal_details(
  p_meal_id uuid, p_expected_revision text, p_parent jsonb,
  p_complete boolean, p_components jsonb
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_owner uuid := auth.uid(); v_before jsonb; v_after jsonb;
  v_entry jsonb; v_id uuid; v_seen uuid[] := array[]::uuid[];
  v_next_order integer; v_rows integer; v_created boolean := p_expected_revision is null;
  v_old_fingerprint jsonb; v_new_fingerprint jsonb; v_old_complete boolean;
  v_n integer; v_k_n integer; v_p_n integer; v_f_n integer; v_c_n integer; v_s_n integer;
  v_k numeric; v_p numeric; v_f numeric; v_c numeric; v_s numeric;
begin
  if v_owner is null or not public.site_is_owner() then
    raise exception '无权修改饮食记录' using errcode = '42501';
  end if;
  perform set_config('app.nutrition_safe_edit','on',true);
  if p_meal_id is null or p_complete is null or jsonb_typeof(p_components) is distinct from 'array'
     or jsonb_array_length(p_components) < 1 or jsonb_array_length(p_components) > 50 then
    raise exception '请至少保留一项食物，最多50项';
  end if;
  if v_created then
    if p_parent is null or jsonb_typeof(p_parent) <> 'object' then raise exception '缺少餐次信息'; end if;
    insert into public.meal_items(id, owner_id, meal_date, meal_type, food_name, brand, amount_g, note, components_complete)
    values (p_meal_id, v_owner, (p_parent->>'meal_date')::date, p_parent->>'meal_type',
      left(coalesce(nullif(btrim(p_parent->>'food_name'), ''), '餐次汇总'), 120), '', null,
      coalesce(p_parent->>'note', ''), p_complete);
    v_before := null;
  else
    perform 1 from public.meal_items where id=p_meal_id and owner_id=v_owner for update;
    if not found then raise exception '餐次不存在或无权访问'; end if;
    perform 1 from public.meal_components where meal_item_id=p_meal_id and owner_id=v_owner for update;
    v_before := public.nutrition_meal_snapshot(p_meal_id);
    if (v_before->>'revision') is distinct from p_expected_revision then
      raise exception '记录已在其他地方修改，请刷新后再编辑' using errcode='40001';
    end if;
  end if;
  select components_complete into v_old_complete from public.meal_items where id=p_meal_id and owner_id=v_owner;
  select coalesce(jsonb_agg(jsonb_build_array(id, food_id, food_name, brand, portion_text, amount_g,
    kcal, protein_g, fat_g, carbs_g, sodium_mg) order by id), '[]'::jsonb)
    into v_old_fingerprint from public.meal_components where meal_item_id=p_meal_id and owner_id=v_owner;
  select coalesce(max(component_order),0) into v_next_order from public.meal_components where meal_item_id=p_meal_id and owner_id=v_owner;
  for v_entry in select value from jsonb_array_elements(p_components) loop
    if jsonb_typeof(v_entry) <> 'object' then raise exception '食物明细格式错误'; end if;
    v_id := nullif(v_entry->>'id','')::uuid;
    if v_id is null then
      v_id := gen_random_uuid();
      v_next_order := v_next_order + 1;
      insert into public.meal_components(id,meal_item_id,owner_id,component_order,food_id,food_name,brand,portion_text,
        amount_g,weight_basis,kcal,energy_basis,protein_g,fat_g,carbs_g,sodium_mg,source_note)
      values(v_id,p_meal_id,v_owner,v_next_order,nullif(v_entry->>'food_id','')::uuid,
        btrim(v_entry->>'food_name'),coalesce(v_entry->>'brand',''),coalesce(v_entry->>'portion_text',''),
        nullif(v_entry->>'amount_g','')::numeric,coalesce(v_entry->>'weight_basis','unknown'),
        nullif(v_entry->>'kcal','')::numeric,coalesce(v_entry->>'energy_basis','unknown'),
        nullif(v_entry->>'protein_g','')::numeric,nullif(v_entry->>'fat_g','')::numeric,
        nullif(v_entry->>'carbs_g','')::numeric,nullif(v_entry->>'sodium_mg','')::numeric,coalesce(v_entry->>'source_note',''));
    else
      if v_id = any(v_seen) then raise exception '同一食物明细重复'; end if;
      update public.meal_components set food_id=nullif(v_entry->>'food_id','')::uuid,
        food_name=btrim(v_entry->>'food_name'),brand=coalesce(v_entry->>'brand',''),portion_text=coalesce(v_entry->>'portion_text',''),
        amount_g=nullif(v_entry->>'amount_g','')::numeric,weight_basis=coalesce(v_entry->>'weight_basis','unknown'),
        kcal=nullif(v_entry->>'kcal','')::numeric,energy_basis=coalesce(v_entry->>'energy_basis','unknown'),
        protein_g=nullif(v_entry->>'protein_g','')::numeric,fat_g=nullif(v_entry->>'fat_g','')::numeric,
        carbs_g=nullif(v_entry->>'carbs_g','')::numeric,sodium_mg=nullif(v_entry->>'sodium_mg','')::numeric,
        source_note=coalesce(v_entry->>'source_note',''),updated_at=now()
      where id=v_id and meal_item_id=p_meal_id and owner_id=v_owner;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception '食物明细不存在或不属于此餐'; end if;
    end if;
    v_seen := array_append(v_seen,v_id);
  end loop;
  delete from public.meal_components where meal_item_id=p_meal_id and owner_id=v_owner and not (id=any(v_seen));
  select coalesce(jsonb_agg(jsonb_build_array(id, food_id, food_name, brand, portion_text, amount_g,
    kcal, protein_g, fat_g, carbs_g, sodium_mg) order by id), '[]'::jsonb),
    count(*),count(kcal),count(protein_g),count(fat_g),count(carbs_g),count(sodium_mg),
    sum(kcal),sum(protein_g),sum(fat_g),sum(carbs_g),sum(sodium_mg)
    into v_new_fingerprint,v_n,v_k_n,v_p_n,v_f_n,v_c_n,v_s_n,v_k,v_p,v_f,v_c,v_s
    from public.meal_components where meal_item_id=p_meal_id and owner_id=v_owner;
  if p_complete and (v_created or v_old_complete is distinct from true or v_old_fingerprint is distinct from v_new_fingerprint) then
    update public.meal_items set components_complete=true,
      kcal=case when v_k_n=v_n then v_k else null end,
      protein_g=case when v_p_n=v_n then v_p else null end,
      fat_g=case when v_f_n=v_n then v_f else null end,
      carbs_g=case when v_c_n=v_n then v_c else null end,
      sodium_mg=case when v_s_n=v_n then v_s else null end, updated_at=now()
      where id=p_meal_id and owner_id=v_owner;
  else
    update public.meal_items set components_complete=p_complete,updated_at=now() where id=p_meal_id and owner_id=v_owner;
  end if;
  v_after := public.nutrition_meal_snapshot(p_meal_id);
  insert into public.meal_edit_audit(owner_id,meal_item_id,action,before_data,after_data)
    values(v_owner,p_meal_id,case when v_created then 'create' else 'edit' end,v_before,v_after);
  return v_after;
end;
$$;

create or replace function public.nutrition_save_legacy_meal(p_meal_id uuid,p_expected_revision text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_owner uuid := auth.uid(); v_before jsonb; v_after jsonb;
begin
  if v_owner is null or not public.site_is_owner() then raise exception '无权修改饮食记录' using errcode='42501'; end if;
  perform set_config('app.nutrition_safe_edit','on',true);
  perform 1 from public.meal_items where id=p_meal_id and owner_id=v_owner for update;
  if not found then raise exception '餐次不存在或无权访问'; end if;
  perform 1 from public.meal_components where meal_item_id=p_meal_id and owner_id=v_owner for update;
  v_before := public.nutrition_meal_snapshot(p_meal_id);
  if v_before->>'revision' is distinct from p_expected_revision then raise exception '记录已在其他地方修改，请刷新后再编辑' using errcode='40001'; end if;
  if jsonb_array_length(v_before->'components') > 0 then raise exception '此餐已有明细，请使用明细编辑'; end if;
  update public.meal_items set meal_date=(p_payload->>'meal_date')::date,meal_type=p_payload->>'meal_type',
    food_id=nullif(p_payload->>'food_id','')::uuid,food_name=btrim(p_payload->>'food_name'),brand=coalesce(p_payload->>'brand',''),
    amount_g=nullif(p_payload->>'amount_g','')::numeric,kcal=nullif(p_payload->>'kcal','')::numeric,
    protein_g=nullif(p_payload->>'protein_g','')::numeric,fat_g=nullif(p_payload->>'fat_g','')::numeric,
    carbs_g=nullif(p_payload->>'carbs_g','')::numeric,sodium_mg=nullif(p_payload->>'sodium_mg','')::numeric,
    note=coalesce(p_payload->>'note',''),updated_at=now() where id=p_meal_id and owner_id=v_owner;
  v_after:=public.nutrition_meal_snapshot(p_meal_id);
  insert into public.meal_edit_audit(owner_id,meal_item_id,action,before_data,after_data) values(v_owner,p_meal_id,'edit',v_before,v_after);
  return v_after;
end;
$$;

create or replace function public.nutrition_delete_meal(p_meal_id uuid,p_expected_revision text)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_owner uuid := auth.uid(); v_before jsonb;
begin
  if v_owner is null or not public.site_is_owner() then raise exception '无权删除饮食记录' using errcode='42501'; end if;
  perform set_config('app.nutrition_safe_edit','on',true);
  perform 1 from public.meal_items where id=p_meal_id and owner_id=v_owner for update;
  if not found then raise exception '餐次不存在或无权访问'; end if;
  perform 1 from public.meal_components where meal_item_id=p_meal_id and owner_id=v_owner for update;
  v_before := public.nutrition_meal_snapshot(p_meal_id);
  if v_before->>'revision' is distinct from p_expected_revision then raise exception '记录已在其他地方修改，请刷新后再删除' using errcode='40001'; end if;
  insert into public.meal_edit_audit(owner_id,meal_item_id,action,before_data) values(v_owner,p_meal_id,'delete',v_before);
  delete from public.meal_items where id=p_meal_id and owner_id=v_owner;
  return true;
end;
$$;

create or replace function public.nutrition_guard_linked_records()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if current_user='authenticated' and current_setting('app.nutrition_safe_edit',true) is distinct from 'on' then
    if tg_table_name='meal_components' then
      raise exception '此餐包含食物明细，请刷新页面并通过明细编辑，避免总量不同步' using errcode='42501';
    elsif exists(select 1 from public.meal_components where meal_item_id=old.id and owner_id=old.owner_id) then
      raise exception '此餐包含食物明细，请刷新页面并通过明细编辑，避免总量不同步' using errcode='42501';
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists nutrition_guard_summary on public.meal_items;
drop trigger if exists nutrition_guard_components on public.meal_components;
create trigger nutrition_guard_summary before update or delete on public.meal_items
  for each row execute function public.nutrition_guard_linked_records();
create trigger nutrition_guard_components before insert or update or delete on public.meal_components
  for each row execute function public.nutrition_guard_linked_records();
revoke all on function public.nutrition_guard_linked_records() from public,anon,authenticated;

revoke all on function public.nutrition_meal_snapshot(uuid) from public,anon;
revoke all on function public.nutrition_save_meal_details(uuid,text,jsonb,boolean,jsonb) from public,anon;
revoke all on function public.nutrition_save_legacy_meal(uuid,text,jsonb) from public,anon;
revoke all on function public.nutrition_delete_meal(uuid,text) from public,anon;
grant execute on function public.nutrition_meal_snapshot(uuid) to authenticated;
grant execute on function public.nutrition_save_meal_details(uuid,text,jsonb,boolean,jsonb) to authenticated;
grant execute on function public.nutrition_save_legacy_meal(uuid,text,jsonb) to authenticated;
grant execute on function public.nutrition_delete_meal(uuid,text) to authenticated;
comment on table public.meal_items is '饮食统计主表。既有记录可能是整餐汇总或单项食物，应依原记录判断；当某行关联 public.meal_components 时，该行是汇总，明细只是拆解，计算每日总量不得重复相加。今后按关联明细逐项记录实际摄入、份量、热量及来源；未知不填0。写前查重，汇总和明细一并核对后保存，写后回查。网站通过 nutrition_save_meal_details 事务同步汇总和明细，meal_edit_audit 保存修改前后快照；components_complete 仅表示食物是否全部列出，不代表每项营养值已知。';
notify pgrst, 'reload schema';
commit;
