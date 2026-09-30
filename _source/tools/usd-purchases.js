(() => {
  'use strict';
  const KEY = 'rain.usd-purchases.v1';
  const $ = id => document.getElementById(id);
  let rows = [], editing = null, writable = true, snapshot = null;
  const money = (n, currency) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const id = () => crypto.randomUUID();
  function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
  function validDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d = new Date(value+'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value; }
  function validate(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 10000) throw new Error('备份格式不正确。');
    const ids = new Set();
    return data.records.map(r => {
      if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 100 || ids.has(r.id) || !validDate(r.date) || !Number.isFinite(r.usd) || r.usd <= 0 || r.usd > 100000000 || !Number.isFinite(r.cny) || r.cny <= 0 || r.cny > 1000000000 || typeof r.note !== 'string' || r.note.length > 300) throw new Error('记录内容不合法，请检查日期和金额。');
      ids.add(r.id); return { id: r.id, date: r.date, usd: r.usd, cny: r.cny, note: r.note };
    });
  }
  function disableWrites() { writable = false; $('save').disabled = true; $('import').disabled = true; }
  function save(next) {
    if (!writable) { message('当前无法保存，请先导出记录或刷新页面。', true); return false; }
    try {
      if (localStorage.getItem(KEY) !== snapshot) { disableWrites(); message('另一个标签页已修改记录。请刷新后继续，避免覆盖新数据。', true); return false; }
      const encoded = JSON.stringify({version:1,records:next}); localStorage.setItem(KEY, encoded); snapshot = encoded; rows = next; render(); return true;
    } catch { message('保存失败，浏览器存储可能已满或被禁用。输入仍保留，请导出备份。', true); return false; }
  }
  function reset() { editing = null; $('purchase-form').reset(); $('date').value = today(); $('form-title').textContent = '新增购买记录'; $('save').textContent = '保存记录'; $('cancel').hidden = true; rate(); }
  function rate() { const usd = Number($('usd').value), cny = Number($('cny').value); $('record-rate').textContent = usd > 0 && cny > 0 ? (cny / usd).toFixed(4) : '—'; }
  function render() {
    const usd = rows.reduce((a,r)=>a+r.usd,0), cny = rows.reduce((a,r)=>a+r.cny,0);
    $('total-usd').textContent = money(usd,'USD'); $('total-cny').textContent = money(cny,'CNY'); $('avg-rate').textContent = usd ? (cny/usd).toFixed(4) : '—';
    $('records').replaceChildren(); $('empty').hidden = rows.length > 0; $('records-table').hidden = rows.length === 0;
    for (const r of [...rows].sort((a,b)=>b.date.localeCompare(a.date))) {
      const tr = document.createElement('tr');
      for (const text of [r.date, money(r.usd,'USD'), money(r.cny,'CNY'), (r.cny/r.usd).toFixed(4), r.note || '—']) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
      const td = document.createElement('td'); td.className = 'no-print';
      const edit = document.createElement('button'); edit.type='button'; edit.className='secondary'; edit.textContent='修改'; edit.disabled=!writable; edit.setAttribute('aria-label',`修改 ${r.date} ${r.usd} 美元记录`);
      edit.onclick=()=>{ editing=r.id; for(const key of ['date','usd','cny','note']) $(key).value=r[key]; $('form-title').textContent='修改购买记录'; $('save').textContent='保存修改'; $('cancel').hidden=false; rate(); $('purchase-form').scrollIntoView({behavior:'smooth',block:'center'}); $('date').focus(); };
      const del = document.createElement('button'); del.type='button'; del.className='danger'; del.textContent='删除'; del.disabled=!writable; del.setAttribute('aria-label',`删除 ${r.date} ${r.usd} 美元记录`);
      del.onclick=()=>{ if(confirm(`删除 ${r.date} 的 $${r.usd} 记录？`)){ if(save(rows.filter(x=>x.id!==r.id))){ if(editing===r.id) reset(); message('已删除记录。'); } } };
      td.append(edit,del); tr.append(td); $('records').append(tr);
    }
  }
  $('purchase-form').onsubmit=e=>{ e.preventDefault(); const r={id:editing||id(), date:$('date').value, usd:Number($('usd').value), cny:Number($('cny').value), note:$('note').value.trim()}; try{validate({version:1,records:[r]});}catch(err){message(err.message,true);return;} const next=editing?rows.map(x=>x.id===editing?r:x):[...rows,r]; if(save(next)){reset();message('已保存到当前浏览器。');} };
  $('usd').oninput=rate; $('cny').oninput=rate; $('cancel').onclick=reset;
  $('add-first').onclick=()=>{ reset(); $('date').value=''; $('usd').value='540'; message('已预填 $540，请填写实际购买日期和人民币扣款金额。'); $('date').focus(); };
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,records:rows},null,2)],{type:'application/json;charset=utf-8'}); const a=document.createElement('a'), url=URL.createObjectURL(blob); a.href=url; a.download=`美元购汇记录_${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000); message('已导出备份，请保管下载文件。');};
  $('import').onclick=()=>$('import-file').click();
  $('import-file').onchange=async e=>{const f=e.target.files[0]; if(!f)return; try{ if(f.size>5000000)throw new Error('备份文件过大。'); const next=validate(JSON.parse((await f.text()).replace(/^\uFEFF/,''))); if(confirm(`导入 ${next.length} 条记录将替换当前 ${rows.length} 条记录。请确认已备份现有数据。`)){ if(save(next)){reset();message('已导入备份。');} } }catch(err){message('导入失败：'+err.message,true);}finally{e.target.value='';}};
  $('print').onclick=()=>window.print();
  window.addEventListener('storage',e=>{if(e.key===KEY){ disableWrites(); render(); message('记录已在另一个标签页变更，请刷新后继续。',true); }});
  reset();
  try { snapshot=localStorage.getItem(KEY); if(snapshot!==null)rows=validate(JSON.parse(snapshot)); } catch { disableWrites(); message('无法读取本机记录，已暂停写入以保护原数据。请检查浏览器存储权限；不会覆盖现有数据。',true); }
  render();
})();
