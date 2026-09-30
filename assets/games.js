(() => {
  const $=id=>document.getElementById(id);
  function pick(length){const limit=2**32-(2**32%length),buffer=new Uint32Array(1);do{crypto.getRandomValues(buffer);}while(buffer[0]>=limit);return buffer[0]%length;}
  $('roll-dice').onclick=()=>{const index=pick(6);$('dice-result').textContent=['⚀','⚁','⚂','⚃','⚄','⚅'][index]+' '+(index+1);};
  $('pick-player').onclick=()=>{const players=[...new Set($('players').value.split(/[,，、;；\n]/).map(x=>x.trim()).filter(Boolean))];$('player-result').textContent=players.length?'这次是：'+players[pick(players.length)]:'请先填写参与者。';};
})();
