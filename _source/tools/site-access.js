(() => {
  'use strict';
  const root=new URL('../',document.currentScript.src);
  const modules={'usd-purchases':'购买记录','article-categories':'分类管理','games':'小游戏'};
  let client, state={user:null,ready:false,owner:false,approved:false,allowed:[],error:null}, generation=0;
  function paint(){
    window.RAIN_SITE_ACCESS=state;
    for(const el of document.querySelectorAll('[data-module]'))el.hidden=!state.allowed.includes(el.dataset.module);
    for(const el of document.querySelectorAll('[data-owner]'))el.hidden=!state.owner;
    const login=document.getElementById('account-link');if(login)login.textContent=state.user?'已登录':'登录';
    const protectedPage=document.querySelector('[data-protected-module]'),gate=document.getElementById('module-gate');
    if(protectedPage){const allowed=state.allowed.includes(protectedPage.dataset.protectedModule);protectedPage.hidden=!allowed;if(gate){gate.hidden=allowed;const text=gate.querySelector('[data-gate-message]');if(text)text.textContent=!state.ready?'正在验证访问权限…':state.error?'权限服务尚未启用或暂时不可用。请在账号页面查看配置说明。':!state.user?'请先登录网站账号。':!state.approved?'你的账号正在等待网站主人确认。':'你尚未获得此模块的访问权限，请联系网站主人。';}}
    window.dispatchEvent(new CustomEvent('rain:access',{detail:state}));
  }
  async function refreshAccess(session){
    const turn=++generation;state={user:session?.user||null,ready:false,owner:false,approved:false,allowed:[],error:null};paint();
    if(!session){state.ready=true;paint();return state;}
    try{
      const {data:identity,error:identityError}=await client.auth.getUser();if(identityError)throw identityError;if(!identity?.user||identity.user.id!==session.user.id)throw Error('登录账号已变化，请重新登录');
      let {data:member,error}=await client.from('site_members').select('approved,is_owner').eq('user_id',identity.user.id).maybeSingle();if(error)throw error;
      if(!member){const result=await client.from('site_members').upsert({user_id:identity.user.id,email:identity.user.email,approved:false,is_owner:false},{onConflict:'user_id',ignoreDuplicates:true});if(result.error)throw result.error;const result2=await client.from('site_members').select('approved,is_owner').eq('user_id',identity.user.id).single();if(result2.error)throw result2.error;member=result2.data;}
      const {data:grants,error:grantError}=await client.from('site_module_permissions').select('module').eq('user_id',identity.user.id);if(grantError)throw grantError;
      if(turn!==generation)return state;state={user:identity.user,ready:true,owner:member.is_owner,approved:member.approved,allowed:member.is_owner?Object.keys(modules):member.approved?grants.map(g=>g.module):[],error:null};
    }catch(error){if(turn!==generation)return state;state.ready=true;state.error=error.message;}
    paint();return state;
  }
  window.RAIN_REFRESH_ACCESS=async()=>{const {data,error}=await client.auth.getSession();if(error)throw error;return refreshAccess(data.session);};
  window.RAIN_SITE_AUTH=(async()=>{
    try{const config=window.RAIN_USD_CLOUD;if(!config?.url||!config.publishableKey||config.publishableKey.startsWith('sb_secret_'))throw Error('云端配置不正确');const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.117.2');client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')window.RAIN_PENDING_RECOVERY=true;setTimeout(()=>refreshAccess(session),0);});await window.RAIN_REFRESH_ACCESS();return client;}
    catch(error){state.ready=true;state.error=error.message;paint();throw error;}
  })();
  // Visitor blog pages remain usable if the cloud auth service is unavailable.
  window.RAIN_SITE_AUTH.catch(()=>{});paint();
})();
