(() => {
 'use strict';
 const $=id=>document.getElementById(id), rows=[];
 function add(type,level,role,lines){lines.trim().split('\n').forEach(text=>rows.push({id:rows.length,type,level,role,text}));}
 add('truth',1,'all',`你最容易被哪种小动作撩到？具体演示一下。
你做过最蠢的一次恋爱脑行为是什么？
你有没有故意晚回消息，假装自己没那么在乎？
你最离谱的一次约会翻车是什么？
喜欢一个人时，你的聊天记录会暴露哪三个特征？
你有没有把某人的朋友圈翻到很久以前？最后翻到多久？
你最吃哪种夸奖？现场给一个能让你开心的范例。
你曾经为见某个人假装顺路吗？真实绕了多远？
你最怕喜欢的人看见自己哪种糗样？
你相信一见钟情，还是更容易日久生情？`);
 add('truth',2,'all',`你有没有把一条消息编辑五遍才发出去？当时想说什么？
你最擅长的暧昧招数是什么？成功过吗？
你会偷偷吃醋但嘴上不承认吗？说一次真实经历。
你有没有把普通互动误会成对方喜欢你？后来怎么发现的？
你收到过最让你心动的一句话是什么？不用说对方名字。
你最近一次因为感情失眠，脑子里在循环什么？
你是主动撩人的类型，还是等对方先出手？证据是什么？
你觉得自己的恋爱短板是什么，为什么现在还没改？
你会介意对象和前任保持联系吗？边界在哪里？
你曾经暗暗期待谁主动找你，却故意装作无所谓？只讲故事即可。`);
 add('truth',3,'all',`说一件你在感情里嘴上否认、心里却特别在意的事。
你做过最大胆的一次追人举动是什么？结果如何？
你有没有同时对两个人有过好感？你最后怎么处理？
你在恋爱里最想被满足、却最不好意思开口的需求是什么？
你有没有为了看某个人的反应故意制造醋意？当时怎么想的？
你有没有明明想牵手，却假装只是碰巧靠近？讲讲现场。
你最上头的一次心动有多夸张？发生了什么？
如果不用顾虑面子，你现在最想问你这一组搭档什么？直接问，搭档可以不答。
你最受不了哪种暧昧拉扯？你自己做过吗？
如果喜欢的人说“我想见你”，你能有多主动？用真实经历回答。`);
 add('truth',1,'couple',`你第一次见{partner}时，心里真实打了几分？现在呢？
你们谁先动心？谁先暴露？各说一个证据。
{partner}第一次约会最让你想吐槽的细节是什么？
{partner}哪个生活习惯让你想翻白眼，但已经习惯了？
你们恋爱初期最装的一件事是什么？
如果给{partner}的撒娇起一个招式名，你会怎么命名？`);
 add('truth',2,'couple',`你有没有对{partner}说“没事”，实际上很希望被哄？讲一次。
你曾经瞒着{partner}偷偷准备过什么惊喜？翻车也算。
你觉得{partner}什么时候最有吸引力？说得具体一点。
你们谁更容易吃醋？最近一次是为什么？
结婚前后，{partner}最让你意外的反差是什么？
你最怀念你们恋爱时哪种暧昧小动作？现在还想要吗？`);
 add('truth',3,'couple',`说一个{partner}以为你没发现，其实你早就看穿的恋爱小心机。
说一句你一直想对{partner}说，却因为害羞没说出口的情话。
你们哪次亲密时刻最让你记到现在？只讲愿意公开的细节。
最近一次觉得{partner}特别性感是什么时候？具体是哪一点？
如果今晚重新约会，你最想和{partner}重演哪个心动场景？
{partner}做什么动作，你会立刻心软？现场承认一下。
你最希望{partner}主动一点的事情是什么？
如果给你们的爱情拍一支预告片，最劲爆的台词是哪一句？`);
 add('truth',1,'guest',`你第一次见{partner}，第一眼注意到的是什么？
你觉得{partner}和初见时的印象有什么反差？
如果和{partner}单独吃饭，你会选什么地方？为什么？
你觉得{partner}身上最有趣的一个特点是什么？
你们最近的一次互动，哪件小事让你记住了？
你更喜欢被朋友介绍认识，还是自己偶然遇见？`);
 add('truth',2,'guest',`最近和{partner}聊天，有没有哪句话让你忍不住笑着看手机？
你对{partner}的好奇心，从第一次见面到现在增加了吗？为什么？
你有没有为了见{partner}多花一点心思打扮？可以坦诚说没有。
{partner}做过哪件事，让你觉得“这个人还不错”？
如果{partner}今晚单独约你出去散步，你会怎么回答？
你最想了解{partner}的哪个方面，但还没找到机会问？
下次见{partner}，你更期待两个人见，还是继续四人一起？
你觉得{partner}是会主动追人的类型吗？依据是什么？`);
 add('truth',3,'guest',`如果把你和{partner}现在的状态写成电影名，会叫什么？为什么？
你和{partner}相处时，有没有某个瞬间觉得有点暧昧？有就讲，没有也直接说。
你有没有期待过{partner}主动发消息？最想收到什么内容？
如果{partner}说“我想认真了解你”，你最真实的回应是什么？
你愿意和{partner}试一次单独约会吗？愿意就提一个想去的地方。
你对{partner}目前最大的顾虑或疑问是什么？可以只谈相处节奏。
如果今晚可以问{partner}一个直球问题，你想问什么？对方可跳过。
说一句你平时会不好意思对{partner}说、但确实是真的话。
你希望{partner}接下来主动一点，还是慢慢来？说清你喜欢的节奏。
从初见到现在，{partner}哪一点最加分？哪一点还需要继续了解？`);
 add('dare',1,'all',`用恋爱综艺嘉宾的语气，介绍自己30秒。
演一段“收到喜欢的人消息，却在朋友面前装淡定”，让其他三人打分。
让另外三人给你取一个恋爱外号，你挑一个当今晚的称号。
用三个表情演绎：见面前、见面时、回家后。
以霸道总裁的口吻说“记得多喝水”，然后自己先笑场一次。
用一句土味情话打动全场，笑场也算完成。
模拟给喜欢的人打电话，第一句只能是“其实我不是顺路”。
用肢体语言表演“我没吃醋”，让大家猜到底多酸。`);
 add('dare',2,'all',`对{partner}说三句夸奖，必须各有一个具体细节，不能只说好看。
和{partner}即兴演一场30秒偶像剧：最后一句必须是“下次还想见你”。
由{partner}挑一个词，你用它即兴编一段情话。
和{partner}各用一个词形容对方，然后解释选择。
用15秒语音留言的口吻，对{partner}说一段“今天很开心”的告别。
请{partner}当导演，你演一段“笨拙但真诚的邀约”。
看着{partner}，把“随便”换成一个明确的约会提议。
和{partner}玩30秒默契问答：火锅还是烧烤、海边还是山里、电影还是散步。`);
 add('dare',3,'all',`与{partner}商量后，来一场15秒对视挑战；不愿对视就背靠背各说一句真话。
把一句“我觉得你不错”升级成30秒真诚夸奖，对{partner}说出来。
和{partner}演一段“电梯里偶遇心动对象”，必须有一句让全场起哄的台词。
先问{partner}是否愿意，愿意就牵手10秒；否则各说一件期待的约会小事。
对{partner}说一段“如果我是偶像剧男/女主，我会这样约你”的台词，说明是表演。
让{partner}指定一个日常场景，用你的方式演出最撩的版本。
和{partner}轮流接三句暧昧台词，任一人笑场即可结束。
面对{partner}，把“有空再约”改成一个具体时间和活动建议。提议不代表承诺。`);
 add('dare',1,'couple',`模仿{partner}平时最常用的语气，由本人判断像不像。
向全场讲述你们第一次约会，用一分钟电影解说的口吻。
给{partner}写一个离谱但可爱的五字以内昵称，当面征求同意。
由{partner}挑选一句你们常说的话，你用三种情绪演出来。`);
 add('dare',2,'couple',`和{partner}各说一个第一次心动的细节，看看记忆是否一致。
对{partner}复刻当年最让人心动的一句情话。
牵不牵手由你们决定；各说三件最近感谢对方的小事。
邀请{partner}一起规划一次只有你们两人的约会，现场确定活动。`);
 add('dare',3,'couple',`征得{partner}同意后，亲一下手背或额头；也可以改成认真说20秒情话。
向{partner}重新“求婚”30秒，这次必须带一个生活里真实的小细节。
和{partner}演一段热恋期重逢，拥抱由双方选择，也可用台词完成。
看着{partner}说“如果重新来一次，我还会选你”，再给一个真实理由。
为{partner}编一段只属于你们的暧昧台词，然后读出来。`);
 add('dare',1,'guest',`对{partner}提出一个轻松问题，再分享你自己的答案。
和{partner}共同设计一个你们都愿意玩的周末活动。
说出{partner}的一个优点，用最近见面时的小事作证。
给{partner}推荐一首适合今晚的歌，并说明原因。`);
 add('dare',2,'guest',`请{partner}挑一个：散步、咖啡或电影。你来设计30秒邀约词，对方可说暂时不想约。
和{partner}共同给你们最近的见面起一个剧集标题。
对{partner}说“我还想了解你的一件事是……”，然后认真听回答，对方可以跳过。
和{partner}各说一种相处时最舒服的聊天方式。
当面告诉{partner}：最近一次见面，你最开心的一个瞬间。`);
 add('dare',3,'guest',`邀请{partner}进行一分钟“只属于你们的聊天”，另外两人不插话；双方都愿意才开始。
用你平时真实的语气邀请{partner}单独见面，对方可接受、改时间或拒绝。
把“你挺好的”改成一句具体、有分量的欣赏，对{partner}说出来。
和{partner}各完成一句：“下次见面，我希望……”；不需要给对方承诺。
问{partner}“你愿意让我多了解你一点吗？”认真听答案，不追问理由。
向全场介绍{partner}最吸引你的一个特点，不用替关系下定义。`);
 let level=2,turn=0,current=-1,type='',bag=[],used=new Set(),last=null,clock=null,remaining=30,history=[];
 const names=()=>[0,1,2,3].map(i=>$('name'+i).value.trim()||['老公','老婆','男嘉宾','女嘉宾'][i]);
 const random=n=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return Math.floor(a[0]/4294967296*n);};
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
 const render=(q,p)=>q.text.replaceAll('{partner}',names()[p^1]);
 function eligible(t,p){return rows.filter(q=>q.type===t&&q.level===level&&(q.role==='all'||q.role===(p<2?'couple':'guest')));}
 function choose(t,p){let pool=eligible(t,p).filter(q=>!used.has(q.id));if(!pool.length){eligible(t,p).forEach(q=>used.delete(q.id));pool=eligible(t,p).filter(q=>q.id!==last?.id);}const q=pool[random(pool.length)];used.add(q.id);return q;}
 function stopClock(){clearInterval(clock);clock=null;remaining=30;$('seconds').textContent='30';$('startTimer').textContent='开始计时';}
 function draw(t,keep=false){stopClock();if(!keep||current<0){if($('mode').value==='round'){if(!bag.length){bag=shuffle([0,1,2,3]);if(bag[bag.length-1]===current)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];}current=bag.pop();}else{const choices=[0,1,2,3].filter(p=>p!==current);current=choices[random(choices.length)];}turn++;}type=t;last=choose(t,current);const text=render(last,current);$('kind').textContent=(t==='truth'?'真心话':'大冒险')+' / '+['','暖场八卦','暧昧升温','劲爆直球'][level];$('round').textContent='第 '+turn+' 回合';$('player').textContent=names()[current]+' · '+(current<2?'夫妻组':'朋友组');$('prompt').textContent=text;$('detail').textContent=t==='truth'?'讲愿意分享的真话，其他人可以追问一次，玩家可以不答。':'互动涉及搭档时，先问一句“可以吗？”；对方拒绝就用替代任务或换题。';$('timer').hidden=t!=='dare';$('swap').disabled=false;$('skip').disabled=false;const card=document.querySelector('.question');card.classList.remove('pop');void card.offsetWidth;card.classList.add('pop');history.unshift(names()[current]+' · '+(t==='truth'?'真心话':'大冒险')+'：'+text);history=history.slice(0,60);paintHistory();}
 function paintHistory(){$('history').replaceChildren(...history.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));$('count').textContent=history.length+' 题';}
 [0,1,2,3].forEach(i=>{try{const n=JSON.parse(localStorage.getItem('rain.party.names.v1')||'null');if(Array.isArray(n)&&typeof n[i]==='string')$('name'+i).value=n[i].slice(0,16);}catch{}$('name'+i).addEventListener('change',()=>{try{localStorage.setItem('rain.party.names.v1',JSON.stringify(names()));}catch{}});});
 document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{level=Number(b.dataset.level);document.querySelectorAll('[data-level]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});if(current>=0)draw(type,true);}));
 $('truth').onclick=()=>draw('truth');$('dare').onclick=()=>draw('dare');$('mix').onclick=()=>draw(random(2)?'truth':'dare');$('swap').onclick=()=>draw(type,true);$('skip').onclick=()=>draw(random(2)?'truth':'dare');$('mode').onchange=()=>{bag=[];};
 $('startTimer').onclick=()=>{if(clock){clearInterval(clock);clock=null;$('startTimer').textContent='继续';return;}if(remaining===0)remaining=30;const end=Date.now()+remaining*1000;$('startTimer').textContent='暂停';clock=setInterval(()=>{remaining=Math.max(0,Math.ceil((end-Date.now())/1000));$('seconds').textContent=String(remaining);if(!remaining){clearInterval(clock);clock=null;$('startTimer').textContent='再计时';}},200);};
 $('reset').onclick=()=>{stopClock();turn=0;current=-1;bag=[];used.clear();history=[];last=null;paintHistory();$('kind').textContent='今晚，谁先交代？';$('round').textContent='第 0 回合';$('player').textContent='四位，请就位';$('prompt').textContent='新一局，谁先来？';$('detail').textContent='选择真心话、大冒险或随机抽题。';$('timer').hidden=true;$('swap').disabled=true;$('skip').disabled=true;};
})();
