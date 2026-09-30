(() => {
  'use strict';
  const button=document.querySelector('.menu-toggle');
  const nav=document.getElementById('site-navigation');
  const header=document.querySelector('.top-inner');
  if(!button||!nav||!header)return;
  function setOpen(open){
    header.classList.toggle('menu-open',open);
    button.setAttribute('aria-expanded',String(open));
    button.textContent=open?'✕ 收起':'☰ 菜单';
  }
  setOpen(false);
  document.documentElement.classList.add('nav-ready');
  button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
  nav.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){setOpen(false);button.focus();}
  });
  document.addEventListener('click',event=>{if(!header.contains(event.target))setOpen(false);});
  window.matchMedia('(max-width:750px)').addEventListener('change',()=>setOpen(false));
})();
