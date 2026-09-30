(() => {
  'use strict';
  const $=id=>document.getElementById(id), root=new URL('../',document.currentScript.src);
  let client, catalog, session, revision, assignments={}, busy=false, ready=false, dirty=false;
  const fields=new Map();
  function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
  function controls(){const writable=Boolean(session)&&ready&&!busy;$('save').disabled=!writable;$('refresh').disabled=busy;$('login').disabled=busy||!client;$('logout').disabled=busy;for(const {main,sub} of fields.values()){main.disabled=!writable;sub.disabled=!writable;}}
  function options(select,values){select.replaceChildren();for(const [key,value] of Object.entries(values)){const option=document.createElement('option');option.value=key;option.textContent=value.title;select.append(option);}}
  function valid(value){return value&&catalog.categories[value.category]?.subcategories[value.subcategory];}
  function render(){
    fields.clear();$('category-fields').replaceChildren();
    for(const article of catalog.articles){
      const saved=assignments[article.slug], current=valid(saved)?saved:article;
      const row=document.createElement('div');row.className='category-row';const title=document.createElement('h3');title.textContent=article.title;row.append(title);
      const group=document.createElement('div');group.className='fields';const main=document.createElement('select'),sub=document.createElement('select');
      for(const [labelText,select] of [['大类',main],['子类',sub]]){const label=document.createElement('label');label.append(document.createTextNode(labelText),select);group.append(label);}
      options(main,catalog.categories);main.value=current.category;options(sub,catalog.categories[main.value].subcategories);sub.value=current.subcategory;
      main.onchange=()=>{options(sub,catalog.categories[main.value].subcategories);dirty=true;};sub.onchange=()=>{dirty=true;};row.append(group);$('category-fields').append(row);fields.set(article.slug,{main,sub});
    }
    controls();
  }
  async function load(){
    if(busy)return;if(dirty&&!confirm('读取最新分类会放弃本页尚未保存的分类调整，继续吗？'))return;
    busy=true;controls();
    try{const {data,error}=await client.from('site_article_categories').select('assignments,revision').eq('id','main').single();if(error)throw error;if(!data||!data.assignments||Array.isArray(data.assignments))throw Error('云端分类数据格式不正确');assignments=data.assignments;revision=data.revision;ready=true;dirty=false;$('setup-panel').hidden=true;render();message('已读取最新分类。登录后可调整并保存。');}
    catch(e){ready=false;$('setup-panel').hidden=false;message('分类服务尚不可用：'+e.message+'。请确认初始化 SQL 已执行，或稍后重试。',true);if(!fields.size)render();}
    finally{busy=false;controls();}
  }
  $('category-form').onsubmit=async e=>{
    e.preventDefault();if(busy||!session||!ready)return;busy=true;controls();
    try{
      const {data:identity,error:authError}=await client.auth.getUser();if(authError)throw authError;if(!identity?.user||identity.user.id!==session.user.id)throw Error('账号已变化或失效，请退出后重新登录');
      const next={...assignments};for(const [slug,{main,sub}] of fields){const value={category:main.value,subcategory:sub.value};if(!valid(value))throw Error('分类选择不合法');next[slug]=value;}
      const {data,error}=await client.from('site_article_categories').update({assignments:next,revision:crypto.randomUUID(),updated_at:new Date().toISOString()}).eq('id','main').eq('revision',revision).select('revision');
      if(error)throw error;if(!data?.length)throw Error('未保存：账号没有维护权限，或分类已在另一设备修改。请确认使用授权账号；有权限时可读取最新分类后重试');
      assignments=next;revision=data[0].revision;dirty=false;message('分类已保存到云端。打开或刷新网站页面即可看到更新。');
    }catch(e){message('分类保存失败：'+e.message+'。你的选择已保留。',true);}finally{busy=false;controls();}
  };
  function applySession(next){session=next;$('login-form').hidden=Boolean(session);$('account').hidden=!session;$('account-email').textContent=session?.user?.email||'';controls();}
  $('login-form').onsubmit=async e=>{e.preventDefault();if(!client||busy)return;busy=true;controls();try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';applySession(data.session);message(ready?'已登录，可调整分类后保存。':'已登录，请先启用云端分类服务。');}catch(e){message('登录失败：'+e.message,true);}finally{busy=false;controls();}};
  $('logout').onclick=async()=>{if(busy)return;const {error}=await client.auth.signOut({scope:'local'});if(error)message('退出失败：'+error.message,true);};
  $('refresh').onclick=load;$('retry-setup').onclick=load;
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  async function start(){
    try{const response=await fetch(new URL('assets/article-catalog.json',root),{cache:'no-store'});if(!response.ok)throw Error('文章清单加载失败');catalog=await response.json();render();
      const config=window.RAIN_USD_CLOUD;if(!config?.url||!config.publishableKey||config.publishableKey.startsWith('sb_secret_'))throw Error('云端配置不正确');
      client=await window.RAIN_SITE_AUTH;
      client.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>applySession(next),0);});const {data,error}=await client.auth.getSession();if(error)throw error;applySession(data.session);await load();
    }catch(e){message('分类管理加载失败：'+e.message,true);}finally{controls();}
  }
  controls();start();
})();
