/* GameHub 2.0 — 24 distinct browser games, creator tools, local storage,
   optional Netlify AI, Wi-Fi bridge PIN pairing and USB serial control. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const BRIDGE_URL = '/.netlify/functions/bridge';
  const AI_URL = '/.netlify/functions/gamehub-ai';
  const DB_NAME = 'gamehub-2-db';
  const PROFILE_KEY = 'gh2-profile-name';
  const STORE = {
    saved: 'gh2-saved', custom: 'gh2-custom', settings: 'gh2-settings',
    widgets: 'gh2-widgets', seconds: 'gh2-seconds', day: 'gh2-day',
    scores: 'gh2-scores', edition: 'gh2-edition', chat: 'gh2-chat',
    plays: 'gh2-plays', unique: 'gh2-unique', achievements: 'gh2-achievements', daily: 'gh2-daily'
  };
  const safeJSON = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch (_) { return fallback; }
  };
  const saveJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { toast('Browser storage is full. Export or remove files.'); } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtBytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
  const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

  const games = [
    ['snake','Neon Snake','Classic','🐍','Eat energy dots and grow without hitting yourself.','#1d8b78'],
    ['pong','Pocket Pong','Arcade','🏓','Keep the ball alive with your paddle.','#5d67c8'],
    ['breakout','Brick Breaker','Arcade','🧱','Bounce a ball to clear every brick.','#b45b91'],
    ['flappy','Sky Hopper','Skill','🐤','Flap through moving gaps.','#4289b4'],
    ['runner','Pixel Runner','Action','🏃','Jump over hazards and survive the run.','#bc7947'],
    ['shooter','Space Patrol','Action','🚀','Move, shoot and clear the enemy wave.','#4b65bd'],
    ['dodge','Meteor Dodge','Action','☄️','Dodge falling rocks for as long as possible.','#a65d42'],
    ['target','Target Tap','Skill','🎯','Hit the moving target before time runs out.','#c45b7b'],
    ['memory','Memory Match','Puzzle','🧠','Flip tiles and find all matching pairs.','#7b69bd'],
    ['tictactoe','Tic-Tac-Toe','Puzzle','❎','Beat the computer in a three-in-a-row duel.','#3a9b91'],
    ['tetris','Tetris Drop','Puzzle','🟦','Rotate and fit falling blocks to clear lines.','#5f7fc5'],
    ['2048','2048 Merge','Puzzle','🔢','Slide equal tiles together to reach 2048.','#b38b45'],
    ['mines','Mine Finder','Puzzle','💣','Reveal safe tiles and mark hidden mines.','#c06b61'],
    ['simon','Simon Sequence','Skill','🎵','Remember the growing sequence of colours.','#a46ab6'],
    ['whack','Whack-a-Mole','Casual','🔨','Tap the mole before it hides.','#6f9d58'],
    ['connect4','Connect Four','Puzzle','🔴','Drop discs and connect four before the CPU.','#bd6d52'],
    ['lights','Lights Out','Puzzle','💡','Switch off every light by toggling neighbours.','#599bb5'],
    ['word','Word Guess','Puzzle','🔤','Find the hidden five-letter word in six tries.','#8b76c8'],
    ['math','Math Blitz','Skill','➗','Choose the correct answer before time expires.','#4c9b7c'],
    ['maze','Maze Escape','Puzzle','🧭','Find the exit through the maze.','#a28b4e'],
    ['tower','Tower Stack','Arcade','🏗️','Drop moving platforms and build a tall tower.','#b06b92'],
    ['lunar','Lunar Lander','Skill','🌕','Use gentle thrust to land on the landing pad.','#617eb0'],
    ['reaction','Reaction Rush','Skill','⚡','Wait for GO, then react as fast as you can.','#bc8e47'],
    ['fruit','Fruit Catch','Casual','🍉','Catch fruit and avoid the bombs.','#d27658']
  ].map(([id,title,category,icon,desc,color], index) => ({ id, engine:id, title, category, icon, desc, color, index }));
  const engineById = Object.fromEntries(games.map(g => [g.id, g]));
  const achievementDefs = [
    ['first-play','First Steps','Play your first game.','🎮'],
    ['explorer','Arcade Explorer','Try five different games.','🧭'],
    ['ten-games','Dedicated Player','Start ten games.','🏅'],
    ['score-hunter','Score Hunter','Earn 100 points in one game.','🎯'],
    ['creator','Game Creator','Create your first custom game.','🪄'],
    ['customizer','Style Maker','Change your wallpaper or accent.','🎨'],
    ['collector','Collector','Save ten games to My Games.','📚'],
    ['uploader','File Keeper','Upload your first file.','📁']
  ];
  function unlockAchievement(id) {
    if (state.achievements.includes(id)) return;
    state.achievements.push(id);
    saveJSON(STORE.achievements, state.achievements);
    const item = achievementDefs.find(a => a[0] === id);
    if (item) toast(`Achievement unlocked: ${item[1]}`);
    if (state.view === 'dashboard') renderAchievementPanels();
  }
  function ensureDailyChallenge() {
    if (!state.daily || state.daily.day !== dayKey()) {
      const d = new Date();
      const ordinal = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
      const game = games[((ordinal % games.length) + games.length) % games.length];
      state.daily = { day: dayKey(), gameId: game.id, complete: false };
      saveJSON(STORE.daily, state.daily);
    }
  }
  function renderAchievementPanels() {
    const list = $('#achievement-list');
    list.innerHTML = achievementDefs.map(a => {
      const won = state.achievements.includes(a[0]);
      return `<div class="achievement-row ${won?'':'achievement-locked'}"><span class="trophy">${a[3]}</span><div><b>${a[1]}</b><small>${won?'Unlocked':a[2]}</small></div></div>`;
    }).join('');
    const rows = Object.entries(state.scores).sort((a,b) => b[1]-a[1]).slice(0,5);
    $('#leaderboard-list').innerHTML = rows.length ? rows.map(([id,score],i) => {
      const game = engineById[id];
      return `<div class="leaderboard-row"><span class="rank">#${i+1}</span><div><b>${esc(game?.title || id)}</b><small>Personal best</small></div><strong>${Number(score)||0}</strong></div>`;
    }).join('') : '<div class="empty-inline">Finish a game to set your first personal best.</div>';
    ensureDailyChallenge();
    const dailyGame = engineById[state.daily.gameId] || games[0];
    $('#daily-title').textContent = dailyGame.title;
    $('#daily-description').textContent = `Today's challenge: play ${dailyGame.title} and finish a round. Your progress is stored on this browser.`;
    $('#daily-status').textContent = state.daily.complete ? 'Completed today ✓' : 'Not completed yet';
    $('#daily-play').textContent = state.daily.complete ? 'Play again →' : 'Play challenge →';
  }

  const state = {
    saved: safeJSON(STORE.saved, []), custom: safeJSON(STORE.custom, []), settings: safeJSON(STORE.settings, {}),
    widgets: safeJSON(STORE.widgets, []), scores: safeJSON(STORE.scores, {}),
    plays: Number(safeJSON(STORE.plays, 0)) || 0, uniquePlayed: safeJSON(STORE.unique, []),
    achievements: safeJSON(STORE.achievements, []), daily: safeJSON(STORE.daily, null),
    view: 'dashboard', category: 'all', page: 1, pageSize: 24, collection: 'games',
    token: localStorage.getItem('gh2-pair-token') || '', bridgeTimer: null,
    usbPort: null, usbReader: null, usbWriter: null, usbConnected: false, usbTimer: null, usbText: '',
    battery: { voltage:null, percent:null, source:'Not connected' },
    device: { online:false, mode:'—', screen:'—' },
    game: null, raf: 0, seconds: 0, day: dayKey(), toastTimer: null,
    chat: safeJSON(STORE.chat, []), chatBusy: false
  };

  // ---------- IndexedDB file and wallpaper storage ----------
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('uploads')) db.createObjectStore('uploads', { keyPath:'id' });
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath:'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open browser storage'));
    });
  }
  async function dbPut(store, item) {
    const db = await openDB();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(store,'readwrite'); tx.objectStore(store).put(item);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  async function dbAll(store) {
    const db = await openDB();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(store,'readonly'); const req = tx.objectStore(store).getAll();
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  }
  async function dbDelete(store,id) {
    const db = await openDB();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(store,'readwrite'); tx.objectStore(store).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  const uploads = async () => { try { return await dbAll('uploads'); } catch (_) { return []; } };

  // ---------- Shared helpers ----------
  function toast(message) {
    const el = $('#toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function setView(view) {
    if (!$('#view-' + view)) return;
    state.view = view;
    $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + view));
    $$('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    $('#current-crumb').textContent = '/ ' + view.replace(/([a-z])([A-Z])/g,'$1 $2').toUpperCase();
    $('#sidebar').classList.remove('open');
    if (view === 'store') renderStore();
    if (view === 'mygames') renderMyGames();
    if (view === 'uploads') renderUploads();
    if (view === 'storage') renderStorage();
    if (view === 'widgets') renderWidgets();
    if (view === 'esp32') refreshDeviceUI();
    if (view === 'dashboard') renderDashboard();
  }
  function allCatalog() { return [...games, ...state.custom]; }
  function findGame(id) { return allCatalog().find(g => g.id === id) || null; }
  function savedIds() { return new Set(state.saved.map(x => typeof x === 'string' ? x : x.id)); }
  function savedGames() { return state.saved.map(x => typeof x === 'string' ? findGame(x) : x).filter(Boolean); }
  function gameCard(g) {
    const isSaved = savedIds().has(g.id);
    return `<article class="game-card"><div class="game-art" style="--art1:${esc(g.color || '#51448e')};--art2:#1c5f70"><span class="emoji">${esc(g.icon || '🎮')}</span><span class="game-art-tag">${esc(g.category || 'CUSTOM')}</span></div><div class="card-body"><div class="card-title-row"><div><h3>${esc(g.title)}</h3><p>${esc(g.desc || 'A custom GameHub creation.')}</p></div><button class="save-game ${isSaved?'saved':''}" data-save="${esc(g.id)}" aria-label="${isSaved?'Remove':'Save'} ${esc(g.title)}">${isSaved?'★':'☆'}</button></div><div class="card-foot"><span class="tag">${esc(g.category || 'CUSTOM')}</span><button class="play-small" data-play="${esc(g.id)}">PLAY ▶</button></div></div></article>`;
  }
  function renderFeatured() { $('#featured-games').innerHTML = games.slice(0,4).map(gameCard).join(''); }
  function renderStore() {
    let list = allCatalog().slice();
    const query = ($('#store-search').value || '').trim().toLowerCase();
    if (query) list = list.filter(g => `${g.title} ${g.category} ${g.desc}`.toLowerCase().includes(query));
    if (state.category !== 'all') list = list.filter(g => g.category === state.category);
    const sort = $('#sort-filter').value;
    if (sort === 'az') list.sort((a,b) => a.title.localeCompare(b.title));
    if (sort === 'za') list.sort((a,b) => b.title.localeCompare(a.title));
    const shown = list.slice(0, state.page * state.pageSize);
    $('#game-grid').innerHTML = shown.map(gameCard).join('') || '<div class="empty-state">No games match your search.</div>';
    $('#store-results').textContent = `Showing ${shown.length} of ${list.length} games`;
    $('#load-more').classList.toggle('hidden', shown.length >= list.length);
    $('#load-more').textContent = `Load more (${Math.max(0,list.length-shown.length)} remaining)`;
  }
  function updateCounts() {
    const n = savedGames().length;
    $('#my-games-count').textContent = n; $('#dash-my-games').textContent = n; $('#saved-count').textContent = n;
    uploads().then(files => { $('#uploaded-count').textContent = files.length; });
  }
  function renderDashboard() {
    renderFeatured(); updateCounts(); renderAchievementPanels();
    const picks = savedGames().slice(0,3);
    $('#continue-list').innerHTML = picks.length ? picks.map(g => `<div class="file-row"><span class="file-type">${esc(g.icon)}</span><div class="file-meta"><b>${esc(g.title)}</b><small>${esc(g.category)}</small></div><button class="play-small" data-play="${esc(g.id)}">PLAY</button></div>`).join('') : 'Save games from the Game Store to see them here.';
    updateScreenTimeUI(); updateBatteryUI();
  }
  function toggleSaved(id) {
    const set = savedIds();
    if (set.has(id)) state.saved = state.saved.filter(x => (typeof x === 'string' ? x : x.id) !== id);
    else { const g = findGame(id); if (g) state.saved.push(g); }
    saveJSON(STORE.saved, state.saved); if(savedGames().length>=10)unlockAchievement('collector'); updateCounts(); renderDashboard();
    if (state.view === 'store') renderStore(); if (state.view === 'mygames') renderMyGames();
    toast(set.has(id) ? 'Removed from My Games' : 'Saved to My Games');
  }
  function renderMyGames() {
    const box = $('#mygames-content');
    if (state.collection === 'uploads') {
      uploads().then(files => { box.className = 'file-list'; box.innerHTML = files.length ? files.map(fileRow).join('') : '<div class="empty-state">No uploaded files yet.</div>'; });
      return;
    }
    box.className = 'game-grid'; const list = savedGames();
    box.innerHTML = list.length ? list.map(gameCard).join('') : '<div class="empty-state">Your collection is empty. Save a game or create one.</div>';
  }

  // ---------- 24 different playable canvas games ----------
  const canvas = $('#game-canvas');
  const ctx = canvas.getContext('2d');
  const C = { bg:'#091321', panel:'#13243a', grid:'#1e3550', white:'#eef5ff', mint:'#64e5bf', purple:'#a997ff', red:'#ff718d', gold:'#ffd47c', blue:'#69b7ef' };
  const rand = n => Math.floor(Math.random()*n);
  const choice = a => a[rand(a.length)];
  function rect(x,y,w,h,color=C.mint,r=4) { ctx.fillStyle=color; ctx.beginPath(); if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);ctx.fill(); }
  function circle(x,y,r,color=C.gold) { ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill(); }
  function text(t,x,y,size=13,color=C.white,align='left') { ctx.fillStyle=color;ctx.font=`${size}px system-ui, sans-serif`;ctx.textAlign=align;ctx.fillText(String(t),x,y);ctx.textAlign='left'; }
  function base(s) {
    const grad=ctx.createLinearGradient(0,0,480,300);grad.addColorStop(0,'#0b1729');grad.addColorStop(1,'#111c35');ctx.fillStyle=grad;ctx.fillRect(0,0,480,300);
    ctx.strokeStyle='rgba(115,145,190,.09)';ctx.lineWidth=1;
    for(let x=0;x<480;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,300);ctx.stroke();}
    for(let y=0;y<300;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(480,y);ctx.stroke();}
    text(s.g.title.toUpperCase(),14,21,12,'#9dafca');
    text(`SCORE ${s.score}`,466,21,12,C.gold,'right');
  }
  function addScore(n) { if (!state.game) return; state.game.score = n; $('#game-score').textContent = `SCORE ${n}`; }
  function finish(msg) { const s=state.game;if(!s||s.over)return;s.over=true;s.message=msg;$('#game-help').textContent=`${msg} · Restart ↻ or close ×`;if(s.score>(state.scores[s.type]||0)){state.scores[s.type]=s.score;saveJSON(STORE.scores,state.scores);}if(s.score>=100)unlockAchievement('score-hunter');ensureDailyChallenge();if(s.g.id===state.daily.gameId||s.type===state.daily.gameId){state.daily.complete=true;saveJSON(STORE.daily,state.daily);}if(state.view==='dashboard')renderAchievementPanels();}
  function newGameState(g) {
    const speed = g.difficulty==='hard'?1.35:g.difficulty==='easy'?.78:1;
    const s={g,type:g.engine||'snake',score:0,over:false,paused:false,last:0,elapsed:0,keys:new Set(),speed,lastSpawn:0};
    switch(s.type){
      case 'snake': s.body=[{x:10,y:7},{x:9,y:7},{x:8,y:7}];s.dir={x:1,y:0};s.food={x:15,y:7};s.step=0;break;
      case 'pong': s.paddle={x:195,w:90};s.ball={x:240,y:130,vx:3.1*speed,vy:3.4*speed};s.misses=0;break;
      case 'breakout': s.paddle={x:195,w:90};s.ball={x:240,y:248,vx:3*speed,vy:-4*speed};s.bricks=[];for(let y=0;y<4;y++)for(let x=0;x<9;x++)s.bricks.push({x:14+x*51,y:43+y*23,on:true,color:[C.mint,C.purple,C.gold][(x+y)%3]});s.lives=3;break;
      case 'flappy': s.player={y:145,vy:0};s.pipes=[];break;
      case 'runner': s.player={y:240,vy:0,ground:true};s.obstacles=[];break;
      case 'shooter': s.player={x:240};s.bullets=[];s.enemies=[];s.lastShot=0;break;
      case 'dodge': s.player={x:240};s.rocks=[];break;
      case 'target': s.target={x:240,y:150,r:21};s.endAt=performance.now()+30000;s.lastTarget=0;break;
      case 'memory': s.tiles=Array.from({length:16},(_,i)=>({v:Math.floor(i/2),open:false,done:false}));for(let i=15;i>0;i--){const j=rand(i+1);[s.tiles[i],s.tiles[j]]=[s.tiles[j],s.tiles[i]];}s.first=-1;s.lock=false;s.hideAt=0;s.pairs=0;s.moves=0;break;
      case 'tictactoe': s.board=Array(9).fill('');s.turn='X';s.winner='';s.aiAt=0;break;
      case 'tetris': s.grid=Array.from({length:18},()=>Array(10).fill(0));s.pieces=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];s.colors=[C.mint,C.gold,C.purple,C.blue,C.red,'#e58acb','#9ecb69'];s.piece=null;s.dropAt=0;s.lines=0;spawnTetris(s);break;
      case '2048': s.board=Array.from({length:4},()=>Array(4).fill(0));s.moves=0;addTile(s.board);addTile(s.board);break;
      case 'mines': s.mines=Array.from({length:8},()=>Array(8).fill(0));s.revealed=Array.from({length:8},()=>Array(8).fill(false));s.flags=Array.from({length:8},()=>Array(8).fill(false));s.mineCount=10;s.cursor={x:0,y:0};let m=0;while(m<10){const x=rand(8),y=rand(8);if(!s.mines[y][x]){s.mines[y][x]=1;m++;}}for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!s.mines[y][x]){let c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(s.mines[y+dy]?.[x+dx])c++;s.mines[y][x]=c;}s.safe=54;break;
      case 'simon':s.sequence=[];s.phase='ready';s.seqIndex=0;s.flash=-1;s.flashUntil=0;s.nextFlash=0;s.userIndex=0;s.inputTimeout=0;break;
      case 'whack':s.active=rand(9);s.holeUntil=performance.now()+900;s.endAt=performance.now()+30000;break;
      case 'connect4':s.board=Array.from({length:6},()=>Array(7).fill(0));s.col=3;s.turn=1;break;
      case 'lights':s.board=Array.from({length:5},()=>Array.from({length:5},()=>rand(2)));s.cursor={x:2,y:2};break;
      case 'word':s.answer=choice(['PLANE','BRICK','CLOUD','LIGHT','PIXEL','GHOST','MOUSE','QUEST','ZEBRA','LASER']);s.guesses=[];s.current='';s.done=false;break;
      case 'math':s.endAt=performance.now()+45000;s.question=null;makeMath(s);break;
      case 'maze':s.map=['############','#S...#.....#','#.##.#.###.#','#....#...#.#','####.###.#.#','#......#...#','#.######.###','#..........#','##########E#'];s.player={x:1,y:1};break;
      case 'tower':s.level=0;s.block={x:0,w:150,dir:1};s.stack=[{x:165,w:150}];s.endAt=0;break;
      case 'lunar':s.ship={x:75,y:55,vx:0,vy:0,a:0};s.fuel=100;s.pad={x:185,w:110,y:270};break;
      case 'reaction':s.phase='wait';s.goAt=performance.now()+1800+rand(2600);s.started=0;s.reaction=null;break;
      case 'fruit':s.basket={x:210,w:65};s.items=[];s.lives=3;break;
    }
    return s;
  }
  function startGame(game) {
    if(!game)return;stopGame();state.plays++;saveJSON(STORE.plays,state.plays);if(!state.uniquePlayed.includes(game.engine||game.id)){state.uniquePlayed.push(game.engine||game.id);saveJSON(STORE.unique,state.uniquePlayed);}unlockAchievement('first-play');if(state.uniquePlayed.length>=5)unlockAchievement('explorer');if(state.plays>=10)unlockAchievement('ten-games');state.game=newGameState({...game});
    $('#game-modal').classList.remove('hidden');$('#game-modal-title').textContent=game.title;
    $('#game-score').textContent='SCORE 0';$('#game-help').textContent=helpText(state.game.type);
    $('#game-pause').textContent='Ⅱ';
    $('#word-input-wrap').classList.toggle('hidden', state.game.type!=='word');
    $('#game-word-input').value='';
    gameLoop();
  }
  function helpText(t){return ({snake:'Arrow keys or D-pad: steer. Avoid your tail and walls.',pong:'Use LEFT and RIGHT to keep the ball bouncing on your paddle.',breakout:'Move LEFT / RIGHT. Clear every brick before losing all lives.',flappy:'Press UP or A to flap through the gaps.',runner:'Press UP or A to jump over each obstacle.',shooter:'Move LEFT / RIGHT and press A or SPACE to fire.',dodge:'Move LEFT / RIGHT to dodge falling meteors.',target:'Click / tap the target. Score as many hits as you can in 30 seconds.',memory:'Click two cards at a time and find matching pairs.',tictactoe:'Click a square. You are X; the computer is O.',tetris:'LEFT / RIGHT to move, DOWN to drop, A to rotate.', '2048':'Use the arrow keys to slide and merge equal tiles.',mines:'Click a tile to reveal. Right-click to flag a mine.',simon:'Watch the sequence, then repeat with arrow keys: UP, RIGHT, DOWN, LEFT.',whack:'Click the lit mole. You have 30 seconds.',connect4:'Click a column or use LEFT / RIGHT + A. Connect four.',lights:'Click a light or move with arrows + A. Turn them all off.',word:'Type letters, press ENTER to submit, BACKSPACE to erase.',math:'Click the correct answer or press 1, 2, 3 or 4.',maze:'Use the arrow keys to reach the exit E.',tower:'Press A or click to drop each moving platform.',lunar:'UP = thrust, LEFT / RIGHT = rotate. Land slowly on the pad.',reaction:'Wait for GO, then press A or click as quickly as possible.',fruit:'Move LEFT / RIGHT to catch fruit. Avoid bombs.'})[t]||'Use the keyboard or touch controls.';}

  // Drawing helpers for each game.
  function drawGame() {
    const s=state.game;if(!s)return;base(s);const now=performance.now();
    if(s.type==='snake'){
      for(const p of s.body)rect(18+p.x*22,32+p.y*16,19,13,p===s.body[0]?C.gold:C.mint,3);
      circle(18+s.food.x*22+9,32+s.food.y*16+7,6,C.red);text('Grow without crashing',240,286,12,'#94a7c5','center');
    } else if(s.type==='pong'){
      rect(s.paddle.x,273,s.paddle.w,10,C.mint,5);circle(s.ball.x,s.ball.y,8,C.gold);text(`Misses ${s.misses}/3`,460,48,12,C.white,'right');
    } else if(s.type==='breakout'){
      s.bricks.forEach(b=>{if(b.on)rect(b.x,b.y,43,14,b.color,3);});rect(s.paddle.x,276,s.paddle.w,9,C.mint,5);circle(s.ball.x,s.ball.y,7,C.gold);text(`Lives ${s.lives} · Bricks ${s.bricks.filter(b=>b.on).length}`,240,294,12,C.white,'center');
    } else if(s.type==='flappy'){
      s.pipes.forEach(p=>{rect(p.x,30,44,p.top-30,C.purple,4);rect(p.x,p.bottom,44,300-p.bottom,C.purple,4);});circle(105,s.player.y,10,C.gold);
    } else if(s.type==='runner'){
      rect(0,264,480,4,'#657894',0);rect(65,s.player.y,23,24,C.mint,4);s.obstacles.forEach(o=>rect(o.x,264-o.h,o.w,o.h,C.red,3));
    } else if(s.type==='shooter'){
      rect(s.player.x-16,264,32,18,C.mint,6);s.bullets.forEach(b=>rect(b.x-2,b.y,4,12,C.gold,2));s.enemies.forEach(e=>{circle(e.x,e.y,12,C.red);rect(e.x-7,e.y-2,14,4,'#fff',2);});
    } else if(s.type==='dodge'){
      rect(s.player.x-14,265,28,22,C.mint,5);s.rocks.forEach(r=>circle(r.x,r.y,r.r,C.red));
    } else if(s.type==='target'){
      const remain=Math.max(0,Math.ceil((s.endAt-now)/1000));circle(s.target.x,s.target.y,s.target.r+7,'rgba(255,113,141,.28)');circle(s.target.x,s.target.y,s.target.r,C.red);circle(s.target.x,s.target.y,6,'#fff');text(`${remain}s left`,460,48,13,C.gold,'right');
    } else if(s.type==='memory'){
      const icons=['✦','◆','●','▲','☾','⬟','♥','✚'];s.tiles.forEach((t,i)=>{const x=74+(i%4)*86,y=58+Math.floor(i/4)*55;rect(x,y,70,43,t.done?'#276a63':t.open?'#5b4f9d':'#243b58',7);text(t.open||t.done?icons[t.v]:'?',x+35,y+29,21,C.white,'center');});text(`Pairs ${s.pairs}/8 · Moves ${s.moves}`,460,48,12,C.white,'right');
    } else if(s.type==='tictactoe'){
      for(let i=0;i<9;i++){const x=126+(i%3)*78,y=55+Math.floor(i/3)*70;rect(x,y,66,58,'#233a55',6);text(s.board[i],x+33,y+40,29,s.board[i]==='X'?C.mint:C.gold,'center');}text('You are X · CPU is O',240,286,12,'#a8b9d2','center');
    } else if(s.type==='tetris'){
      const ox=150,oy=36,cell=16;for(let y=0;y<18;y++)for(let x=0;x<10;x++)if(s.grid[y][x])rect(ox+x*cell,oy+y*cell,14,14,s.grid[y][x],2);if(s.piece)s.piece.shape.forEach((row,dy)=>row.forEach((v,dx)=>{if(v)rect(ox+(s.piece.x+dx)*cell,oy+(s.piece.y+dy)*cell,14,14,s.colors[s.piece.color],2);}));text(`Lines ${s.lines}`,360,70,16,C.gold);text('A rotates',360,96,12,'#a8b9d2');
    } else if(s.type==='2048'){
      for(let y=0;y<4;y++)for(let x=0;x<4;x++){const v=s.board[y][x],xx=92+x*76,yy=48+y*58;const col=v===0?'#25374c':v<16?'#486c82':v<64?'#6a70ac':v<256?'#a66c83':'#c18a48';rect(xx,yy,66,48,col,6);if(v)text(v,xx+33,yy+31,18,C.white,'center');}text('Reach 2048',240,288,12,'#a8b9d2','center');
    } else if(s.type==='mines'){
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){const xx=120+x*30,yy=48+y*29;if(s.revealed[y][x]){rect(xx,yy,26,25,'#34445a',3);if(s.mines[y][x]===1)text('✹',xx+13,yy+18,16,C.red,'center');else if(s.mines[y][x])text(s.mines[y][x],xx+13,yy+18,14,[C.mint,C.blue,C.gold,C.red][s.mines[y][x]%4],'center');}else rect(xx,yy,26,25,s.flags[y][x]?'#93634f':'#49627e',3);}text('Right-click to flag',240,294,12,'#a8b9d2','center');
    } else if(s.type==='simon'){
      const colors=['#e85d75','#57bd91','#5e8de2','#e2b65c'];const boxes=[[115,65],[250,65],[115,185],[250,185]];boxes.forEach((p,i)=>rect(p[0],p[1],112,98,(s.flash===i)?'#ffffff':colors[i],14));text(s.phase==='ready'?'Press A to start':s.phase==='show'?'Watch the pattern':'Repeat the pattern',240,45,15,C.white,'center');text(`Length ${s.sequence.length}`,240,296,12,C.gold,'center');
    } else if(s.type==='whack'){
      for(let i=0;i<9;i++){const x=110+(i%3)*130,y=74+Math.floor(i/3)*72;circle(x,y,27,'#344b44');if(i===s.active){circle(x,y,20,'#a66a4c');circle(x-7,y-3,3,'#fff');circle(x+7,y-3,3,'#fff');rect(x-9,y+8,18,5,'#3c2230',2);}}text(`${Math.max(0,Math.ceil((s.endAt-now)/1000))} seconds`,240,285,13,C.gold,'center');
    } else if(s.type==='connect4'){
      for(let y=0;y<6;y++)for(let x=0;x<7;x++){rect(78+x*47,50+y*37,40,30,'#25405d',8);if(s.board[y][x])circle(98+x*47,65+y*37,12,s.board[y][x]===1?C.red:C.gold);}text('You: red · CPU: gold',240,292,12,'#a8b9d2','center');
    } else if(s.type==='lights'){
      for(let y=0;y<5;y++)for(let x=0;x<5;x++){const xx=158+x*37,yy=65+y*37;rect(xx,yy,30,30,s.board[y][x]?'#f4d36d':'#25384f',6);if(x===s.cursor.x&&y===s.cursor.y){ctx.strokeStyle=C.mint;ctx.lineWidth=2;ctx.strokeRect(xx-2,yy-2,34,34);}}text('Turn all lights off',240,290,12,'#a8b9d2','center');
    } else if(s.type==='word'){
      const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';for(let r=0;r<6;r++)for(let c=0;c<5;c++){const x=150+c*38,y=44+r*38;const ch=s.guesses[r]?.[c]|| (r===s.guesses.length?s.current[c]:'');let color='#263a54';if(s.guesses[r]){if(ch===s.answer[c])color='#347c68';else if(s.answer.includes(ch))color='#92743d';else color='#374255';}rect(x,y,32,32,color,4);text(ch||'',x+16,y+23,17,C.white,'center');}text('Type 5 letters · ENTER',240,292,12,'#a8b9d2','center');
    } else if(s.type==='math'){
      text(s.question.q,240,90,30,C.white,'center');s.question.opts.forEach((n,i)=>{const x=52+i*108;rect(x,150,92,76,'#314a68',9);text(`${i+1}`,x+46,172,12,C.gold,'center');text(n,x+46,204,24,C.white,'center');});text(`${Math.max(0,Math.ceil((s.endAt-now)/1000))}s left`,240,270,13,C.gold,'center');
    } else if(s.type==='maze'){
      for(let y=0;y<s.map.length;y++)for(let x=0;x<s.map[y].length;x++){const v=s.map[y][x],xx=72+x*30,yy=34+y*29;if(v==='#')rect(xx,yy,27,26,'#30435c',3);else if(v==='E')rect(xx,yy,27,26,'#3f946d',3);else if(v==='S')rect(xx,yy,27,26,'#49698b',3);}circle(72+s.player.x*30+13,34+s.player.y*29+13,9,C.gold);text('Reach the green exit',240,294,12,'#a8b9d2','center');
    } else if(s.type==='tower'){
      const baseY=270; s.stack.forEach((b,i)=>rect(b.x,baseY-i*20,b.w,17,i%2?C.purple:C.mint,3));rect(s.block.x,baseY-s.stack.length*20,s.block.w,17,C.gold,3);text(`Height ${s.stack.length}`,420,50,14,C.white,'right');text('Tap / A to stack',240,294,12,'#a8b9d2','center');
    } else if(s.type==='lunar'){
      rect(s.pad.x,s.pad.y,s.pad.w,7,C.mint,2);circle(s.ship.x,s.ship.y,9,C.gold);ctx.strokeStyle=C.gold;ctx.beginPath();ctx.moveTo(s.ship.x,s.ship.y);ctx.lineTo(s.ship.x+Math.sin(s.ship.a)*19,s.ship.y-Math.cos(s.ship.a)*19);ctx.stroke();text(`Fuel ${Math.floor(s.fuel)}%`,460,50,13,C.gold,'right');text('Land gently on the green pad',240,292,12,'#a8b9d2','center');
    } else if(s.type==='reaction'){
      rect(75,75,330,145,s.phase==='go'?'#2c895f':s.phase==='early'?'#90475c':'#31435e',16);text(s.phase==='go'?'GO!':s.phase==='early'?'TOO EARLY':'WAIT…',240,158,34,C.white,'center');text(s.reaction===null?'Press A when GO appears':`${s.reaction} ms`,240,190,14,C.gold,'center');
    } else if(s.type==='fruit'){
      rect(s.basket.x,265,s.basket.w,14,C.mint,6);s.items.forEach(it=>circle(it.x,it.y,it.r,it.bomb?C.red:C.gold));text(`Lives ${s.lives}`,460,50,13,C.gold,'right');
    }
    if(s.paused||s.over){ctx.fillStyle='rgba(2,7,17,.72)';ctx.fillRect(0,0,480,300);text(s.paused?'PAUSED':s.message||'GAME OVER',240,145,26,C.white,'center');text(s.paused?'Press play to resume':`Final score ${s.score} · press ↻ to retry`,240,176,13,C.gold,'center');}
  }

  // ---------- Game mechanics ----------
  function spawnTetris(s){const shapes=s.pieces,shape=shapes[rand(shapes.length)].map(row=>row.slice());s.piece={shape,x:3,y:0,color:rand(s.colors.length)};if(!canTetris(s,s.piece,0,0))finish('STACK BLOCKED');}
  function canTetris(s,p,dx,dy,shape=p.shape){for(let y=0;y<shape.length;y++)for(let x=0;x<shape[y].length;x++)if(shape[y][x]){const nx=p.x+x+dx,ny=p.y+y+dy;if(nx<0||nx>=10||ny>=18||(ny>=0&&s.grid[ny][nx]))return false;}return true;}
  function rotateShape(shape){return shape[0].map((_,i)=>shape.map(row=>row[i]).reverse());}
  function addTile(board){const cells=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(!board[y][x])cells.push([x,y]);if(cells.length){const [x,y]=choice(cells);board[y][x]=Math.random()<.9?2:4;}}
  function makeMath(s){const a=1+rand(12),b=1+rand(12),op=choice(['+','−','×']);const ans=op==='+'?a+b:op==='−'?Math.max(a,b)-Math.min(a,b):a*b;const opts=new Set([ans]);while(opts.size<4)opts.add(Math.max(0,ans+rand(13)-6));s.question={q:`${a} ${op} ${b} = ?`,ans,opts:[...opts].sort(()=>Math.random()-.5)};}
  function move2048(s,dir){const b=s.board.map(row=>row.slice());let changed=false;for(let i=0;i<4;i++){let line=dir==='left'||dir==='right'?b[i]:b.map(r=>r[i]);if(dir==='right'||dir==='down')line.reverse();let a=line.filter(Boolean),out=[];for(let j=0;j<a.length;j++){if(a[j]===a[j+1]){out.push(a[j]*2);s.score+=a[j]*2;j++;}else out.push(a[j]);}while(out.length<4)out.push(0);if(dir==='right'||dir==='down')out.reverse();for(let j=0;j<4;j++){if(dir==='left'||dir==='right'){if(b[i][j]!==out[j])changed=true;b[i][j]=out[j];}else{if(b[j][i]!==out[j])changed=true;b[j][i]=out[j];}}}if(changed){s.board=b;addTile(s.board);addScore(s.score);if(s.board.some(row=>row.includes(2048)))finish('2048 REACHED!');else if(!['left','right','up','down'].some(d=>canMove2048(s.board,d)))finish('NO MORE MOVES');}}
  function canMove2048(board,dir){const cp=board.map(r=>r.slice()),before=JSON.stringify(cp);const fake={board:cp,score:0};move2048NoSpawn(fake,dir);return JSON.stringify(fake.board)!==before;}
  function move2048NoSpawn(s,dir){const b=s.board;for(let i=0;i<4;i++){let line=dir==='left'||dir==='right'?b[i]:b.map(r=>r[i]);if(dir==='right'||dir==='down')line.reverse();let a=line.filter(Boolean),out=[];for(let j=0;j<a.length;j++){if(a[j]===a[j+1]){out.push(a[j]*2);j++;}else out.push(a[j]);}while(out.length<4)out.push(0);if(dir==='right'||dir==='down')out.reverse();for(let j=0;j<4;j++){if(dir==='left'||dir==='right')b[i][j]=out[j];else b[j][i]=out[j];}}}
  function clickCellMemory(s,x,y){const col=Math.floor((x-74)/86),row=Math.floor((y-58)/55),i=row*4+col;if(col<0||col>3||row<0||row>3||s.lock||s.tiles[i].done||s.tiles[i].open)return;s.tiles[i].open=true;s.moves++;if(s.first<0)s.first=i;else{const a=s.tiles[s.first],b=s.tiles[i];s.lock=true;if(a.v===b.v){a.done=b.done=true;s.pairs++;s.first=-1;s.lock=false;addScore(s.score+20);if(s.pairs===8)finish('ALL PAIRS FOUND!');}else s.hideAt=performance.now()+700;}}
  function tttMove(s,i){if(s.board[i]||s.winner)return;s.board[i]='X';const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];const winner=who=>lines.some(l=>l.every(n=>s.board[n]===who));if(winner('X')){s.winner='YOU WIN';finish('YOU WIN');return;}if(s.board.every(Boolean)){finish('DRAW');return;}const empty=s.board.map((v,n)=>v? -1:n).filter(n=>n>=0);let best=empty.find(n=>lines.some(l=>l.includes(n)&&l.filter(x=>s.board[x]==='O').length===2&&l.filter(x=>!s.board[x]).length===1));if(best===undefined)best=empty.find(n=>lines.some(l=>l.includes(n)&&l.filter(x=>s.board[x]==='X').length===2&&l.filter(x=>!s.board[x]).length===1));if(best===undefined)best= s.board[4]?'':4;if(best===''||best===undefined)best=choice(empty);s.board[best]='O';if(winner('O')){finish('CPU WINS');return;}if(s.board.every(Boolean))finish('DRAW');}
  function revealMine(s,x,y){if(x<0||x>=8||y<0||y>=8||s.revealed[y][x]||s.flags[y][x]||s.over)return;s.revealed[y][x]=true;if(s.mines[y][x]===1){finish('MINE EXPLODED');return;}s.safe--;if(s.safe<=0){finish('FIELD CLEARED!');return;}if(s.mines[y][x]===0){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)revealMine(s,x+dx,y+dy);}}
  function simonStart(s){s.sequence=[rand(4)];s.phase='show';s.seqIndex=0;s.flash=-1;s.nextFlash=performance.now()+500;}
  function simonInput(s,i){if(s.phase!=='input'||s.over)return;if(i!==s.sequence[s.userIndex]){finish('WRONG SEQUENCE');return;}s.userIndex++;if(s.userIndex>=s.sequence.length){addScore(s.score+10);s.phase='show';s.sequence.push(rand(4));s.seqIndex=0;s.nextFlash=performance.now()+550;}}
  function simonKey(key){const map={ArrowUp:0,ArrowRight:1,ArrowDown:2,ArrowLeft:3,UP:0,RIGHT:1,DOWN:2,LEFT:3,A:0,B:2};return map[key];}
  function connect4Drop(s,col){if(col<0||col>6||s.over)return;let row=-1;for(let y=5;y>=0;y--)if(!s.board[y][col]){row=y;break;}if(row<0)return;s.board[row][col]=1;if(checkConnect4(s.board,1)){finish('YOU CONNECTED FOUR!');return;}if(s.board[0].every(Boolean)){finish('BOARD FULL');return;}const empties=[];for(let c=0;c<7;c++)if(s.board[0][c]===0)empties.push(c);if(!empties.length)return;let cpu=empties.find(c=>connectWouldWin(s.board,c,2))??empties.find(c=>connectWouldWin(s.board,c,1))??choice(empties);let ry=5;while(ry>=0&&s.board[ry][cpu])ry--;if(ry>=0)s.board[ry][cpu]=2;if(checkConnect4(s.board,2))finish('CPU CONNECTED FOUR!');}
  function connectWouldWin(board,col,p){const cp=board.map(r=>r.slice());let y=5;while(y>=0&&cp[y][col])y--;if(y<0)return false;cp[y][col]=p;return checkConnect4(cp,p);}
  function checkConnect4(b,p){for(let y=0;y<6;y++)for(let x=0;x<7;x++)if(b[y][x]===p){for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){let ok=true;for(let k=1;k<4;k++)if(b[y+dy*k]?.[x+dx*k]!==p)ok=false;if(ok)return true;}}return false;}
  function toggleLight(s,x,y){for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])if(s.board[y+dy]?.[x+dx]!==undefined)s.board[y+dy][x+dx]^=1;if(s.board.every(row=>row.every(v=>v===0)))finish('ALL LIGHTS OUT!');}
  function submitWord(s){if(s.current.length!==5||s.done)return;const guess=s.current.toUpperCase();s.guesses.push(guess);s.current='';if(guess===s.answer){s.done=true;addScore(60-(s.guesses.length-1)*8);finish('WORD FOUND!');}else if(s.guesses.length>=6){s.done=true;finish(`WORD WAS ${s.answer}`);}}
  function hitMath(s,index){if(!s.question)return;if(s.question.opts[index]===s.question.ans){addScore(s.score+10);makeMath(s);}else{addScore(Math.max(0,s.score-3));makeMath(s);}}
  function moveMaze(s,dx,dy){const nx=s.player.x+dx,ny=s.player.y+dy;if(s.map[ny]?.[nx]&&s.map[ny][nx]!=='#'){s.player={x:nx,y:ny};if(s.map[ny][nx]==='E'){addScore(s.score+100);finish('MAZE ESCAPED!');}}}
  function dropTower(s){const prev=s.stack[s.stack.length-1],x=s.block.x,w=s.block.w,left=Math.max(x,prev.x),right=Math.min(x+w,prev.x+prev.w),overlap=right-left;if(overlap<=0){finish('TOWER COLLAPSED');return;}s.stack.push({x:left,w:overlap});addScore(s.score+overlap);if(overlap<10){finish('TOWER COMPLETE!');return;}s.block={x:s.block.dir>0?0:480-overlap,w:overlap,dir:s.block.dir>0?1:-1};s.block.dir*=-1;}
  function gameAction(key){const s=state.game;if(!s||s.over)return;
    if(s.type==='simon'){if(s.phase==='ready'){simonStart(s);return;}const idx=simonKey(key);if(idx!==undefined)simonInput(s,idx);}
    if(s.type==='tetris'&&key==='A'&&s.piece){const shape=rotateShape(s.piece.shape);if(canTetris(s,s.piece,0,0,shape))s.piece.shape=shape;}
    if(s.type==='2048'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','LEFT','RIGHT','UP','DOWN'].includes(key)){const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',LEFT:'left',RIGHT:'right',UP:'up',DOWN:'down'};move2048(s,map[key]);}
    if(s.type==='mines'){if(key==='A')revealMine(s,s.cursor.x,s.cursor.y);if(key==='B')s.flags[s.cursor.y][s.cursor.x]=!s.flags[s.cursor.y][s.cursor.x];}
    if(s.type==='connect4'){if(key==='LEFT')s.col=Math.max(0,s.col-1);if(key==='RIGHT')s.col=Math.min(6,s.col+1);if(key==='A')connect4Drop(s,s.col);}
    if(s.type==='lights'&&key==='A')toggleLight(s,s.cursor.x,s.cursor.y);
    if(s.type==='tower'&&key==='A')dropTower(s);
    if(s.type==='reaction'&&key==='A')reactionTap(s);
    if(s.type==='whack'&&key==='A')whackTap(s,s.active);
  }
  function reactionTap(s){if(s.phase==='wait'){s.phase='early';finish('TOO EARLY');}else if(s.phase==='go'){s.reaction=Math.max(0,Math.round(performance.now()-s.started));addScore(Math.max(1,1000-s.reaction));finish(`REACTION ${s.reaction} MS`);}}
  function whackTap(s,index){if(index===s.active&&performance.now()<s.endAt){addScore(s.score+10);s.active=rand(9);s.holeUntil=performance.now()+550;}}

  function updateGame(now) {
    const s=state.game;if(!s||s.paused||s.over)return;
    const dt=Math.min(40,now-(s.last||now));s.last=now;s.elapsed+=dt;
    const has=(...keys)=>keys.some(k=>s.keys.has(k));
    if(s.type==='snake'&&s.elapsed>125/s.speed){s.elapsed=0;if(has('ArrowUp','UP')&&s.dir.y!==1)s.dir={x:0,y:-1};else if(has('ArrowDown','DOWN')&&s.dir.y!==-1)s.dir={x:0,y:1};else if(has('ArrowLeft','LEFT')&&s.dir.x!==1)s.dir={x:-1,y:0};else if(has('ArrowRight','RIGHT')&&s.dir.x!==-1)s.dir={x:1,y:0};const h={x:s.body[0].x+s.dir.x,y:s.body[0].y+s.dir.y};if(h.x<0||h.x>=20||h.y<0||h.y>=13||s.body.some(p=>p.x===h.x&&p.y===h.y)){finish('SNAKE OVER');return;}s.body.unshift(h);if(h.x===s.food.x&&h.y===s.food.y){addScore(s.score+10);s.food={x:rand(20),y:rand(13)};}else s.body.pop();}
    if(s.type==='pong'){if(has('ArrowLeft','LEFT'))s.paddle.x-=7;if(has('ArrowRight','RIGHT'))s.paddle.x+=7;s.paddle.x=Math.max(0,Math.min(480-s.paddle.w,s.paddle.x));s.ball.x+=s.ball.vx;s.ball.y+=s.ball.vy;if(s.ball.x<8||s.ball.x>472)s.ball.vx*=-1;if(s.ball.y<35)s.ball.vy=Math.abs(s.ball.vy);if(s.ball.y>262&&s.ball.x>=s.paddle.x-3&&s.ball.x<=s.paddle.x+s.paddle.w+3){s.ball.vy=-Math.abs(s.ball.vy);s.ball.vx+=(s.ball.x-(s.paddle.x+s.paddle.w/2))*.025;addScore(s.score+1);}if(s.ball.y>305){s.misses++;if(s.misses>=3)finish('PONG OVER');else s.ball={x:240,y:130,vx:(Math.random()<.5?-1:1)*3,vy:3};}}
    if(s.type==='breakout'){if(has('ArrowLeft','LEFT'))s.paddle.x-=7;if(has('ArrowRight','RIGHT'))s.paddle.x+=7;s.paddle.x=Math.max(0,Math.min(480-s.paddle.w,s.paddle.x));s.ball.x+=s.ball.vx;s.ball.y+=s.ball.vy;if(s.ball.x<7||s.ball.x>473)s.ball.vx*=-1;if(s.ball.y<28)s.ball.vy=Math.abs(s.ball.vy);if(s.ball.y>263&&s.ball.x>=s.paddle.x&&s.ball.x<=s.paddle.x+s.paddle.w){s.ball.vy=-Math.abs(s.ball.vy);s.ball.vx+=(s.ball.x-(s.paddle.x+s.paddle.w/2))*.035;}for(const b of s.bricks){if(b.on&&s.ball.x>b.x&&s.ball.x<b.x+43&&s.ball.y>b.y&&s.ball.y<b.y+14){b.on=false;s.ball.vy*=-1;addScore(s.score+10);break;}}if(s.bricks.every(b=>!b.on))finish('ALL BRICKS CLEARED');if(s.ball.y>305){s.lives--;if(s.lives<=0)finish('BRICK BREAKER OVER');else s.ball={x:240,y:248,vx:3,vy:-4};}}
    if(s.type==='flappy'){if(has('ArrowUp','UP',' ','A')){s.player.vy=-5.4;s.keys.clear();}s.player.vy+=.28;s.player.y+=s.player.vy;if(now-s.lastSpawn>1500/s.speed){const top=45+rand(105);s.pipes.push({x:500,top,bottom:top+105,passed:false});s.lastSpawn=now;}s.pipes.forEach(p=>p.x-=2.8*s.speed);s.pipes=s.pipes.filter(p=>p.x>-60);if(s.player.y<20||s.player.y>290)finish('SKY HOPPER CRASH');for(const p of s.pipes){if(105+9>p.x&&105-9<p.x+44&&(s.player.y-9<p.top||s.player.y+9>p.bottom))finish('PIPE COLLISION');if(!p.passed&&p.x+44<105){p.passed=true;addScore(s.score+1);}}}
    if(s.type==='runner'){if(has('ArrowUp','UP',' ','A')&&s.player.ground){s.player.vy=-10;s.player.ground=false;s.keys.clear();}s.player.vy+=.46;s.player.y+=s.player.vy;if(s.player.y>=240){s.player.y=240;s.player.vy=0;s.player.ground=true;}if(now-s.lastSpawn>1200/s.speed){s.obstacles.push({x:500,w:18+rand(18),h:25+rand(25)});s.lastSpawn=now;}s.obstacles.forEach(o=>o.x-=4.3*s.speed);s.obstacles=s.obstacles.filter(o=>o.x>-50);if(s.obstacles.some(o=>o.x<88&&o.x+o.w>65&&s.player.y+23>264-o.h))finish('RUN OVER');if(Math.floor(s.elapsed/500)!==Math.floor((s.elapsed-dt)/500))addScore(s.score+1);}
    if(s.type==='shooter'){if(has('ArrowLeft','LEFT'))s.player.x-=5;if(has('ArrowRight','RIGHT'))s.player.x+=5;s.player.x=Math.max(17,Math.min(463,s.player.x));if(has(' ','A')&&now-s.lastShot>250){s.bullets.push({x:s.player.x,y:260});s.lastShot=now;s.keys.delete(' ');s.keys.delete('A');}if(now-s.lastSpawn>850/s.speed){s.enemies.push({x:20+rand(440),y:26,v:1.2+Math.random()*1.7});s.lastSpawn=now;}s.bullets.forEach(b=>b.y-=7);s.enemies.forEach(e=>e.y+=e.v*s.speed);s.bullets=s.bullets.filter(b=>b.y>-15);s.enemies=s.enemies.filter(e=>e.y<320);for(const e of [...s.enemies]){const b=s.bullets.find(x=>Math.abs(x.x-e.x)<17&&Math.abs(x.y-e.y)<17);if(b){s.bullets.splice(s.bullets.indexOf(b),1);s.enemies.splice(s.enemies.indexOf(e),1);addScore(s.score+10);}else if(e.y>250&&Math.abs(e.x-s.player.x)<26){finish('SHIP HIT');return;}}}
    if(s.type==='dodge'){if(has('ArrowLeft','LEFT'))s.player.x-=5;if(has('ArrowRight','RIGHT'))s.player.x+=5;s.player.x=Math.max(15,Math.min(465,s.player.x));if(now-s.lastSpawn>600/s.speed){s.rocks.push({x:15+rand(450),y:-15,r:8+rand(10),v:2+Math.random()*2.5});s.lastSpawn=now;}s.rocks.forEach(r=>r.y+=r.v*s.speed);s.rocks=s.rocks.filter(r=>r.y<320);if(s.rocks.some(r=>Math.hypot(r.x-s.player.x,r.y-270)<r.r+14))finish('METEOR HIT');if(Math.floor(s.elapsed/500)!==Math.floor((s.elapsed-dt)/500))addScore(s.score+1);}
    if(s.type==='target'){if(now>=s.endAt){finish('TIME UP');return;}if(now-s.lastTarget>1000){s.target={x:35+rand(410),y:55+rand(200),r:14+rand(10)};s.lastTarget=now;}}
    if(s.type==='memory'&&s.hideAt&&now>=s.hideAt){const second=s.tiles.findIndex(t=>t.open&&!t.done&&s.tiles.indexOf(t)!==s.first);if(second>=0)s.tiles[second].open=false;if(s.first>=0)s.tiles[s.first].open=false;s.first=-1;s.lock=false;s.hideAt=0;}
    if(s.type==='tictactoe'&&s.turn==='O'&&s.aiAt&&now>=s.aiAt){s.aiAt=0;const empt=s.board.map((v,i)=>v? -1:i).filter(i=>i>=0);let i=empt.find(n=>{const b=s.board.slice();b[n]='O';return tttWon(b,'O');});if(i===undefined)i=empt.find(n=>{const b=s.board.slice();b[n]='X';return tttWon(b,'X');});if(i===undefined)i=empt.includes(4)?4:choice(empt);s.board[i]='O';if(tttWon(s.board,'O'))finish('CPU WINS');else if(s.board.every(Boolean))finish('DRAW');else s.turn='X';}
    if(s.type==='tetris'){if(has('ArrowLeft','LEFT')&&now-(s.hMove||0)>100){if(canTetris(s,s.piece,-1,0))s.piece.x--;s.hMove=now;}if(has('ArrowRight','RIGHT')&&now-(s.hMove||0)>100){if(canTetris(s,s.piece,1,0))s.piece.x++;s.hMove=now;}if(has('ArrowDown','DOWN'))s.dropAt=0;if(now-s.dropAt>(has('ArrowDown','DOWN')?75:550/s.speed)){s.dropAt=now;if(canTetris(s,s.piece,0,1))s.piece.y++;else{const p=s.piece;p.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v&&p.y+y>=0)s.grid[p.y+y][p.x+x]=s.colors[p.color];}));for(let y=17;y>=0;y--)if(s.grid[y].every(Boolean)){s.grid.splice(y,1);s.grid.unshift(Array(10).fill(0));s.lines++;addScore(s.score+100);y++;}spawnTetris(s);}}}
    if(s.type==='2048'){} // Moves are handled once on keydown.
    if(s.type==='mines'){if(has('ArrowUp','UP')){s.cursor.y=Math.max(0,s.cursor.y-1);s.keys.clear();}if(has('ArrowDown','DOWN')){s.cursor.y=Math.min(7,s.cursor.y+1);s.keys.clear();}if(has('ArrowLeft','LEFT')){s.cursor.x=Math.max(0,s.cursor.x-1);s.keys.clear();}if(has('ArrowRight','RIGHT')){s.cursor.x=Math.min(7,s.cursor.x+1);s.keys.clear();}}
    if(s.type==='simon'){if(s.phase==='show'&&now>=s.nextFlash){if(s.flash>=0){s.flash=-1;s.nextFlash=now+220;}else if(s.seqIndex<s.sequence.length){s.flash=s.sequence[s.seqIndex++];s.nextFlash=now+430;}else{s.phase='input';s.userIndex=0;}}}
    if(s.type==='whack'){if(now>=s.endAt){finish('TIME UP');return;}if(now>=s.holeUntil){s.active=rand(9);s.holeUntil=now+650;}}
    if(s.type==='lights'){if(has('ArrowUp','UP')){s.cursor.y=Math.max(0,s.cursor.y-1);s.keys.clear();}if(has('ArrowDown','DOWN')){s.cursor.y=Math.min(4,s.cursor.y+1);s.keys.clear();}if(has('ArrowLeft','LEFT')){s.cursor.x=Math.max(0,s.cursor.x-1);s.keys.clear();}if(has('ArrowRight','RIGHT')){s.cursor.x=Math.min(4,s.cursor.x+1);s.keys.clear();}}
    if(s.type==='math'&&now>=s.endAt){finish('TIME UP');return;}
    if(s.type==='maze'){let dx=0,dy=0;if(has('ArrowUp','UP'))dy=-1;else if(has('ArrowDown','DOWN'))dy=1;else if(has('ArrowLeft','LEFT'))dx=-1;else if(has('ArrowRight','RIGHT'))dx=1;if(dx||dy){moveMaze(s,dx,dy);s.keys.clear();}}
    if(s.type==='tower'){s.block.x+=s.block.dir*(3.2*s.speed);if(s.block.x<0){s.block.x=0;s.block.dir=1;}if(s.block.x+s.block.w>480){s.block.x=480-s.block.w;s.block.dir=-1;}if(s.endAt&&now>=s.endAt)finish('TIME UP');}
    if(s.type==='lunar'){const sh=s.ship;if(has('ArrowLeft','LEFT'))sh.a-=.035;if(has('ArrowRight','RIGHT'))sh.a+=.035;if(has('ArrowUp','UP',' ','A')&&s.fuel>0){sh.vx+=Math.sin(sh.a)*.15;sh.vy-=Math.cos(sh.a)*.18;s.fuel-=.18;}sh.vy+=.045;sh.x+=sh.vx;sh.y+=sh.vy;if(sh.x<5||sh.x>475){finish('LOST IN SPACE');}else if(sh.y>=260){if(sh.x>=s.pad.x&&sh.x<=s.pad.x+s.pad.w&&Math.abs(sh.vy)<2.2&&Math.abs(sh.vx)<1.4){addScore(100);finish('PERFECT LANDING!');}else finish('HARD LANDING');}}
    if(s.type==='reaction'){if(s.phase==='wait'&&now>=s.goAt){s.phase='go';s.started=now;}if(s.phase==='early')finish('TOO EARLY');}
    if(s.type==='fruit'){if(has('ArrowLeft','LEFT'))s.basket.x-=6;if(has('ArrowRight','RIGHT'))s.basket.x+=6;s.basket.x=Math.max(0,Math.min(480-s.basket.w,s.basket.x));if(now-s.lastSpawn>500/s.speed){s.items.push({x:15+rand(450),y:-10,r:9+rand(5),bomb:Math.random()<.22,v:2+Math.random()*2.5});s.lastSpawn=now;}s.items.forEach(it=>it.y+=it.v);for(const it of [...s.items])if(it.y>250&&it.y<290&&it.x>s.basket.x&&it.x<s.basket.x+s.basket.w){s.items.splice(s.items.indexOf(it),1);if(it.bomb){s.lives--;if(s.lives<=0)finish('BOMBED OUT');}else addScore(s.score+5);}s.items=s.items.filter(it=>it.y<320);}
  }
  function tttWon(board,p){const l=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];return l.some(a=>a.every(i=>board[i]===p));}
  function gameLoop(now=performance.now()){if(!state.game)return;updateGame(now);drawGame();state.raf=requestAnimationFrame(gameLoop);}
  function stopGame(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;state.game=null;$('#game-modal').classList.add('hidden');$('#word-input-wrap').classList.add('hidden');}
  function gameClick(ev){const s=state.game;if(!s||s.over||s.paused)return;const r=canvas.getBoundingClientRect();const x=(ev.clientX-r.left)*480/r.width,y=(ev.clientY-r.top)*300/r.height;
    if(s.type==='target'){if(Math.hypot(x-s.target.x,y-s.target.y)<s.target.r+8){addScore(s.score+1);s.target={x:35+rand(410),y:55+rand(200),r:14+rand(10)};s.lastTarget=performance.now();}}
    if(s.type==='memory')clickCellMemory(s,x,y);
    if(s.type==='tictactoe'){const col=Math.floor((x-126)/78),row=Math.floor((y-55)/70);if(col>=0&&col<3&&row>=0&&row<3&&s.turn==='X'&&!s.board[row*3+col]){const idx=row*3+col;s.board[idx]='X';if(tttWon(s.board,'X'))finish('YOU WIN');else if(s.board.every(Boolean))finish('DRAW');else{s.turn='O';s.aiAt=performance.now()+420;}}}
    if(s.type==='mines'){const col=Math.floor((x-120)/30),row=Math.floor((y-48)/29);if(col>=0&&col<8&&row>=0&&row<8){s.cursor={x:col,y:row};if(ev.button===2)s.flags[row][col]=!s.flags[row][col];else revealMine(s,col,row);}}
    if(s.type==='whack'){const col=Math.round((x-110)/130),row=Math.round((y-74)/72);const ix=row*3+col;if(col>=0&&col<3&&row>=0&&row<3)whackTap(s,ix);}
    if(s.type==='connect4'){const col=Math.floor((x-78)/47);if(col>=0&&col<7)connect4Drop(s,col);}
    if(s.type==='lights'){const col=Math.floor((x-158)/37),row=Math.floor((y-65)/37);if(col>=0&&col<5&&row>=0&&row<5){s.cursor={x:col,y:row};toggleLight(s,col,row);}}
    if(s.type==='math'){const idx=Math.floor((x-52)/108);if(idx>=0&&idx<4&&y>=145&&y<235)hitMath(s,idx);}
    if(s.type==='simon'){const col=x>240?1:0,row=y>150?1:0;const map=[[0,1],[3,2]];simonInput(s,map[row][col]);}
    if(s.type==='tower')dropTower(s);
    if(s.type==='reaction')reactionTap(s);
  }
  function gameKeyDown(e){const s=state.game;if(!s)return;const k=e.key;
    if(s.type==='word'){
      if(e.target===$('#game-word-input'))return;
      if(/^[a-z]$/i.test(k)&&s.current.length<5&&!s.done)s.current+=k.toUpperCase();
      else if(k==='Backspace')s.current=s.current.slice(0,-1);
      else if(k==='Enter'){submitWord(s);$('#game-word-input').value='';}
      else return;
      e.preventDefault();return;
    }
    if(s.type==='simon'&&['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(k)){e.preventDefault();simonInput(s,simonKey(k));return;}
    if(s.type==='simon'&&(k==='a'||k==='A')&&s.phase==='ready'){e.preventDefault();simonStart(s);return;}
    if(s.type==='2048'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k)){e.preventDefault();move2048(s,({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'})[k]);return;}
    if(s.type==='math'&&['1','2','3','4'].includes(k)){hitMath(s,Number(k)-1);return;}
    if(s.type==='connect4'&&['ArrowLeft','ArrowRight'].includes(k)){s.col=Math.max(0,Math.min(6,s.col+(k==='ArrowLeft'?-1:1)));return;}
    const allowed=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','a','A','b','B'];if(allowed.includes(k)){e.preventDefault();s.keys.add(k==='a'?'A':k==='b'?'B':k);if(k===' '||k==='a'||k==='A'||k==='b'||k==='B')gameAction(k.toUpperCase()===' '? 'A':k.toUpperCase());}
  }
  function gameKeyUp(e){if(state.game)state.game.keys.delete(e.key);if(state.game)state.game.keys.delete(e.key==='a'?'A':e.key);}

  // ---------- Game library, uploads and storage ----------
  function fileRow(f){return `<div class="file-row"><span class="file-type">${esc((f.name.split('.').pop()||'FILE').slice(0,4).toUpperCase())}</span><div class="file-meta"><b>${esc(f.name)}</b><small>${fmtBytes(f.size)} · ${new Date(f.added||Date.now()).toLocaleDateString()}</small></div><div class="file-actions"><button data-download-file="${esc(f.id)}">Download</button><button data-delete-file="${esc(f.id)}">Delete</button></div></div>`;}
  async function addFiles(fileList){let count=0;for(const f of Array.from(fileList||[])){const id='up_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);try{await dbPut('uploads',{id,name:f.name,type:f.type||'application/octet-stream',size:f.size,added:Date.now(),blob:f});count++;}catch(e){toast('Could not save '+f.name+'. Browser storage may be full.');break;}}$('#upload-input').value='';if(count>0)unlockAchievement('uploader');toast(`${count} file${count===1?'':'s'} saved in this browser`);renderUploads();updateCounts();}
  async function renderUploads(){const files=await uploads();$('#upload-list').innerHTML=files.length?files.map(fileRow).join(''):'<div class="empty-state">No files yet. Choose HTML, JS, PY or ZIP game files.</div>';$('#upload-space').textContent=`${files.length} files`;$('[data-collection="uploads"] #uploaded-count')?.replaceChildren(document.createTextNode(String(files.length)));}
  async function downloadFile(id){const f=(await uploads()).find(x=>x.id===id);if(!f)return;const url=URL.createObjectURL(f.blob);const a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  async function renderStorage(){const files=await uploads();$('#storage-files').textContent=files.length;$('#storage-games').textContent=savedGames().length;try{const e=await navigator.storage.estimate();$('#storage-used').textContent=fmtBytes(e.usage||0);}catch(_){$('#storage-used').textContent='Unavailable';}}

  // ---------- Creator and local game backups ----------
  function makeCustomGame({title,engine,desc,difficulty,color}){const baseGame=engineById[engine]||games[0];const g={id:'custom_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),engine:baseGame.id,title:title||`My ${baseGame.title}`,category:'CUSTOM',icon:baseGame.icon,desc:desc||`Your custom ${baseGame.title} game.`,difficulty:difficulty||'normal',color:color||baseGame.color,created:Date.now()};state.custom.unshift(g);state.saved.unshift(g);saveJSON(STORE.custom,state.custom);saveJSON(STORE.saved,state.saved);updateCounts();unlockAchievement('creator');return g;}
  function offlineAIReply(message){const m=message.toLowerCase();if(/battery|percent|voltage|1s/.test(m))return 'Your 1S battery is nominally 3.7 V and reaches about 4.2 V when full. The ESP32 reads the analog divider on GPIO34. The divider ratio must be calibrated with a multimeter before the percentage is trusted.';if(/pair|pin|connect|wifi|offline/.test(m))return 'Open WEB / PAIR on the handheld, wait until it says “Bridge connected”, then enter the six digits in My ESP32. The same PIN is refreshed to the bridge while the pairing window is valid. On Android and iPhone, use Wi-Fi; USB is an optional computer feature.';if(/usb|cable|android|iphone|phone/.test(m))return 'USB serial is intended for supported desktop Chrome or Edge browsers over HTTPS with a USB data cable. Android USB-serial support depends on the phone, cable, OTG adapter and browser. Wi-Fi PIN pairing is the recommended phone option.';if(/wallpaper|theme|colour|color/.test(m))return 'Open Settings to choose Aurora, Sunset, Pixel Grid, Deep Space or Mint Glow. You can upload your own wallpaper and choose an accent colour. Settings are saved in this browser.';if(/upload|my games|save/.test(m))return 'Save any game with the star button to add it to My Games. Upload Games stores files in this browser using IndexedDB; it does not silently install them on the ESP32.';if(/create|game/.test(m))return 'In Create a Game, describe your idea. The Creator Assistant can choose one of the 24 tested game mechanics and customise its title, difficulty and colour. Online AI needs OPENAI_API_KEY in Netlify; offline suggestions still work.';return 'I can help with GameHub games, the AI Creator, wallpapers, browser storage, Wi-Fi PIN pairing, USB support and ESP32 battery readings. Tell me which part you are working on.';}
  async function askAI(prompt,mode='chat'){
    try{const res=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,mode}),cache:'no-store'});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||`AI service HTTP ${res.status}`);return {online:true,text:data.reply||data.text||''};}
    catch(e){return {online:false,text:offlineAIReply(prompt),error:e.message};}
  }
  function addChatMessage(role,message){const node=document.createElement('div');node.className='ai-message '+role;node.textContent=message;$('#ai-messages').appendChild(node);$('#ai-messages').scrollTop=$('#ai-messages').scrollHeight;state.chat.push({role,message,at:Date.now()});state.chat=state.chat.slice(-30);saveJSON(STORE.chat,state.chat);}
  function restoreChat(){const el=$('#ai-messages');for(const m of state.chat.slice(-20)){const node=document.createElement('div');node.className='ai-message '+(m.role==='user'?'user':'assistant');node.textContent=m.message;el.appendChild(node);}if(!state.chat.length)addChatMessage('assistant','Hi! I can help you use GameHub, connect your handheld or plan a new game.');}
  async function sendChat(message){if(state.chatBusy)return;state.chatBusy=true;addChatMessage('user',message);$('#ai-chat-input').value='';const wait=document.createElement('div');wait.className='ai-message assistant';wait.textContent='Thinking…';$('#ai-messages').appendChild(wait);try{const answer=await askAI(message,'chat');const reply=answer.text+(answer.online?'':'\n(Offline helper — configure OPENAI_API_KEY in Netlify for online AI.)');wait.textContent=reply;state.chat.push({role:'assistant',message:reply,at:Date.now()});state.chat=state.chat.slice(-30);saveJSON(STORE.chat,state.chat);}catch(error){wait.textContent='The assistant could not complete that request. '+String(error.message||error); }finally{state.chatBusy=false;$('#ai-messages').scrollTop=$('#ai-messages').scrollHeight;}}
  function parseAIJSON(raw){const text=String(raw||'').replace(/```(?:json)?/gi,'').trim();try{return JSON.parse(text);}catch(_){}const match=text.match(/\{[\s\S]*\}/);if(match){try{return JSON.parse(match[0]);}catch(_){}}return null;}
  async function buildGameFromPrompt(prompt){if(!prompt.trim()){toast('Describe your game idea first.');return;}const btn=$('#creator-ai-btn');btn.disabled=true;$('#creator-ai-status').textContent='Designing your game…';
    const answer=await askAI(prompt,'create');let spec=parseAIJSON(answer.text);
    if(!spec){const m=prompt.toLowerCase();let engine='runner';if(/snake|worm|grow/.test(m))engine='snake';else if(/space|ship|shoot|laser/.test(m))engine='shooter';else if(/maze|labyrinth|exit/.test(m))engine='maze';else if(/word|letter|guess/.test(m))engine='word';else if(/number|2048|merge/.test(m))engine='2048';else if(/memory|match|pair/.test(m))engine='memory';else if(/paddle|ball|pong/.test(m))engine='pong';else if(/block|brick/.test(m))engine='breakout';else if(/fruit|catch|basket/.test(m))engine='fruit';else if(/asteroid|meteor|dodge/.test(m))engine='dodge';else if(/math|number|equation/.test(m))engine='math';spec={title:`${prompt.trim().split(/[.!?]/)[0].slice(0,26)||'My Arcade'} `,engine,description:`Created from your idea: ${prompt.trim()}`,difficulty:'normal',color:'#8b7cff'};}
    const validEngine=engineById[spec.engine]?spec.engine:'runner';const g=makeCustomGame({title:String(spec.title||'My AI Arcade').slice(0,32),engine:validEngine,desc:String(spec.description||spec.rules||prompt).slice(0,180),difficulty:['easy','normal','hard'].includes(spec.difficulty)?spec.difficulty:'normal',color:/^#[0-9a-f]{6}$/i.test(spec.color||'')?spec.color:'#8b7cff'});
    $('#creator-ai-output').textContent=`${answer.online?'Online AI design':'Offline game recipe'}: ${g.title}\nMechanic: ${engineById[g.engine].title}\n${g.desc}\n\nSaved to My Games. This uses a supported GameHub game engine; it does not execute untrusted generated JavaScript.`;
    $('#creator-ai-status').textContent=answer.online?'Online AI created a playable game recipe.':'Offline helper created a playable game recipe. Add OPENAI_API_KEY in Netlify for generative AI.';
    btn.disabled=false;toast('Your game was created and saved to My Games.');renderMyGames();
  }

  // ---------- Local guest profile and account actions ----------
  function currentProfileName() {
    const name = (localStorage.getItem(PROFILE_KEY) || '').trim();
    return name || 'Guest Player';
  }
  function renderAccount() {
    const storedName = (localStorage.getItem(PROFILE_KEY) || '').trim();
    const name = storedName || 'Guest Player';
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'GH';
    $('#account-player-name').textContent = name;
    $('#account-avatar').textContent = initials;
    $('#account-shortcut').textContent = initials;
    $('#account-profile-status').textContent = storedName
      ? 'Local guest profile · player name saved in this browser'
      : 'Guest profile · no named player is signed in';
    $('#sign-out').disabled = !storedName;
    $('#sign-out').title = storedName ? 'Return to the default Guest Player profile' : 'Already using the Guest Player profile';
  }
  function switchLocalPlayer() {
    const current = currentProfileName();
    const answer = window.prompt(
      'Enter a display name for this local GameHub player (up to 24 characters). This is a local profile label, not an online account:',
      current === 'Guest Player' ? '' : current
    );
    if (answer === null) return;
    const name = answer.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) {
      toast('Please enter a player name.');
      return;
    }
    localStorage.setItem(PROFILE_KEY, name);
    renderAccount();
    toast('Local player name updated. Your browser saves are unchanged.');
  }
  function signOutLocalPlayer() {
    if (!localStorage.getItem(PROFILE_KEY)) {
      toast('You are already using the Guest Player profile.');
      return;
    }
    const ok = window.confirm('Return to the Guest Player profile? Your saved games, uploads, themes and screen-time data will remain on this browser.');
    if (!ok) return;
    localStorage.removeItem(PROFILE_KEY);
    renderAccount();
    toast('Signed out of the named local profile. Your local GameHub data was kept.');
  }
  async function deleteAllLocalGameHubData() {
    const ok = window.confirm('Permanently delete ALL local GameHub data from this browser? This includes saved games, creations, uploaded files, wallpapers, themes, widgets, scores, achievements, screen time and the saved ESP32 pairing token. This cannot be undone. Export a backup first if you need one.');
    if (!ok) return;
    const second = window.confirm('Final confirmation: delete all GameHub data stored by this website in this browser?');
    if (!second) return;

    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('gh2-')) localStorage.removeItem(key);
      }
    } catch (_) {}

    if ('indexedDB' in window) {
      await new Promise(resolve => {
        try {
          const request = indexedDB.deleteDatabase(DB_NAME);
          request.onsuccess = request.onerror = request.onblocked = () => resolve();
        } catch (_) { resolve(); }
      });
    }
    toast('Local GameHub data deleted. Reloading…');
    window.setTimeout(() => window.location.reload(), 500);
  }

  // ---------- Widgets, themes and screen time ----------
  function renderWidgets(){const box=$('#widget-list');box.innerHTML=state.widgets.length?state.widgets.map((w,i)=>`<article class="note-widget"><button data-delete-widget="${i}" title="Delete">×</button><h3>${esc(w.title)}</h3><p>${esc(w.body)}</p></article>`).join(''):'<div class="empty-state">Your custom notes and goals will appear here.</div>';}
  function applySettings(){const s=state.settings;const fontMap={manrope:'Manrope,system-ui,sans-serif',system:'system-ui,-apple-system,BlinkMacSystemFont,sans-serif',trebuchet:'Trebuchet MS,Arial,sans-serif',arial:'Arial,Helvetica,sans-serif'};document.documentElement.style.setProperty('--accent',s.accent||'#8b7cff');document.documentElement.style.setProperty('--app-font',fontMap[s.font]||fontMap.manrope);$('#font-picker').value=s.font||'manrope';document.body.classList.toggle('light',!!s.light);document.body.classList.toggle('reduce-motion',!!s.reduceMotion);const backgrounds={aurora:'radial-gradient(ellipse at 78% -12%,rgba(91,78,190,.22),transparent 34%),#090d18',sunset:'linear-gradient(135deg,rgba(62,35,72,.35),rgba(9,13,24,.92)),linear-gradient(140deg,#9a555b,#242344 60%,#111a28)',grid:'linear-gradient(rgba(139,124,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(139,124,255,.045) 1px,transparent 1px),#090d18',space:'radial-gradient(circle at 78% 18%,rgba(225,133,204,.22),transparent 18%),radial-gradient(circle at 22% 70%,rgba(88,103,215,.22),transparent 25%),#090d18',mint:'radial-gradient(ellipse at 80% 0%,rgba(69,215,176,.19),transparent 32%),#090d18'};if(s.wallpaper!=='custom')document.body.style.background=backgrounds[s.wallpaper||'aurora'];$$('.wallpaper-choice').forEach(b=>b.classList.toggle('selected',b.dataset.wallpaper===(s.wallpaper||'aurora')));$('#accent-picker').value=s.accent||'#8b7cff';$('#theme-toggle').classList.toggle('on',!!s.light);$('#theme-toggle').setAttribute('aria-checked',String(!!s.light));$('#reduce-motion').classList.toggle('on',!!s.reduceMotion);$('#reduce-motion').setAttribute('aria-checked',String(!!s.reduceMotion));if(s.edition){$$('.edition-card').forEach(b=>b.classList.toggle('selected',b.dataset.edition===s.edition));}}
  async function applyCustomWallpaper(){try{const assets=await dbAll('assets');const w=assets.find(x=>x.id==='wallpaper');if(w&&state.settings.wallpaper==='custom'){document.body.style.backgroundImage=`linear-gradient(rgba(7,11,22,.65),rgba(7,11,22,.84)),url("${w.data}")`;document.body.style.backgroundSize='cover';document.body.style.backgroundAttachment='fixed';}}catch(_){} }
  function updateScreenTimeUI(){const min=Math.floor(state.seconds/60),h=Math.floor(min/60),m=min%60,label=h?`${h}h ${m}m`:`${m}m`;$('#dash-screen-time').textContent=label;$('#time-big').textContent=`${h}h ${m}m`;const goal=Number($('#screen-goal').value||60);$('#time-track-fill').style.width=`${Math.min(100,min/goal*100)}%`;}
  function tickScreenTime(){const today=dayKey();if(today!==state.day){state.day=today;state.seconds=0;saveJSON(STORE.day,today);saveJSON(STORE.seconds,0);}if(document.visibilityState==='visible'){state.seconds++;if(state.seconds%10===0)saveJSON(STORE.seconds,state.seconds);}updateScreenTimeUI();}
  state.seconds=state.day===safeJSON(STORE.day,'')?Number(safeJSON(STORE.seconds,0)):0;
  setInterval(tickScreenTime,1000);

  // ---------- ESP32 Wi-Fi PIN bridge ----------
  async function bridgePost(payload){const response=await fetch(BRIDGE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});let data={};try{data=await response.json();}catch(_){}if(!response.ok||!data.ok)throw new Error(data.error||`Bridge HTTP ${response.status}`);return data;}
  function pairMessage(message,error=false,success=false){const el=$('#pair-message');el.textContent=message;el.classList.toggle('error',error);el.classList.toggle('success',success);}
  function setDeviceState(online,detail,kind='Wi-Fi'){state.device.online=online;$('#device-status').textContent=online?(kind==='USB'?'Connected by USB':'Device online'):'Device offline';$('#device-status-detail').textContent=detail;$('#device-orb').classList.toggle('online',online);$('#sidebar-orb').classList.toggle('online',online);$('#side-device-dot').classList.toggle('online',online);$('#sidebar-device-status').textContent=online?'Device online':'Device offline';$('#sidebar-device-sub').textContent=online?`${kind} connected`:'Browser arcade ready';$('#esp-status-badge').textContent=online?'● DEVICE ONLINE':'● DEVICE OFFLINE';$('#esp-status-badge').classList.toggle('online',online);$('#esp-status-badge').classList.toggle('offline',!online);$('#device-connection-type').textContent=online?kind:'Offline';$('#remote-mode').textContent=online?`${kind} active`:'Not connected';}
  function setBattery(voltage,percent,source){if(Number.isFinite(percent)&&percent>=0&&percent<=100){state.battery={voltage:Number.isFinite(voltage)?voltage:null,percent,source};updateBatteryUI();}}
  function updateBatteryUI(){const b=state.battery,ok=Number.isFinite(b.percent);$('#top-battery').textContent=ok?`${b.percent}%`:'--%';$('#dash-battery').textContent=ok?`${b.percent}%`:'--%';$('#dash-battery-source').textContent=ok?`Live · ${b.source}`:'Connect handheld to read';$('#esp-battery-percent').innerHTML=ok?`${b.percent}<small>%</small>`:'--<small>%</small>';$('#battery-fill').style.width=ok?`${b.percent}%`:'0%';$('#esp-battery-voltage').textContent=Number.isFinite(b.voltage)?`${b.voltage.toFixed(2)} V · 1S pack`:'Voltage unavailable';$('#battery-source').textContent=ok?`Reported by ESP32 via ${b.source}`:'No live battery value received.';$('#battery-warning').textContent=ok?(b.percent<=15?'Low battery. Check the handheld battery soon.':'Live reading from your calibrated analog reader.'):'Battery percentage is not guessed. Connect the ESP32 and calibrate the reader first.';}
  function parseTelemetry(mode){const value=String(mode||'');const m=value.match(/BAT=(\d{1,3}|NA)/i),v=value.match(/V=([0-9]+(?:\.[0-9]+)?)/i);if(m){if(m[1].toUpperCase()==='NA'){state.battery={voltage:null,percent:null,source:'Not available'};updateBatteryUI();}else{const pct=Number(m[1]),vol=v?Number(v[1]):null;if(pct<=100)setBattery(vol,pct,'Wi-Fi bridge');}}$('#device-mode').textContent=value.split('|')[0]||'—';}
  async function checkBridgeStatus(){if(!state.token)return;try{const data=await bridgePost({action:'status',token:state.token});const online=!!data.online;setDeviceState(online,online?`Bridge online · last seen ${data.last_seen_seconds??'?'} seconds ago`:'Pairing token is valid, but the ESP32 has not checked in recently.','Wi-Fi');if(data.screen)$('#device-screen').textContent=data.screen;if(data.mode)parseTelemetry(data.mode);$('#device-last-seen').textContent=data.last_seen_seconds!=null?`${data.last_seen_seconds}s ago`:'—';}catch(e){if(/token|paired|invalid/i.test(e.message)){state.token='';localStorage.removeItem('gh2-pair-token');clearInterval(state.bridgeTimer);state.bridgeTimer=null;}setDeviceState(false,'Bridge status error: '+e.message,'Wi-Fi');}}
  function startBridgePolling(){clearInterval(state.bridgeTimer);if(!state.token)return;checkBridgeStatus();state.bridgeTimer=setInterval(checkBridgeStatus,8000);}
  async function pairByPIN(ev){ev.preventDefault();const pin=$('#pair-pin').value.trim();if(!/^\d{6}$/.test(pin)){pairMessage('Enter all six digits shown on the ESP32.',true);return;}const btn=$('#pair-submit');btn.disabled=true;pairMessage('Checking the one active PIN with the GameHub bridge…');try{const data=await bridgePost({action:'pair',pin});if(!data.token)throw new Error('The bridge did not return a pairing token.');state.token=data.token;localStorage.setItem('gh2-pair-token',data.token);if(data.screen)$('#device-screen').textContent=data.screen;pairMessage('PIN accepted. Checking the handheld status…',false,true);await checkBridgeStatus();startBridgePolling();if(!state.device.online)pairMessage('PIN accepted. The browser is paired; the handheld has not checked in yet. Confirm its OLED says “Bridge connected”.',false,true);else pairMessage('Connected! Your GameHub browser is paired.',false,true);}catch(e){const msg=e.message==='pin_expired_or_invalid'?'PIN expired or not registered. Check that the handheld says “Bridge connected”, then enter the current PIN again.':e.message;pairMessage('Pairing failed: '+msg,true);}finally{btn.disabled=false;}}
  async function sendBridgeKey(key){if(!state.token)return;try{await bridgePost({action:'command',token:state.token,key});}catch(e){toast('Remote command failed: '+e.message);}}
  function forgetPair(){state.token='';localStorage.removeItem('gh2-pair-token');clearInterval(state.bridgeTimer);state.bridgeTimer=null;setDeviceState(false,'PIN pairing removed. You can pair again.','Offline');pairMessage('This browser has forgotten the device.');toast('Pairing forgotten.');}

  // ---------- USB serial (desktop Chrome/Edge and compatible devices only) ----------
  function usbMessage(message,error=false,success=false){const el=$('#usb-message');el.textContent=message;el.classList.toggle('error',error);el.classList.toggle('success',success);}
  async function usbSend(line){if(!state.usbWriter)return;try{await state.usbWriter.write(new TextEncoder().encode(line+'\n'));}catch(e){usbMessage('USB write failed: '+e.message,true);}}
  function parseDeviceLine(line){line=line.trim();if(!line)return;if(line==='GAMEHUB_USB_READY'||line==='GH:READY'){usbMessage('ESP32 firmware ready. USB control is active.',false,true);setDeviceState(true,'Direct USB serial connection','USB');}if(line.startsWith('GH:BATTERY:')){const p=line.split(':');const v=Number(p[2]),pct=Number(p[3]);if(p[2]==='NA'||p[3]==='NA'){if(state.battery.source==='USB cable'){state.battery={voltage:null,percent:null,source:'Not available'};updateBatteryUI();}}else if(Number.isFinite(v)&&Number.isFinite(pct))setBattery(v,pct,'USB cable');}if(line.startsWith('GH:MODE:'))$('#device-mode').textContent=line.slice(8);if(line.startsWith('GH:SCREEN:'))$('#device-screen').textContent=line.slice(10);}
  async function usbReadLoop(){if(!state.usbPort?.readable)return;const decoder=new TextDecoder();try{while(state.usbPort&&state.usbPort.readable){state.usbReader=state.usbPort.readable.getReader();try{while(true){const {value,done}=await state.usbReader.read();if(done)break;state.usbText+=decoder.decode(value,{stream:true});const lines=state.usbText.split(/\r?\n/);state.usbText=lines.pop()||'';lines.forEach(parseDeviceLine);}}finally{state.usbReader.releaseLock();state.usbReader=null;}}}catch(e){usbMessage('USB connection ended: '+e.message,true);} }
  async function connectUSB(){if(!('serial'in navigator)){usbMessage('USB serial is unavailable here. Use Wi-Fi PIN pairing on phones or an unsupported browser.',true);return;}try{state.usbPort=await navigator.serial.requestPort();await state.usbPort.open({baudRate:115200,bufferSize:256});state.usbWriter=state.usbPort.writable.getWriter();state.usbConnected=true;$('#usb-connect').classList.add('hidden');$('#usb-disconnect').classList.remove('hidden');usbMessage('USB opened. Waiting for GameHub firmware…');setDeviceState(false,'USB port opened; waiting for firmware response.','USB');usbReadLoop();await usbSend('HELLO');await usbSend('BATTERY?');state.usbTimer=setInterval(()=>{if(state.usbConnected){usbSend('PING');usbSend('BATTERY?');}},5000);}catch(e){state.usbConnected=false;state.usbPort=null;usbMessage('Could not connect: '+e.message,true);}}
  async function disconnectUSB(){clearInterval(state.usbTimer);state.usbTimer=null;try{if(state.usbReader)await state.usbReader.cancel();if(state.usbWriter){state.usbWriter.releaseLock();state.usbWriter=null;}if(state.usbPort)await state.usbPort.close();}catch(_){}state.usbPort=null;state.usbConnected=false;$('#usb-connect').classList.remove('hidden');$('#usb-disconnect').classList.add('hidden');usbMessage('USB disconnected.');if(state.battery.source==='USB cable'){state.battery={voltage:null,percent:null,source:'Not connected'};updateBatteryUI();}setDeviceState(false,'Choose Wi-Fi PIN or USB to connect.','Offline');}
  function sendRemote(key){if(state.usbConnected){usbSend('KEY '+key);return;}if(state.token){sendBridgeKey(key);return;}toast('Connect with PIN or USB first.');}
  function refreshDeviceUI(){if(state.usbConnected){setDeviceState(true,'USB cable connected','USB');return;}if(state.token){pairMessage('Saved pairing found. Checking bridge…');checkBridgeStatus();startBridgePolling();}else setDeviceState(false,'Choose a connection method below.','Offline');updateBatteryUI();}

  // ---------- DOM events ----------
  document.addEventListener('click', async e => {
    const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}
    const go=e.target.closest('[data-go]');if(go){setView(go.dataset.go);return;}
    const play=e.target.closest('[data-play]');if(play){startGame(findGame(play.dataset.play));return;}
    const save=e.target.closest('[data-save]');if(save){toggleSaved(save.dataset.save);return;}
    const tab=e.target.closest('[data-connect-tab]');if(tab){$$('.connection-tab').forEach(b=>b.classList.toggle('active',b===tab));$$('.connect-panel').forEach(p=>p.classList.toggle('active',p.id==='connect-'+tab.dataset.connectTab));return;}
    const remote=e.target.closest('[data-remote]');if(remote){sendRemote(remote.dataset.remote);return;}
    const col=e.target.closest('[data-collection]');if(col){state.collection=col.dataset.collection;$$('[data-collection]').forEach(b=>b.classList.toggle('active',b===col));renderMyGames();return;}
    const cat=e.target.closest('[data-category]');if(cat){state.category=cat.dataset.category;state.page=1;$$('[data-category]').forEach(b=>b.classList.toggle('active',b===cat));$('#category-filter').value=state.category;renderStore();return;}
    const wp=e.target.closest('[data-wallpaper]');if(wp){state.settings.wallpaper=wp.dataset.wallpaper;saveJSON(STORE.settings,state.settings);applySettings();unlockAchievement('customizer');toast('Wallpaper changed');return;}
    const delW=e.target.closest('[data-delete-widget]');if(delW){state.widgets.splice(Number(delW.dataset.deleteWidget),1);saveJSON(STORE.widgets,state.widgets);renderWidgets();return;}
    const delF=e.target.closest('[data-delete-file]');if(delF){await dbDelete('uploads',delF.dataset.deleteFile);renderUploads();updateCounts();return;}
    const dl=e.target.closest('[data-download-file]');if(dl){downloadFile(dl.dataset.downloadFile);return;}
    if(e.target.closest('[data-close-game]')){stopGame();return;}
    const ed=e.target.closest('[data-edition]');if(ed){$$('.edition-card').forEach(b=>b.classList.toggle('selected',b===ed));state.settings.edition=ed.dataset.edition;saveJSON(STORE.settings,state.settings);$('#device-screen').textContent=ed.dataset.edition==='oled'?'SH1106 128x64':'ILI9341 320x240';toast('Screen profile selected. Upload the matching firmware to the ESP32.');return;}
    const key=e.target.closest('[data-game-key]');if(key&&state.game){const k=key.dataset.gameKey;state.game.keys.add(k);gameAction(k);setTimeout(()=>state.game&&state.game.keys.delete(k),130);}
  });
  $('#pair-form').addEventListener('submit',pairByPIN);
  $('#usb-connect').addEventListener('click',connectUSB);
  $('#usb-disconnect').addEventListener('click',disconnectUSB);
  $('#forget-device').addEventListener('click',forgetPair);
  $('#game-canvas').addEventListener('pointerdown',gameClick);
  $('#game-word-input').addEventListener('input',e=>{if(state.game?.type==='word'&&!state.game.done)state.game.current=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,5);});
  $('#game-word-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&state.game?.type==='word'){e.preventDefault();submitWord(state.game);e.target.value='';}});
  $('#game-canvas').addEventListener('contextmenu',e=>{if(state.game?.type==='mines'){e.preventDefault();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*480/r.width,y=(e.clientY-r.top)*300/r.height,col=Math.floor((x-120)/30),row=Math.floor((y-48)/29);if(col>=0&&col<8&&row>=0&&row<8)state.game.flags[row][col]=!state.game.flags[row][col];}});
  $('#game-pause').addEventListener('click',()=>{if(!state.game)return;state.game.paused=!state.game.paused;$('#game-pause').textContent=state.game.paused?'▶':'Ⅱ';});
  $('#game-restart').addEventListener('click',()=>{if(state.game)startGame(state.game.g);});
  $('#daily-play').addEventListener('click',()=>{ensureDailyChallenge();startGame(findGame(state.daily.gameId));});
  $$('[data-close-game]').forEach(b=>b.addEventListener('click',stopGame));
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.game){stopGame();return;}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#global-search').focus();}if(state.game)gameKeyDown(e);else if(state.view==='esp32'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)){const map={ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT',' ':'A'};sendRemote(map[e.key]);}});
  window.addEventListener('keyup',gameKeyUp);
  $('#store-search').addEventListener('input',()=>{state.page=1;renderStore();});
  $('#global-search').addEventListener('input',e=>{if(e.target.value){setView('store');$('#store-search').value=e.target.value;state.page=1;renderStore();}});
  $('#category-filter').addEventListener('change',e=>{state.category=e.target.value;state.page=1;$$('[data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category===state.category));renderStore();});
  $('#sort-filter').addEventListener('change',renderStore);$('#load-more').addEventListener('click',()=>{state.page++;renderStore();});
  $('#create-title').addEventListener('input',e=>$('#creator-preview-title').textContent=e.target.value||'My Neon Adventure');
  $('#create-color').addEventListener('input',e=>$('#creator-preview').style.background=`linear-gradient(130deg,${e.target.value},#245e69)`);
  $('#create-form').addEventListener('submit',e=>{e.preventDefault();const g=makeCustomGame({title:$('#create-title').value.trim(),engine:$('#create-template').value,desc:`Your ${$('#create-difficulty').value} custom ${engineById[$('#create-template').value]?.title||'arcade'} game.`,difficulty:$('#create-difficulty').value,color:$('#create-color').value});toast('Game created and saved.');setView('mygames');});
  $('#creator-ai-btn').addEventListener('click',()=>buildGameFromPrompt($('#creator-prompt').value));
  $('#upload-input').addEventListener('change',e=>addFiles(e.target.files));
  const drop=$('#drop-zone');['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover');}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover');}));drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
  $('#widget-form').addEventListener('submit',e=>{e.preventDefault();const title=$('#widget-title').value.trim(),body=$('#widget-body').value.trim();if(!title)return;state.widgets.unshift({title,body});saveJSON(STORE.widgets,state.widgets);e.target.reset();renderWidgets();toast('Widget added');});
  $('#accent-picker').addEventListener('input',e=>{state.settings.accent=e.target.value;saveJSON(STORE.settings,state.settings);applySettings();unlockAchievement('customizer');});
  $('#font-picker').addEventListener('change',e=>{state.settings.font=e.target.value;saveJSON(STORE.settings,state.settings);applySettings();unlockAchievement('customizer');toast('Interface font updated');});
  $('#switch-account').addEventListener('click', switchLocalPlayer);
  $('#sign-out').addEventListener('click', signOutLocalPlayer);
  $('#delete-local-data').addEventListener('click', deleteAllLocalGameHubData);
  $('#theme-toggle').addEventListener('click',()=>{state.settings.light=!state.settings.light;saveJSON(STORE.settings,state.settings);applySettings();});
  $('#reduce-motion').addEventListener('click',()=>{state.settings.reduceMotion=!state.settings.reduceMotion;saveJSON(STORE.settings,state.settings);applySettings();});
  $('#screen-goal').addEventListener('change',updateScreenTimeUI);
  $('#wallpaper-upload').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;if(f.size>1800000){toast('Choose an image smaller than 1.8 MB.');e.target.value='';return;}const reader=new FileReader();reader.onload=async()=>{try{await dbPut('assets',{id:'wallpaper',data:reader.result});state.settings.wallpaper='custom';saveJSON(STORE.settings,state.settings);unlockAchievement('customizer');document.body.style.backgroundImage=`linear-gradient(rgba(7,11,22,.65),rgba(7,11,22,.84)),url("${reader.result}")`;document.body.style.backgroundSize='cover';document.body.style.backgroundAttachment='fixed';toast('Wallpaper applied');}catch(_){toast('Could not save wallpaper.');}};reader.readAsDataURL(f);});
  $('#reset-data').addEventListener('click',async()=>{if(!confirm('Clear saved games, creations, themes, widgets and screen time from this browser? Uploaded files will remain.'))return;[STORE.saved,STORE.custom,STORE.settings,STORE.widgets,STORE.seconds,STORE.day,STORE.scores,STORE.plays,STORE.unique,STORE.achievements,STORE.daily].forEach(k=>localStorage.removeItem(k));state.saved=[];state.custom=[];state.settings={};state.widgets=[];state.seconds=0;state.scores={};state.plays=0;state.uniquePlayed=[];state.achievements=[];state.daily=null;applySettings();renderDashboard();renderWidgets();updateCounts();toast('Local GameHub data reset');});
  $('#export-data').addEventListener('click',()=>{const data={saved:state.saved,custom:state.custom,settings:state.settings,widgets:state.widgets,seconds:state.seconds,scores:state.scores,plays:state.plays,uniquePlayed:state.uniquePlayed,achievements:state.achievements,daily:state.daily,exported:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gamehub-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);});
  $('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));$('#account-shortcut').addEventListener('click',()=>setView('account'));
  $('#ai-fab').addEventListener('click',()=>$('#ai-panel').classList.toggle('hidden'));$('#ai-close').addEventListener('click',()=>$('#ai-panel').classList.add('hidden'));
  $('#ai-chat-form').addEventListener('submit',e=>{e.preventDefault();const value=$('#ai-chat-input').value.trim();if(value)sendChat(value);});
  if('serial'in navigator)navigator.serial.addEventListener('disconnect',()=>{if(state.usbConnected)disconnectUSB();});

  // ---------- Initial page state ----------
  ensureDailyChallenge();renderAccount();applySettings();applyCustomWallpaper();renderDashboard();renderStore();renderUploads();renderWidgets();updateCounts();updateBatteryUI();restoreChat();
  if(state.token)startBridgePolling();
})();
