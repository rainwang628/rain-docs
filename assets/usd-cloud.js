(() => {
  'use strict';
  const KEY = 'rain.usd-purchases.v1';
  let client, user, busy=false;
  const $ = id => document.getElementById(id);
  let rows = [], editing = null, writable = false, snapshot = null;
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
  function setBusy(value) { busy=value; $('save').disabled=busy||!writable; $('import').disabled=busy||!writable; $('refresh').disabled=busy||!writable; render(); }
  const toDB=r=>({id:r.id,user_id:user.id,purchase_date:r.date,usd:r.usd,cny:r.cny,note:r.note,revision:crypto.randomUUID()});
  const fromDB=r=>({id:r.id,date:r.purchase_date,usd:Number(r.usd),cny:Number(r.cny),note:r.note,revision:r.revision});
  async function loadRows() {
    const all=[];
    for(let from=0;;from+=1000){const {data,error}=await client.from('usd_purchases').select('*').eq('user_id',user.id).order('purchase_date',{ascending:false}).order('id').range(from,from+999);if(error)throw error;all.push(...data);if(data.length<1000)break;}
    return all.map(fromDB);
  }
  async function refresh() { if(!writable||busy)return;setBusy(true);try{rows=await loadRows();render();message('已读取最新云端记录。');}catch(e){message('读取云端失败：'+e.message,true);}finally{setBusy(false);} }
  async function verifyWriteOwner() {
    const expected=user?.id;
    const {data,error}=await client.auth.getUser();
    if(error){if(error.code==='user_not_found'||error.status===401||error.status===403)throw Error('登录账号已失效，请退出后用当前网站账号重新登录。');throw Error('无法验证登录账号：'+error.message);}
    if(!expected||!data?.user||data.user.id!==expected||user?.id!==expected)throw Error('登录账号已变化，请退出后重新登录再保存。');
  }
  function writeError(error) {
    return error.code==='23503' && /usd_purchases_user_id_fkey/.test(error.message)
      ? '当前账号 ID 在关联的用户表中不存在，请退出后重新登录；若仍报错，需要检查数据库外键。'
      : error.message;
  }
  async function save(next) {
    if(!writable||busy){message('请先登录并等待当前操作完成。',true);return false;}
    setBusy(true);
    try{
      await verifyWriteOwner();
      const removed=rows.filter(r=>!next.some(n=>n.id===r.id));
      const changed=next.filter(r=>{const old=rows.find(n=>n.id===r.id);return !old||JSON.stringify(old)!==JSON.stringify(r);});
      if(removed.length>1||changed.length>1)throw Error('请逐条保存修改。');
      if(removed.length){const old=removed[0];const {data,error}=await client.from('usd_purchases').delete().eq('user_id',user.id).eq('id',old.id).eq('revision',old.revision).select('id');if(error)throw error;if(!data.length)throw Error('此记录已在其他设备变更，请刷新后重试。');rows=rows.filter(r=>r.id!==old.id);}
      if(changed.length){const r=changed[0],old=rows.find(n=>n.id===r.id);let result;
        if(old)result=await client.from('usd_purchases').update(toDB(r)).eq('user_id',user.id).eq('id',r.id).eq('revision',old.revision).select();
        else result=await client.from('usd_purchases').insert(toDB(r)).select();
        if(result.error)throw result.error;if(!result.data.length)throw Error('此记录已在其他设备变更，请刷新后重试。');
        rows=[...rows.filter(n=>n.id!==r.id),fromDB(result.data[0])];
      }
      render();return true;
    }catch(e){message('云端保存失败：'+writeError(e)+' 输入已保留。',true);return false;}finally{setBusy(false);}
  }
  async function importRows(next){
    if(!writable||busy)return;setBusy(true);
    try{await verifyWriteOwner();const mapped=next.map(toDB);for(let i=0;i<mapped.length;i+=200){const {error}=await client.from('usd_purchases').upsert(mapped.slice(i,i+200),{onConflict:'id',ignoreDuplicates:true});if(error)throw error;}rows=await loadRows();reset();message('已导入云端；已存在的记录未覆盖。');}
    catch(e){message('导入未完全完成：'+writeError(e)+' 可以重试，不会重复登记。',true);}finally{setBusy(false);}
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
      const edit = document.createElement('button'); edit.type='button'; edit.className='secondary'; edit.textContent='修改'; edit.disabled=!writable||busy; edit.setAttribute('aria-label',`修改 ${r.date} ${r.usd} 美元记录`);
      edit.onclick=()=>{ editing=r.id; for(const key of ['date','usd','cny','note']) $(key).value=r[key]; $('form-title').textContent='修改购买记录'; $('save').textContent='保存修改'; $('cancel').hidden=false; rate(); $('purchase-form').scrollIntoView({behavior:'smooth',block:'center'}); $('date').focus(); };
      const del = document.createElement('button'); del.type='button'; del.className='danger'; del.textContent='删除'; del.disabled=!writable||busy; del.setAttribute('aria-label',`删除 ${r.date} ${r.usd} 美元记录`);
      del.onclick=async()=>{ if(confirm(`删除 ${r.date} 的 $${r.usd} 记录？`)){ if(await save(rows.filter(x=>x.id!==r.id))){ if(editing===r.id) reset(); message('已删除记录。'); } } };
      td.append(edit,del); tr.append(td); $('records').append(tr);
    }
  }
  $('purchase-form').onsubmit=async e=>{ e.preventDefault(); const r={id:editing||id(), date:$('date').value, usd:Number($('usd').value), cny:Number($('cny').value), note:$('note').value.trim()}; try{validate({version:1,records:[r]});}catch(err){message(err.message,true);return;} const next=editing?rows.map(x=>x.id===editing?r:x):[...rows,r]; if(await save(next)){reset();message('已保存到云端。');} };
  $('usd').oninput=rate; $('cny').oninput=rate; $('cancel').onclick=reset;
  $('add-first').onclick=()=>{ reset(); $('date').value=''; $('usd').value='540'; message('已预填 $540，请填写实际购买日期和人民币扣款金额。'); $('date').focus(); };
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,records:rows},null,2)],{type:'application/json;charset=utf-8'}); const a=document.createElement('a'), url=URL.createObjectURL(blob); a.href=url; a.download=`美元购汇记录_${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000); message('已导出备份，请保管下载文件。');};
  $('import').onclick=()=>$('import-file').click();
  $('import-file').onchange=async e=>{const f=e.target.files[0]; if(!f)return; try{ if(f.size>5000000)throw new Error('备份文件过大。'); const next=validate(JSON.parse((await f.text()).replace(/^\uFEFF/,''))); if(confirm(`导入 ${next.length} 条记录到云端？已存在的记录不会被覆盖。`)){ await importRows(next); } }catch(err){message('导入失败：'+err.message,true);}finally{e.target.value='';}};
  $('print').onclick=()=>window.print();
  $('refresh').onclick=refresh;
  $('migrate').onclick=async()=>{try{const raw=localStorage.getItem(KEY);if(!raw){message('当前浏览器没有本机购买记录。');return;}const next=validate(JSON.parse(raw));if(confirm(`将本机 ${next.length} 条记录导入云端？本机原记录会保留。`))await importRows(next);}catch(e){message('迁移失败：'+e.message,true);}};
  $('logout').onclick=async()=>{if(busy)return;const {error}=await client.auth.signOut({scope:'local'});if(error)message('退出失败：'+error.message,true);};
  $('login-form').onsubmit=async e=>{
    e.preventDefault();if(!client){message('登录服务尚未加载，请稍后重试。',true);return;}$('send-link').disabled=true;
    try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';await applySession(data.session);}
    catch(e){message(e.message==='Invalid login credentials'?'登录失败：请检查网站登录邮箱和密码。此密码不是 Google 或 Supabase 控制台密码。':'登录失败：'+e.message,true);}
    finally{$('send-link').disabled=false;}
  };
  $('recover-password').onclick=async()=>{
    if(!client){message('登录服务尚未加载，请稍后重试。',true);return;}
    if(!$('email').reportValidity())return;
    const button=$('recover-password');button.disabled=true;
    try{const {error}=await client.auth.resetPasswordForEmail($('email').value.trim(),{redirectTo:location.origin+location.pathname});if(error)throw error;message('已提交密码设置邮件请求。请检查收件箱和垃圾邮件；打开最新邮件链接后，在本页设置网站密码。');}
    catch(e){message(e.code==='over_email_send_rate_limit'||/rate limit/i.test(e.message)?'邮件发送额度暂时用完，请等待额度恢复后再试。若此前收到的登录链接仍有效，可打开它，再设置网站密码。':'密码设置邮件发送失败：'+e.message,true);}
    finally{button.disabled=false;}
  };
  $('password-form').onsubmit=async e=>{
    e.preventDefault();if(!client||!user){message('请先通过有效的邮箱链接或密码登录，再设置网站密码。',true);return;}
    if($('new-password').value!==$('confirm-password').value){message('两次输入的密码不一致。',true);return;}
    const button=$('save-password');button.disabled=true;
    try{const {error}=await client.auth.updateUser({password:$('new-password').value});if(error)throw error;$('password-form').reset();$('password-settings').open=false;message('网站密码已保存。现在可在手机和电脑使用同一邮箱及此密码登录。');}
    catch(e){message('网站密码保存失败：'+e.message,true);}
    finally{button.disabled=false;}
  };
  async function applySession(session){
    if(session?.user?.id && user?.id === session.user.id)return;
    const draft={date:$('date').value,usd:$('usd').value,cny:$('cny').value,note:$('note').value};
    user=session?.user||null;writable=Boolean(user);$('login-form').hidden=writable;$('account').hidden=!writable;$('account-email').textContent=user?.email||'';rows=[];reset();if(draft.usd||draft.cny||draft.note){for(const key of ['date','usd','cny','note'])$(key).value=draft[key];rate();}render();$('migrate').disabled=!writable;setBusy(false);if(writable)await refresh();
  }
  async function start(){
    const config=window.RAIN_USD_CLOUD||{};
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url||'')||!config.publishableKey){message('云端数据库尚未配置。本机版仍可使用，接入项目后才能登录和同步。',true);$('send-link').disabled=true;setBusy(false);return;}
    if(config.publishableKey.startsWith('sb_secret_')){message('配置错误：不能在网页中使用 secret key。',true);$('send-link').disabled=true;return;}
    try{const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.117.2');client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((event,session)=>{setTimeout(async()=>{await applySession(session);if(event==='PASSWORD_RECOVERY'&&session){$('password-settings').open=true;$('new-password').focus();message('邮箱验证成功，请在“设置网站登录密码”中保存新密码。');}},0);});
      const {data,error}=await client.auth.getSession();if(error)throw error;await applySession(data.session);
    }catch(e){message('无法连接云端登录服务：'+e.message,true);$('send-link').disabled=true;}
  }
  reset();render();setBusy(false);start();
})();
