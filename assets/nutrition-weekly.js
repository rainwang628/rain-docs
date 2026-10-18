(() => {
'use strict';
const $ = id => document.getElementById(id);
const chart = $('week-chart'), summary = $('week-summary'), label = $('week-label');
if (!chart || !summary || !label) return;
const DAY = 86400000, weekdays = ['周一','周二','周三','周四','周五','周六','周日'];
let db, weekStart, requestId = 0;
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const add = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const startOfWeek = d => add(d,-(d.getDay()+6)%7);
const nice = n => Math.round(n).toLocaleString('zh-CN');
function setWeek(date) { weekStart = startOfWeek(date); return load(); }
function message(text) { chart.innerHTML = '<p class="n-hint">'+text+'</p>'; }
function render(rows) {
  const start = weekStart, days = Array.from({length:7},(_,i)=>add(start,i));
  const end = days[6], data = new Map(days.map(d=>[iso(d),{sum:0,count:0,unknown:false}]));
  for (const r of rows) {
    const d = data.get(r.meal_date); if (!d) continue;
    d.count++;
    if (r.kcal === null || r.kcal === undefined) d.unknown = true;
    else d.sum += Number(r.kcal);
  }
  label.textContent = iso(start).slice(5).replace('-','/')+' – '+iso(end).slice(5).replace('-','/');
  const points = days.map((date,i)=>({date,day:weekdays[i],...data.get(iso(date))}));
  const known = points.filter(p=>p.count && !p.unknown), partial = points.filter(p=>p.count && p.unknown);
  const avg = known.length ? known.reduce((s,p)=>s+p.sum,0)/known.length : null;
  summary.textContent = known.length ? '已记录 '+known.length+' 天 · 完整热量字段日均 '+nice(avg)+' kcal'+(partial.length?' · '+partial.length+' 天存在热量未知项':'') : '本周暂无可完整汇总的热量记录';
  const max = Math.max(2400,...points.filter(p=>p.count).map(p=>p.sum)), ceiling = Math.ceil(max/500)*500;
  const W=720,H=270,L=53,R=18,T=20,B=49,plotW=W-L-R,plotH=H-T-B;
  const x=i=>L+i*plotW/6, y=v=>T+(1-v/ceiling)*plotH;
  let svg = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="本周每日已记录能量折线图，缺失数据不连线" xmlns="http://www.w3.org/2000/svg">';
  for (const val of [0,500,1000,1500,2000,2500,3000].filter(v=>v<=ceiling)) {
    svg+='<line x1="'+L+'" y1="'+y(val)+'" x2="'+(W-R)+'" y2="'+y(val)+'" stroke="#e4ecee"/><text x="'+(L-9)+'" y="'+(y(val)+4)+'" text-anchor="end" fill="#637784" font-size="12">'+val+'</text>';
  }
  const bandTop=y(2000),bandBottom=y(1800);
  svg+='<rect x="'+L+'" y="'+bandTop+'" width="'+plotW+'" height="'+(bandBottom-bandTop)+'" fill="#e5f0ed" opacity=".8"/>';
  svg+='<line x1="'+L+'" y1="'+y(2000)+'" x2="'+(W-R)+'" y2="'+y(2000)+'" stroke="#6faaa0" stroke-dasharray="5 5"/>';
  // Connect only adjacent days with known, non-partial calorie totals.
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(a.count && b.count && !a.unknown && !b.unknown)
      svg+='<line x1="'+x(i-1)+'" y1="'+y(a.sum)+'" x2="'+x(i)+'" y2="'+y(b.sum)+'" stroke="#146e5d" stroke-width="3" stroke-linecap="round"/>';
  }
  points.forEach((p,i)=>{
    const xx=x(i),date=iso(p.date).slice(5).replace('-','/');
    svg+='<text x="'+xx+'" y="'+(H-24)+'" text-anchor="middle" font-size="13" fill="#637784">'+p.day+'</text>';
    svg+='<text x="'+xx+'" y="'+(H-7)+'" text-anchor="middle" font-size="11" fill="#637784">'+date+'</text>';
    if (!p.count) {svg+='<text x="'+xx+'" y="'+(H-62)+'" text-anchor="middle" font-size="12" fill="#9aaab0">—</text>';return;}
    const yy=y(p.sum),color=p.unknown?'#c58a36':'#146e5d';
    svg+='<circle cx="'+xx+'" cy="'+yy+'" r="6" fill="'+color+'" stroke="#fff" stroke-width="2"><title>'+iso(p.date)+'：'+nice(p.sum)+' kcal'+(p.unknown?'（部分营养值未知，仅为已知合计）':'')+'</title></circle>';
    svg+='<text x="'+xx+'" y="'+Math.max(12,yy-13)+'" text-anchor="middle" font-size="13" font-weight="600" fill="'+color+'">'+nice(p.sum)+(p.unknown?'*':'')+'</text>';
  });
  svg+='</svg>';
  chart.innerHTML=svg;
  $('week-details').innerHTML=points.map(p=>'<div class="week-day"><span>'+p.day+'</span><strong>'+(p.count?nice(p.sum)+' kcal'+(p.unknown?' *':''):'未记录')+'</strong></div>').join('');
}
async function load() {
  if(!weekStart || !db) return;
  const seq=++requestId,start=iso(weekStart),end=iso(add(weekStart,6));
  label.textContent=start+' 至 '+end;
  message('正在读取本周记录…');
  const {data,error}=await db.from('meal_items').select('meal_date,kcal').gte('meal_date',start).lte('meal_date',end).order('meal_date').limit(1000);
  if(seq!==requestId)return;
  if(error){message('读取失败：'+error.message);summary.textContent='';return;}
  render(data||[]);
}
$('week-prev').addEventListener('click',()=>setWeek(add(weekStart,-7)));
$('week-next').addEventListener('click',()=>setWeek(add(weekStart,7)));
$('week-today').addEventListener('click',()=>setWeek(new Date()));
document.getElementById('meal-date')?.addEventListener('change',e=>setWeek(parse(e.target.value)));
window.addEventListener('nutrition:changed',()=>load());
(async()=>{try{
  db=await window.RAIN_SITE_AUTH;
  if(!window.RAIN_SITE_ACCESS?.owner)throw Error('请先验证网站主人权限');
  await setWeek(parse($('meal-date').value));
}catch(e){message('无法加载周报：'+e.message)}})();
})();