(() => {
'use strict';
const grid = document.getElementById('module-grid');
const toggle = document.getElementById('module-sort-toggle');
const message = document.getElementById('module-sort-message');
if (!grid || !toggle || !message) return;
const cards = () => [...grid.querySelectorAll(':scope > .module-card')];
const cardId = card => card.dataset.sortId;
const knownIds = new Set(cards().map(cardId));
const localKey = 'rain.module-order.v1';
let db, userId, editing = false, dragCard = null, saveQueue = Promise.resolve(), changeNumber = 0;
const say = value => { message.textContent = value; };
const order = () => cards().map(cardId);
function applyOrder(ids) {
  if (!Array.isArray(ids)) return;
  const map = new Map(cards().map(c => [cardId(c),c]));
  const ordered = [];
  for (const id of ids) if (map.has(id) && !ordered.includes(id)) ordered.push(id);
  for (const id of map.keys()) if (!ordered.includes(id)) ordered.push(id);
  for (const id of ordered) grid.append(map.get(id));
  refreshControls();
}
function refreshControls() {
  const visible = cards().filter(c => !c.hidden);
  visible.forEach((card,i)=>{
    const up=card.querySelector('[data-move="up"]'),down=card.querySelector('[data-move="down"]');
    if(up)up.disabled=i===0;
    if(down)down.disabled=i===visible.length-1;
  });
}
function move(card,dir) {
  const visible = cards().filter(c=>!c.hidden), pos=visible.indexOf(card), target=visible[pos+dir];
  if(!target)return;
  if(dir<0)grid.insertBefore(card,target);
  else grid.insertBefore(card,target.nextSibling);
  refreshControls();
  saveCloud();
}
function saveCloud() {
  const snapshot = order(), version = ++changeNumber;
  say('正在同步排序到云端…');
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{
    const {error}=await db.from('site_module_order').upsert({
      user_id:userId,module_ids:snapshot,updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
    if(error)throw error;
    if(version===changeNumber)say('顺序已保存到云端，其他设备刷新后生效。');
  }).catch(e=>{
    if(version===changeNumber)say('云端保存失败：'+e.message+'。请检查网络后再次调整顺序。');
  });
}
function makeControls(card) {
  const container=card.querySelector('.module-controls');
  const name=card.querySelector('h2')?.textContent || '模块';
  for(const [direction,text] of [['up','↑'],['down','↓']]){
    const btn=document.createElement('button');btn.type='button';btn.dataset.move=direction;
    btn.textContent=text;btn.setAttribute('aria-label',name+(direction==='up'?'上移':'下移'));
    btn.addEventListener('click',()=>move(card,direction==='up'?-1:1));
    container.append(btn);
  }
  const handle=document.createElement('button');
  handle.type='button';handle.className='drag-handle';handle.textContent='⠿';handle.draggable=true;
  handle.setAttribute('aria-label','鼠标拖动'+name+'排序');
  handle.title='电脑端按住拖动；手机端请使用上下箭头';
  handle.addEventListener('dragstart',e=>{
    dragCard=card;card.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',cardId(card));
  });
  handle.addEventListener('dragend',()=>{card.classList.remove('dragging');dragCard=null;});
  container.append(handle);
  card.addEventListener('dragover',e=>{if(editing&&dragCard&&dragCard!==card&&!card.hidden)e.preventDefault();});
  card.addEventListener('drop',e=>{
    if(!editing||!dragCard||dragCard===card||card.hidden)return;
    e.preventDefault();
    const mid=card.getBoundingClientRect().top+card.getBoundingClientRect().height/2;
    grid.insertBefore(dragCard,e.clientY<mid?card:card.nextSibling);
    dragCard.classList.remove('dragging');dragCard=null;
    refreshControls();saveCloud();
  });
}
toggle.addEventListener('click',()=>{
  editing=!editing;
  grid.classList.toggle('sorting',editing);
  toggle.textContent=editing?'完成调整':'调整顺序';
  toggle.setAttribute('aria-pressed',String(editing));
  say(editing?'点击卡片右上角的 ↑ ↓ 调整顺序，修改后自动同步云端。':'模块排序已退出编辑模式。');
  refreshControls();
});
(async()=>{
  try{
    db=await window.RAIN_SITE_AUTH;
    const state=window.RAIN_SITE_ACCESS;
    if(!state?.owner||!state.user?.id)throw Error('仅网站主人可以调整模块顺序');
    userId=state.user.id;
    cards().forEach(makeControls);
    const {data,error}=await db.from('site_module_order').select('module_ids').eq('user_id',userId).maybeSingle();
    if(error)throw error;
    if(data?.module_ids?.length){
      applyOrder(data.module_ids);
      say('排序已从云端加载。');
    }else{
      let old=[];
      try{
        const stored=JSON.parse(localStorage.getItem(localKey)||'[]');
        if(Array.isArray(stored))old=stored.filter(id=>typeof id==='string'&&knownIds.has(id));
      }catch{}
      if(old.length){applyOrder(old);saveCloud();}
      else say('可调整模块顺序，自动同步到云端。');
    }
    toggle.disabled=false;
    refreshControls();
  }catch(e){toggle.disabled=true;say('暂时无法启用云端排序：'+e.message);}
})();
})();