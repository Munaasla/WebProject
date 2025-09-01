const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();
const useCors = true;
const cors = useCors ? require('cors') : null;
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (useCors) {
  app.use(cors({
    origin: ['http://localhost:5500','http://127.0.0.1:5500','http://localhost:3000'],
    methods: ['GET','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }));
  app.options('*', cors());
}
app.use(session({
  secret: 'change_me_secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, _res, next) => { console.log(req.method, req.url); next(); });
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const OTP_TTL_MIN = parseInt(process.env.RESET_CODE_TTL_MINUTES || '15', 10);
async function sendMail(to, subject, html) {
  const driver = (process.env.MAIL_DRIVER || 'console').toLowerCase();
  if (driver === 'smtp') {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html });
  } else {
    console.log('--- OTP EMAIL (DEV) ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('HTML:', html);
    console.log('-----------------------');
  }
}
const genCode = () => String(Math.floor(100000 + Math.random() * 900000)); 
const DATA_DIR     = path.join(__dirname, 'data');
const USERS_PATH   = path.join(DATA_DIR, 'users.json');
const BATTLES_PATH = path.join(DATA_DIR, 'battles.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_PATH)) fs.writeFileSync(USERS_PATH, '[]');
if (!fs.existsSync(BATTLES_PATH)) fs.writeFileSync(BATTLES_PATH, '[]');
const readArr  = fp => { 
  try { const j = JSON.parse(fs.readFileSync(fp, 'utf8') || '[]'); 
    return Array.isArray(j)?j:[]; } 
    catch { fs.writeFileSync(fp,'[]'); 
      return []; } };
const writeArr = (fp, a) => fs.writeFileSync(fp, JSON.stringify(a, null, 2));
const readUsers    = () => readArr(USERS_PATH);
const writeUsers   = a  => writeArr(USERS_PATH, a);
const readBattles  = () => readArr(BATTLES_PATH);
const writeBattles = a  => writeArr(BATTLES_PATH, a);
const validName  = s => typeof s==='string' && s.length>0 && s.length<=50 && /^[\p{L}\s]+$/u.test(s);
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
function validPassword(p){
  if (typeof p!=='string' || p.length<7 || p.length>15)
     return false;
  return /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
}
const ensureAuthPage = (req,res,next)=>{ if(!req.session.user) 
  return res.redirect('/home.html'); next(); };
const ensureAuthAPI  = (req,res,next)=>{ if(!req.session.user) 
  return res.status(401).json({error:'Not logged in'}); next(); };
const getUserByEmail = email => { const users = readUsers(); const idx = users.findIndex(u=>u.email===email); return {users,idx}; };
function assertSameUser(req,res,next){
  const userId = String(req.params.userId||'').toLowerCase();
  if (!req.session.user || req.session.user.email !== userId) 
    return res.status(403).json({error:'Forbidden'});
  next();
}


app.get('/api/students', (_req,res)=>{
  try {
    const t = fs.readFileSync(path.join(__dirname,'data','students.json'),'utf8');
    res.json(JSON.parse(t));
  } catch {
    res.status(500).json({error:'Failed to read students data'});
  }
});
app.get('/api/user', (req,res)=> req.session.user ? res.json(req.session.user) : res.status(401).json({error:'Not logged in'}));


app.post('/api/register', async (req,res)=>{
  try{
    const { name, email, password } = req.body || {};
    if (!validName(name))
       return res.status(400).send('Name must be ≤ 50 and letters/spaces only.');
    if (!validEmail(email))
       return res.status(400).send('Invalid email format.');
    if (!validPassword(password)) 
      return res.status(400).send('Password 7–15, must include UPPER, lower, digit, special.');
    const users = readUsers();
    const em = String(email).toLowerCase();
    if (users.find(u=>u.email===em)) 
      return res.status(409).send('Email already exists.');
    const hash = await bcrypt.hash(password, 10);
    users.push({ name, email: em, password: hash, favorites: [], createdAt: Date.now() });
    writeUsers(users);
    req.session.user = { name, email: em };
    res.json({ message:'Registered successfully.' });
  }catch(e){ console.error('REGISTER ERROR:', e); res.status(500).send('Internal server error during register.'); }
});
app.post('/register.html', (req,res)=> res.redirect(307,'/api/register'));


app.post('/api/login', async (req,res)=>{
  try{
    const { email, password } = req.body || {};
    if (!validEmail(email) || typeof password!=='string') 
      return res.status(400).json({error:'Invalid email or password.'});
    const users = readUsers();
    const u = users.find(x=>x.email===String(email).toLowerCase());
    if (!u)
       return res.status(401).json({error:'Invalid email or password.'});
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) 
      return res.status(401).json({error:'Invalid email or password.'});
    req.session.user = { name: u.name, email: u.email };
    res.json({ message:'Login successful.' });
  }catch(e){ console.error('LOGIN ERROR:', e); res.status(500).json({error:'Server error.'}); }
});
app.get('/logout', (req,res)=> req.session.destroy(()=>res.redirect('/home.html')));
app.post('/api/forgot-code', (req, res) => {
  const { email } = req.body || {};
  if (!validEmail(email))
     return res.status(400).json({ error: 'Invalid email.' });
  const users = readUsers();
  const idx = users.findIndex(u => u.email === String(email).toLowerCase());
  if (idx === -1) 
    return res.json({ message: 'If the email exists, a verification code has been sent.' });
  const code = genCode();
  users[idx].resetCode = code;
  users[idx].resetCodeExpires = Date.now() + OTP_TTL_MIN*60*1000;
  users[idx].resetCodeAttempts = 0;
  writeUsers(users);
  const html = `
    <h3>Password reset code</h3>
    <p>Your verification code is:</p>
    <div style="font-size:24px;font-weight:bold;letter-spacing:3px">${code}</div>
    <p>This code expires in ${OTP_TTL_MIN} minutes.</p>
  `;
  sendMail(users[idx].email, 'Your password reset code', html)
    .then(()=>{
      const payload = { message: 'If the email exists, a verification code has been sent.' };
      if ((process.env.MAIL_DRIVER || 'console').toLowerCase() !== 'smtp')
         payload.devCode = code; 
      res.json(payload);
    })
    .catch(()=> res.json({ message: 'If the email exists, a verification code has been sent.' }));
});

app.post('/api/reset-by-code', async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!validEmail(email)) 
    return res.status(400).json({ error: 'Invalid email.' });
  if (!/^\d{6}$/.test(code || '')) 
    return res.status(400).json({ error: 'Invalid code.' });
  if (!validPassword(newPassword)) 
    return res.status(400).json({ error: 'Password 7–15, must include uppercase, lowercase, digit, special.' });
  const users = readUsers();
  const idx = users.findIndex(u => u.email === String(email).toLowerCase());
  if (idx === -1) 
    return res.status(400).json({ error: 'Invalid email or code.' });
  const u = users[idx];
  if (!u.resetCode || !u.resetCodeExpires) 
    return res.status(400).json({ error: 'No code requested.' });
  u.resetCodeAttempts = (u.resetCodeAttempts || 0) + 1;
  if (u.resetCodeAttempts > 5) {
    delete u.resetCode; delete u.resetCodeExpires; delete u.resetCodeAttempts;
    writeUsers(users);
    return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  }
  if (Date.now() > u.resetCodeExpires || u.resetCode !== code) {
    writeUsers(users);
    return res.status(400).json({ error: 'Invalid or expired code.' });
  }
  u.password = await bcrypt.hash(newPassword, 10);
  delete u.resetCode; delete u.resetCodeExpires; delete u.resetCodeAttempts;
  writeUsers(users);
  if (req.session) req.session.destroy(()=>{});
  res.json({ message: 'Password updated. You can login now.' });
});


app.get('/users/:userId/favorites', ensureAuthAPI, assertSameUser, (req,res)=>{
  const { users, idx } = getUserByEmail(req.session.user.email);
  if (idx===-1) 
    return res.status(404).json({error:'User not found'});
  res.json(users[idx].favorites || []);
});
app.post('/users/:userId/favorites', ensureAuthAPI, assertSameUser, (req,res)=>{
  const { id, name, types, abilities, sprite } = req.body || {};
  if (!id || !name) 
    return res.status(400).json({error:'Invalid pokemon payload'});
  const { users, idx } = getUserByEmail(req.session.user.email);
  if (idx===-1)
     return res.status(404).json({error:'User not found'});
  users[idx].favorites = users[idx].favorites || [];
  if (!users[idx].favorites.find(p=>p.id===id)) 
    users[idx].favorites.push({ id, name, types, abilities, sprite });
  writeUsers(users);
  res.json({message:'Added to favorites'});
});
app.delete('/users/:userId/favorites/:pokemonId', ensureAuthAPI, assertSameUser, (req,res)=>{
  const pokeId = Number(req.params.pokemonId);
  const { users, idx } = getUserByEmail(req.session.user.email);
  if (idx===-1) 
    return res.status(404).json({error:'User not found'});
  users[idx].favorites = (users[idx].favorites||[]).filter(p=>p.id!==pokeId);
  writeUsers(users);
  res.json({message:'Removed'});
});
app.get('/users/:userId/favorites/download', ensureAuthAPI, assertSameUser, (req,res)=>{
  const { users, idx } = getUserByEmail(req.session.user.email);
  if (idx===-1)
     return res.status(404).json({error:'User not found'});
  const favs = users[idx].favorites || [];
  const header = 'id,name,types,abilities,sprite\n';
  const rows = favs.map(p=>{
    const types = (p.types||[]).map(t=>t.type?.name||t).join('|');
    const abilities = (p.abilities||[]).map(a=>a.ability?.name||a).join('|');
    const esc = s => `"${String(s??'').replace(/"/g,'""')}"`;
    return [p.id, esc(p.name), esc(types), esc(abilities), esc(p.sprite)].join(',');
  });
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="favorites.csv"');
  res.send(header+rows.join('\n'));
});

function pickPokemonFor(email){
  const { users, idx } = getUserByEmail(email);
  const user = idx===-1 ? null : users[idx];
  if (user && Array.isArray(user.favorites) && user.favorites.length) {
    const p = user.favorites[Math.floor(Math.random()*user.favorites.length)];
    return { id:p.id, name:p.name };
  }
  const id = Math.floor(Math.random()*151)+1;
  return { id, name:`pokemon-${id}` };
}
const computePower = id => Math.floor(50+Math.random()*100)+(id%20);


app.get('/api/arena/my-favorites', ensureAuthAPI, (req,res)=>{
  const { users, idx } = getUserByEmail(req.session.user.email);
  if (idx===-1) 
    return res.status(404).json({error:'User not found'});
  res.json(users[idx].favorites || []);
});
app.post('/api/arena/vs-bot/start', ensureAuthAPI, (req,res)=>{
  const me = req.session.user;
  const { pokemonId, pokemonName } = req.body || {};
  if (!pokemonId) 
    return res.status(400).json({error:'pokemonId required'});
  const botEmail='bot@arena', botName='Arena Bot', botPick=pickPokemonFor(botEmail);
  res.json({ me, bot:{name:botName,email:botEmail}, myPokemon:{id:Number(pokemonId),name:pokemonName||`pokemon-${pokemonId}`}, botPokemon:botPick });
});
app.post('/api/arena/vs-bot/record', ensureAuthAPI, (req,res)=>{
  const { me, bot, my, opp, winnerEmail } = req.body || {};
  if (!me?.email || !bot?.email || !my?.id || !opp?.id || typeof winnerEmail!=='string') 
    return res.status(400).json({error:'payload invalid'});
  const battle = { time:Date.now(),
    player1:{ name:me.name,  email:me.email,  pokemonId:my.id,  pokemonName:my.name,  power:my.score },
    player2:{ name:bot.name, email:bot.email, pokemonId:opp.id, pokemonName:opp.name, power:opp.score },
    winnerEmail };
  const arr = readBattles(); arr.push(battle); writeBattles(arr);
  res.json({message:'saved', battle});
});
app.get('/api/arena/opponents', ensureAuthAPI, (req,res)=>{
  const me = req.session.user.email;
  const users = readUsers().filter(u=>u.email!==me).map(u=>({name:u.name,email:u.email}));
  res.json(users);
});
app.post('/api/arena/random-vs-player/start', ensureAuthAPI, (req,res)=>{
  const me = req.session.user;
  const { opponentEmail } = req.body || {};
  const users = readUsers().filter(u=>u.email!==me.email);
  if (!users.length) 
    return res.status(400).json({error:'אין יריבים זמינים.'});
  const opp = opponentEmail ? users.find(u=>u.email===String(opponentEmail).toLowerCase()) : users[Math.floor(Math.random()*users.length)];
  if (!opp) 
    return res.status(400).json({error:'יריב לא נמצא.'});
  res.json({ me, opponent:{name:opp.name,email:opp.email}, myPokemon:pickPokemonFor(me.email), oppPokemon:pickPokemonFor(opp.email) });
});
app.post('/api/arena/random-vs-player/record', ensureAuthAPI, (req,res)=>{
  const { me, opponent, my, opp, winnerEmail } = req.body || {};
  if (!me?.email || !opponent?.email || !my?.id || !opp?.id || typeof winnerEmail!=='string') 
    return res.status(400).json({error:'payload invalid'});
  const battle = { time:Date.now(),
    player1:{ name:me.name, email:me.email, pokemonId:my.id, pokemonName:my.name, power:my.score },
    player2:{ name:opponent.name, email:opponent.email, pokemonId:opp.id, pokemonName:opp.name, power:opp.score },
    winnerEmail };
  const arr = readBattles(); arr.push(battle); writeBattles(arr);
  res.json({message:'saved', battle});
});
app.get('/api/arena/history', ensureAuthAPI, (req,res)=>{
  const me = req.session.user;
  const list = readBattles().filter(b=>b.player1.email===me.email || b.player2.email===me.email).sort((a,b)=>b.time-a.time);
  res.json(list);
});
app.get('/api/arena/leaderboard', ensureAuthAPI, (_req,res)=>{
  const battles = readBattles().slice(-100);
  const table = new Map();
  const ensure = p => {
     if (!table.has(p.email)) 
      table.set(p.email,{email:p.email,name:p.name,wins:0,draws:0,losses:0,games:0,points:0});
   return table.get(p.email); 
  };
  for (const b of battles){
    const p1=ensure(b.player1), p2=ensure(b.player2); 
    p1.games++;
     p2.games++;
    const draw = b.player1.power===b.player2.power;
    if (draw){
      p1.draws++; 
      p2.draws++; 
      p1.points+=1; 
      p2.points+=1; 
    }
    else if (b.winnerEmail===b.player1.email){
       p1.wins++; 
       p2.losses++; 
       p1.points+=3; 
      }
    else {
       p2.wins++; 
       p1.losses++;
        p2.points+=3;
       }
  }
  const list = Array.from(table.values()).filter(x=>x.email!=='bot@arena')
    .map(x=>({...x, success: x.games ? Math.round((x.wins/x.games)*100) : 0}))
    .sort((a,b)=> b.points-a.points || b.success-a.success || b.wins-a.wins);
  list.forEach((x,i)=>x.rank=i+1);
  res.json(list);
});


app.get('/index.html', ensureAuthPage, (_req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/favorites.html', ensureAuthPage, (req,res)=>res.sendFile(path.join(__dirname,'public','favorites.html')));
app.get('/pokemon/:id', (req,res)=>{ if(!req.session.user) return res.redirect('/'); res.sendFile(path.join(__dirname,'public','pokemon.html')); });
app.get('/arena.html',     ensureAuthPage, (req,res)=>res.sendFile(path.join(__dirname,'public','arena.html')));
app.get('/arena/vs-bot.html', ensureAuthPage, (_req,res)=> res.sendFile(path.join(__dirname,'public','arena','vs-bot.html')));
app.get('/arena/random-vs-player.html', ensureAuthPage, (_req,res)=> res.sendFile(path.join(__dirname,'public','arena','random-vs-player.html')));
app.get('/arena/leaderboard.html', ensureAuthPage, (_req,res)=> res.sendFile(path.join(__dirname,'public','arena','leaderboard.html')));
app.get('/', (req,res)=> req.session.user ? res.redirect('/index.html') : res.redirect('/home.html'));
app.get('*', (_req,res)=> res.status(404).send('Not found'));
app.listen(PORT, ()=> console.log(`http://localhost:${PORT}`));
