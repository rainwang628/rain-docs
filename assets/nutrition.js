(() => {
'use strict';
const $=id=>document.getElementById(id), fmt=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:1});
const labels={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐'};
const fields=['kcal','protein_g','fat_g','carbs_g','sodium_mg'];
const ids={kcal:'edit-kcal',protein_g:'edit-protein',fat_g:'edit-fat',carbs_g:'edit-carbs',sodium_mg:'edit-sodium'};
let db,user,foods=[],meals=[],editing='meal',importRows=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=v=>v===''||v===null||v===undefined?null:Number(v);
const dateLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function status(t){$('nutrition-status').textContent=t}
function safeError(e){status('操作失败：'+(e?.message||String(e)))}
function authGuard(){if(!user)throw Error('请先登录');if(!window.RAIN_SITE_ACCESS?.owner)throw Error('仅网站主人可以使用饮食管理')}
async function loadFoods(){authGuard();const {data,error}=await db.from('food_library').select('*').order('name').limit(2000);if(error)throw error;foods=data||[];renderFoods();renderFoodSelect()}
async function loadMeals(){authGuard();const date=$('meal-date').value;const {data,error}=await db.from('meal_items').select('*').eq('meal_date',date).order('created_at',{ascending:true}).limit(500);if(error)throw error;meals=data||[];renderMeals();window.dispatchEvent(new Event('nutrition:changed'))}
function showTab(tab){for(const btn of document.querySelectorAll('[data-tab]'))btn.classList.toggle('active',btn.dataset.tab===tab);for(const t of ['journal','foods','import'])$('tab-'+t).hidden=t!==tab}
function renderFoodSelect(){const s=$('edit-food-id');s.innerHTML='<option value="">手动输入</option>'+foods.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name+(f.brand?' · '+f.brand:''))+'</option>').join('')}
function renderFoods(){const term=$('food-search').value.trim().toLowerCase();const list=foods.filter(f=>(f.name+' '+f.brand).toLowerCase().includes(term));$('food-list').innerHTML=list.length?list.map(f=>'<div class="n-item"><div><strong>'+esc(f.name)+'</strong> '+esc(f.brand)+'<small>每 '+fmt(f.basis_g)+'g：'+(f.kcal===null?'热量未知':fmt(f.kcal)+' kcal')+' · 蛋白质 '+(f.protein_g===null?'未知':fmt(f.protein_g)+'g')+' · 脂肪 '+(f.fat_g===null?'未知':fmt(f.fat_g)+'g')+' · 钠 '+(f.sodium_mg===null?'未知':fmt(f.sodium_mg)+'mg')+'</small></div><div class="n-actions"><button type="button" class="n-secondary" data-action="edit-food" data-id="'+f.id+'">编辑</button><button type="button" class="n-secondary" data-action="delete-food" data-id="'+f.id+'">删除</button></div></div>').join(''):'<p class="n-empty">暂无匹配的食物。可以新增常用食物。</p>'}
function renderMeals(){
const stats=[['kcal','热量','kcal'],['protein_g','蛋白质','g'],['fat_g','总脂肪','g'],['sodium_mg','钠','mg']];
$('daily-stats').innerHTML=stats.map(([key,title,unit])=>{const known=meals.filter(m=>m[key]!==null);const sum=known.reduce((a,m)=>a+Number(m[key]),0);return '<div class="n-stat"><span>'+title+'</span><strong>'+(known.length?fmt(sum):'—')+'</strong> '+(known.length?unit:'')+'<small style="display:block;color:#637784">'+(known.length<meals.length?'部分未知':'已记录合计')+'</small></div>'}).join('');
$('meal-list').innerHTML=Object.entries(labels).map(([type,title])=>{const rows=meals.filter(m=>m.meal_type===type);return '<section class="n-meal"><h3>'+title+' · '+rows.length+' 项</h3>'+(rows.length?rows.map(m=>'<div class="n-item"><div><strong>'+esc(m.food_name)+'</strong> '+esc(m.brand)+'<small>'+fmt(m.amount_g)+'g · '+(m.kcal===null?'热量未知':fmt(m.kcal)+' kcal')+' · 蛋白质 '+(m.protein_g===null?'未知':fmt(m.protein_g)+'g')+(m.note?' · '+esc(m.note):'')+'</small></div><div class="n-actions"><button type="button" class="n-secondary" data-action="edit-meal" data-id="'+m.id+'">编辑</button><button type="button" class="n-secondary" data-action="delete-meal" data-id="'+m.id+'">删除</button></div></div>').join(''):'<div class="n-empty">尚无记录（不代表未进食）</div>')+'</section>'}).join('')
}
function resetDialog(kind,obj={}){
editing=kind;$('nutrition-form').reset();$('edit-id').value=obj.id||'';
$('form-heading').textContent=(obj.id?'编辑':'新增')+(kind==='food'?'常用食物':'饮食记录');
$('meal-fields').hidden=kind==='food';$('amount-label').firstChild.textContent=kind==='food'?'营养基准重量（克）':'食用重量（克）';
$('edit-date').value=obj.meal_date||$('meal-date').value;$('edit-type').value=obj.meal_type||'breakfast';
$('edit-name').value=obj.food_name||obj.name||'';$('edit-brand').value=obj.brand||'';
$('edit-amount').value=obj.amount_g??obj.basis_g??100;
$('edit-note').value=obj.note??obj.source_note??'';
for(const f of fields)$(ids[f]).value=obj[f]??'';
$('edit-food-id').value=obj.food_id||'';
$('nutrition-dialog').showModal()
}
function fillFromFood(){const food=foods.find(f=>f.id===$('edit-food-id').value);if(!food)return;
$('edit-name').value=food.name;$('edit-brand').value=food.brand;
const qty=Number($('edit-amount').value);const factor=qty>0?qty/Number(food.basis_g):0;
for(const f of fields)$(ids[f]).value=food[f]===null?'':String(Math.round(Number(food[f])*factor*1000)/1000)
}
async function saveForm(){
authGuard();const kind=editing,oldId=$('edit-id').value;
const name=$('edit-name').value.trim(),amount=Number($('edit-amount').value);
if(!name||!Number.isFinite(amount)||amount<=0)throw Error('请填写食物名称与有效重量');
const vals={};for(const f of fields){const v=numeric($(ids[f]).value);if(v!==null&&(!Number.isFinite(v)||v<0))throw Error('营养值不能为负数');vals[f]=v}
let table,payload;
if(kind==='food'){table='food_library';payload={name,brand:$('edit-brand').value.trim(),basis_g:amount,source_note:$('edit-note').value.trim(),...vals}}
else {table='meal_items';payload={meal_date:$('edit-date').value,meal_type:$('edit-type').value,food_id:$('edit-food-id').value||null,food_name:name,brand:$('edit-brand').value.trim(),amount_g:amount,note:$('edit-note').value.trim(),...vals}}
const query=oldId?db.from(table).update(payload).eq('id',oldId).eq('owner_id',user.id):db.from(table).insert({...payload,owner_id:user.id});
const {error}=await query;if(error)throw error;
$('nutrition-dialog').close();await (kind==='food'?loadFoods():loadMeals());status('保存成功')
}
async function deleteRow(kind,id){
authGuard();if(!confirm('确定删除这条'+(kind==='food'?'食物库':'饮食')+'记录吗？'))return;
const table=kind==='food'?'food_library':'meal_items';const {error}=await db.from(table).delete().eq('id',id).eq('owner_id',user.id);if(error)throw error;
await (kind==='food'?loadFoods():loadMeals());status('已删除')
}
function checkImport(){
const value=JSON.parse($('import-json').value);const records=Array.isArray(value)?value:[value];if(!records.length||records.length>100)throw Error('每次支持1至100餐');
const rows=[];for(const rec of records){
if(!/^\d{4}-\d{2}-\d{2}$/.test(rec.meal_date)||!labels[rec.meal_type]||!Array.isArray(rec.items)||!rec.items.length||rec.items.length>100)throw Error('请检查日期、餐次和 items 数组');
for(const item of rec.items){if(typeof item.food_name!=='string'||!item.food_name.trim()||item.food_name.length>120||!Number.isFinite(Number(item.amount_g))||Number(item.amount_g)<=0)throw Error('食物名称或重量不正确');
const v={meal_date:rec.meal_date,meal_type:rec.meal_type,food_name:item.food_name.trim(),brand:String(item.brand||''),amount_g:Number(item.amount_g),note:String(item.note||'')};
for(const f of fields){const n=numeric(item[f]);if(n!==null&&(!Number.isFinite(n)||n<0))throw Error(f+' 数值无效');v[f]=n}rows.push(v)}
}if(rows.length>200)throw Error('一次最多导入200条食物');return rows
}
function previewImport(){importRows=checkImport();$('import-preview').innerHTML='<p>检查通过，共 '+importRows.length+' 条食物。以下为即将写入的内容：</p>'+importRows.map(r=>'<div class="n-item"><div>'+esc(r.meal_date)+' '+labels[r.meal_type]+' · '+esc(r.food_name)+' '+fmt(r.amount_g)+'g · '+(r.kcal===null?'热量未知':fmt(r.kcal)+' kcal')+'</div></div>').join('');$('save-import').disabled=false}
async function saveImport(){
authGuard();if(!importRows?.length)throw Error('请先检查记录');
const existing=new Map();
for(const date of [...new Set(importRows.map(r=>r.meal_date))]){const {data,error}=await db.from('meal_items').select('meal_date,meal_type,food_name,amount_g').eq('meal_date',date);if(error)throw error;for(const r of data||[])existing.set([r.meal_date,r.meal_type,r.food_name,Number(r.amount_g)].join('|'),true)}
const duplicate=importRows.filter(r=>existing.has([r.meal_date,r.meal_type,r.food_name,r.amount_g].join('|')));
if(duplicate.length)throw Error('发现 '+duplicate.length+' 条疑似重复记录，请先核对，未执行导入');
const {error}=await db.from('meal_items').insert(importRows.map(r=>({...r,owner_id:user.id})));if(error)throw error;
status('成功导入 '+importRows.length+' 条食物');importRows=null;$('save-import').disabled=true;$('import-preview').textContent='导入成功';$('import-json').value='';await loadMeals()
}
document.addEventListener('click',async e=>{const target=e.target.closest('[data-action]');if(!target)return;try{const id=target.dataset.id,action=target.dataset.action;
if(action==='edit-food')resetDialog('food',foods.find(f=>f.id===id));
if(action==='edit-meal')resetDialog('meal',meals.find(m=>m.id===id));
if(action==='delete-food')await deleteRow('food',id);
if(action==='delete-meal')await deleteRow('meal',id)
}catch(err){safeError(err)}});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$('meal-date').value=dateLocal();$('meal-date').addEventListener('change',()=>loadMeals().catch(safeError));
$('food-search').addEventListener('input',renderFoods);
$('new-meal').addEventListener('click',()=>resetDialog('meal'));
$('new-food').addEventListener('click',()=>resetDialog('food'));
$('edit-food-id').addEventListener('change',fillFromFood);
$('edit-amount').addEventListener('change',()=>{if(editing==='meal'&&$('edit-food-id').value)fillFromFood()});
$('cancel-edit').addEventListener('click',()=>$('nutrition-dialog').close());
$('nutrition-form').addEventListener('submit',e=>{e.preventDefault();saveForm().catch(safeError)});
$('reload').addEventListener('click',()=>Promise.all([loadFoods(),loadMeals()]).then(()=>status('已刷新')).catch(safeError));
$('preview-import').addEventListener('click',()=>{try{previewImport()}catch(err){importRows=null;$('save-import').disabled=true;safeError(err)}});
$('import-json').addEventListener('input',()=>{importRows=null;$('save-import').disabled=true;$('import-preview').textContent=''});
$('save-import').addEventListener('click',()=>saveImport().catch(safeError));
(async()=>{try{db=await window.RAIN_SITE_AUTH;const {data,error}=await db.auth.getUser();if(error)throw error;user=data.user;
if(!user||!window.RAIN_SITE_ACCESS?.owner)throw Error('请登录网站主人账号');
await Promise.all([loadFoods(),loadMeals()]);status('已连接 · 数据来自 Supabase')
}catch(e){safeError(e)}})();
})();