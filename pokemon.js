(async ()=>{
  const r = await fetch('/api/user'); 
  if(!r.ok){
    location.href='/home.html';
    return;
  }
  const u = await r.json();
  document.getElementById('user-info').innerHTML = `שלום, ${u.name}! <a href="/logout">התנתק</a>`;
})();
const id = location.pathname.split('/').pop();
fetch(`https://pokeapi.co/api/v2/pokemon/${id}`).then(r=>r.json()).then(d=>{
  document.getElementById('pokemon-details').innerHTML = `
    <h1>${d.name} (#${d.id})</h1>
    <img src="${d.sprites.other['official-artwork'].front_default || d.sprites.front_default}" style="height:180px">
    <p>Types: ${d.types.map(t=>t.type.name).join(', ')}</p>
    <p>Abilities: ${d.abilities.map(a=>a.ability.name).join(', ')}</p>
    <ul>${d.stats.map(s=>`<li>${s.stat.name}: ${s.base_stat}</li>`).join('')}</ul>
  `;
});
