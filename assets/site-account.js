(() => {
  'use strict';
  const $=id=>document.getElementById(id),modules={'usd-purchases':'购买记录（各自数据）','article-categories':'分类管理（可修改网站归类）','games':'小游戏'};
  let client,busy=false,loadedOwner=false;
  function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
  function controls(){for(const id of ['login','signup','recover','logout','refresh-access','load-members','retry','save-password','copy-setup'])$(id).disabled=busy||!client;}
  function show(state){const user=state?.user;$('login-form').hidden=Boolean(user);$('account').hidden=!user;$('account-email').textContent=user?.email||'';$('setup-panel').hidden=!state?.error;$('access-status').textContent=state?.error?'权限服务不可用，请完成初始化后重试。':state?.owner?'网站主人：拥有全部模块及授权管理权限。':!state?.approved?'已提交访问申请，等待网站主人确认。':'已确认；可访问模块：'+(state.allowed.map(key=>modules[key]).join('、')||'暂未分配');if(state?.owner&&client&&!loadedOwner){loadedOwner=true;loadMembers();}if(!state?.owner){loadedOwner=false;$('members').replaceChildren();}}
  window.addEventListener('rain:access',e=>show(e.detail));
  async function loadMembers(){
    if(!client||!window.RAIN_SITE_ACCESS?.owner)return;
    try{const [{data:members,error},{data:grants,error:grantError}]=await Promise.all([client.from('site_members').select('user_id,email,approved,is_owner').order('email'),client.from('site_module_permissions').select('user_id,module')]);if(error)throw error;if(grantError)throw grantError;if(!window.RAIN_SITE_ACCESS?.owner)return;$('members').replaceChildren();
      for(const member of members){if(member.is_owner)continue;const row=document.createElement('div');row.className='category-row';const title=document.createElement('h3');title.textContent=member.email;row.append(title);const checks=[];
        for(const [key,text] of [['approved','确认此用户'],...Object.entries(modules)]){const label=document.createElement('label');label.style.cssText='display:flex;flex-direction:row;align-items:center;margin:10px 0';const input=document.createElement('input');input.type='checkbox';input.style.cssText='width:20px;min-height:20px';input.checked=key==='approved'?member.approved:grants.some(g=>g.user_id===member.user_id&&g.module===key);label.append(input,document.createTextNode(text));row.append(label);checks.push({key,input});}
        const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='margin:12px 0 0;overflow-wrap:anywhere';
        const button=document.createElement('button');button.type='button';button.textContent='保存此用户权限';button.onclick=async()=>{
          button.disabled=true;button.textContent='正在保存…';status.textContent='正在保存权限…';status.classList.remove('error');
          try{
            const {error}=await client.rpc('site_set_permissions',{target_user:member.user_id,allow_user:checks[0].input.checked,allowed_modules:checks.filter(c=>c.key!=='approved'&&c.input.checked).map(c=>c.key)});
            if(error)throw error;
            status.textContent=checks[0].input.checked?'已保存：用户已确认；允许模块：'+(checks.filter(c=>c.key!=='approved'&&c.input.checked).map(c=>modules[c.key]).join('、')||'暂未分配')+'。该用户刷新权限后生效。':'已保存：已撤销用户确认及全部模块权限。';
            message('已保存 '+member.email+' 的权限。该用户刷新权限或重新打开页面后生效。');
          }catch(e){
            const detail=e.message||'请求失败，请重试';
            status.textContent='授权保存失败：'+detail+(e.code?'（'+e.code+'）':'');status.classList.add('error');
            message(status.textContent,true);
          }finally{button.disabled=false;button.textContent='保存此用户权限';}
        };row.append(button,status);$('members').append(row);}
      if(!members.some(m=>!m.is_owner))$('members').textContent='暂无申请用户。';
    }catch(e){message('读取用户失败：'+e.message,true);}
  }
  async function action(fn){if(!client||busy)return;busy=true;controls();try{await fn();}catch(e){message(e.code==='over_email_send_rate_limit'||/rate limit/i.test(e.message)?'邮件发送额度暂时用完，请等待恢复后再试。':'操作失败：'+e.message,true);}finally{busy=false;controls();}}
  $('login-form').onsubmit=e=>{e.preventDefault();action(async()=>{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';await window.RAIN_REFRESH_ACCESS();message('已登录。');});};
  $('signup').onclick=()=>{if(!$('login-form').reportValidity())return;if($('password').value.length<8){message('注册密码至少需要 8 个字符。',true);return;}action(async()=>{const {data,error}=await client.auth.signUp({email:$('email').value.trim(),password:$('password').value,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;$('password').value='';if(data.session){await window.RAIN_REFRESH_ACCESS();message('访问申请已提交，等待网站主人确认。');}else message('注册请求已提交。请打开验证邮件链接，登录后申请访问；已有账号请直接登录。');});};
  $('recover').onclick=()=>{if(!$('email').reportValidity())return;action(async()=>{const {error}=await client.auth.resetPasswordForEmail($('email').value.trim(),{redirectTo:location.origin+location.pathname});if(error)throw error;message('密码设置邮件请求已提交，请打开最新邮件链接。');});};
  $('password-form').onsubmit=e=>{e.preventDefault();if($('new-password').value!==$('confirm-password').value){message('两次密码不一致。',true);return;}action(async()=>{const {error}=await client.auth.updateUser({password:$('new-password').value});if(error)throw error;$('password-form').reset();$('password-settings').open=false;message('网站密码已保存。');});};
  $('logout').onclick=()=>action(async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;message('已退出。');});
  $('copy-setup').onclick=()=>action(async()=>{
    const {data,error}=await client.auth.getUser();if(error)throw error;if(!data?.user?.email)throw Error('请先登录你的网站主人账号');
    const response=await fetch(new URL('../../website-access-schema.sql',location.href),{cache:'no-store'});if(!response.ok)throw Error('初始化脚本加载失败');
    const text=(await response.text()).replaceAll('__OWNER_EMAIL__',data.user.email.replaceAll("'","''"));
    $('setup-sql').value=text;$('setup-sql').hidden=false;
    try{await navigator.clipboard.writeText(text);message('已复制当前账号的初始化 SQL，请在你现有项目的 SQL Editor 粘贴执行。');}catch{message('初始化 SQL 已生成，请从下方文本框复制到 SQL Editor。');}
  });
  $('refresh-access').onclick=$('retry').onclick=()=>action(async()=>{await window.RAIN_REFRESH_ACCESS();});$('load-members').onclick=loadMembers;
  (async()=>{try{client=await window.RAIN_SITE_AUTH;client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>{$('password-settings').open=true;message('邮箱验证成功，请设置网站密码。');},0);});show(window.RAIN_SITE_ACCESS);if(window.RAIN_PENDING_RECOVERY){$('password-settings').open=true;message('邮箱验证成功，请设置网站密码。');}}catch(e){message('登录服务不可用：'+e.message,true);}finally{controls();}})();
  controls();
})();
