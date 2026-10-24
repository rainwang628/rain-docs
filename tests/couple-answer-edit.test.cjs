const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let registry=new Map();
class Node{constructor(tag='div'){this.tag=tag;this.children=[];this.hidden=false;this.dataset={};this.value='';this.classList={toggle(){},add(){}};}set id(v){this._id=v;registry.set(v,this);}get id(){return this._id;}append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n)}}replaceChildren(...nodes){this.children=[];this.append(...nodes)}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);registry.delete(this.id)}setAttribute(){}addEventListener(){}querySelector(tag){return this.children.find(n=>n.tag===tag)||this.children.map(n=>n.querySelector?.(tag)).find(Boolean)}querySelectorAll(){return []}}
const $=id=>{if(!registry.has(id))registry.set(id,new Node());return registry.get(id)};
const storage=new Map(),store={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const window={RAIN_SITE_ACCESS:{user:{id:'dad'},ready:true},RainSurveys:{submissionId:()=> 'id',nickname:()=> 'nickname'},addEventListener(){},confirm:()=>true};
const ctx={window,document:{getElementById:$,createElement:t=>new Node(t),body:new Node(),addEventListener(){},querySelectorAll:()=>[]},location:{search:'?id=7730bfa3-039a-4ed8-87da-ca3204b9b870'},URLSearchParams,Map,Date,JSON,Number,crypto:{randomUUID:()=> 'id'},sessionStorage:store,localStorage:store,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
const src=fs.readFileSync(__dirname+'/../assets/surveys.js','utf8'),end=src.lastIndexOf('(async()=>{try{client=await window.RAIN_SITE_AUTH;');
vm.runInNewContext(src.slice(0,end)+`window.test={beginCoupleEdit,saveCoupleDraft,readCoupleDraft,setup(d){coupleData=d;coupleUser='dad';},editing(){return coupleEditing;},draft(){return coupleDraftMemory.get('dad');}};})();`,ctx);
const data={role:'dad',submitted:true,expired:false,responses:[{role:'dad',revision:'r1',answers:{q1:'own original'}},{role:'mom',revision:'r2',answers:{q1:'partner original'}}],survey:{id:'7730bfa3-039a-4ed8-87da-ca3204b9b870',title:'Test',description:'提交后不可修改，不保存本地答案草稿',is_open:true,questions:[{id:'q1',title:'Test',type:'text',theme:'couple',required:false}]}};
const t=window.test;t.setup(data);t.beginCoupleEdit(data);
const input=$('survey-questions').children[0].querySelector('textarea');
assert.equal(input.value,'own original');assert.equal($('survey-submit').textContent,'保存修改');assert.ok(t.editing());
input.value='supplement';t.saveCoupleDraft();assert.equal(t.draft().answers.q1,'supplement');assert.equal(t.draft().revision,'r1');assert.equal(t.draft().editing,true);
$('couple-edit-cancel').onclick();assert.equal(t.editing(),false);assert.equal(t.draft(),undefined);assert.equal($('survey-form').hidden,true);assert.equal(data.responses[0].answers.q1,'own original');
assert.equal(data.responses[1].answers.q1,'partner original');
console.log('PASS: prefill own answer, save label, edit draft and revision, cancel without changing either answer');

const momData={...data,role:'mom'};t.setup(momData);t.beginCoupleEdit(momData);assert.equal(t.editing(),false);assert.equal($('survey-description').hidden,true);console.log('PASS: mom cannot enter edit mode; description hidden');
