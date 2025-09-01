(async () => {
  try {
    const r = await fetch('/api/user', { credentials: 'include' });
    if (!r.ok) { location.href = '/home.html'; return; }
    const u = await r.json();
    document.getElementById('user-info').innerHTML = `שלום, ${u.name}! <a href="/logout">התנתק</a>`;
  } catch (e) {
    console.error(e);
    return;
  }
  loadFav();
})();

const favGrid = document.getElementById('favGrid');
const stage   = document.getElementById('stage');

function score(stats){
  const g = n => stats.find(s => s.stat.name === n)?.base_stat || 0;
  const HP=g('hp'), ATK=g('attack'), DEF=g('defense'), SPD=g('speed');
  return +(HP*0.3 + ATK*0.4 + DEF*0.2 + SPD*0.1).toFixed(2);
}

async function loadFav(){
  favGrid.innerHTML = 'טוען...';
  try {
    const r = await fetch('/api/arena/my-favorites', { credentials:'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const favs = await r.json();
    if (!Array.isArray(favs) || favs.length === 0) {
      favGrid.innerHTML = '<div class="error">אין מועדפים. לכו לדף החיפוש והוסיפו.</div>';
      return;
    }
    favGrid.innerHTML = '';
    favs.forEach(p => {
      const d = document.createElement('div');
      d.className = 'tile';
      d.innerHTML = `<img src="${p.sprite}" style="height:80px"><br><strong>${p.name}</strong><br>#${p.id}`;
      d.onclick = () => start(p.id, p.name);
      favGrid.appendChild(d);
    });
  } catch (e) {
    console.error(e);
    favGrid.innerHTML = `<div class="error">שגיאה בטעינת מועדפים (${e.message})</div>`;
  }
}

async function start(id, name){
  stage.textContent = 'מכין קרב...';
  try {
    const r = await fetch('/api/arena/vs-bot/start', {
      method:'POST', headers:{'Content-Type':'application/json'},
      credentials:'include',
      body: JSON.stringify({ pokemonId:id, pokemonName:name })
    });
    const data = await r.json();
    if (!r.ok) { stage.innerHTML = `<div class="error">${data.error||'שגיאה'}</div>`; return; }
    const myP = data.myPokemon, opP = data.botPokemon;
    const [myFull, opFull] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${myP.id}`).then(r=>r.json()),
      fetch(`https://pokeapi.co/api/v2/pokemon/${opP.id}`).then(r=>r.json())
    ]);
    stage.innerHTML = `
      <div class="pokemon-card">
        <div style="flex:1;text-align:center">
          <h3>${myFull.name} #${myFull.id}</h3>
          <img style="height:120px" src="${myFull.sprites.other['official-artwork'].front_default || myFull.sprites.front_default}">
        </div>
        <div style="flex:1;text-align:center">
          <h3>${opFull.name} #${opFull.id}</h3>
          <img style="height:120px" src="${opFull.sprites.other['official-artwork'].front_default || opFull.sprites.front_default}">
        </div>
      </div>
      <div id="count" style="font-size:40px;text-align:center">3</div>`;
    for (let n=3;n>0;n--) {
      document.getElementById('count').textContent = n;
      await new Promise(s=>setTimeout(s,700));
    }
    const a = score(myFull.stats), b = score(opFull.stats);
    const draw = a === b, winner = draw ? data.me.email : (a>b ? data.me.email : data.bot.email);
    stage.innerHTML += `<p><strong>ניקוד:</strong> שלי ${a} | בוט ${b}</p><h2>${draw?'תיקו':('מנצח: '+(winner===data.me.email?'אני':'הבוט'))}</h2>`;
    await fetch('/api/arena/vs-bot/record', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({
        me: data.me, bot: data.bot, winnerEmail: winner,
        my:  { id: myFull.id, name: myFull.name, score: a },
        opp: { id: opFull.id, name: opFull.name, score: b }
      })
    }).catch(()=>{});
  } catch(e) {
    console.error(e);
    stage.innerHTML = `<div class="error">שגיאה בהפעלת קרב (${e.message})</div>`;
  }
}
