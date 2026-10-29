(() => {
'use strict';
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('zh-CN', {maximumFractionDigits: 1});
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric = v => v === '' || v === null || v === undefined ? null : Number(v);
const labels = {breakfast:'早餐', lunch:'午餐', dinner:'晚餐', snack:'加餐'};
const fields = ['kcal','protein_g','fat_g','carbs_g','sodium_mg'];
const fieldLabels = {kcal:'热量 kcal',protein_g:'蛋白质 g',fat_g:'脂肪 g',carbs_g:'碳水 g',sodium_mg:'钠 mg'};
const ids = {kcal:'edit-kcal',protein_g:'edit-protein',fat_g:'edit-fat',carbs_g:'edit-carbs',sodium_mg:'edit-sodium'};
const weightLabels = {weighed:'称重',reported:'用户报告',calculated:'折算',estimated:'估算',unknown:'重量未知'};
const energyLabels = {label:'按包装',reference:'参考资料',estimated:'估算',unknown:'热量未知'};
let db, user, foods = [], meals = [], components = new Map(), editing = 'meal', importRows = null, mealRequestId = 0;
let legacyRevision = null, detailState = null;
const dateLocal = () => {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function newUuid() {
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function status(t) {$('nutrition-status').textContent=t}
function safeError(e) {status('操作失败：'+(e?.message||String(e)))}
function authGuard() {if(!user)throw Error('请先登录');if(!window.RAIN_SITE_ACCESS?.owner)throw Error('仅网站主人可以使用饮食管理')}
function showTab(tab) {
  for(const btn of document.querySelectorAll('[data-tab]'))btn.classList.toggle('active',btn.dataset.tab===tab);
  for(const t of ['journal','foods','import'])$('tab-'+t).hidden=t!==tab;
}
async function loadFoods() {
  authGuard();const {data,error}=await db.from('food_library').select('*').order('name').limit(2000);
  if(error)throw error;foods=data||[];renderFoods();renderFoodSelect();
}
async function loadMeals() {
  authGuard();const date=$('meal-date').value,requestId=++mealRequestId;
  const {data,error,count}=await db.from('meal_items').select('*',{count:'exact'}).eq('meal_date',date).order('created_at',{ascending:true}).limit(500);
  if(error)throw error;
  if(count!==null&&count>(data||[]).length)throw Error('当天餐次过多，未能完整读取，请稍后重试');
  const nextMeals=data||[], nextComponents=new Map(nextMeals.map(m=>[m.id,[]]));
  if(nextMeals.length){
    const r=await db.from('meal_components').select('*',{count:'exact'}).in('meal_item_id',nextMeals.map(m=>m.id)).order('component_order',{ascending:true}).limit(2500);
    if(r.error)throw Error('餐次已读取，但食物明细读取失败：'+r.error.message);
    if(r.count!==null&&r.count>(r.data||[]).length)throw Error('食物明细过多，未能完整读取，请稍后重试');
    for(const item of r.data||[])if(nextComponents.has(item.meal_item_id))nextComponents.get(item.meal_item_id).push(item);
  }
  if(requestId!==mealRequestId)return;
  meals=nextMeals;components=nextComponents;renderMeals();window.dispatchEvent(new Event('nutrition:changed'));
}
function renderFoodSelect() {
  $('edit-food-id').innerHTML='<option value="">手动输入</option>'+foods.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name+(f.brand?' · '+f.brand:''))+'</option>').join('');
}
function foodBasisUnit(food) {return /basis_g\s*=[\s\S]*(ml|毫升)/i.test(food.source_note||'')?'ml':'g'}
function renderFoods() {
  const term=$('food-search').value.trim().toLowerCase();
  const list=foods.filter(f=>(f.name+' '+f.brand).toLowerCase().includes(term));
  $('food-list').innerHTML=list.length?list.map(f=>'<div class="n-item"><div><strong>'+esc(f.name)+'</strong> '+esc(f.brand)+
    '<small>每 '+fmt(f.basis_g)+foodBasisUnit(f)+'：'+(f.kcal==null?'热量未知':fmt(f.kcal)+' kcal')+' · 蛋白质 '+(f.protein_g==null?'未知':fmt(f.protein_g)+'g')+
    ' · 脂肪 '+(f.fat_g==null?'未知':fmt(f.fat_g)+'g')+' · 钠 '+(f.sodium_mg==null?'未知':fmt(f.sodium_mg)+'mg')+
    '</small></div><div class="n-actions"><button type="button" class="n-secondary" data-action="edit-food" data-id="'+esc(f.id)+'">编辑</button><button type="button" class="n-secondary" data-action="delete-food" data-id="'+esc(f.id)+'">删除</button></div></div>').join(''):
    '<p class="n-empty">暂无匹配的食物。可以新增常用食物。</p>';
}
function itemAmount(c) {
  const pieces=[];
  if(c.portion_text)pieces.push(esc(c.portion_text));
  if(c.amount_g==null)pieces.push('克重未知');
  else pieces.push('克重 '+fmt(c.amount_g)+'g（'+esc(weightLabels[c.weight_basis]||'来源待核')+'）');
  return pieces.join(' · ');
}
function renderComponent(c) {
  return '<div class="n-component"><div class="n-component-main"><strong>'+esc(c.food_name)+'</strong>'+(c.brand?' <span>'+esc(c.brand)+'</span>':'')+
    '<small>'+itemAmount(c)+'</small></div><div class="n-component-energy">'+(c.kcal==null?'热量未知':fmt(c.kcal)+' kcal')+
    '<small>'+(c.kcal==null?'未填写':esc(energyLabels[c.energy_basis]||'来源待核'))+'</small></div>'+
    '<div class="n-component-extra">'+(c.protein_g==null?'蛋白质未知':'蛋白质 '+fmt(c.protein_g)+'g')+
    (c.sodium_mg==null?' · 钠未知':' · 钠 '+fmt(c.sodium_mg)+'mg')+
    (c.source_note?'<details><summary>查看来源和说明</summary><p>'+esc(c.source_note)+'</p></details>':'')+'</div></div>';
}
function renderMeal(m) {
  const list=components.get(m.id)||[], isSummary=list.length>0;
  const placeholder=m.amount_g==null || (Number(m.amount_g)===1 && /占位|份量未知|重量未知/.test(m.note||''));
  const amountText=isSummary?'整餐汇总':placeholder?'份量待核':fmt(m.amount_g)+'g';
  const completeness=m.components_complete===true?'明细已标记完整':m.components_complete===false?'部分明细 · 整餐沿用原估值':'明细完整性未标记';
  return '<article class="n-meal-record"><div class="n-item"><div class="n-record-head"><strong>'+esc(m.food_name)+'</strong> '+esc(m.brand)+
    '<small>'+amountText+' · '+(m.kcal==null?'热量未知':fmt(m.kcal)+' kcal')+' · 蛋白质 '+(m.protein_g==null?'未知':fmt(m.protein_g)+'g')+'</small>'+
    (m.note?'<details class="n-note"><summary>原记录和依据</summary><p>'+esc(m.note)+'</p></details>':'')+'</div>'+
    '<div class="n-actions"><button type="button" class="n-secondary" data-action="'+(isSummary?'edit-details':'edit-meal')+'" data-id="'+esc(m.id)+'">'+(isSummary?'编辑明细':'编辑')+'</button>'+
    (!isSummary?'<button type="button" class="n-secondary" data-action="edit-details" data-id="'+esc(m.id)+'">补充明细</button>':'')+
    '<button type="button" class="n-secondary" data-action="delete-meal" data-id="'+esc(m.id)+'">删除</button></div></div>'+
    (isSummary?'<div class="n-component-list"><div class="n-component-heading"><span>食物明细 · '+list.length+' 项</span><small>'+completeness+'</small></div>'+list.map(renderComponent).join('')+'</div>':'')+'</article>';
}
function renderMeals() {
  const stats=[['kcal','热量','kcal'],['protein_g','蛋白质','g'],['fat_g','总脂肪','g'],['sodium_mg','钠','mg']];
  $('daily-stats').innerHTML=stats.map(([key,title,unit])=>{
    const known=meals.filter(m=>m[key]!=null),sum=known.reduce((a,m)=>a+Number(m[key]),0);
    return '<div class="n-stat"><span>'+title+'</span><strong>'+(known.length?fmt(sum):'—')+'</strong> '+(known.length?unit:'')+
      '<small style="display:block;color:#637784">'+(known.length<meals.length?'部分未知':'已记录合计')+'</small></div>';
  }).join('');
  $('meal-list').innerHTML=Object.entries(labels).map(([type,title])=>{
    const rows=meals.filter(m=>m.meal_type===type);
    return '<section class="n-meal"><h3>'+title+' · '+rows.length+' 条</h3>'+
      (rows.length?rows.map(renderMeal).join(''):'<div class="n-empty">尚无记录（不代表未进食）</div>')+'</section>';
  }).join('');
}
async function snapshot(id) {
  const {data,error}=await db.rpc('nutrition_meal_snapshot',{p_meal_id:id});
  if(error)throw error;if(!data?.meal||!data?.revision)throw Error('餐次不存在或无权访问');return data;
}
function resetDialog(kind,obj={}) {
  editing=kind;$('nutrition-form').reset();$('edit-id').value=obj.id||'';
  $('legacy-form-error').textContent='';
  $('form-heading').textContent=(obj.id?'编辑':'新增')+(kind==='food'?'常用食物':'饮食记录');
  $('meal-fields').hidden=kind==='food';
  $('amount-label').firstChild.textContent=kind==='food'?'营养基准重量（克）':'食用重量（克，可留空）';
  $('edit-date').value=obj.meal_date||$('meal-date').value;$('edit-type').value=obj.meal_type||'breakfast';
  $('edit-name').value=obj.food_name||obj.name||'';$('edit-brand').value=obj.brand||'';
  $('edit-amount').value=obj.id?(obj.amount_g??obj.basis_g??''):(kind==='food'?100:'');
  $('edit-note').value=obj.note??obj.source_note??'';
  for(const f of fields)$(ids[f]).value=obj[f]??'';
  $('edit-food-id').value=obj.food_id||'';$('nutrition-dialog').showModal();
}
async function editLegacy(id) {
  const snap=await snapshot(id);
  if(snap.components.length){await editDetails(id);return}
  legacyRevision=snap.revision;resetDialog('meal',snap.meal);
}
function fillFromFood() {
  const food=foods.find(f=>f.id===$('edit-food-id').value);if(!food)return;
  $('edit-name').value=food.name;$('edit-brand').value=food.brand;
  const qty=numeric($('edit-amount').value);
  if(qty===null||qty<=0)return;
  if(/毫升|ml\b/i.test(food.source_note||''))throw Error('这款饮品的食物库规格按毫升计，请手动填写营养，避免把毫升当作克');
  const factor=qty/Number(food.basis_g);
  for(const f of fields)$(ids[f]).value=food[f]==null?'':String(Math.round(Number(food[f])*factor*1000)/1000);
}
async function verifySnapshot(id,revision) {
  const verified=await snapshot(id);
  if(verified.revision!==revision)throw Error('保存后记录发生了变化，请刷新核对');
  return verified;
}
async function saveForm() {
  authGuard();const kind=editing,oldId=$('edit-id').value;
  const name=$('edit-name').value.trim(),amount=numeric($('edit-amount').value);
  if(!name||amount!==null&&(!Number.isFinite(amount)||amount<=0)||kind==='food'&&amount===null)throw Error(kind==='food'?'请填写食物名称与有效的营养基准重量':'请检查食物名称和重量');
  const vals={};for(const f of fields){const v=numeric($(ids[f]).value);if(v!==null&&(!Number.isFinite(v)||v<0))throw Error('营养值不能为负数');vals[f]=v}
  let table,payload;
  if(kind==='food'){table='food_library';payload={name,brand:$('edit-brand').value.trim(),basis_g:amount,source_note:$('edit-note').value.trim(),...vals}}
  else {table='meal_items';payload={meal_date:$('edit-date').value,meal_type:$('edit-type').value,food_id:$('edit-food-id').value||null,food_name:name,brand:$('edit-brand').value.trim(),amount_g:amount,note:$('edit-note').value.trim(),...vals}}
  if(kind==='meal'&&oldId){
    const {data,error}=await db.rpc('nutrition_save_legacy_meal',{p_meal_id:oldId,p_expected_revision:legacyRevision,p_payload:payload});
    if(error)throw error;
    try {await verifySnapshot(oldId,data.revision)} catch(e) {$('nutrition-dialog').close();status('保存已提交，但回读未确认：'+e.message+'；请刷新核对后再操作');return}
  } else {
    const q=oldId?db.from(table).update(payload).eq('id',oldId).eq('owner_id',user.id):db.from(table).insert({...payload,owner_id:user.id});
    const {error}=await q;if(error)throw error;
  }
  $('nutrition-dialog').close();await(kind==='food'?loadFoods():loadMeals());status('保存成功');
}
async function deleteRow(kind,id) {
  authGuard();
  if(kind==='food'){
    if(!confirm('确定删除这条常用食物记录吗？'))return;
    const {error}=await db.from('food_library').delete().eq('id',id).eq('owner_id',user.id);if(error)throw error;
    await loadFoods();status('已删除');return;
  }
  const before=await snapshot(id),n=before.components.length;
  if(!confirm('确定删除这条餐次记录'+(n?'及其 '+n+' 项食物明细':'')+'吗？删除前会保存原始记录。'))return;
  const {error}=await db.rpc('nutrition_delete_meal',{p_meal_id:id,p_expected_revision:before.revision});if(error)throw error;
  const check=await db.from('meal_items').select('id').eq('id',id).maybeSingle();
  if(check.error||check.data){status('删除已提交，但回读未确认，请刷新核对');return}
  await loadMeals();status('已删除，原记录已保留在修改历史');
}
function options(map,selected) {
  return Object.entries(map).map(([k,v])=>'<option value="'+esc(k)+'"'+(k===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
}
function componentCard(c={}) {
  const card=document.createElement('section');card.className='n-editor-card';card.dataset.id=c.id||'';
  card.dataset.originalInputs=JSON.stringify([c.food_name||'',c.brand||'',c.portion_text||'',c.amount_g==null?'':String(Number(c.amount_g))]);
  card.innerHTML='<div class="n-card-head"><strong class="n-card-number">食物</strong><button type="button" class="n-secondary" data-detail-action="remove">移除</button></div>'+
    '<label>从常用食物库选择（可选）<select data-field="food_id"><option value="">手动填写</option>'+foods.map(f=>'<option value="'+esc(f.id)+'"'+(f.id===c.food_id?' selected':'')+'>'+esc(f.name+(f.brand?' · '+f.brand:''))+'</option>').join('')+'</select></label>'+
    '<div class="n-fields"><label>食物名称<input data-field="food_name" maxlength="120" value="'+esc(c.food_name||'')+'" required></label>'+
    '<label>品牌（可选）<input data-field="brand" maxlength="120" value="'+esc(c.brand||'')+'"></label>'+
    '<label>份量说明<input data-field="portion_text" value="'+esc(c.portion_text||'')+'" placeholder="如：2个、半碗、250毫升"></label>'+
    '<label>食用重量（克，可留空）<input type="number" min=".001" step="any" data-field="amount_g" value="'+esc(c.amount_g??'')+'"></label>'+
    '<label>重量依据<select data-field="weight_basis">'+options({reported:'用户报告',weighed:'实际称重',calculated:'根据规格折算',estimated:'照片或经验估算'},c.weight_basis==='unknown'?'reported':c.weight_basis||'reported')+'</select></label>'+
    '<label>热量（kcal，可留空）<input type="number" min="0" step="any" data-field="kcal" value="'+esc(c.kcal??'')+'"></label>'+
    '<label>热量依据<select data-field="energy_basis">'+options({estimated:'估算',label:'包装标签计算',reference:'参考资料'},c.energy_basis==='unknown'?'estimated':c.energy_basis||'estimated')+'</select></label>'+
    Object.keys(fieldLabels).filter(f=>f!=='kcal').map(f=>'<label>'+fieldLabels[f]+'<input type="number" min="0" step="any" data-field="'+f+'" value="'+esc(c[f]??'')+'"></label>').join('')+'</div>'+
    '<div class="n-actions"><button type="button" class="n-secondary" data-detail-action="calculate">按食物库和重量计算</button></div>'+
    '<label class="n-review" hidden><input type="checkbox" data-field="nutrition_reviewed"> 食物或份量变动后，我已重新核对上面的营养值</label>'+
    '<label>来源 / 估算说明<textarea data-field="source_note" rows="2" placeholder="如：包装标签、实际称重，或照片估算">'+esc(c.source_note||'')+'</textarea></label>';
  for(const f of fields){const input=card.querySelector('[data-field="'+f+'"]');if(input.value!=='')input.dataset.atInputs=card.dataset.originalInputs}
  return card;
}
function renumber() {
  $('details-items').querySelectorAll('.n-editor-card').forEach((card,i)=>card.querySelector('.n-card-number').textContent='食物 '+(i+1));
}
function addComponent(c={}) {$('details-items').appendChild(componentCard(c));renumber();updateDetailTotal()}
function currentInputs(card) {
  const val=f=>card.querySelector('[data-field="'+f+'"]').value.trim();
  const amount=val('amount_g'),normalized=amount===''?'':String(Number(amount));
  return JSON.stringify([val('food_name'),val('brand'),val('portion_text'),normalized]);
}
function needsNutritionReview(card) {
  const current=currentInputs(card);
  return fields.some(f=>{
    const input=card.querySelector('[data-field="'+f+'"]');
    return input.value!==''&&input.dataset.atInputs&&input.dataset.atInputs!==current;
  });
}
function refreshNutritionReview(card) {
  card.querySelector('.n-review').hidden=!needsNutritionReview(card);
}
function readComponents() {
  return [...$('details-items').querySelectorAll('.n-editor-card')].map(card=>{
    const value=f=>card.querySelector('[data-field="'+f+'"]').value.trim();
    const out={id:card.dataset.id||null,food_id:value('food_id')||null,food_name:value('food_name'),brand:value('brand'),portion_text:value('portion_text')};
    if(!out.food_name)throw Error('请填写每项食物名称');
    if(needsNutritionReview(card)&&!card.querySelector('[data-field="nutrition_reviewed"]').checked)throw Error(out.food_name+'的食物或份量已改变，请先重新核对营养值并勾选确认');
    out.amount_g=numeric(value('amount_g'));
    if(out.amount_g!==null&&(!Number.isFinite(out.amount_g)||out.amount_g<=0))throw Error(out.food_name+'的重量必须大于0');
    out.weight_basis=out.amount_g===null?'unknown':value('weight_basis');
    for(const f of fields){out[f]=numeric(value(f));if(out[f]!==null&&(!Number.isFinite(out[f])||out[f]<0))throw Error(out.food_name+'的营养值不能为负数')}
    out.energy_basis=out.kcal===null?'unknown':value('energy_basis');
    out.source_note=value('source_note')||(out.id?'':'用户在网站手动填写，具体来源尚未补充。');
    return out;
  });
}
function updateDetailTotal() {
  const cards=[...$('details-items').querySelectorAll('.n-editor-card')];
  const vals=cards.map(c=>numeric(c.querySelector('[data-field="kcal"]').value));
  const known=vals.filter(v=>v!==null&&Number.isFinite(v)&&v>=0),sum=known.reduce((a,b)=>a+b,0);
  const complete=$('details-complete').checked;
  $('details-total').textContent=!cards.length?'请添加食物':complete?
    (known.length===cards.length?'按明细计算整餐：'+fmt(sum)+' kcal':'有食物热量未知，整餐热量会显示未知'):
    (known.length?'已列食物的已知热量：'+fmt(sum)+' kcal；整餐保留原估值':'部分明细；整餐保留原估值');
}
function initDetails(snap) {
  const isNew=!snap, m=snap?.meal;
  detailState={id:isNew?newUuid():m.id,revision:isNew?null:snap.revision,isNew,originalCount:snap?.components?.length||0};
  $('details-heading').textContent=isNew?'记录一餐':'编辑食物明细';
  $('details-error').textContent='';
  $('details-date').value=isNew?$('meal-date').value:m.meal_date;
  $('details-type').value=isNew?'breakfast':m.meal_type;
  $('details-title').value=isNew?'':m.food_name;
  $('details-note').value=isNew?'':m.note||'';
  for(const id of ['details-date','details-type','details-title','details-note'])$(id).disabled=!isNew;
  $('details-complete').checked=isNew||m.components_complete===true;
  $('details-items').innerHTML='';
  const list=snap?.components?.length?snap.components:[{}];for(const c of list)addComponent(c);
  updateDetailTotal();$('details-dialog').showModal();
}
async function editDetails(id) {authGuard();initDetails(await snapshot(id))}
function chooseFood(card) {
  const food=foods.find(f=>f.id===card.querySelector('[data-field="food_id"]').value);
  if(!food)return;
  card.querySelector('[data-field="food_name"]').value=food.name;
  card.querySelector('[data-field="brand"]').value=food.brand||'';
  for(const f of fields)card.querySelector('[data-field="'+f+'"]').value='';
  card.querySelector('[data-field="nutrition_reviewed"]').checked=false;
  card.querySelector('[data-field="source_note"]').value='选自常用食物库；'+(food.source_note||'来源待补充。');
  updateDetailTotal();
}
function calculateFromLibrary(card) {
  const food=foods.find(f=>f.id===card.querySelector('[data-field="food_id"]').value);
  if(!food)throw Error('请先从常用食物库选择食物');
  if(/毫升|ml\b/i.test(food.source_note||''))throw Error('这款食物的标签按毫升计，请手动填写，避免把毫升当作克');
  const qty=numeric(card.querySelector('[data-field="amount_g"]').value);
  if(qty===null||!Number.isFinite(qty)||qty<=0)throw Error('请先填写食用重量（克）');
  const factor=qty/Number(food.basis_g);
  for(const f of fields){
    const input=card.querySelector('[data-field="'+f+'"]');
    input.value=food[f]==null?'':String(Math.round(Number(food[f])*factor*1000)/1000);
    input.dataset.atInputs=currentInputs(card);
  }
  card.querySelector('[data-field="energy_basis"]').value=/包装|标签|营养成分表/.test(food.source_note||'')?'label':'reference';
  card.querySelector('[data-field="source_note"]').value='按食物库“'+food.name+'”每 '+food.basis_g+'g 数据与本次 '+qty+'g 折算；'+(food.source_note||'请补充食物库数据来源。');
  refreshNutritionReview(card);
  if(needsNutritionReview(card))card.querySelector('[data-field="nutrition_reviewed"]').checked=true;
  updateDetailTotal();
}
async function saveDetails() {
  authGuard();if(!detailState)throw Error('请重新打开餐次');
  const list=readComponents();if(!list.length)throw Error('请至少添加一项食物');
  const mealDate=$('details-date').value,mealType=$('details-type').value;
  if(!mealDate||!labels[mealType])throw Error('请选择日期和餐次');
  if(detailState.isNew){
    const r=await db.from('meal_items').select('id,food_name').eq('meal_date',mealDate).eq('meal_type',mealType);
    if(r.error)throw r.error;
    if((r.data||[]).some(m=>m.id===detailState.id))throw Error('这餐可能已经保存，请刷新核对后再操作');
    if(r.data?.length&&!confirm('当天'+labels[mealType]+'已有 '+r.data.length+' 条记录。如果是同一餐，请取消后编辑原记录；确定要新增另一条餐次吗？'))return;
  }
  const title=$('details-title').value.trim()||('餐次汇总：'+list.map(c=>c.food_name).join('、')).slice(0,120);
  const parent=detailState.isNew?{meal_date:mealDate,meal_type:mealType,food_name:title,note:$('details-note').value.trim()}:null;
  const save=$('save-details');save.disabled=true;
  try {
    const {data,error}=await db.rpc('nutrition_save_meal_details',{p_meal_id:detailState.id,p_expected_revision:detailState.revision,p_parent:parent,p_complete:$('details-complete').checked,p_components:list});
    if(error)throw error;
    try {await verifySnapshot(detailState.id,data.revision)} catch(e) {$('details-dialog').close();status('保存已提交，但回读未确认：'+e.message+'；请刷新核对后再操作');return}
    $('details-dialog').close();
    if(detailState.isNew&&$('meal-date').value!==mealDate){$('meal-date').value=mealDate;$('meal-date').dispatchEvent(new Event('change'))}
    await loadMeals();status('餐次和食物明细已保存并核对');
  } finally {save.disabled=false}
}
function checkImport() {
  const value=JSON.parse($('import-json').value),records=Array.isArray(value)?value:[value];
  if(!records.length||records.length>100)throw Error('每次支持1至100餐');
  const rows=[],keys=new Set();
  for(const rec of records){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(rec.meal_date)||!labels[rec.meal_type]||!Array.isArray(rec.items)||!rec.items.length||rec.items.length>100)throw Error('请检查日期、餐次和 items 数组');
    for(const item of rec.items){
      const amount=numeric(item.amount_g);
      if(typeof item.food_name!=='string'||!item.food_name.trim()||item.food_name.length>120||amount!==null&&(!Number.isFinite(amount)||amount<=0))throw Error('食物名称或重量不正确');
      const row={meal_date:rec.meal_date,meal_type:rec.meal_type,food_name:item.food_name.trim(),brand:String(item.brand||''),amount_g:amount,note:String(item.note||'')};
      for(const f of fields){const n=numeric(item[f]);if(n!==null&&(!Number.isFinite(n)||n<0))throw Error(f+' 数值无效');row[f]=n}
      const key=[row.meal_date,row.meal_type,row.food_name,row.amount_g].join('|');
      if(keys.has(key))throw Error('导入内容里有重复食物，请先核对');keys.add(key);rows.push(row);
    }
  }
  if(rows.length>200)throw Error('一次最多导入200条食物');return rows;
}
function previewImport() {
  importRows=checkImport();
  $('import-preview').innerHTML='<p>检查通过，共 '+importRows.length+' 条食物：</p>'+importRows.map(r=>'<div class="n-item"><div>'+esc(r.meal_date)+' '+labels[r.meal_type]+' · '+esc(r.food_name)+' '+(r.amount_g==null?'重量未知':fmt(r.amount_g)+'g')+' · '+(r.kcal==null?'热量未知':fmt(r.kcal)+' kcal')+'</div></div>').join('');
  $('save-import').disabled=false;
}
async function saveImport() {
  authGuard();if(!importRows?.length)throw Error('请先检查记录');
  const existing=new Set();
  for(const date of [...new Set(importRows.map(r=>r.meal_date))]){
    const {data,error}=await db.from('meal_items').select('meal_date,meal_type').eq('meal_date',date);if(error)throw error;
    for(const r of data||[])existing.add(r.meal_date+'|'+r.meal_type);
  }
  if(importRows.some(r=>existing.has(r.meal_date+'|'+r.meal_type)))throw Error('同日期餐次已有记录，请先检查并编辑原餐，避免整餐和食物重复计入；未执行导入');
  const {error}=await db.from('meal_items').insert(importRows.map(r=>({...r,owner_id:user.id})));if(error)throw error;
  status('成功导入 '+importRows.length+' 条食物');importRows=null;$('save-import').disabled=true;$('import-preview').textContent='导入成功';$('import-json').value='';await loadMeals();
}
document.addEventListener('click',async e=>{
  const target=e.target.closest('[data-action]');if(!target)return;
  try {const id=target.dataset.id,action=target.dataset.action;
    if(action==='edit-food')resetDialog('food',foods.find(f=>f.id===id));
    if(action==='edit-meal')await editLegacy(id);
    if(action==='edit-details')await editDetails(id);
    if(action==='delete-food')await deleteRow('food',id);
    if(action==='delete-meal')await deleteRow('meal',id);
  } catch(err){safeError(err)}
});
$('details-items').addEventListener('click',e=>{
  const button=e.target.closest('[data-detail-action]');if(!button)return;
  const card=button.closest('.n-editor-card');
  try {
    if(button.dataset.detailAction==='remove'){
      if($('details-items').children.length===1)throw Error('请至少保留一项食物；如需删除整餐，请使用餐次删除按钮');
      if(card.dataset.id&&!confirm('确定移除这一项食物吗？保存后才会生效，原记录会保留在修改历史。'))return;
      card.remove();renumber();updateDetailTotal();
    }
    if(button.dataset.detailAction==='calculate')calculateFromLibrary(card);
  } catch(err){safeError(err);alert(err.message)}
});
$('details-items').addEventListener('change',e=>{
  const card=e.target.closest('.n-editor-card');if(!card)return;
  if(e.target.dataset.field==='food_id')chooseFood(card);
  if(['food_name','brand'].includes(e.target.dataset.field)){
    const selected=foods.find(f=>f.id===card.querySelector('[data-field="food_id"]').value);
    if(selected&&((e.target.dataset.field==='food_name'&&e.target.value!==selected.name)||(e.target.dataset.field==='brand'&&e.target.value!==selected.brand)))card.querySelector('[data-field="food_id"]').value='';
  }
  refreshNutritionReview(card);updateDetailTotal();
});
$('details-items').addEventListener('input',e=>{
  const card=e.target.closest('.n-editor-card');
  if(card){
    if(['food_name','brand','portion_text','amount_g'].includes(e.target.dataset.field))card.querySelector('[data-field="nutrition_reviewed"]').checked=false;
    if(fields.includes(e.target.dataset.field))e.target.dataset.atInputs=currentInputs(card);
    refreshNutritionReview(card);
  }
  updateDetailTotal();
});
$('details-complete').addEventListener('change',updateDetailTotal);
$('add-component').addEventListener('click',()=>addComponent());
$('cancel-details').addEventListener('click',()=>$('details-dialog').close());
$('details-form').addEventListener('submit',e=>{
  e.preventDefault();$('details-error').textContent='';
  saveDetails().catch(err=>{$('details-error').textContent='保存失败：'+(err?.message||String(err));safeError(err)});
});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$('meal-date').value=dateLocal();$('meal-date').addEventListener('change',()=>loadMeals().catch(safeError));
$('food-search').addEventListener('input',renderFoods);
$('new-meal').addEventListener('click',()=>initDetails(null));
$('new-food').addEventListener('click',()=>resetDialog('food'));
$('edit-food-id').addEventListener('change',()=>{try{fillFromFood()}catch(e){safeError(e)}});
$('edit-amount').addEventListener('change',()=>{try{if(editing==='meal'&&$('edit-food-id').value)fillFromFood()}catch(e){safeError(e)}});
$('cancel-edit').addEventListener('click',()=>$('nutrition-dialog').close());
$('nutrition-form').addEventListener('submit',e=>{
  e.preventDefault();$('legacy-form-error').textContent='';
  saveForm().catch(err=>{$('legacy-form-error').textContent='保存失败：'+(err?.message||String(err));safeError(err)});
});
$('reload').addEventListener('click',()=>Promise.all([loadFoods(),loadMeals()]).then(()=>status('已刷新')).catch(safeError));
$('preview-import').addEventListener('click',()=>{try{previewImport()}catch(err){importRows=null;$('save-import').disabled=true;safeError(err)}});
$('import-json').addEventListener('input',()=>{importRows=null;$('save-import').disabled=true;$('import-preview').textContent=''});
$('save-import').addEventListener('click',()=>saveImport().catch(safeError));
(async()=>{
  try {db=await window.RAIN_SITE_AUTH;const {data,error}=await db.auth.getUser();if(error)throw error;user=data.user;
    if(!user||!window.RAIN_SITE_ACCESS?.owner)throw Error('请登录网站主人账号');
    await Promise.all([loadFoods(),loadMeals()]);status('已连接 · 数据来自 Supabase');
  } catch(e){safeError(e)}
})();
})();
