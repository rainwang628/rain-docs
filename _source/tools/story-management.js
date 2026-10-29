(() => {
'use strict';
const $=id=>document.getElementById(id);
const root=new URL('../',document.currentScript.src);
let db,user,stories=[],pending=[],loading=false;
const say=text=>{$('story-status').textContent=text};
function button(label,fn,disabled=false) {
  const b=document.createElement('button');b.type='button';b.className='story-delete';b.textContent=label;b.disabled=disabled;
  b.addEventListener('click',()=>Promise.resolve(fn()).catch(e=>say('操作失败：'+(e?.message||String(e)))));return b;
}
function render() {
  const list=$('story-list');list.replaceChildren();
  if(!stories.length){const p=document.createElement('p');p.textContent='目前没有已发布的故事。';list.append(p)}
  for(const story of stories){
    const wait=pending.find(r=>r.slug===story.slug),card=document.createElement('article');card.className='story-card';
    const body=document.createElement('div'),title=document.createElement('h2'),desc=document.createElement('p'),link=document.createElement('a');
    title.textContent=story.title;desc.textContent=story.description||'';link.textContent='查看故事';link.href=new URL('stories/'+encodeURIComponent(story.slug)+'/',root).href;
    body.append(title,desc,link);
    if(wait){const progress=document.createElement('p');progress.className='story-progress';progress.textContent=wait.last_error?'处理暂未完成，系统会重试。':'删除请求已提交，正在等待处理。';body.append(progress)}
    card.append(body,button(wait?'删除处理中':'删除故事',()=>requestDeletion(story),!!wait));list.append(card);
  }
  const missing=pending.filter(r=>!stories.some(s=>s.slug===r.slug));
  $('story-pending').hidden=!missing.length;$('story-pending-list').replaceChildren();
  for(const r of missing){const p=document.createElement('p');p.className='story-pending-row';p.textContent=r.slug+'：'+(r.last_error?'网页发布尚未完成，系统会重试。':'正在等待网页发布完成。');$('story-pending-list').append(p)}
}
async function load() {
  if(loading)return;loading=true;
  try{
    const [res,rows]=await Promise.all([
      fetch(new URL('assets/story-catalog.json',root),{cache:'no-store'}),
      db.from('site_article_deletion_requests').select('id,slug,status,last_error,created_at').eq('kind','story').eq('status','pending').order('created_at',{ascending:true})
    ]);
    if(!res.ok)throw Error('故事清单读取失败');if(rows.error)throw rows.error;
    const catalog=await res.json();if(!Array.isArray(catalog))throw Error('故事清单格式不正确');
    stories=catalog.filter(x=>typeof x.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.slug)&&typeof x.title==='string');
    pending=rows.data||[];render();say(pending.length?'删除请求正在处理，可刷新查看进度。':'已连接 · 显示已发布的故事');
  }finally{loading=false}
}
async function requestDeletion(story) {
  if(!window.RAIN_SITE_ACCESS?.owner||!user)throw Error('仅网站主人可以删除');
  if(!confirm('确定删除《'+story.title+'》吗？\n\n故事网页和 GitHub 上的 HTML 源文件会一并删除，通常几分钟后生效。GitHub 历史版本仍可恢复。'))return;
  say('正在提交删除请求…');
  const {error}=await db.from('site_article_deletion_requests').insert({owner_id:user.id,kind:'story',slug:story.slug});
  if(error){if(error.code==='23505'){await load();return}throw error}
  await load();
}
$('story-refresh').addEventListener('click',()=>load().catch(e=>say('读取失败：'+e.message)));
(async()=>{
  try{db=await window.RAIN_SITE_AUTH;const result=await db.auth.getUser();if(result.error)throw result.error;user=result.data.user;
    if(!user||!window.RAIN_SITE_ACCESS?.owner)throw Error('请使用网站主人账号登录');
    await load();setInterval(()=>{if(pending.length)load().catch(e=>say('读取失败：'+e.message))},30000);
  }catch(e){say('操作失败：'+e.message)}
})();
})();
