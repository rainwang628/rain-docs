(() => {
  'use strict';
  const root=new URL('../',document.currentScript.src);
  function link(path){return new URL(path,root).href;}
  function articleCard(article,categories){
    const a=document.createElement('a');a.className='post';a.href=link('articles/'+article.slug+'/');
    for(const [tag,className,text] of [['span','tag',categories[article.category].title+' · '+categories[article.category].subcategories[article.subcategory].title],['h2','',article.title],['p','',article.description],['span','date',article.date]]){const node=document.createElement(tag);node.className=className;node.textContent=text;a.append(node);}
    return a;
  }
  async function start(){
    try{
      const config=window.RAIN_USD_CLOUD;if(!config?.url||!config.publishableKey)return;
      const [catalogResponse,response]=await Promise.all([fetch(link('assets/article-catalog.json'),{cache:'no-store'}),fetch(config.url+'/rest/v1/site_article_categories?id=eq.main&select=assignments&limit=1',{headers:{apikey:config.publishableKey},cache:'no-store'})]);
      if(!catalogResponse.ok||!response.ok)return;
      const catalog=await catalogResponse.json(),records=await response.json(),assignments=records[0]?.assignments;if(!assignments||Array.isArray(assignments))return;
      const categories=catalog.categories,articles=catalog.articles.map(article=>{const value=assignments[article.slug];return value&&categories[value.category]?.subcategories[value.subcategory]?{...article,category:value.category,subcategory:value.subcategory}:article;});
      const relative=location.pathname.startsWith(root.pathname)?location.pathname.slice(root.pathname.length):'';const segments=relative.split('/').filter(Boolean);
      if(segments[0]==='categories'&&segments[1]){
        const key=segments[1],subkey=segments[2];if(!categories[key]||(subkey&&!categories[key].subcategories[subkey]))return;
        const selected=articles.filter(a=>a.category===key&&(!subkey||a.subcategory===subkey)),grid=document.getElementById('category-articles');
        if(grid){grid.replaceChildren(...selected.map(a=>articleCard(a,categories)));if(!selected.length){const empty=document.createElement('p');empty.textContent='这个分类暂时没有文章。';grid.append(empty);}}
        const description=document.querySelector('.intro p');if(description)description.textContent=(subkey?categories[key].subcategories[subkey].description:categories[key].description)+' · '+selected.length+' 篇';
      }
      for(const card of document.querySelectorAll('.post')){const path=new URL(card.href).pathname;const article=articles.find(a=>path===new URL('articles/'+a.slug+'/',root).pathname);if(article){const tag=card.querySelector('.tag');if(tag)tag.textContent=categories[article.category].title+' · '+categories[article.category].subcategories[article.subcategory].title;}}
      for(const tile of document.querySelectorAll('.tile')){const target=new URL(tile.href);if(!target.pathname.startsWith(root.pathname))continue;const path=target.pathname.slice(root.pathname.length).split('/').filter(Boolean);if(path[0]!=='categories'||!categories[path[1]])continue;const count=articles.filter(a=>a.category===path[1]&&(!path[2]||a.subcategory===path[2])).length;const node=tile.querySelector('.count');if(node)node.textContent=String(count).padStart(2,'0')+' 篇文章';}
      if(segments[0]==='articles'){
        const article=articles.find(a=>a.slug===segments[1]);if(!article)return;
        const category=categories[article.category],sub=category.subcategories[article.subcategory],crumb=document.querySelector('.crumb');
        if(crumb){crumb.replaceChildren();for(const [text,path] of [['首页',''],[category.title,'categories/'+article.category+'/'],[sub.title,'categories/'+article.category+'/'+article.subcategory+'/']]){const a=document.createElement('a');a.textContent=text;a.href=link(path);crumb.append(a,document.createTextNode(' / '));}crumb.append(document.createTextNode(article.title));}
        const tag=document.querySelector('.doc-head .tag');if(tag)tag.textContent=category.title+' · '+sub.title;
      }
    }catch(error){console.warn('Cloud categories unavailable; using published classifications.');}
  }
  start();
})();
