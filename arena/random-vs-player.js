(async () => {
  const r = await fetch('/api/user', { credentials:'include' });
  if (!r.ok) { location.href = '/home.html'; return; }
  const u = await r.json();
  document.getElementById('user-info').innerHTML = `שלום, ${u.name}! <a href="/logout">התנתק</a>`;
  loadOpp();
})();
const sel   = document.getElementById('opponents');
const stage = document.getElementById('stage');
const btnRand = document.getElementById('randomOpponent') || document.querySelector('#randomOpponent');
const btnStart= document.getElementById('startBattle')     || document.querySelector('#startBattle');
function score(stats){ const g=n=>stats.find(s=>s.stat.name===n)?.base_stat||0;
  return +((g('hp')*0.3)+(g('attack')*0.4)+(g('defense')*0.2)+(g('speed')*0.1)).toFixed(2); }
async function loadOpp(){
  stage.textContent='';
  try {
    const r = await fetch('/api/arena/opponents', { credentials:'include' });
    const list = await r.json();
    sel.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      sel.disabled = true; btnRand.disabled = true; btnStart.disabled = true;
      stage.innerHTML = '<div class="error">אין יריבים זמינים. צרו עוד משתמש אחד ואז חזרו לפה.</div>';
      return;
    }
    list.forEach(u=>{
      const o=document.createElement('option');
      o.value=u.email; o.textContent=`${u.name} (${u.email})`;
      sel.appendChild(o);
    });
  } catch(e){
    console.error(e);
    stage.innerHTML = `<div class="error">שגיאה בטעינת יריבים (${e.message})</div>`;
  }
}
async function start(useRandom){
  stage.textContent = 'טוען...';
  try{
    const body = useRandom ? {} : { opponentEmail: sel.value };
    const r = await fetch('/api/arena/random-vs-player/start', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) { stage.innerHTML = `<div class="error">${data.error||'שגיאה'}</div>`; return; }

    const { me, opponent, myPokemon, oppPokemon } = data;
    const [my, op] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${myPokemon.id}`).then(r=>r.json()),
      fetch(`https://pokeapi.co/api/v2/pokemon/${oppPokemon.id}`).then(r=>r.json())
    ]);
    const a = score(my.stats), b = score(op.stats);
    const winner = a >= b ? me.email : opponent.email;
    stage.innerHTML = `
      <div class="pokemon-card">
        <div style="flex:1;text-align:center">
          <h3>${my.name} #${my.id}</h3>
          <img style="height:120px" src="${my.sprites.other['official-artwork'].front_default || my.sprites.front_default}">
        </div>
        <div style="flex:1;text-align:center">
          <h3>${op.name} #${op.id}</h3>
          <img style="height:120px" src="${op.sprites.other['official-artwork'].front_default || op.sprites.front_default}">
        </div>
      </div>
      <p><strong>ניקוד:</strong> ${me.name} ${a} | ${opponent.name} ${b}</p>
      <h2>המנצח: ${(winner===me.email)?me.name:opponent.name}</h2>`;
    await fetch('/api/arena/random-vs-player/record', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({
        me, opponent, winnerEmail: winner,
        my:  { id: my.id, name: my.name, score: a },
        opp: { id: op.id, name: op.name, score: b }
      })
    });
  } catch(e){
    console.error(e);
    stage.innerHTML = `<div class="error">שגיאה בהפעלת קרב (${e.message})</div>`;
  }
}
btnRand.onclick  = () => start(true);
btnStart.onclick = () => start(false);
