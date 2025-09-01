(async ()=>{const r=await fetch('/api/user');
  if(!r.ok){
    location.href='/home.html';
    return;
  }
const u=await r.json();
document.getElementById('user-info').innerHTML=`שלום, ${u.name}! <a href="/logout">התנתק</a>`;
}
)();
async function loadBoard(){
  const r = await fetch('/api/arena/leaderboard', { credentials:'include' });
  const list = await r.json();
  const tb = document.querySelector('#tbl tbody');
  tb.innerHTML = '';
  if (!Array.isArray(list) || !list.length) {
    tb.innerHTML = '<tr><td colspan="9">אין נתונים. שחקו לפחות קרב אחד מול בוט/שחקן.</td></tr>';
    return;
  }
  list.forEach(x=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${x.rank}</td>
                  <td>${x.name}</td>
                  <td>${x.email}</td>
                  <td><strong>${x.points}</strong></td>
                  <td>${x.wins}</td>
                  <td>${x.draws}</td>
                  <td>${x.losses}</td>
                  <td>${x.games}</td>
                  <td>${x.success}%</td>`;
    tb.appendChild(tr);
  });
}
window.onload = loadBoard;
