const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const storage=new Map();
const source=fs.readFileSync(__dirname+'/../assets/surveys.js','utf8');
function boot(){
 const nodes=new Map(),events={};
 function node(id){if(!nodes.has(id))nodes.set(id,{hidden:false,children:[],textContent:'',classList:{toggle(){}},addEventListener(){},replaceChildren(...x){this.children=x},remove(){}});return nodes.get(id);}
 const window={RainSurveys:{},RAIN_SITE_ACCESS:{user:{id:'dad'},ready:true},addEventListener(name,fn){events[name]=fn}};
 const context={window,document:{getElementById:node,addEventListener(){},querySelectorAll(){return []}},location:{search:'?id=7730bfa3-039a-4ed8-87da-ca3204b9b870'},URLSearchParams,Map,Date,JSON,Number,setTimeout,clearTimeout,setInterval,clearInterval,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 const start=source.lastIndexOf('(async()=>{try{client=await window.RAIN_SITE_AUTH;');
 assert.ok(start>0);
 const testCode=source.slice(0,start)+`window.test={saveCoupleDraft,readCoupleDraft,dropCoupleDraft,accessChanged,setup(s,u){current=s;coupleUser=u;ready=true;coupleData={submitted:false};},submitted(){coupleData={submitted:true};},ready(){return ready;}};})();`;
 vm.runInNewContext(testCode,context);
 return {api:window.test,window,node,events};
}
const s={id:'7730bfa3-039a-4ed8-87da-ca3204b9b870',questions:[{id:'q1',type:'text'}]};
const a=boot();a.api.setup(s,'dad');
const input={value:'写到一半的内容\n还没有提交 '};
const field={dataset:{question:'q1'},querySelector:()=>input};
a.node('survey-questions').children=[field];
a.events['rain:access']();
assert.equal(a.node('survey-questions').children[0],field,'same-user auth refresh must not rebuild fields');
assert.equal(input.value,'写到一半的内容\n还没有提交 ');
a.api.saveCoupleDraft();
const b=boot();b.api.setup(s,'dad');
assert.equal(b.api.readCoupleDraft(s).q1,input.value,'fresh page restores exact text');
b.window.RAIN_SITE_ACCESS.user={id:'mom'};
assert.equal(Object.keys(b.api.readCoupleDraft(s)).length,0,'different account cannot restore dad draft');
a.window.RAIN_SITE_ACCESS={user:null,ready:true};a.events['rain:access']();
assert.equal(a.node('survey-questions').children.length,0,'logout clears visible answers');
assert.equal(storage.size,0,'logout removes persisted draft');
b.window.RAIN_SITE_ACCESS.user={id:'dad'};b.api.setup(s,'dad');b.node('survey-questions').children=[field];b.api.saveCoupleDraft();
const changed={...s,questions:[{id:'q2',type:'text'}]};
assert.equal(Object.keys(b.api.readCoupleDraft(changed)).length,0,'changed questionnaire must not restore stale answers');
b.api.saveCoupleDraft();b.api.dropCoupleDraft('dad');b.api.submitted();b.api.saveCoupleDraft();
assert.equal(storage.size,0,'submitted answers must not reappear as draft');
console.log('PASS: repeated auth event, refresh restore, account isolation, logout cleanup, changed questions, submitted cleanup');
