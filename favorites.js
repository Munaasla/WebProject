let meEmail = null;
async function loadUser() {
  const r = await fetch('/api/user');
  if (!r.ok) { location.href='/home.html'; return; }
  const u = await r.json();
  meEmail = u.email;
  document.getElementById('user-info').innerHTML = `שלום, ${u.name}! <a href="/logout">התנתק</a>`;
}

async function renderFavorites() {
  const sortBy = document.getElementById('sortSelect').value;
  const r = await fetch(`/users/${encodeURIComponent(meEmail)}/favorites`);
  let favs = await r.json();
  favs.sort(sortBy==='name' ? ((a,b)=>a.name.localeCompare(b.name)) : ((a,b)=>a.id-b.id));
  const container = document.getElementById('favorites');
  container.innerHTML = '';
  favs.forEach(p=>{
    const types = (p.types||[]).map(t=>t.type?.name||t).join(', ');
    const abilities = (p.abilities||[]).map(a=>a.ability?.name||a).join(', ');
    const div = document.createElement('div');
    div.className='pokemon-card';
    div.innerHTML = `
      <img src="${p.sprite}" alt="${p.name}" onclick="location.href='/pokemon/${p.id}'"/>
      <div>
        <strong>${p.name}</strong> (#${p.id})<br>
        סוגים: ${types}<br>
        יכולות: ${abilities}<br>
        <button>הסר</button>
      </div>`;
    div.querySelector('button').onclick = ()=>removeFavorite(p.id);
    container.appendChild(div);
  });
}

async function removeFavorite(id){
  await fetch(`/users/${encodeURIComponent(meEmail)}/favorites/${id}`, { method:'DELETE' });
  renderFavorites();
}

document.getElementById('sortSelect').onchange = renderFavorites;
document.getElementById('download').onclick = ()=> {
  location.href = `/users/${encodeURIComponent(meEmail)}/favorites/download`;
};

window.onload = async ()=>{ await loadUser(); renderFavorites(); };
