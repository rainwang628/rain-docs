const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(__dirname+'/../assets/usd-cloud.js','utf8');
const start=src.indexOf('  async function applySession(session){'),end=src.indexOf('  async function start(){',start);
const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,textContent:''});return nodes.get(id)};
let resets=0,refreshes=0;
const ctx={$ ,reset(){resets++;for(const id of ['date','usd','cny','note'])$(id).value=''},render(){},setBusy(){},refresh:async()=>{refreshes++}};
vm.runInNewContext('let user={id:"dad"},sessionApplied=true,writable=true,rows=[];'+src.slice(start,end)+'this.applySession=applySession;',ctx);
(async()=>{
 $('usd').value='123';$('note').value='unfinished';
 await ctx.applySession({user:{id:'dad'}});assert.equal($('usd').value,'123');assert.equal(resets,0);assert.equal(refreshes,0);
 await ctx.applySession({user:{id:'mom'}});assert.equal($('usd').value,'');assert.equal($('note').value,'');assert.equal(resets,1);assert.equal(refreshes,1);
 $('usd').value='456';await ctx.applySession(null);assert.equal($('usd').value,'');assert.equal(resets,2);
 await ctx.applySession(null);assert.equal(resets,2);
 console.log('PASS: USD same-user input preserved, account change and logout clear inputs, repeated logout is idempotent');
})().catch(e=>{console.error(e);process.exitCode=1});
