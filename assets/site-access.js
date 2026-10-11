(() => {
  'use strict';
  const modules={'usd-purchases':'购买记录','article-categories':'分类管理','games':'小游戏'};
  const CACHE_KEY='rain.site.access.v2', CACHE_TTL=2*60*60*1000;
  let client, state={user:null,ready:false,owner:false,approved:false,allowed:[],error:null}, generation=0, pending=null;
  const config=window.RAIN_USD_CLOUD;
  const freshAccountPage=/\/tools\/account\/(?:index\.html)?$/.test(location.pathname);
  function clearCache(){try{sessionStorage.removeItem(CACHE_KEY);}catch{}}
  function readCache(session){
    if(!session?.user?.id||!session.access_token||!Number.isFinite(session.expires_at)||session.expires_at*1000<=Date.now())return null;
    try{
      const cache=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null');
      if(!cache||cache.userId!==session.user.id||cache.project!==config?.url||!Number.isFinite(cache.checkedAt)||cache.checkedAt>Date.now()||Date.now()-cache.checkedAt>=CACHE_TTL||typeof cache.owner!=='boolean'||typeof cache.approved!=='boolean'||!Array.isArray(cache.allowed)||!cache.allowed.every(m=>Object.hasOwn(modules,m)))return null;
      return {user:session.user,ready:true,owner:cache.owner,approved:cache.approved,allowed:cache.allowed,error:null};
    }catch{return null;}
  }
  function saveCache(){try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({project:config.url,userId:state.user.id,checkedAt:Date.now(),owner:state.owner,approved:state.approved,allowed:state.allowed}));}catch{}}
  function paint(){
    window.RAIN_SITE_ACCESS=state;
    for(const el of document.querySelectorAll('[data-module]'))el.hidden=!state.allowed.includes(el.dataset.module);
    for(const el of document.querySelectorAll('[data-owner]'))el.hidden=!state.owner;
    const login=document.getElementById('account-link');if(login)login.textContent=state.user?'已登录':'登录';
    const protectedPage=document.querySelector('[data-protected-module]'),gate=document.getElementById('module-gate');
    if(protectedPage){const allowed=state.allowed.includes(protectedPage.dataset.protectedModule);protectedPage.hidden=!allowed;if(gate){gate.hidden=allowed;const text=gate.querySelector('[data-gate-message]');if(text)text.textContent=!state.ready?'正在验证访问权限…':state.error?'权限服务尚未启用或暂时不可用。请在账号页面查看配置说明。':!state.user?'请先登录网站账号。':!state.approved?'你的账号正在等待网站主人确认。':'你尚未获得此模块的访问权限，请联系网站主人。';}}
    window.dispatchEvent(new CustomEvent('rain:access',{detail:state}));
  }
  function refreshAccess(session,force=false){
    if(!session){++generation;pending=null;clearCache();state={user:null,ready:true,owner:false,approved:false,allowed:[],error:null};paint();return Promise.resolve(state);}
    if(pending?.userId===session.user.id)return pending.promise;
    const cached=!force&&readCache(session);
    if(cached){++generation;state=cached;paint();return Promise.resolve(state);}
    const turn=++generation;
    // Keep an already verified same-user view visible while refreshing it.
    if(state.user?.id!==session.user.id||!state.ready||state.error){state={user:session.user,ready:false,owner:false,approved:false,allowed:[],error:null};paint();}
    const entry={userId:session.user.id,promise:null};pending=entry;
    entry.promise=(async()=>{
      try{
        const {data:identity,error:identityError}=await client.auth.getUser();if(identityError)throw identityError;if(!identity?.user||identity.user.id!==session.user.id)throw Error('登录账号已变化，请重新登录');
        const [memberResult,grantResult]=await Promise.all([
          client.from('site_members').select('approved,is_owner').eq('user_id',identity.user.id).maybeSingle(),
          client.from('site_module_permissions').select('module').eq('user_id',identity.user.id)
        ]);
        if(memberResult.error)throw memberResult.error;if(grantResult.error)throw grantResult.error;
        let member=memberResult.data;
        if(!member){const result=await client.from('site_members').upsert({user_id:identity.user.id,email:identity.user.email,approved:false,is_owner:false},{onConflict:'user_id',ignoreDuplicates:true});if(result.error)throw result.error;const result2=await client.from('site_members').select('approved,is_owner').eq('user_id',identity.user.id).single();if(result2.error)throw result2.error;member=result2.data;}
        if(turn!==generation)return state;
        state={user:identity.user,ready:true,owner:member.is_owner===true,approved:member.approved===true,allowed:member.is_owner?Object.keys(modules):member.approved?(grantResult.data||[]).map(g=>g.module).filter(m=>Object.hasOwn(modules,m)):[],error:null};
        saveCache();
      }catch(error){if(turn!==generation)return state;clearCache();state={user:session.user,ready:true,owner:false,approved:false,allowed:[],error:error.message};}
      paint();return state;
    })().finally(()=>{if(pending===entry)pending=null;});
    return entry.promise;
  }
  // This cache controls static navigation only. Cloud data and writes retain RLS checks.
  try{
    if(!freshAccountPage&&config?.url){
      const storageKey='sb-'+new URL(config.url).hostname.split('.')[0]+'-auth-token';
      const savedSession=JSON.parse(localStorage.getItem(storageKey)||'null');
      const cached=readCache(savedSession);if(cached)state=cached;
    }
  }catch{}
  paint();
  window.RAIN_REFRESH_ACCESS=async()=>{clearCache();const {data,error}=await client.auth.getSession();if(error)throw error;return refreshAccess(data.session,true);};
  window.RAIN_SITE_AUTH=(async()=>{
    try{
      if(!config?.url||!config.publishableKey||config.publishableKey.startsWith('sb_secret_'))throw Error('云端配置不正确');
      const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.117.2');
      client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='PASSWORD_RECOVERY')window.RAIN_PENDING_RECOVERY=true;
        if(event==='SIGNED_OUT'){refreshAccess(null);return;}
        if(event==='INITIAL_SESSION')return;
        setTimeout(()=>refreshAccess(session,event==='USER_UPDATED'||freshAccountPage),0);
      });
      const {data,error}=await client.auth.getSession();if(error)throw error;
      await refreshAccess(data.session,freshAccountPage);return client;
    }catch(error){++generation;clearCache();state={user:state.user,ready:true,owner:false,approved:false,allowed:[],error:error.message};paint();throw error;}
  })();
  window.RAIN_SITE_AUTH.catch(()=>{});
})();
