(() => {
'use strict';
const $=id=>document.getElementById(id),M=window.RainSurveys,shareId=new URLSearchParams(location.search).get('id');
let client,ready=false,current=null,records=[],surveys=[],operation=false,loaded=false,resultTurn=0,anonymousId=null;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function status(text,error=false){$('survey-status').textContent=text;$('survey-status').classList.toggle('error',error);}
function friendly(e){return /PGRST20[025]|42P01|does not exist|schema cache/.test((e.code||'')+' '+e.message)?'问卷服务尚未初始化，请执行下方脚本后重试。':e.message||'连接失败，请重试';}
async function run(fn){if(operation)return;operation=true;for(const b of document.querySelectorAll('.survey-wrap button'))b.disabled=true;try{await fn();}catch(e){status(friendly(e),true);}finally{operation=false;for(const b of document.querySelectorAll('.survey-wrap button'))b.disabled=false;}}
function owner(){return window.RAIN_SITE_ACCESS?.owner===true;}
function checkOwner(){if(!owner())throw Error('请登录网站主人账号');}
function link(s){const u=new URL(location.href);u.search='';u.searchParams.set('id',s.id);return u.href;}
function draftKey(){return 'rain.survey.draft.'+shareId;}

const COUPLE_ID='7730bfa3-039a-4ed8-87da-ca3204b9b870';
let coupleData=null,coupleTurn=0,coupleExpiryTimer=null,couplePoll=null;
const isCouple=id=>id===COUPLE_ID;
function clearCouple(){
 ++coupleTurn;coupleData=null;clearTimeout(coupleExpiryTimer);clearInterval(couplePoll);
 $('couple-comparison')?.remove();$('survey-fill').hidden=true;
 $('survey-questions').replaceChildren();$('survey-thanks').hidden=true;
}
function coupleDate(date){return new Date(date).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）';}
function compareRows(data){
 return data.survey.questions.filter(q=>!q.followUpFor).map(q=>({
 title:q.title,
 answers:['dad','mom'].map(role=>{
 const r=data.responses.find(x=>x.role===role);
 if(!r)return '对方还没有完成答题';
 const main=answerText(q,r.answers)||'未填写';
 const notes=data.survey.questions.filter(n=>n.followUpFor===q.id).map(n=>r.answers[n.id]).filter(x=>typeof x==='string'&&x.trim());
 return main+(notes.length?'\n补充：'+notes.join('\n'):'');
 })
 }));
}
function showComparison(data){
 $('couple-comparison')?.remove();$('survey-form').hidden=true;$('survey-thanks').hidden=true;
 const box=el('section',undefined,'survey-card couple-comparison');box.id='couple-comparison';
 box.append(el('h2','羊爸 × 羊妈 · 答卷对照'));
 const both=data.responses.length===2;
 box.append(el('p',both?'你们都已提交，现在可以逐题看看彼此的想法。':'对方还没有完成答题，先展示你自己的答案。'));
 const retention=data.expires_at?'在线答卷将于 '+coupleDate(data.expires_at)+' 自动删除。':'双方都提交后开始7天倒计时；目前尚未开始倒计时。';
 box.append(el('p',retention,'couple-retention'));
 const toolbar=el('div',undefined,'survey-toolbar');
 const refresh=el('button','刷新对方状态');refresh.type='button';refresh.onclick=()=>run(()=>loadCouple());
 toolbar.append(refresh);
 if(data.role==='dad'){
 const pdf=el('button','导出 PDF');pdf.type='button';
 pdf.onclick=()=>run(async()=>{
  await loadCouple();
  if(!coupleData?.submitted||coupleData.expired)throw Error('答卷不可导出');
  await window.RainCouplePDF.download(coupleData.survey.title,compareRows(coupleData),coupleData.expires_at?'在线答卷删除时间：'+coupleDate(coupleData.expires_at):'对方尚未完成；双方提交后7天删除在线答卷。');
 });
 toolbar.append(pdf);
 }
 box.append(toolbar,el('p','导出的PDF保存在你的设备，不会随在线答卷一起删除。','survey-note'));
 for(const [i,row] of compareRows(data).entries()){
 const section=el('section',undefined,'couple-row');section.append(el('h3',(i+1)+'. '+row.title));
 const grid=el('div',undefined,'couple-answer-grid');
 row.answers.forEach((text,i)=>{const card=el('div',undefined,'couple-answer');card.append(el('h4',i===0?'🐑 羊爸':'🐑 羊妈'),el('p',text));grid.append(card);});
 section.append(grid);box.append(section);
 }
 $('survey-fill').append(box);
 status(both?'双方已完成 · 可以查看逐题对照':'你已提交 · 等待对方完成');
 clearTimeout(coupleExpiryTimer);
 if(data.expires_at)coupleExpiryTimer=setTimeout(()=>{clearCouple();status('答卷已到期，在线答案已不可访问。');},Math.min(2147483647,Math.max(0,new Date(data.expires_at).getTime()-Date.now())));
 clearInterval(couplePoll);
 if(!both)couplePoll=setInterval(()=>{if(!document.hidden&&!operation)loadCouple().catch(()=>{});},30000);
}
async function loadCouple(){
 const turn=++coupleTurn;
 const uid=window.RAIN_SITE_ACCESS?.user?.id;
 if(!uid){clearCouple();$('survey-login').hidden=false;$('survey-login').replaceChildren();const a=el('a','登录羊爸或羊妈账号');a.href='../account/';$('survey-login').append(a,el('span','，然后返回本问卷。'));status('这份问卷仅限羊爸、羊妈登录后填写。');return;}
 const {data,error}=await client.rpc('couple_survey_state',{p_survey:COUPLE_ID});
 if(turn!==coupleTurn||uid!==window.RAIN_SITE_ACCESS?.user?.id)return;
 if(error){clearCouple();throw error;}
 coupleData=data;document.body.classList.add('couple-theme');
 $('survey-login').hidden=true;
 if(data.expired){clearCouple();status('答卷已到期，在线答案已不可访问；已导出的PDF仍保留在你的设备上。');return;}
 makeFill(data.survey);ready=true;
 document.querySelector('.intro h1').textContent='🐑爸🐑妈的 XP 小调查';
 $('survey-subtitle').textContent='先认真听见自己，再慢慢了解彼此。';
 const identity=document.querySelector('.survey-identity');
 identity.querySelector('span').textContent='当前填写身份';
 $('survey-nickname').textContent=data.role==='dad'?'🐑 羊爸':'🐑 羊妈';
 identity.querySelector('p').textContent='身份由登录账号确定。自己提交后才可查看双方答卷；提交后不可修改。双方完成后7天自动删除在线答卷。';
 if(data.submitted)showComparison(data);
 else{$('couple-comparison')?.remove();$('survey-submit').textContent='确认提交并查看对照';}
}

function makeFill(s){current=s;const intimate=s.questions.some(q=>q.theme==='couple');document.body.classList.toggle('couple-theme',intimate);if(!anonymousId){let storage;try{storage=localStorage;}catch{}anonymousId=M.submissionId(storage,draftKey()+'.submission',()=>crypto.randomUUID());}$('survey-nickname').textContent=M.nickname(anonymousId);$('survey-fill').hidden=false;$('survey-title').textContent=s.title;$('survey-description').textContent=s.description;let draft={};try{if(!intimate)draft=JSON.parse(localStorage.getItem(draftKey())||'{}');else localStorage.removeItem(draftKey());}catch{}const container=$('survey-questions');container.replaceChildren();
let visibleNumber=0;for(const [i,q] of s.questions.entries()){const group=el('fieldset');group.dataset.question=q.id;group.append(el('legend',`${q.followUpFor?'':(++visibleNumber)+'. '}${q.title}${q.required?' *':'（选填）'}`));if(q.followUpFor)group.classList.add('survey-followup');if(q.hint)group.append(el('p',q.hint,'survey-note'));const value=draft[q.id];
if(q.type==='text'){const input=el('textarea');input.maxLength=2000;input.required=q.required;input.value=typeof value==='string'?value:'';input.setAttribute('aria-label',q.title);group.append(input);}
else if(q.type==='rating'){for(const item of q.options){const row=el('label',undefined,'survey-rating');row.append(el('span',item));const select=el('select');select.dataset.item=item;select.required=q.required;for(const [v,t] of [['','请选择'],['1','不喜欢'],['2','比较一般'],['3','还不错'],['4','很喜欢'],['0','没参加 / 记不清']]){const option=el('option',t);option.value=v;select.append(option);}select.value=value?.[item]||'';row.append(select);group.append(row);}}
else{for(const item of q.options){const label=el('label',undefined,'survey-choice'),input=el('input');input.type=q.type==='single'?'radio':'checkbox';input.name=q.id;input.value=item;input.checked=q.type==='single'?value===item:Array.isArray(value)&&value.includes(item);if(q.type==='single')input.required=q.required;label.append(input,el('span',item));group.append(label);}}
container.append(group);}
$('survey-form').hidden=false;$('survey-thanks').hidden=true;if(!s.is_open){$('survey-form').hidden=true;status('这份问卷已经结束收集。');}else status(intimate?'13道题 · 约5—8分钟 · 可以跳过 · 填完后点击提交':'约2—3分钟，填写后点击提交。');
}
function collect(){const answers={};for(const q of current.questions){const g=[...$('survey-questions').children].find(n=>n.dataset.question===q.id);if(q.type==='text')answers[q.id]=g.querySelector('textarea').value.trim();else if(q.type==='rating')answers[q.id]=Object.fromEntries([...g.querySelectorAll('select')].map(n=>[n.dataset.item,n.value]));else if(q.type==='single')answers[q.id]=g.querySelector('input:checked')?.value||'';else answers[q.id]=[...g.querySelectorAll('input:checked')].map(n=>n.value);}return answers;}
$('survey-form').addEventListener('input',()=>{if(current?.questions.some(q=>q.theme==='couple'))return;try{localStorage.setItem(draftKey(),JSON.stringify(collect()));}catch{}});
$('survey-form').onsubmit=e=>{e.preventDefault();run(async()=>{if(!ready)throw Error('问卷服务暂时不可用，请稍后重试');const answers=M.validateAnswers(current,collect());if(isCouple(current.id)){const uid=window.RAIN_SITE_ACCESS?.user?.id;const {error}=await client.rpc('couple_survey_submit',{p_survey:current.id,answer_data:answers});if(error)throw error;if(uid!==window.RAIN_SITE_ACCESS?.user?.id)return;await loadCouple();return;}const id=anonymousId;if(!id)throw Error('匿名昵称尚未准备好，请刷新页面');const {error}=await client.rpc('survey_submit',{survey_id:current.id,submission_id:id,answer_data:answers});if(error)throw error;try{localStorage.removeItem(draftKey());}catch{}$('survey-form').hidden=true;$('survey-thanks').hidden=false;$('survey-thanks').textContent=M.nickname(anonymousId)+'，你的匿名答卷已保存，谢谢你！';status('提交成功，答卷已保存。');});};
function drawList(){const query=$('survey-search').value.trim().toLowerCase();$('survey-list').replaceChildren();for(const s of surveys.filter(s=>s.title.toLowerCase().includes(query))){const card=el('article',undefined,'tile');card.append(el('h2',s.title),el('p',`${s.is_open?'收集中':'已结束'} · ${new Date(s.created_at).toLocaleDateString('zh-CN')}`));const toolbar=el('div',undefined,'survey-toolbar'),share=el('button','复制填写链接'),results=el('button','查看结果'),toggle=el('button',s.is_open?'结束收集':'重新开放');share.onclick=()=>run(async()=>{try{await navigator.clipboard.writeText(link(s));status('填写链接已复制。');}catch{status('填写链接：'+link(s));}});results.onclick=()=>{if(isCouple(s.id)){location.href=link(s);return;}run(()=>loadResults(s));};toggle.onclick=()=>run(async()=>{checkOwner();const {data,error}=await client.from('site_surveys').update({is_open:!s.is_open}).eq('id',s.id).select('id').single();if(error)throw error;if(!data)throw Error('状态更新失败');await loadList();status(!s.is_open?'已开放收集。':'已结束收集。');});toolbar.append(share,results,toggle);card.append(toolbar);$('survey-list').append(card);}if(!$('survey-list').children.length)$('survey-list').append(el('p','暂无匹配问卷。'));}
async function loadList(){checkOwner();const {data,error}=await client.from('site_surveys').select('*').order('created_at',{ascending:false});if(error)throw error;surveys=data;drawList();}
let questionCount=0;
function addQuestion(q={type:'text',title:'',required:false,options:[],max:3}){const row=el('div',undefined,'question-editor');++questionCount;row.dataset.id=q.id||'q'+questionCount;row.meta=Object.fromEntries(['theme','hint','followUpFor'].filter(k=>q[k]).map(k=>[k,q[k]]));const title=el('input');title.placeholder='问题标题';title.required=true;title.maxLength=500;title.value=q.title;const titleLabel=el('label','问题标题');titleLabel.append(title);const type=el('select');for(const [v,t] of [['text','文字建议'],['single','单选'],['multiple','多选'],['rating','活动评分']]){const o=el('option',t);o.value=v;type.append(o);}type.value=q.type;const typeLabel=el('label','题型');typeLabel.append(type);const options=el('textarea');options.placeholder='每行一个选项 / 评分项目';options.value=(q.options||[]).join('\n');const optionLabel=el('label','选项 / 评分项目');optionLabel.append(options);const max=el('input');max.type='number';max.min=1;max.max=30;max.value=q.max||3;const maxLabel=el('label','最多选择数');maxLabel.append(max);const required=el('input');required.type='checkbox';required.checked=q.required;const requiredLabel=el('label',undefined,'survey-choice');requiredLabel.append(required,el('span','必填'));const remove=el('button','删除本题');remove.type='button';remove.onclick=()=>row.remove();function visibility(){optionLabel.hidden=type.value==='text';maxLabel.hidden=type.value!=='multiple';}type.onchange=visibility;visibility();row.append(titleLabel,typeLabel,optionLabel,maxLabel,requiredLabel,remove);row.fields={title,type,options,max,required};$('new-questions').append(row);}
function edit(s={title:'',description:'',questions:[{type:'text',title:'',required:false}]}){checkOwner();$('new-title').value=s.title;$('new-description').value=s.description;$('new-questions').replaceChildren();questionCount=0;s.questions.forEach(addQuestion);$('survey-editor').hidden=false;$('survey-editor').scrollIntoView({behavior:'smooth'});}
$('survey-new').onclick=()=>edit();$('survey-template').onclick=()=>edit(M.template);$('survey-couple-template').onclick=()=>{location.href=link({id:COUPLE_ID});};$('add-question').onclick=()=>addQuestion();$('cancel-editor').onclick=()=>{$('survey-editor').hidden=true;};
$('survey-create').onsubmit=e=>{e.preventDefault();run(async()=>{checkOwner();const s={title:$('new-title').value.trim(),description:$('new-description').value.trim(),questions:[...$('new-questions').children].map(row=>{const f=row.fields;return {...row.meta,id:row.dataset.id,title:f.title.value.trim(),type:f.type.value,required:f.required.checked,...(f.type.value==='text'?{}:{options:f.options.value.split('\n').map(x=>x.trim()).filter(Boolean)}),...(f.type.value==='multiple'?{max:Number(f.max.value)}:{})};})};M.validateDefinition(s);const {error}=await client.from('site_surveys').insert(s);if(error)throw error;$('survey-editor').hidden=true;await loadList();status('问卷已创建，可以复制填写链接发给朋友。');});};
$('survey-search').oninput=drawList;
async function loadResults(s){checkOwner();if(isCouple(s.id)){location.href=link(s);return;}const turn=++resultTurn;status('正在读取答卷…');const rows=[];for(let offset=0;;offset+=500){const {data,error}=await client.from('site_survey_responses').select('id,created_at,answers').eq('survey_id',s.id).order('created_at',{ascending:false}).order('id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)break;}if(!owner()||turn!==resultTurn)return;current=s;records=rows;$('survey-results').hidden=false;$('result-title').textContent=s.title;$('result-count').textContent=`共 ${rows.length} 份答卷；评分均值仅统计实际评分，未参加不计入。`;$('result-summary').replaceChildren();for(const q of M.summarize(s,rows)){const section=el('section');section.append(el('h3',q.title));if(q.type==='text'){section.append(el('p',`${q.texts.length} 条文字建议`));for(const text of q.texts)section.append(el('p',text));}else for(const stat of q.stats){const bar=el('div',undefined,'survey-bar');bar.append(el('span',stat.label));const meter=el('meter');meter.min=0;meter.max=q.type==='rating'?4:Math.max(rows.length,1);meter.value=q.type==='rating'?(stat.average||0):stat.n;meter.setAttribute('aria-label',stat.label);bar.append(meter,el('span',q.type==='rating'?(stat.average===null?'暂无评分':`${stat.average.toFixed(2)} / 4（${stat.n}人）`)+` · 未参加 ${stat.skipped}人`:`${stat.n}票 · ${rows.length?Math.round(stat.n/rows.length*100):0}%`));section.append(bar);}$('result-summary').append(section);}drawResponses();status('汇总已更新。');$('survey-results').scrollIntoView({behavior:'smooth'});}
function filtered(){const query=$('response-search').value.trim().toLowerCase(),from=$('response-from').value,to=$('response-to').value;return records.filter(r=>{const d=new Date(r.created_at),day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return (!from||day>=from)&&(!to||day<=to)&&(!query||(M.nickname(r.id)+' '+JSON.stringify(r.answers)).toLowerCase().includes(query));});}
function answerText(q,a){const v=a[q.id];if(q.type==='rating')return q.options.map(o=>o+'：'+({'0':'没参加 / 记不清','1':'不喜欢','2':'比较一般','3':'还不错','4':'很喜欢'}[v?.[o]]||'未填')).join('\n');if(Array.isArray(v))return v.join('、');return v||'未填';}
function drawResponses(){const container=$('response-list');container.replaceChildren();const matches=filtered();container.append(el('p',`匹配 ${matches.length} 份答卷`));for(const r of matches){const detail=el('details');detail.append(el('summary',M.nickname(r.id)+' · '+new Date(r.created_at).toLocaleString('zh-CN')));for(const q of current.questions){detail.append(el('h4',q.title),el('pre',answerText(q,r.answers)));}container.append(detail);}}
for(const id of ['response-search','response-from','response-to'])$(id).oninput=drawResponses;
$('refresh-results').onclick=()=>run(()=>loadResults(current));
$('export-results').onclick=()=>run(async()=>{checkOwner();const csvCell=v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const rows=[['提交时间','匿名昵称','答卷编号',...current.questions.map(q=>q.title)],...filtered().map(r=>[r.created_at,M.nickname(r.id),r.id,...current.questions.map(q=>answerText(q,r.answers))])];const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=current.title.replace(/[\\/:*?"<>|]/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('已导出当前筛选结果。');});
$('copy-survey-sql').onclick=()=>run(async()=>{const response=await fetch('../../surveys-schema.sql',{cache:'no-store'});if(!response.ok)throw Error('脚本加载失败');const sql=await response.text();$('survey-sql').value=sql;$('survey-sql').hidden=false;try{await navigator.clipboard.writeText(sql);status('初始化 SQL 已复制。执行后点击重试连接。');}catch{status('请复制下方脚本到 SQL Editor 执行。');}});
$('survey-retry').onclick=()=>{loaded=false;start();};
function accessChanged(){if(isCouple(shareId)){clearCouple();loaded=false;ready=false;$('survey-admin').hidden=true;if(client&&window.RAIN_SITE_ACCESS?.ready)run(()=>loadCouple());return;}const isOwner=owner();$('survey-admin').hidden=!!shareId||!isOwner;$('survey-login').hidden=!!shareId||isOwner;if(!isOwner){++resultTurn;records=[];surveys=[];current=shareId?current:null;$('survey-list').replaceChildren();$('response-list').replaceChildren();$('result-summary').replaceChildren();$('survey-results').hidden=true;}if(client&&!shareId&&isOwner&&!loaded)start();}
window.addEventListener('rain:access',accessChanged);
async function start(){if(!client||loaded)return;if(isCouple(shareId)){await loadCouple();return;}if(!shareId&&!owner()){accessChanged();status('请使用主人账号管理问卷，或打开朋友发来的填写链接。');return;}loaded=true;try{if(shareId){const {data,error}=await client.rpc('survey_get',{survey_id:shareId});if(error)throw error;if(!data)throw Error('问卷不存在或已移除');makeFill(data);}else{await loadList();status(surveys.length?'选择问卷查看汇总，或新建下一份调研。':'点击“使用活动问卷模板”即可创建第一份问卷。');}ready=true;$('survey-setup').hidden=true;accessChanged();}catch(e){ready=false;loaded=false;status(friendly(e),true);$('survey-setup').hidden=!owner()||!!shareId;}}
(async()=>{try{client=await window.RAIN_SITE_AUTH;if(isCouple(shareId)){await loadCouple();return;}accessChanged();await start();}catch(e){status('登录服务暂时不可用：'+e.message,true);$('survey-login').hidden=false;}})();
})();
