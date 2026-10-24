(function(root){
'use strict';
const activities=['王者荣耀','汤泉','羽毛球','麻将','剧本杀','一起吃饭、吃蛋糕'];
const template={title:'四人小分队 · 下次玩什么？',description:'最近一起玩了不少项目，想听听大家的真实感受，方便安排下一次！喜欢就夸，一般就说，按自己的感受填就好～',questions:[
{id:'q1',type:'rating',title:'最近一起玩过的活动，你觉得怎么样？',options:activities,required:true},
{id:'q2',type:'multiple',title:'下次组局，你最想再参加哪些？（最多选3项）',options:[...activities,'想先试试新活动'],max:3,required:true},
{id:'q3',type:'text',title:'有没有哪项活动体验一般？怎样调整会更好？',required:false},
{id:'q4',type:'multiple',title:'接下来想一起尝试什么？（最多选3项）',options:['桌游','密室逃脱','KTV','保龄球 / 台球','徒步 / 公园散步','露营 / 野餐 / 烧烤','手工体验（陶艺、拼豆等）','做饭 / 烘焙','现有活动就挺好','其他（请在下一题补充）'],max:3,required:true},
{id:'q5',type:'text',title:'你心中的下一次理想组局是什么样的？也可以补充新活动、时间、预算与频率偏好。',required:false}]};
function validateDefinition(s){if(!s.title?.trim()||s.title.length>120)throw Error('请填写120字以内的标题');if((s.description||'').length>2000)throw Error('填写说明过长');if(!Array.isArray(s.questions)||!s.questions.length||s.questions.length>30)throw Error('每份问卷需要1—30道题');const ids=new Set();for(const q of s.questions){if(!q.id||ids.has(q.id))throw Error('问题编号重复');ids.add(q.id);if(!q.title?.trim()||q.title.length>500)throw Error('请填写500字以内的问题标题');if(!['text','single','multiple','rating'].includes(q.type))throw Error('不支持的题型');if(q.type!=='text'){if(!Array.isArray(q.options)||!q.options.length||q.options.length>30||new Set(q.options).size!==q.options.length||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>200))throw Error('选项需要1—30项，不能重复或留空');}if(q.type==='multiple'&&(!Number.isInteger(q.max)||q.max<1||q.max>q.options.length))throw Error('最多选择数须介于1和选项总数之间');}return s;}
function validateAnswers(s,a){for(const q of s.questions){const v=a[q.id];if(q.type==='text'){if(typeof v!=='string'||v.length>2000||(q.required&&!v.trim()))throw Error('请检查：'+q.title);}else if(q.type==='single'){if((q.required||v)&&!q.options.includes(v))throw Error('请完成：'+q.title);}else if(q.type==='multiple'){if(!Array.isArray(v)||new Set(v).size!==v.length||v.some(o=>!q.options.includes(o))||v.length>q.max||(q.required&&!v.length))throw Error('请检查多选数量：'+q.title);}else{if(!v||typeof v!=='object'||q.options.some(o=>!['0','1','2','3','4',...(q.required?[]:[''])].includes(v[o])))throw Error('请完成评分：'+q.title);}}return a;}
function summarize(s,rows){return s.questions.map(q=>{if(q.type==='rating')return {...q,stats:q.options.map(label=>{const values=rows.map(r=>Number(r.answers[q.id]?.[label])).filter(v=>Number.isInteger(v)&&v>=1&&v<=4);return {label,n:values.length,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,skipped:rows.filter(r=>r.answers[q.id]?.[label]==='0').length};})};if(q.type==='text')return {...q,texts:rows.map(r=>r.answers[q.id]).filter(v=>v?.trim())};return {...q,stats:q.options.map(label=>({label,n:rows.filter(r=>q.type==='single'?r.answers[q.id]===label:(r.answers[q.id]||[]).includes(label)).length}))};});}
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function nickname(id){
 if(!uuidPattern.test(id||''))return '匿名答卷';
 const hex=id.replaceAll('-','').toLowerCase();
 const adjectives=['晴天','微风','星光','月亮','软糖','薄荷','椰子','橘子','奶茶','晚霞','云朵','山间','森林','海盐','春日','秋日'];
 const animals=['水獭','小熊','企鹅','兔子','海豚','熊猫','松鼠','猫咪','鹿鹿','狐狸','考拉','刺猬','海豹','鲸鱼','小狗','羊驼'];
 return adjectives[parseInt(hex[0],16)]+animals[parseInt(hex[1],16)]+' · '+hex.slice(-6).toUpperCase();
}
function submissionId(storage,key,generate){
 let id;try{id=storage?.getItem(key);}catch{}
 if(uuidPattern.test(id||''))return id;
 id=generate();if(!uuidPattern.test(id||''))throw Error('无法生成匿名答卷标识，请刷新重试');
 try{storage?.setItem(key,id);}catch{}return id;
}
const coupleTemplate={"title":"🐑爸🐑妈的 XP 小调查","description":"10道简短问题，围绕性交偏好和实际需求。每题写一两句话或几个关键词即可，也可以跳过。按真实想法填写，参考提示不是标准答案，偏好也不是承诺。自己提交后才可查看逐题对照；双方完成后7天自动删除在线答卷。提交后可修改本人答卷，修改不延长保留时间，草稿临时保存在当前标签页，刷新可恢复；提交或退出账号时清除。","questions":[{"id":"couple_1","title":"现在的性交体验，最想改善什么？","type":"text","theme":"couple","required":false,"promptWords":["满意的部分","想调整的地方"]},{"id":"couple_2","title":"你希望多久性交一次？","type":"text","theme":"couple","required":false,"promptWords":["理想频率","可接受的范围"]},{"id":"couple_3","title":"你希望每次持续多久？","type":"text","theme":"couple","required":false,"promptWords":["前戏时长","性交时长","不设固定时间"]},{"id":"couple_4","title":"你更喜欢什么时候性交？","type":"text","theme":"couple","required":false,"promptWords":["早晨醒来","晚上","休息日","时间充裕"]},{"id":"couple_6","title":"你希望对方怎样主动？","type":"text","theme":"couple","required":false,"promptWords":["直接表达","提前商量","约定暗号","由自己发起"]},{"id":"couple_foreplay","title":"你喜欢哪些前戏？","type":"text","theme":"couple","required":false,"promptWords":["亲吻","触碰","口交","手部刺激","节奏和时间"]},{"id":"couple_7","title":"你喜欢或想尝试哪些体位、场景？","type":"text","theme":"couple","required":false,"promptWords":["已有偏好","想了解的新方式","愿意尝试的契机","先商量再尝试"]},{"id":"couple_8","title":"性交时，你喜欢怎样的节奏和配合？","type":"text","theme":"couple","required":false,"promptWords":["谁主导","节奏","力度","需要怎样调整"]},{"id":"couple_9","title":"哪些事情你不接受，或需要先商量？","type":"text","theme":"couple","required":false,"promptWords":["行为界限","避孕","身体不适","暂停或停止","隐私"]},{"id":"couple_10","title":"双方性需求不一致时，你希望怎么处理？","type":"text","theme":"couple","required":false,"promptWords":["接受拒绝","另找时间","自行解决","沟通频率"]}]};
const api={coupleTemplate,template,validateDefinition,validateAnswers,summarize,nickname,submissionId};root.RainSurveys=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
