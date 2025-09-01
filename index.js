async function ensureUser() {
  const r = await fetch('/api/user');
  if (!r.ok) { location.href = '/home.html'; return null; }
  const u = await r.json();
  document.getElementById('user-info').innerHTML = `שלום, ${u.name}! <a href="/logout">התנתק</a>`;
  return u;
}

async function searchPokemon() {
  const id = document.getElementById('pokemonId').value.trim().toLowerCase();
  const ability = document.getElementById('ability').value.trim().toLowerCase();
  const type = document.getElementById('type').value;
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const result = document.getElementById('result');
  error.textContent = ''; result.innerHTML = '';

  loading.style.display = 'block';
  const show = d => displayPokemon(d);
  try {
    if (id) {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!r.ok) throw new Error('לא נמצא פוקימון');
      show(await r.json());
    } else if (type) {
      const r = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
      const data = await r.json();
      const arr = await Promise.all(data.pokemon.slice(0,10).map(p=>fetch(p.pokemon.url).then(r=>r.json())));
      arr.forEach(show);
    } else if (ability) {
      const r = await fetch(`https://pokeapi.co/api/v2/ability/${ability}`);
      const data = await r.json();
      const arr = await Promise.all(data.pokemon.slice(0,10).map(p=>fetch(p.pokemon.url).then(r=>r.json())));
      arr.forEach(show);
    } else {
      error.textContent = 'אנא הזן קריטריון אחד לפחות';
    }
  } catch(e){ error.textContent = e.message || 'שגיאה'; }
  finally { loading.style.display = 'none'; }
}

function displayPokemon(data) {
  const result = document.getElementById('result');
  const types = data.types.map(t => t.type.name).join(', ');
  const abilities = data.abilities.map(a => a.ability.name).join(', ');
  const card = document.createElement('div');
  card.className = 'pokemon-card';
  card.innerHTML = `
    <img src="${data.sprites.front_default}" alt="${data.name}" onclick="location.href='/pokemon/${data.id}'"/>
    <div>
      <strong>שם:</strong> ${data.name}<br>
      <strong>ID:</strong> ${data.id}<br>
      <strong>סוג:</strong> ${types}<br>
      <strong>יכולות:</strong> ${abilities}<br>
      <button data-id="${data.id}">הוסף למועדפים</button>
    </div>`;
  card.querySelector('button').onclick = () => addToFavorites(data);
  result.appendChild(card);
}

async function addToFavorites(d) {
  const me = await fetch('/api/user').then(r=>r.json());
  const r = await fetch(`/users/${encodeURIComponent(me.email)}/favorites`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ id:d.id, name:d.name, types:d.types, abilities:d.abilities, sprite:d.sprites.front_default })
  });
  if (!r.ok) alert('Failed to add');
  else alert('Added!');
}

window.onload = ensureUser;
