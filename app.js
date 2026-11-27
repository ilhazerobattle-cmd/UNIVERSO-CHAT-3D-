window.__ok = 1;

// Os módulos 3D dependem da biblioteca "three". Se ela falhar ao carregar (sem internet,
// node_modules ausente etc.), o app continua funcionando — só sem o visual 3D.
const load3D = async (file) => {
  try { return await import(file); } catch (err) { console.error('Falha ao carregar ' + file + ':', err); return null; }
};
import { BUILTIN_SONGS, musicPlayer, renderSongToWav } from '/music.js';
// Sem top-level await (navegadores/WebViews antigos dão "Unexpected reserved word").
// Áudio 3D depende de "three": carregado de forma segura (se falhar, usa um substituto mudo).
let spatialAudio = { isMuted: () => true, toggleMute: () => true, playUi: () => {} };
let avatarMod = null, zombieMod = null, bowlingMod = null, cannonMod = null, fishingMod = null, caveMod = null, soccerMod = null;
const no3D = () => { throw new Error('Módulo 3D indisponível'); };
const mountStage = (...a) => (avatarMod && avatarMod.mountStage || no3D)(...a);
const mountPreview = (...a) => (avatarMod && avatarMod.mountPreview || no3D)(...a);
const mountZombie3D = (...a) => (zombieMod && zombieMod.mountZombie3D || no3D)(...a);
const mountBowling3D = (...a) => (bowlingMod && bowlingMod.mountBowling3D || no3D)(...a);
const mountCannon3D = (...a) => (cannonMod && cannonMod.mountCannon3D || no3D)(...a);
const mountFishing3D = (...a) => (fishingMod && fishingMod.mountFishing3D || no3D)(...a);
const mountCave3D = (...a) => (caveMod && caveMod.mountCave3D || no3D)(...a);
const mountSoccer3D = (...a) => (soccerMod && soccerMod.mountSoccer3D || no3D)(...a);
const load3DAll = () => Promise.all([
  load3D('/audio3d.js').then((m) => { if (m && m.spatialAudio) spatialAudio = m.spatialAudio; }),
  load3D('/avatar3d.js'), load3D('/zombie3d.js'), load3D('/bowling3d.js'), load3D('/cannon3d.js'), load3D('/fishing3d.js'), load3D('/cave3d.js'), load3D('/soccer3d.js'),
]).then(([, a, z, b, c, f, cv, sc]) => { soccerMod = sc; avatarMod = a; zombieMod = z; bowlingMod = b; cannonMod = c; fishingMod = f; caveMod = cv; });

const $ = (s) => document.querySelector(s);
const COR = ['#94a3b8', '#22c55e', '#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#ef4444'];
const CARGOS = ['Viajante', 'Sentinela', 'Comandante', 'Arconte', 'Celestial', 'Arquiteto', 'Dono'];
const BOLAS = { verde: ['🟢', 0], vermelha: ['🔴', 0], eletrica: ['⚡', 30], prata: ['⚪', 50], preto: ['⚫', 80], gold: ['🟡', 120], fire: ['🔥', 200] };
const ARMAS = { pistola: ['🔫', 1, 0], espingarda: ['🧨', 2, 40], metralhadora: ['⚡', 3, 100] };
const VARAS = { vara_bambu: ['🎋', 'Bambu', 0, 0], vara_titanio: ['🪝', 'Titânio', 16, 60], vara_estelar: ['🌟', 'Estelar', 32, 140] };
const ICON = { chat: '🪐', prison: '🔒', vip: '👑', bowling: '🎳', cannon: '💥', zombie: '🧟', fishing: '🎣', cave: '🕯️', soccer: '⚽' };
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: (k) => { try { localStorage.removeItem(k); } catch {} } };
const initialSongCache = Object.fromEntries(BUILTIN_SONGS.map((s) => [s.id, s]));
const S = {
  discord: 'https://discord.gg/V28vGAvy', logs: [], key: LS.get('uc_key'), me: null, planets: [], room: null, planet: null,
  members: [], typing: [], tab: 'planets', socialTab: 'friends', guildSearch: '', guildList: null, unreadGuild: 0,
  userSearch: '', userResults: null, userSearchBusy: false,
  topics: [], expandedTopicId: 1, showNewTopic: false, hideRoomTopic: false,
  feedbacks: [], fbCat: 'sugestao', fbRating: 5, fbFilter: 'all', fbSort: 'recent', fbBusy: false,
  confirmDisband: false, passPrompt: null, apk: null, apkUpdate: null, mailPrefill: '', mailThread: null, mailThreadName: '', mailCompose: false, mailRead: (() => { try { return JSON.parse(LS.get('uc_mail_read') || '{}'); } catch { return {}; } })(),
  showTopOptions: false, showReportPick: false, repFilter: 'pendente', verFilter: 'pending', verifyDraft: null, profileModal: null,
  songCache: initialSongCache, aiSongs: [], activeSong: BUILTIN_SONGS[0], activeWavUrl: '',
  aiMusicStyle: 'Synthwave Espacial', aiMusicPrompt: '', aiMusicBusy: false, aiMusicErr: '',
  game: null, showGame: false, rulesOpen: false, authMode: 'create', step: 1, g: 'm', char: 'piloto',
  bagTab: 'chars', shopTab: 'trajes', genderFilter: 'all', activeEmote: 'idle', showActions: false,
  ball: 'verde', ammo: 'fogo', arma: 'pistola', vara: 'vara_bambu', fishStage: 'idle', fishTimer: null, fishMissTimer: null,
  traj: true, ang: 45, pow: 25, busy: false, tries: 0, unreadRoom: 0, mailSeen: Number(LS.get('uc_mail_seen')) || 0,
};
S.code = { open: false, enabled: null, unlocked: false, files: [], file: 'app.js', orig: '', draft: '', readonly: false, modified: false, busy: false, err: '', errLine: null, backups: null, loaded: false };
S.reset = { stage: 'ask', name: '', token: '', busy: false };
S.emailStage = 'idle';
const NAME_COLORS = [
  { hex: '', name: 'Padrão' },
  { hex: '#38bdf8', name: 'Azul Estelar' },
  { hex: '#22d3ee', name: 'Ciano Neon' },
  { hex: '#34d399', name: 'Esmeralda' },
  { hex: '#a78bfa', name: 'Violeta' },
  { hex: '#f472b6', name: 'Rosa Lunar' },
  { hex: '#fbbf24', name: 'Ouro Solar' },
  { hex: '#fb923c', name: 'Laranja Fênix' },
  { hex: '#f87171', name: 'Rubi' },
  { hex: '#f8fafc', name: 'Branco Estelar' },
];
const UG_SHOP = {
  pet: {
    pet_alien: { name: 'Alien Cristalino', emoji: '👾', price: 120 }, pet_pavao: { name: 'Pavão Aurora', emoji: '🦚', price: 150 },
    pet_lobo: { name: 'Lobo Lunar', emoji: '🐺', price: 200 }, pet_kraken: { name: 'Kraken Estelar', emoji: '🐙', price: 280 },
    pet_rex: { name: 'Rex Nebuloso', emoji: '🦖', price: 350 }, pet_dragao: { name: 'Dragão Cósmico', emoji: '🐲', price: 500 },
  },
  planeta: {
    planeta_cristal: { name: 'Planeta Cristal', emoji: '💎', price: 400 }, planeta_gelo: { name: 'Planeta Gelo', emoji: '🧊', price: 450 },
    planeta_vulcao: { name: 'Planeta Vulcão', emoji: '🌋', price: 500 },
  },
  traje: { fantasma_noel: { name: 'Fantasma Noel', emoji: '🎅👻', price: 300, image: '/traje-fantasma-noel.png' } },
};
const CATALOG = {
  chars: {
    piloto: { id: 'piloto', name: 'Piloto Estelar', g: 'm', price: 0, desc: 'Aventureiro clássico com óculos de aviador' },
    explorador_m: { id: 'explorador_m', name: 'Explorador Urbano', g: 'm', price: 0, desc: 'Boné espacial invertido e jaqueta esmeralda' },
    cyber: { id: 'cyber', name: 'Cyborg Órion', g: 'm', price: 90, desc: 'Cabelo platinado espetado, monóculo cyber e reator' },
    principe: { id: 'principe', name: 'Príncipe Solar', g: 'm', price: 130, desc: 'Fios dourados, diadema real e capa curta' },
    eclipse_m: { id: 'eclipse_m', name: 'Guardião Eclipse', g: 'm', price: 160, desc: 'Mechas violetas arrepiadas e cachecol sombrio' },
    samurai_m: { id: 'samurai_m', name: 'Ronin Estelar', g: 'm', price: 180, desc: 'Coque samurai, faixa rubi e ombreiras douradas' },
    lobo_m: { id: 'lobo_m', name: 'Lobo Lunar', g: 'm', price: 220, desc: 'Orelhas de lobo 3D, olhos âmbar e gola prateada' },
    estrela: { id: 'estrela', name: 'Viajante Estelar', g: 'f', price: 0, desc: 'Exploradora espacial com tiara dourada de estrela' },
    luna_f: { id: 'luna_f', name: 'Luna Pop', g: 'f', price: 0, desc: 'Maria-chiquinhas vibrantes com laços estelares' },
    valquiria: { id: 'valquiria', name: 'Valquíria Nebulosa', g: 'f', price: 90, desc: 'Coques espaciais lilás e presilhas aladas' },
    aurora: { id: 'aurora', name: 'Aurora Cósmica', g: 'f', price: 130, desc: 'Cabelos longos turquesa da nebulosa com broche' },
    dama_eclipse: { id: 'dama_eclipse', name: 'Dama Eclipse', g: 'f', price: 160, desc: 'Corte chanel moderno escuro com mechas rubi' },
    kitsune_f: { id: 'kitsune_f', name: 'Kitsune Celestial', g: 'f', price: 180, desc: 'Orelhas de raposa 3D e cauda espiritual animada' },
    imperatriz_f: { id: 'imperatriz_f', name: 'Imperatriz Galáctica', g: 'f', price: 220, desc: 'Rabo de cavalo alto, diadema imperial e manto' },
  },
  outfits: {
    roupa_azul: { id: 'roupa_azul', name: 'Jaqueta Estelar Azul', g: 'm', color: '#3b82f6', price: 60 },
    roupa_preta: { id: 'roupa_preta', name: 'Jaqueta Noturna', g: 'm', color: '#1e293b', price: 95 },
    roupa_terno: { id: 'roupa_terno', name: 'Terno Dourado Real', g: 'm', color: '#d4af37', price: 150 },
    roupa_rosa: { id: 'roupa_rosa', name: 'Vestido Rosa Lunar', g: 'f', color: '#ec4899', price: 60 },
    roupa_roxa: { id: 'roupa_roxa', name: 'Conjunto Nebulosa', g: 'f', color: '#8b5cf6', price: 95 },
    roupa_vestido_ouro: { id: 'roupa_vestido_ouro', name: 'Vestido Solar Dourado', g: 'f', color: '#eab308', price: 150 },
    roupa_galactica: { id: 'roupa_galactica', name: 'Moletom Galáctico', g: 'u', color: '#0891b2', price: 110 },
    roupa_carmesim: { id: 'roupa_carmesim', name: 'Armadura Carmesim', g: 'u', color: '#be123c', price: 180 },
    roupa_neon: { id: 'roupa_neon', name: 'Jaqueta Cyber Neon', g: 'u', color: '#06b6d4', price: 120 },
    roupa_imperial: { id: 'roupa_imperial', name: 'Manto Real Imperial', g: 'u', color: '#7c3aed', price: 170 },
  },
  trajes: {
    coelho_estelar: { id: 'coelho_estelar', name: 'Traje Coelho Estelar', price: 180, img: '/traje-coelho-estelar.png', featured: true, desc: 'Kigurumi bicolor preto e branco com patinhas rosa, estrela dourada, máscara preta, pantufas de coelho e coelhinho no ombro!' },
    astronauta: { id: 'astronauta', name: 'Traje Astronauta Órion', price: 150, desc: 'Capacete espacial espelhado, mochila orbital e macacão pressurizado.' },
    cyber_ninja: { id: 'cyber_ninja', name: 'Traje Ninja Cibernético', price: 190, desc: 'Armadura furtiva com visor neon e lâminas energéticas nas costas.' },
    dragao_rubi: { id: 'dragao_rubi', name: 'Traje Cavaleiro Dragão', price: 240, desc: 'Elmo com chifres dourados, ombreiras reais e cauda dracônica.' },
    guardiao_celestial: { id: 'guardiao_celestial', name: 'Traje Guardião Celestial', price: 220, desc: 'Armadura branca e dourada com núcleo estelar e manto celestial.' },
    fantasma_cosmico: { id: 'fantasma_cosmico', name: 'Traje Espectro Cósmico', price: 200, desc: 'Manto espectral translúcido com capuz sombrio e olhos ciano.' },
  },
  accessories: {
    oculos_cyber: { id: 'oculos_cyber', name: 'Óculos Visor Cyber', price: 55, emoji: '🕶️', desc: 'Visor luminoso ciano futurista' },
    fones_pulsar: { id: 'fones_pulsar', name: 'Fones Pulsar Neon', price: 65, emoji: '🎧', desc: 'Headset espacial com arco brilhante' },
    cartola_estelar: { id: 'cartola_estelar', name: 'Cartola Estelar', price: 80, emoji: '🎩', desc: 'Cartola cósmica com faixa dourada' },
    orelhas_gatinho: { id: 'orelhas_gatinho', name: 'Tiara Orelhas Cósmicas', price: 85, emoji: '🐱', desc: 'Tiara com orelhinhas neon brilhantes' },
    aura_borboletas: { id: 'aura_borboletas', name: 'Borboletas Azuis', price: 120, emoji: '🦋', desc: 'Borboletas azuis luminosas voando ao redor' },
    mochila_foguete: { id: 'mochila_foguete', name: 'Jetpack Cometa', price: 150, emoji: '🚀', desc: 'Propulsor duplo com chamas azuis' },
    asas_luz: { id: 'asas_luz', name: 'Asas Celestiais', price: 180, emoji: '🪽', desc: 'Asas translúcidas de luz estelar' },
    coroa_real: { id: 'coroa_real', name: 'Coroa Estelar Real', price: 160, emoji: '👑', desc: 'Coroa dourada pontiaguda de alto prestígio' },
    mascara_oni: { id: 'mascara_oni', name: 'Máscara Oni Neon', price: 110, emoji: '👹', desc: 'Máscara rubi com presas douradas' },
    capa_heroi: { id: 'capa_heroi', name: 'Capa Galáctica', price: 140, emoji: '🦸', desc: 'Capa escarlate esvoaçante nos ombros' },
  },
  auras: {
    aura_fogo: { id: 'aura_fogo', name: 'Aura Chama Solar', emoji: '🔥', color: '#f97316', price: 140, desc: 'Brasas solares orbitando com anéis de fogo' },
    aura_raio: { id: 'aura_raio', name: 'Aura Tempestade Raios', emoji: '⚡', color: '#38bdf8', price: 150, desc: 'Anéis elétricos e fragmentos ciano em alta velocidade' },
    aura_sombria: { id: 'aura_sombria', name: 'Aura Eclipse Sombrio', emoji: '🌑', color: '#a855f7', price: 160, desc: 'Vórtice violeta com orbes de matéria escura' },
    aura_sakura: { id: 'aura_sakura', name: 'Aura Pétalas Estelares', emoji: '🌸', color: '#f472b6', price: 155, desc: 'Pétalas rosadas luminosas flutuando em espiral' },
    aura_arcana: { id: 'aura_arcana', name: 'Aura Círculo Arcano', emoji: '🔮', color: '#22d3ee', price: 185, desc: 'Selo geométrico hexagonal e runas em rotação' },
    aura_celestial: { id: 'aura_celestial', name: 'Aura Chama Divina', emoji: '✨', color: '#fbbf24', price: 220, desc: 'Hélice dourada celestial com estrelas ascendentes' },
  },
};
let toastT;
let stage3d = null, stageElRef = null;
let preview3d = null, previewElRef = null;
let modal3d = null, modalElRef = null;
let zombie3d = null, zombieElRef = null;
let bowling3d = null, bowlingElRef = null;
let cannon3d = null, cannonElRef = null;
let fishing3d = null, fishingElRef = null, cave3d = null, caveElRef = null, soccer3d = null, soccerElRef = null;
let lastTypingSent = 0, typingStopTimer = null, typingActive = false;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameStyleAttr = (color, cargo = 0) => {
  const c = color || COR[cargo || 0];
  return color ? `color:${esc(c)};text-shadow:0 0 8px ${esc(c)}55` : `color:${c}`;
};
const verBadgeHtml = (v, full = false) => v === 'real'
  ? `<span class="ver-badge real" title="Pessoa Real Verificada (UNIVERSO no papel)">${full ? '✅ Real' : '✅'}</span>`
  : v === 'fake'
    ? `<span class="ver-badge fake" title="Perfil marcado como Fake pela moderação">${full ? '🚫 Fake' : '🚫FAKE'}</span>`
    : '';
const toast = (t) => { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (e.hidden = true), 3500); };
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {}
  try {
    const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); document.body.removeChild(a);
    return ok;
  } catch { return false; }
}
const setNet = (ok) => ($('#net').hidden = ok);
async function api(body) {
  try {
    const r = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: S.key, ...body }) });
    const d = await r.json();
    if (d.reset) { LS.del('uc_key'); location.reload(); }
    return d;
  } catch { return { error: 'Sem internet.' }; }
}

async function postJson(url, body) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return { error: 'Sem internet.' }; }
}
const resetApi = (body) => postJson('/api/reset', body);
const emailApi = (body) => postJson('/api/email', { key: S.key, ...body });
const codeApi = (body) => postJson('/api/code', { key: S.key, ...body });

async function purgeApkCacheAndReload() {
  try {
    if ('caches' in window) {
      const ks = await caches.keys();
      await Promise.all(ks.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
  } catch {}
  location.reload();
}
function renderApkBanner() {
  const b = $('#updbanner');
  if (!b) return;
  if (!S.apkUpdate) { b.hidden = true; b.innerHTML = ''; return; }
  b.hidden = false;
  b.innerHTML = `<span>📲 Nova versão ${esc(S.apkUpdate.ver)}${S.apkUpdate.note ? ` · ${esc(S.apkUpdate.note)}` : ''}</span><div class="row"><button data-a="doapkupdate">Atualizar</button><button class="sec" data-a="dismissapk" style="padding:5px 9px;background:rgba(0,0,0,.28);color:#fff;border:0">✕</button></div>`;
}
async function loadGuildList() {
  const r = await api({ type: 'guildlist', q: S.guildSearch });
  if (r.ok) {
    S.guildList = r.guilds || [];
    if (S.tab === 'social' && S.socialTab === 'guild' && !S.me?.guild) {
      const el = $('#guildlistwrap');
      if (el) el.innerHTML = guildListHtml();
    }
  }
}
let userSearchSeq = 0, userSearchTimer = null;
async function runUserSearch(q) {
  const clean = String(q || '').trim();
  S.userSearch = clean;
  const clr = $('#usearchclr');
  if (clr) clr.hidden = !clean;
  const seq = ++userSearchSeq;
  if (!clean) {
    S.userResults = null;
    S.userSearchBusy = false;
    const w = $('#usearchlist');
    if (w) w.innerHTML = userSearchResultsHtml();
    return;
  }
  S.userSearchBusy = true;
  const wBusy = $('#usearchlist');
  if (wBusy) wBusy.innerHTML = userSearchResultsHtml();
  const r = await api({ type: 'usersearch', q: clean });
  if (seq !== userSearchSeq) return;
  S.userSearchBusy = false;
  S.userResults = r.ok ? (r.users || []) : [];
  const w = $('#usearchlist');
  if (w) w.innerHTML = userSearchResultsHtml();
}

// ---------- conexão em tempo real (reconecta sozinha) ----------
function connect() {
  if (S.es) S.es.close();
  const es = (S.es = new EventSource('/events?key=' + encodeURIComponent(S.key)));
  es.addEventListener('hello', async (e) => {
    const d = JSON.parse(e.data); S.me = d.me; S.planets = d.planets; S.tries = 0;
    if (d.discord) S.discord = d.discord;
    if (d.apk) S.apk = d.apk;
    if (Array.isArray(d.cargos)) CARGOS.splice(0, CARGOS.length, ...d.cargos);
    if (d.catalog) Object.assign(CATALOG, d.catalog);
    if (Array.isArray(d.topics)) S.topics = d.topics;
    if (Array.isArray(d.feedbacks)) S.feedbacks = d.feedbacks;
    if (Array.isArray(d.aiSongs)) {
      S.aiSongs = d.aiSongs;
      for (const sg of d.aiSongs) if (sg?.id) S.songCache[sg.id] = sg;
    }
    setNet(true);
    if (S.room) {
      const r = await api({ type: 'join', room: S.room });
      if (r.ok) { S.planet = r.planet; S.game = r.game; S.members = r.members || []; S.typing = r.typing || []; }
      else {
        if (r.needPass) S.passPrompt = { room: S.room, err: r.error };
        S.room = null; S.tab = 'planets'; S.typing = [];
      }
    }
    render();
  });
  es.addEventListener('me', (e) => {
    const prevGuild = S.me?.guild?.id || null;
    S.me = JSON.parse(e.data);
    if (!S.me?.guild || S.me.guild.id !== prevGuild) S.confirmDisband = false;
    topbar();
    if (S.tab === 'mail') { markMailSeen(); if ($('#maillist')) mailRefresh(); else render(); }
    else if (S.tab === 'menu') { updateMenuParts(); }
    else if (S.tab === 'social') { updateSocialParts(); }
    else if (S.tab === 'room') {
      if (stage3d) stage3d.setMembers(S.members, S.me?.name, S.me?.cargo);
      if (S.modT) { const b = $('#modbox'); if (b) b.innerHTML = modBox(); }
      if (S.showGame && !S.busy) drawGame();
    }
    updateBadges();
  });
  es.addEventListener('planets', (e) => { S.planets = JSON.parse(e.data); if (S.tab === 'planets') render(); });
  es.addEventListener('members', (e) => {
    S.members = JSON.parse(e.data);
    if (stage3d && S.tab === 'room') stage3d.setMembers(S.members, S.me?.name, S.me?.cargo);
    const op = $('.owner-planet-panel');
    if (op && S.tab === 'room') op.outerHTML = ownerPlanetHtml();
  });
  es.addEventListener('typing', (e) => {
    const d = JSON.parse(e.data);
    if (!d.room || d.room === S.room) {
      S.typing = Array.isArray(d.users) ? d.users : [];
      renderTyping();
    }
  });
  es.addEventListener('move', (e) => {
    const d = JSON.parse(e.data);
    if (d.room && d.room !== S.room) return;
    const m = S.members.find((x) => x.name === d.name);
    if (m) m.pos = { x: d.x, z: d.z, ry: d.ry };
    if (stage3d && S.tab === 'room') stage3d.setMemberPos(d.name, d.x, d.z, d.ry);
  });
  es.addEventListener('emote', (e) => {
    const d = JSON.parse(e.data);
    if (stage3d && S.tab === 'room' && d?.name) {
      stage3d.triggerEmote(d.name, d.emote, !!d.persistent);
      if (d.name === S.me?.name) {
        S.activeEmote = d.persistent ? d.emote : 'idle';
        syncEmoteBar();
      }
    }
  });
  es.addEventListener('discord', (e) => { S.discord = JSON.parse(e.data).url; });
  es.addEventListener('topics', (e) => {
    const list = JSON.parse(e.data);
    if (!Array.isArray(list)) return;
    S.topics = list;
    const activeId = document.activeElement?.id || '';
    if (S.tab === 'planets') {
      const tb = $('#topicbanner');
      if (tb) tb.outerHTML = welcomeTopicBannerHtml();
    } else if (S.tab === 'room') {
      const rt = $('#roomtopic');
      if (rt) rt.outerHTML = roomTopicBarHtml();
    } else if (S.tab === 'social' && S.socialTab === 'topics') {
      if (['nttitle', 'ntbody', 'usearch'].includes(activeId) || activeId.startsWith('treply-')) return;
      const sb = $('#socialbody');
      if (sb && S.me) sb.innerHTML = topicsBodyHtml(S.me);
    }
  });
  es.addEventListener('feedbacks', (e) => {
    const list = JSON.parse(e.data);
    if (!Array.isArray(list)) return;
    S.feedbacks = list;
    updateBadges();
    if (S.tab === 'feedback') {
      const activeId = document.activeElement?.id || '';
      if (activeId.startsWith('fbreply-') || activeId.startsWith('fbstatus-')) return;
      const sum = $('#fbsummary');
      if (sum) sum.innerHTML = feedbackSummaryHtml();
      const fl = $('#feedbacklist');
      if (fl) fl.innerHTML = feedbackListHtml();
    }
  });
  es.addEventListener('chat', (e) => addChat(JSON.parse(e.data)));
  es.addEventListener('clearchat', (e) => {
    const d = JSON.parse(e.data);
    if (!d?.room || d.room === S.room) {
      S.logs = [];
      const l = $('#log');
      if (l) l.innerHTML = '';
    }
  });
  es.addEventListener('guildchat', (e) => {
    const d = JSON.parse(e.data);
    if (!d?.msg || !S.me?.guild || S.me.guild.id !== d.guildId) return;
    if (!S.me.guild.chat) S.me.guild.chat = [];
    S.me.guild.chat.push(d.msg);
    if (S.me.guild.chat.length > 60) S.me.guild.chat = S.me.guild.chat.slice(-60);
    const gl = $('#glog');
    if (S.tab === 'social' && S.socialTab === 'guild' && gl) {
      if (gl.dataset.empty === '1') { gl.innerHTML = ''; gl.dataset.empty = '0'; }
      gl.insertAdjacentHTML('beforeend', guildChatLine(d.msg));
      gl.scrollTop = gl.scrollHeight;
    } else {
      S.unreadGuild++;
      updateBadges();
    }
  });
  es.addEventListener('unbug', async (e) => {
    const d = JSON.parse(e.data);
    S.busy = false; S.modT = null; S.passPrompt = null;
    clearFishTimers(); S.fishStage = 'idle';
    if (d.room) {
      const r = await api({ type: 'join', room: d.room });
      if (r.ok) {
        S.room = d.room; S.planet = r.planet; S.game = r.game;
        S.members = r.members || []; S.typing = r.typing || [];
      }
    }
    render();
    toast('🛠️ Personagem e jogo desbugados!');
  });
  es.addEventListener('appupdate', (e) => {
    const d = JSON.parse(e.data);
    S.apk = { ver: d.ver, note: d.note, ts: d.ts };
    if (!d.global) {
      toast('📲 Atualizando APK/App…');
      setTimeout(() => purgeApkCacheAndReload(), 350);
      return;
    }
    S.apkUpdate = d;
    renderApkBanner();
    toast(`📲 Atualização ${d.ver} disponível!`);
  });
  es.addEventListener('restarting', (e) => {
    const d = JSON.parse(e.data);
    S.busy = false;
    clearFishTimers();
    S.fishStage = 'idle';
    toast(`🔄 Servidor reiniciado${d.by ? ` por ${d.by}` : ''} — contas e guildas salvas!`);
  });
  es.addEventListener('plugkick', (e) => {
    const d = JSON.parse(e.data);
    toast(`🔌 Plugin Novatos: ${d.cargo || 'Autoridade'} não pode permanecer em ${d.from}. Movido(a) para ${d.to}.`);
  });
  es.addEventListener('staffalert', (e) => {
    const d = JSON.parse(e.data);
    if (d?.msg) toast(d.msg);
  });
  es.addEventListener('moved', async (e) => {
    const { room } = JSON.parse(e.data); const r = await api({ type: 'join', room });
    if (r.ok) {
      clearTimeout(typingStopTimer); typingActive = false; lastTypingSent = 0;
      S.room = room; S.planet = r.planet; S.game = r.game; S.members = r.members || S.members; S.typing = r.typing || []; S.showGame = false; S.unreadRoom = 0; S.tab = 'room'; render();
    }
  });
  es.onerror = async () => {
    setNet(false);
    if (es.readyState !== 2 || S.es !== es) return;
    S.tries++; if (!S.me) render(); // mostra "acordando o servidor"
    await api({ type: 'ping' }); // se a conta não existe mais, api() limpa a chave e recarrega
    setTimeout(() => { if (S.es === es) connect(); }, Math.min(8000, 2000 + S.tries * 1000));
  };
}
addEventListener('offline', () => setNet(false));
addEventListener('online', () => { if (S.key) connect(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.key && (!S.es || S.es.readyState === 2)) connect(); });

// ---------- telas ----------
function topbar() {
  const t = $('#top'); if (!t) return;
  if (!S.key || !S.me) { t.hidden = true; return; }
  t.hidden = false;
  const mState = musicPlayer.state();
  t.innerHTML = `<span class="logo">UNIVERSO</span><span class="beta">BETA</span><span class="sp"></span><span class="chip">💎 ${S.me.uc || 0} UG</span><span class="chip">🪙 ${S.me.coins} CS</span><span class="chip">⭐ ${S.me.stars}</span><button type="button" class="chip top-kebab" data-a="topoptions" aria-label="Mais opções" title="Mais opções">⋮</button>${S.showTopOptions ? `<div class="top-options"><b>⚙️ Opções do jogo</b><button type="button" class="sec w" data-a="togglemusic">${mState.playing ? '⏸️ Pausar música' : '🎵 Música do jogo'}</button><button type="button" class="sec w" data-a="toggleaudio">${spatialAudio.isMuted() ? '🔇 Ativar efeitos sonoros' : '🔊 Desativar efeitos sonoros'}</button><div class="muted">⭐ Estrelas: ${S.me.stars || 0}</div></div>` : ''}`;
}
function disposeStage3D() {
  if (stage3d) { stage3d.dispose(); stage3d = null; stageElRef = null; }
}
function disposePreview3D() {
  if (preview3d) { preview3d.dispose(); preview3d = null; previewElRef = null; }
}
function disposeModal3D() {
  if (modal3d) { modal3d.dispose(); modal3d = null; modalElRef = null; }
}
function disposeZombie3D() {
  if (zombie3d) { zombie3d.dispose(); zombie3d = null; zombieElRef = null; }
}
function disposeBowling3D() {
  if (bowling3d) { bowling3d.dispose(); bowling3d = null; bowlingElRef = null; }
}
function disposeCannon3D() {
  if (cannon3d) { cannon3d.dispose(); cannon3d = null; cannonElRef = null; }
}
function clearFishTimers() {
  clearTimeout(S.fishTimer); S.fishTimer = null;
  clearTimeout(S.fishMissTimer); S.fishMissTimer = null;
}
function disposeSoccer3D() {
  if (soccer3d) { soccer3d.dispose(); soccer3d = null; soccerElRef = null; }
}
function disposeCave3D() {
  if (cave3d) { cave3d.dispose(); cave3d = null; caveElRef = null; }
}
function disposeFishing3D() {
  clearFishTimers();
  S.fishStage = 'idle';
  if (fishing3d) { fishing3d.dispose(); fishing3d = null; fishingElRef = null; }
}
function disposeGames3D() {
  disposeZombie3D(); disposeBowling3D(); disposeCannon3D(); disposeFishing3D(); disposeCave3D(); disposeSoccer3D();
}
function sync3D() {
  const st = $('#stage');
  if (S.key && S.me && S.tab === 'room' && S.room && !S.showGame && st) {
    disposePreview3D();
    if (!stage3d || stageElRef !== st) {
      disposeStage3D();
      stageElRef = st;
      try {
        stage3d = mountStage(st, {
          planetType: S.planet?.t || 'chat',
          members: S.members,
          myName: S.me.name,
          myCargo: S.me.cargo,
          onSelectMember: (m) => {
            S.showReportPick = false;
            S.modT = { n: m.name, j: !!m.jail, cargo: m.cargo || 0, stars: m.stars || 0, guildTag: m.guildTag || null, bio: m.bio || '', nameColor: m.nameColor || null, verified: m.verified || null };
            const b = $('#modbox'); if (b) b.innerHTML = modBox();
          },
          onMove: (x, z, ry) => {
            if (S.activeEmote !== 'idle') { S.activeEmote = 'idle'; syncEmoteBar(); }
            api({ type: 'move', x, z, ry });
          },
        });
      } catch (err) {
        console.error('stage3d:', err);
        stage3d = null; stageElRef = null;
        st.innerHTML = '<div class="muted" style="padding:18px;text-align:center">Visual 3D indisponível no momento.</div>';
      }
    } else {
      stage3d.setPlanet(S.planet?.t || 'chat');
      stage3d.setMembers(S.members, S.me.name, S.me.cargo);
    }
    return;
  }
  disposeStage3D();

  const pv = $('#preview3d');
  if (pv && (!S.key || (S.tab === 'menu' && S.me))) {
    const member = !S.key ? { name: 'Você', g: S.g, char: S.char || (S.g === 'f' ? 'estrela' : 'piloto'), cargo: 0, vip: false } : S.me;
    if (!preview3d || previewElRef !== pv) {
      disposePreview3D();
      previewElRef = pv;
      try {
        preview3d = mountPreview(pv, member);
      } catch (err) {
        console.error('preview3d:', err);
        preview3d = null; previewElRef = null;
        pv.innerHTML = '<div class="muted" style="padding:18px;text-align:center">Prévia 3D indisponível no momento.</div>';
      }
    } else {
      preview3d.update(member);
    }
    return;
  }
  disposePreview3D();
}
function markMailSeen() {
  const maxTs = (S.me?.mail || []).reduce((mx, m) => Math.max(mx, m.ts || 0), S.mailSeen || 0);
  if (maxTs > S.mailSeen) { S.mailSeen = maxTs; LS.set('uc_mail_seen', String(maxTs)); }
}
function unreadMailCount() {
  if (!S.me?.mail) return 0;
  return S.me.mail.filter((m) => !m.mine && (m.ts || 0) > S.mailSeen).length;
}
function updateBadges() {
  const setB = (name, count) => {
    const el = $(`#nav [data-b="${name}"]`);
    if (!el) return;
    el.hidden = count <= 0;
    el.textContent = count > 99 ? '99+' : String(count);
  };
  const staffCount = (S.me?.cargo || 0) >= 2 ? ((S.me?.staff?.pendingCount || 0) + (S.me?.staff?.pendingVerifyCount || 0)) : 0;
  const socialCount = (S.me?.friendReqs?.length || 0) + (S.me?.guildInvites?.length || 0) + (S.tab === 'social' && S.socialTab === 'guild' && S.me?.guild ? 0 : S.unreadGuild || 0) + staffCount;
  setB('social', socialCount);
  setB('mail', S.tab === 'mail' ? 0 : unreadMailCount());
  setB('room', S.tab === 'room' && !S.showGame ? 0 : S.unreadRoom);
  const newFbCount = (S.me?.cargo || 0) >= 2 ? (S.feedbacks || []).filter((f) => f.status === 'novo').length : 0;
  setB('feedback', S.tab === 'feedback' ? 0 : newFbCount);
}
function renderTyping() {
  const names = (S.typing || []).filter((n) => n && n !== S.me?.name);
  if (stage3d && S.tab === 'room') stage3d.setTyping(names);
  const tb = $('#typingbar');
  if (!tb) return;
  if (!names.length) { tb.innerHTML = ''; return; }
  const txt = names.length === 1
    ? `${esc(names[0])} está digitando`
    : names.length === 2
      ? `${esc(names[0])} e ${esc(names[1])} estão digitando`
      : `${esc(names[0])}, ${esc(names[1])} e +${names.length - 2} estão digitando`;
  tb.innerHTML = `<span class="tdots"><i></i><i></i><i></i></span><span>${txt}</span>`;
}
function setMyTyping(on) {
  if (!S.key || !S.me || !S.room) return;
  clearTimeout(typingStopTimer);
  if (on) {
    typingStopTimer = setTimeout(() => setMyTyping(false), 2500);
    if (!typingActive || Date.now() - lastTypingSent >= 1500) {
      typingActive = true;
      lastTypingSent = Date.now();
      api({ type: 'typing', on: true });
    }
  } else if (typingActive) {
    typingActive = false;
    lastTypingSent = 0;
    api({ type: 'typing', on: false });
  }
}
function render() {
  const m = $('#main');
  try {
    topbar();
    renderApkBanner();
    if (!S.key) {
      $('#nav').hidden = true;
      disposeGames3D();
      m.innerHTML = createHtml();
      sync3D();
      return;
    }
    if (!S.me) {
      $('#nav').hidden = true;
      disposeStage3D(); disposePreview3D(); disposeGames3D();
      return (m.innerHTML = `<div id="boot"><div style="font-size:54px">🌌</div><b>UNIVERSO CHAT</b><span class="muted">${S.tries > 1 ? 'Acordando o servidor… pode levar até 1 minuto.' : 'Conectando…'}</span></div>`);
    }
    if (S.tab === 'mail') markMailSeen();
    if (S.tab === 'social' && S.socialTab === 'guild' && S.me?.guild) S.unreadGuild = 0;
    if (S.tab === 'room' && !S.showGame) S.unreadRoom = 0;
    if (S.tab !== 'room' || !S.room || S.showGame) disposeStage3D();
    if (S.tab !== 'menu') disposePreview3D();
    if (S.tab !== 'room' || !S.showGame || S.planet?.t !== 'zombie') disposeZombie3D();
    if (S.tab !== 'room' || !S.showGame || S.planet?.t !== 'bowling') disposeBowling3D();
    if (S.tab !== 'room' || !S.showGame || S.planet?.t !== 'cannon') disposeCannon3D();
    if (S.tab !== 'room' || !S.showGame || S.planet?.t !== 'fishing') disposeFishing3D();
    if (S.tab !== 'room' || !S.showGame || S.planet?.t !== 'cave') disposeCave3D();
    if (S.tab !== 'room' || !S.showGame || S.planet?.t !== 'soccer') disposeSoccer3D();
    if (S.tab !== 'room' || S.showGame) setMyTyping(false);
    $('#nav').hidden = false;
    const ownerTab = $('#owner-code-tab');
    if (ownerTab) ownerTab.hidden = (S.me?.cargo || 0) < 6;
    if (S.tab === 'ownercode' && (S.me?.cargo || 0) < 6) S.tab = 'menu';
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === S.tab));
    const v = { planets: planetsHtml, social: socialHtml, mail: mailHtml, menu: menuHtml, events: eventsHtml, feedback: feedbackHtml, room: roomHtml, ownercode: ownerCodeHtml }[S.tab] || planetsHtml;
    m.innerHTML = v();
    sync3D();
    renderTyping();
    updateBadges();
    if (S.tab === 'room') { const l = $('#log'); if (l) l.scrollTop = l.scrollHeight; if (S.showGame) drawGame(); }
    if (S.tab === 'social') {
      const gl = $('#glog'); if (gl) gl.scrollTop = gl.scrollHeight;
      if (S.socialTab === 'guild' && !S.me?.guild && S.guildList === null) loadGuildList();
    }
    if (S.tab === 'mail' && S.mailPrefill) { const mt = $('#mto'); if (mt) mt.value = S.mailPrefill; S.mailPrefill = ''; }
    if (S.tab === 'events') loadTop();
    if (S.tab === 'menu') { const b = $('#pixbox'); if (b) b.innerHTML = pixBox(); loadPix(); }
  } catch (err) { showFatal(err); }
}
function showFatal(err) {
  console.error(err);
  disposeStage3D(); disposePreview3D(); disposeGames3D();
  const m = $('#main'); if (!m) return;
  m.innerHTML = '<div id="boot"><div style="font-size:54px">😵</div><b>Algo deu errado</b><button data-a="reload" style="margin-top:12px">Recarregar</button></div>';
}
addEventListener('error', (e) => { if (!$('#main')?.firstElementChild) showFatal(e.error || e.message); });
addEventListener('unhandledrejection', (e) => { if (!$('#main')?.firstElementChild) showFatal(e.reason); });

function resetHtml() {
  const rs = S.reset;
  let body;
  if (rs.stage === 'code') {
    body = `<b>📨 Digite o código do e-mail</b>
      <div class="muted" style="margin:6px 0 10px">Enviamos um código de 6 dígitos para o e-mail da conta <b>${esc(rs.name)}</b> (veja também o spam). Ele vale 10 minutos.</div>
      <input type="text" id="rcode" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" style="letter-spacing:8px;text-align:center;font-size:22px">
      <button data-a="resetverify" class="w mt">✅ Confirmar código</button>
      <button data-a="resetrequest" class="sec w mt">📧 Reenviar código</button>`;
  } else if (rs.stage === 'newpass') {
    body = `<b>🔐 Redefinir senha</b>
      <div class="muted" style="margin:6px 0 10px">Código confirmado! Escolha a nova senha da conta <b>${esc(rs.name)}</b>.</div>
      <input type="password" id="rpass" maxlength="64" placeholder="Nova senha (mín. 4 caracteres)" autocomplete="new-password" style="margin-bottom:8px">
      <input type="password" id="rpass2" maxlength="64" placeholder="Repita a nova senha" autocomplete="new-password">
      <button data-a="resetset" class="w mt">💾 Salvar nova senha</button>`;
  } else {
    body = `<b>🔓 Esqueci minha senha</b>
      <div class="muted" style="margin:6px 0 10px">Digite o nome da sua conta. Se ela tiver um e-mail confirmado (Menu → E-mail de recuperação), enviamos um código para ele.</div>
      <input type="text" id="rname" maxlength="16" value="${esc(rs.name)}" placeholder="Nome de usuário" autocomplete="username">
      <button data-a="resetrequest" class="w mt" ${rs.busy ? 'disabled' : ''}>${rs.busy ? '⏳ Enviando…' : '📧 Enviar código por e-mail'}</button>`;
  }
  return `<div style="text-align:center;margin:16px 0 12px"><h2 style="margin:2px 0;font-size:24px;letter-spacing:2px">🌌 UNIVERSO CHAT</h2><div class="muted">Recuperar acesso à conta</div></div>
  <div class="card">${body}</div>
  <button data-a="authmode" data-m="login" class="sec w">← Voltar ao login</button>`;
}
function createHtml() {
  if (S.authMode === 'reset') return resetHtml();
  const isLogin = S.authMode === 'login';
  return `<div style="text-align:center;margin:16px 0 12px"><h2 style="margin:2px 0;font-size:24px;letter-spacing:2px">🌌 UNIVERSO CHAT</h2><div class="muted">${isLogin ? 'Entre na sua conta salva' : 'Crie seu avatar 3D e entre no universo'}</div></div>
  <div id="preview3d" class="preview3d"></div>
  <div class="grid" style="margin-bottom:10px"><button data-a="authmode" data-m="create" class="${!isLogin ? '' : 'sec'}">🆕 Criar conta</button><button data-a="authmode" data-m="login" class="${isLogin ? '' : 'sec'}">🔑 Já tenho conta</button></div>
  ${isLogin
    ? `<div class="card"><b>Entrar com nome e senha</b>
        <input type="text" id="lname" maxlength="16" placeholder="Nome de usuário" autocomplete="username" style="margin:10px 0 8px">
        <input type="password" id="lpw" maxlength="64" placeholder="Sua senha" autocomplete="current-password" style="margin-bottom:10px">
        <div class="muted" style="margin-bottom:6px">Ou cole o código da conta (se criou sem senha):</div>
        <input type="text" id="lcode" maxlength="64" placeholder="Código da conta (opcional)" autocomplete="off">
        <button data-a="login" class="w mt">🔑 Entrar na conta</button>
        <button data-a="authmode" data-m="reset" class="sec w mt">🔓 Esqueci minha senha</button></div>`
    : `<div class="card"><div class="muted">Passo ${S.step} de 2</div>
        ${S.step === 1 ? (() => {
          const starters = Object.values(CATALOG.chars).filter((c) => c.price === 0 && c.g === S.g);
          const curChar = starters.some((c) => c.id === S.char) ? S.char : starters[0]?.id;
          return `<div class="grid mt"><button data-a="gender" data-g="m" class="sec ${S.g === 'm' ? 'sel' : ''}">👦 Masculino</button><button data-a="gender" data-g="f" class="sec ${S.g === 'f' ? 'sel' : ''}">👧 Feminino</button></div>
          <div class="muted mt" style="font-size:12px">Escolha seu personagem inicial (${S.g === 'f' ? 'Feminino' : 'Masculino'}):</div>
          <div class="grid mt">${starters.map((c) => `<button data-a="pickchar" data-c="${c.id}" class="sec ${curChar === c.id ? 'sel' : ''}">${c.g === 'f' ? '👧' : '👦'} ${esc(c.name)}</button>`).join('')}</div>
          <div class="muted mt" style="text-align:center">Desbloqueie mais 10 personagens Masculinos e Femininos na Loja!</div><button data-a="next" class="w mt">Continuar</button>`;
        })()
          : `<p class="mt" style="margin-bottom:8px">Nome de usuário</p><input type="text" id="nm" maxlength="16" placeholder="3 a 16 letras ou números" autocomplete="username"><p class="mt" style="margin-bottom:8px">Senha para salvar a conta</p><input type="password" id="npw" maxlength="64" placeholder="Mínimo 4 caracteres (recomendado)" autocomplete="new-password"><button data-a="create" class="w mt">Entrar no universo</button>`}</div>`}`;
}
const discordCard = () => `<a class="discord" href="${esc(S.discord)}" target="_blank" rel="noopener noreferrer"><i>💬</i><div><b>Entre no nosso Discord</b><span>Toque para entrar na comunidade</span></div></a>`;
const divulgarCard = () => `<div class="card"><b>📣 Divulgação</b><div class="muted" style="margin:4px 0 10px">Convide seus amigos para o nosso Discord!</div>
  <div class="grid3"><a class="dbtn" href="${esc(S.discord)}" target="_blank" rel="noopener noreferrer"><i>💬</i>Entrar</a><button class="dbtn" data-a="dcopy"><i>📋</i>Copiar link</button><button class="dbtn" data-a="dshare"><i>📤</i>Compartilhar</button></div></div>`;
function primaryTopic() {
  return (S.topics || []).find((t) => t.pinned) || (S.topics || [])[0] || {
    id: 1,
    title: 'Olá! Sejam bem-vindos ao Universo Chat 3D!',
    body: 'Olá, sejam bem-vindos ao Universo Chat 3D! Se divirtam e respeitem os players.',
    authorName: 'Universo Chat 3D',
    authorCargo: 6,
    pinned: true,
    likesCount: 0,
    liked: false,
    replies: [],
  };
}
function welcomeTopicBannerHtml() {
  const tp = primaryTopic();
  const rCount = (tp.replies || []).length;
  return `<div id="topicbanner" class="topic-banner">
    <div class="row between">
      <b>📌 ${esc(tp.title)}</b>
      <span class="st-pill pin">Boas-vindas</span>
    </div>
    <div class="topic-banner-body">${esc(tp.body)}</div>
    <div class="row mt">
      <button class="${tp.liked ? '' : 'sec'}" data-a="topiclike" data-id="${tp.id}">${tp.liked ? '❤️' : '🤍'} Curtir (${tp.likesCount || 0})</button>
      <button class="sec" data-a="opentopics" data-id="${tp.id}">💬 Tópicos & Comentários (${rCount})</button>
    </div>
  </div>`;
}
function roomTopicBarHtml() {
  if (S.hideRoomTopic || S.showGame) return '';
  const tp = primaryTopic();
  return `<div id="roomtopic" class="room-topic">
    <div class="room-topic-txt">📌 <b>${esc(tp.title)}</b> — ${esc(tp.body)}</div>
  </div>`;
}
function planetsHtml() {
  const passBox = S.passPrompt ? `<div class="card"><b>🔐 Planeta protegido: ${esc(S.passPrompt.room)}</b>
    <div class="muted" style="margin:4px 0 8px">${esc(S.passPrompt.err || 'Digite a senha de entrada do planeta.')}</div>
    <div class="row"><input type="password" id="ppass" maxlength="24" placeholder="Senha do planeta" autocomplete="off" style="flex:1"><button data-a="joinpass">🔓 Entrar</button><button class="sec" data-a="cancelpass">Cancelar</button></div></div>` : '';
  return `<h2>Escolha um planeta</h2>${welcomeTopicBannerHtml()}${discordCard()}${passBox}<div class="grid">${S.planets.map((p) => `<button class="planet t-${p.t}${p.locked ? ' locked' : ''}" data-a="join" data-r="${esc(p.n)}">${p.locked ? '<span class="plock" title="Protegido por senha">🔐</span>' : ''}<span class="pi">${p.icon || ICON[p.t] || '🪐'}</span><b>${esc(p.n)}</b>${p.ownerName === S.me?.name ? '<span class="muted">👑 Meu planeta</span>' : ''}<span class="on"><span class="dot ${p.count ? '' : 'z'}"></span>${p.count}/${p.cap || 50} online</span></button>`).join('')}</div>${(S.me?.cargo || 0) >= 6 ? `<div class="card mt"><div class="row between"><div><b>📦 Baixar o jogo (.zip)</b><div class="muted">Área exclusiva do Dono</div></div><button data-a="dlzip">⬇️ .zip</button></div></div>` : ''}`;
}
function modBox() {
  if (!S.modT) return '';
  const t = S.modT;
  const isSelf = t.n.toLowerCase() === (S.me?.name || '').toLowerCase();
  const isFriend = (S.me?.friends || []).some((f) => f.name.toLowerCase() === t.n.toLowerCase());
  const g = S.me?.guild;
  const myRole = g?.leaderKey === S.me?.key ? 'leader' : (g?.officers || []).includes(S.me?.key) ? 'officer' : '';
  const inGuild = !!g && (g.members || []).some((m) => m.name.toLowerCase() === t.n.toLowerCase());
  const canInvGuild = !!myRole && !inGuild && !isSelf;
  const canModAct = (S.me?.cargo || 0) >= 2 && (t.cargo || 0) < (S.me?.cargo || 0);
  const canNovatoKick = (S.me?.cargo || 0) >= 2 && /^novato\b/i.test(S.room || '') && (t.cargo || 0) >= 1 && ((t.cargo || 0) < (S.me?.cargo || 0) || (S.me?.cargo || 0) >= 6);
  const verPill = t.verified === 'real'
    ? '<span class="ver-badge real">✅ Pessoa Real (UNIVERSO)</span>'
    : t.verified === 'fake'
      ? '<span class="ver-badge fake">🚫 Conta Fake</span>'
      : '<span class="ver-badge none">⏳ Não verificado</span>';
  return `<div class="card">
    <div class="row between"><div><b>${canModAct ? '✋' : '👤'} ${t.guildTag ? `<span class="gtag">[${esc(t.guildTag)}]</span>` : ''}<button type="button" class="name-btn" data-a="viewuser" data-n="${esc(t.n)}" style="${nameStyleAttr(t.nameColor, t.cargo)}">${esc(t.n)}</button> <span class="muted">(${CARGOS[t.cargo || 0] || 'Viajante'})</span></b>${verPill}</div><button class="sec" data-a="modx" style="padding:4px 10px">✕</button></div>
    ${t.bio ? `<div class="bio-box">📝 ${esc(t.bio)}</div>` : ''}
    <div class="row mt">
      <button data-a="viewuser" data-n="${esc(t.n)}">🪪 Ver Perfil</button>
      ${!isSelf ? (isFriend ? '<span class="muted">🤝 Já é amigo</span>' : `<button class="sec" data-a="friendaddpick" data-n="${esc(t.n)}">👥 + Amigo</button>`) : ''}
      ${canInvGuild ? `<button class="sec" data-a="guildinvpick" data-n="${esc(t.n)}">🛡️ Convidar Guilda</button>` : ''}
      ${!isSelf ? `<button class="sec" data-a="mailpick" data-n="${esc(t.n)}">✉️ Correio</button>` : ''}
      ${!isSelf ? `<button class="sec" data-a="togglereportpick">🚨 Denunciar</button>` : ''}
    </div>
    ${S.showReportPick && !isSelf ? `<div class="row mt"><input type="text" id="repreason" maxlength="180" placeholder="Motivo da denúncia" autocomplete="off" style="flex:1;min-width:130px"><button data-a="sendreportpick">Enviar</button></div>` : ''}
    ${canModAct ? `<div class="row mt">${t.j ? '<button data-a="modgo" data-k="soltar">🔓 Soltar</button>' : '<input type="text" id="mreason" maxlength="60" placeholder="Motivo (opcional)" style="flex:1;min-width:120px"><button data-a="modgo" data-k="prender">🔒 Prender</button><button class="sec" data-a="modgo" data-k="expulsar">🚪 Expulsar</button>'}</div>` : ''}
    ${canNovatoKick ? `<div class="row mt"><button class="danger" data-a="novatokickpick" data-n="${esc(t.n)}">🔌 Expulsar do Novato (tem autoridade)</button></div>` : ''}
  </div>`;
}
const ROOM_ACTIONS = [
  { id: 'wave', icon: '👋', label: 'Acenar', persistent: false, quick: true },
  { id: 'clap', icon: '👏', label: 'Aplaudir', persistent: false, quick: true },
  { id: 'dance', icon: '💃', label: 'Dançar', persistent: true, quick: true },
  { id: 'sit', icon: '🪑', label: 'Sentar', persistent: true, quick: true },
  { id: 'float', icon: '🧘', label: 'Meditar', persistent: true, quick: true },
  { id: 'sleep', icon: '😴', label: 'Deitar', persistent: true, quick: false },
  { id: 'cheer', icon: '🎉', label: 'Comemorar', persistent: false, quick: false },
  { id: 'bow', icon: '🙇', label: 'Reverência', persistent: false, quick: false },
  { id: 'laugh', icon: '😂', label: 'Rir', persistent: false, quick: false },
  { id: 'spin', icon: '🌀', label: 'Girar', persistent: false, quick: false },
];
function roomActionsHtml() {
  const cur = S.activeEmote || 'idle';
  const quickBtns = ROOM_ACTIONS.filter((a) => a.quick).map((a) => `<button type="button" class="sec ${cur === a.id ? 'on' : ''}" data-a="emote" data-e="${a.id}">${a.icon} ${a.label}</button>`).join('');
  const stopBtn = cur !== 'idle' ? `<button type="button" class="danger" data-a="emote" data-e="idle">🛑 Parar</button>` : '';
  const tray = S.showActions ? `<div class="actions-tray">${ROOM_ACTIONS.map((a) => `<button type="button" class="sec ${cur === a.id ? 'on' : ''}" data-a="emote" data-e="${a.id}">${a.icon} ${a.label}</button>`).join('')}${stopBtn}</div>` : '';
  return `<div id="emotebar" class="emote-wrap">
    <div class="emote-bar">${quickBtns}<button type="button" class="sec ${S.showActions ? 'on' : ''}" data-a="toggleactions">🎭 ${S.showActions ? 'Menos' : 'Ações'}</button>${stopBtn}</div>
    ${tray}
  </div>`;
}
function syncEmoteBar() {
  const el = $('#emotebar');
  if (el) el.outerHTML = roomActionsHtml();
}

/* ---------- menu ⋮ da sala: reúne todas as opções (ações, desbugar, jogo, tópicos, minijogo) ---------- */
function roomMenuHtml() {
  const t = S.planet?.t, game = t === 'bowling' || t === 'cannon' || t === 'zombie' || t === 'fishing' || t === 'cave' || t === 'soccer';
  const cur = S.activeEmote || 'idle', tp = primaryTopic();
  const emotes = ROOM_ACTIONS.map((a) => `<button type="button" class="sec ${cur === a.id ? 'on' : ''}" data-a="rm" data-go="emote" data-e="${a.id}"><span style="font-size:22px">${a.icon}</span>${a.label}</button>`).join('');
  const stop = cur !== 'idle' ? `<button type="button" class="danger w mt" data-a="rm" data-go="emote" data-e="idle">🛑 Parar ação</button>` : '';
  return `<div class="umodal" role="dialog" aria-modal="true" aria-label="Opções da sala">
    <div class="umodal-handle"></div>
    <div class="umodal-head"><span class="umodal-kicker">Opções · ${esc(S.room || '')}</span><button type="button" class="umodal-close" data-a="rmclose" aria-label="Fechar">✕</button></div>
    <div class="rm-sec">Ações do personagem</div>
    <div class="rm-grid">${emotes}</div>${stop}
    <div class="rm-sec">Sala</div>
    <div class="rm-list">
      ${game ? `<button type="button" class="sec" data-a="rm" data-go="togglegame">${S.showGame ? '💬 Voltar ao chat' : '🎮 Jogar'}</button>` : ''}
      ${S.me?.prison ? '<button type="button" class="sec" data-a="rm" data-go="escape">🏃 Fugir</button>' : ''}
      <button type="button" class="sec" data-a="rm" data-go="opentopics" data-id="${tp.id}">💬 Tópicos & Comentários</button>
      <button type="button" class="sec" data-a="rm" data-go="toggleroomtopic">${S.hideRoomTopic ? '📌 Mostrar aviso da sala' : '📌 Ocultar aviso da sala'}</button>
      <button type="button" class="sec" data-a="rm" data-go="unbug">🛠️ Desbugar personagem e jogo</button>
      <a class="sec rm-link" href="/neon-survivor.html" target="_blank" rel="noopener">⚡ NEON SURVIVOR — Minijogo difícil</a>
      <a class="sec rm-link" href="/escape-prisao.html" target="_blank" rel="noopener">🔐 ESCAPE DA PRISÃO 3D — Novo minijogo</a>
    </div>
  </div>`;
}
function openRoomMenu() {
  let ov = $('#rmenu');
  if (!ov) { ov = document.createElement('div'); ov.id = 'rmenu'; ov.className = 'umodal-ov'; document.body.append(ov); }
  ov.innerHTML = roomMenuHtml(); ov.hidden = false;
}
function closeRoomMenu() { const ov = $('#rmenu'); if (ov) { ov.hidden = true; ov.innerHTML = ''; } }
function ownerPlanetHtml() {
  const p = S.planets.find((x) => x.n === S.room);
  if (!p || p.ownerName !== S.me?.name) return '';
  return `<div class="card owner-planet-panel"><b>👑 Painel do dono do planeta</b><div class="muted mt">Gerencie os jogadores que estão neste planeta.</div>${(S.members || []).map((m) => `<div class="sitem"><div><b>${esc(m.name)}</b><div class="muted">⭐ ${m.stars || 0} estrelas ${m.jail ? '· 🔒 Preso' : ''}</div></div><div class="row"><button class="sec" data-a="planetplayer" data-n="${esc(m.name)}" data-k="star">⭐ +1</button><button class="sec" data-a="planetplayer" data-n="${esc(m.name)}" data-k="unstar">−⭐</button>${m.jail ? `<button data-a="planetplayer" data-n="${esc(m.name)}" data-k="release">🔓 Soltar</button>` : `<button class="danger" data-a="planetplayer" data-n="${esc(m.name)}" data-k="jail">🔒 Prender</button>`}</div></div>`).join('') || '<div class="muted mt">Nenhum jogador neste planeta.</div>'}</div>`;
}
function roomHtml() {
  if (!S.room) return `<h2>Chat</h2><div class="card muted">Entre em um planeta na aba Planetas.</div>`;
  const t = S.planet?.t, game = t === 'bowling' || t === 'cannon' || t === 'zombie' || t === 'fishing' || t === 'cave' || t === 'soccer';
  return `<div class="row between"><h2>${ICON[t] || '🪐'} ${esc(S.room)}</h2><div class="row"><button type="button" class="sec kebab" data-a="roommenu" aria-label="Opções da sala" title="Opções">⋮</button></div></div>
  ${S.showGame ? `<div id="game" class="card"></div>` : `${roomTopicBarHtml()}<div class="stage ${t}" id="stage"></div>${ownerPlanetHtml()}<div id="modbox">${modBox()}</div><div id="log">${S.logs.map(chatLine).join('')}</div><div id="typingbar" class="typingbar"></div><div class="row"><input type="text" id="msg" maxlength="200" placeholder="Mensagem, /ajuda, /sentar ou /dono" style="flex:1"><button data-a="send">Enviar</button></div>`}`;
}
const chatLine = (c) => {
  if (c.sys) return `<div class="sys">${esc(c.text).replace(/https:\/\/(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+/gi, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`)}</div>`;
  const musicBtn = c.music?.id ? ` <button type="button" class="sec" style="padding:2px 8px;font-size:11.5px;border-radius:8px;vertical-align:middle" data-a="playsong" data-sid="${esc(c.music.id)}">▶️ Ouvir</button>` : '';
  return `<div>${c.from.guildTag ? `<span class="gtag">[${esc(c.from.guildTag)}]</span>` : ''}<button type="button" class="name-btn" data-a="viewuser" data-n="${esc(c.from.name)}" style="${nameStyleAttr(c.from.nameColor, c.from.cargo)}">${c.from.vip ? '👑' : ''}${esc(c.from.name)}</button>${verBadgeHtml(c.from.verified)}: ${esc(c.text)}${musicBtn}</div>`;
};
function addChat(c) {
  if (c?.music?.id) S.songCache[c.music.id] = c.music;
  S.logs.push(c); if (S.logs.length > 80) S.logs.shift();
  if (!c.sys && c.from?.name && stage3d) stage3d.triggerChat(c.from.name, c.text);
  if (S.tab !== 'room' || S.showGame) { S.unreadRoom++; updateBadges(); }
  const l = $('#log'); if (!l) return; l.insertAdjacentHTML('beforeend', chatLine(c)); l.scrollTop = l.scrollHeight;
}
const guildChatLine = (m) => m.sys ? `<div class="sys">${esc(m.text)}</div>` : `<div><button type="button" class="name-btn" data-a="viewuser" data-n="${esc(m.from || '')}" style="${nameStyleAttr(m.nameColor, m.cargo)}">${m.role === 'leader' ? '👑 ' : m.role === 'officer' ? '⚔️ ' : ''}${esc(m.from || '')}</button>${verBadgeHtml(m.verified)}: ${esc(m.text)}</div>`;
function guildListHtml() {
  if (S.guildList === null) return '<div class="muted mt">Carregando guildas…</div>';
  if (!S.guildList.length) return '<div class="muted mt">Nenhuma guilda encontrada. Crie a primeira acima!</div>';
  return S.guildList.map((g) => `<div class="sitem">
    <div style="min-width:0"><b><span class="gtag">[${esc(g.tag)}]</span> ${esc(g.name)}</b><div class="muted">${g.desc ? esc(g.desc) + ' · ' : ''}${g.membersCount} membro(s) · 🟢 ${g.onlineCount} online</div></div>
    ${g.open ? `<button data-a="guildjoin" data-id="${esc(g.id)}">Entrar</button>` : '<span class="muted">🔒 Convite</span>'}
  </div>`).join('');
}
function friendsBodyHtml(u) {
  const reqs = u.friendReqs || [];
  const friends = u.friends || [];
  const reqHtml = reqs.length ? `<div class="card"><b>📨 Pedidos recebidos (${reqs.length})</b>${reqs.map((r) => `<div class="sitem">
    <div>${r.guildTag ? `<span class="gtag">[${esc(r.guildTag)}]</span>` : ''}<button type="button" class="name-btn" data-a="viewuser" data-n="${esc(r.name)}" style="${nameStyleAttr(r.nameColor, r.cargo)}">${r.vip ? '👑' : ''}${esc(r.name)}</button>${verBadgeHtml(r.verified)}</div>
    <div class="row"><button data-a="friendaccept" data-k="${esc(r.key)}">✅ Aceitar</button><button class="sec" data-a="friendreject" data-k="${esc(r.key)}">✕</button></div>
  </div>`).join('')}</div>` : '';
  const listHtml = `<div class="card"><b>👥 Meus amigos (${friends.length})</b>${friends.length ? friends.map((f) => `<div class="sitem">
    <div style="min-width:0">${f.guildTag ? `<span class="gtag">[${esc(f.guildTag)}]</span>` : ''}<button type="button" class="name-btn" data-a="viewuser" data-n="${esc(f.name)}" style="${nameStyleAttr(f.nameColor, f.cargo)}">${f.vip ? '👑' : ''}${esc(f.name)}</button>${verBadgeHtml(f.verified)}<div class="muted">${f.online ? `🟢 Online (${esc(f.room || 'Menu')})` : '⚪ Offline'}</div>${f.bio ? `<div class="muted" style="font-size:12px;margin-top:2px">📝 ${esc(f.bio)}</div>` : ''}</div>
    <div class="row">
      <button class="sec" data-a="viewuser" data-n="${esc(f.name)}" title="Ver informações">🪪</button>
      ${f.online && f.room ? `<button data-a="friendjoin" data-r="${esc(f.room)}">🚀 Ir até</button>` : ''}
      <button class="sec" data-a="mailpick" data-n="${esc(f.name)}">✉️</button>
      <button class="sec" data-a="friendremove" data-k="${esc(f.key)}">✕</button>
    </div>
  </div>`).join('') : '<div class="muted mt">Nenhum amigo ainda. Adicione pelo nome acima ou toque em um avatar no chat 3D!</div>'}</div>`;
  return `<div class="card"><b>➕ Adicionar amigo</b>
    <div class="muted" style="margin:4px 0 8px">Digite o nome do jogador ou use /amigo &lt;nome&gt; no chat.</div>
    <div class="row"><input type="text" id="faddname" maxlength="16" placeholder="Nome do jogador" autocomplete="off" style="flex:1"><button data-a="friendadd">Adicionar</button></div>
  </div>${reqHtml}${listHtml}
  <div class="card"><b>🚨 Denunciar jogador</b>
    <div class="muted" style="margin:4px 0 8px">Envie para análise de Moderadores e Dono (ou use /denunciar &lt;nome&gt; &lt;motivo&gt;).</div>
    <input type="text" id="repuser" maxlength="16" placeholder="Nome do jogador" autocomplete="off" style="margin-bottom:8px">
    <div class="row"><input type="text" id="repwhy" maxlength="180" placeholder="Motivo da denúncia" autocomplete="off" style="flex:1"><button data-a="sendreport">🚨 Enviar</button></div>
  </div>`;
}
function guildBodyHtml(u) {
  const g = u.guild;
  if (!g) {
    const invs = u.guildInvites || [];
    const invHtml = invs.length ? `<div class="card"><b>📩 Convites de guilda (${invs.length})</b>${invs.map((iv) => `<div class="sitem">
      <div><span class="gtag">[${esc(iv.tag)}]</span> <b>${esc(iv.name)}</b><div class="muted">${iv.memberCount || 1} membro(s)</div></div>
      <div class="row"><button data-a="guildaccept" data-id="${esc(iv.id)}">✅ Entrar</button><button class="sec" data-a="guildreject" data-id="${esc(iv.id)}">✕</button></div>
    </div>`).join('')}</div>` : '';
    return `${invHtml}<div class="card"><b>🛡️ Criar nova guilda</b>
      <div class="muted" style="margin:4px 0 8px">Una jogadores com nome, tag exclusiva e chat privado em tempo real!</div>
      <input type="text" id="gname" maxlength="20" placeholder="Nome da guilda (3 a 20 caracteres)" autocomplete="off" style="margin-bottom:8px">
      <input type="text" id="gtag" maxlength="5" placeholder="Tag (2 a 5 letras/números, ex: UNI)" autocomplete="off" style="margin-bottom:8px;text-transform:uppercase">
      <input type="text" id="gdesc" maxlength="120" placeholder="Descrição da guilda (opcional)" autocomplete="off" style="margin-bottom:8px">
      <label class="chkrow"><input type="checkbox" id="gopen" checked> Guilda aberta (qualquer jogador pode entrar)</label>
      <button data-a="guildcreate" class="w mt">🛡️ Criar Guilda</button>
    </div>
    <div class="card"><b>🌐 Explorar guildas</b>
      <div class="row mt"><input type="text" id="gsearch" maxlength="20" value="${esc(S.guildSearch)}" placeholder="Buscar por nome ou tag" autocomplete="off" style="flex:1"><button class="sec" data-a="guildsearch">🔍 Buscar</button></div>
      <div id="guildlistwrap">${guildListHtml()}</div>
    </div>`;
  }
  const myKey = u.key;
  const isLeader = g.leaderKey === myKey;
  const isOfficer = isLeader || (g.officers || []).includes(myKey);
  const chatLines = (g.chat || []).length ? g.chat.map(guildChatLine).join('') : '<div class="muted">Nenhuma mensagem no chat da guilda ainda. Diga oi!</div>';
  return `<div class="card">
    <div class="row between"><div><span class="gtag">[${esc(g.tag)}]</span> <b style="font-size:17px">${esc(g.name)}</b></div><span class="muted">${g.open ? '🌐 Aberta' : '🔒 Só convite'}</span></div>
    ${g.desc ? `<div class="muted mt">${esc(g.desc)}</div>` : ''}
    <div class="muted mt">👥 ${g.members.length} membro(s) · 🟢 ${g.members.filter((m) => m.online).length} online</div>
    <div class="row mt">
      <button class="sec" data-a="guildmanage" data-act="leave">🚪 Sair da guilda</button>
      ${isLeader ? `<button class="danger" data-a="guilddisband">${S.confirmDisband ? '⚠️ Confirmar Dissolver' : '💥 Dissolver Guilda'}</button>` : ''}
    </div>
  </div>
  <div class="card"><b>🔒 Chat Privado da Guilda</b> <span class="muted">(ou use /g msg)</span>
    <div id="glog" data-empty="${(g.chat || []).length ? '0' : '1'}">${chatLines}</div>
    <div class="row"><input type="text" id="gmsg" maxlength="220" placeholder="Mensagem privada para a guilda…" autocomplete="off" style="flex:1"><button data-a="guildsend">Enviar</button></div>
  </div>
  ${isOfficer ? `<div class="card"><b>📩 Convidar jogador</b>
    <div class="row mt"><input type="text" id="ginvname" maxlength="16" placeholder="Nome do jogador" autocomplete="off" style="flex:1"><button data-a="guildinvite">Convidar</button></div>
  </div>` : ''}
  <div class="card"><b>👥 Membros (${g.members.length})</b>${g.members.map((m) => {
    const roleBadge = m.role === 'leader' ? '<span class="role-badge leader">👑 Líder</span>' : m.role === 'officer' ? '<span class="role-badge officer">⚔️ Oficial</span>' : '<span class="role-badge">Membro</span>';
    const canKick = isOfficer && m.key !== myKey && m.role !== 'leader' && (isLeader || m.role !== 'officer');
    return `<div class="sitem">
      <div style="min-width:0"><button type="button" class="name-btn" data-a="viewuser" data-n="${esc(m.name)}" style="${nameStyleAttr(m.nameColor, m.cargo)}">${m.vip ? '👑' : ''}${esc(m.name)}</button>${verBadgeHtml(m.verified)}${roleBadge}<div class="muted">${m.online ? `🟢 Online (${esc(m.room || 'Menu')})` : '⚪ Offline'}</div></div>
      <div class="row">
        ${isLeader && m.key !== myKey && m.role === 'member' ? `<button class="sec" data-a="guildmanage" data-act="promote" data-k="${esc(m.key)}" title="Promover a Oficial">⬆️ Oficial</button>` : ''}
        ${isLeader && m.key !== myKey && m.role === 'officer' ? `<button class="sec" data-a="guildmanage" data-act="demote" data-k="${esc(m.key)}" title="Rebaixar a Membro">⬇️</button>` : ''}
        ${isLeader && m.key !== myKey ? `<button class="sec" data-a="guildmanage" data-act="transfer" data-k="${esc(m.key)}" title="Transferir liderança">👑</button>` : ''}
        ${canKick ? `<button class="sec" data-a="guildmanage" data-act="kick" data-k="${esc(m.key)}" title="Expulsar da guilda">🚪</button>` : ''}
      </div>
    </div>`;
  }).join('')}</div>
  ${isOfficer ? `<div class="card"><b>⚙️ Configurações da Guilda</b>
    <input type="text" id="geditdesc" maxlength="120" value="${esc(g.desc || '')}" placeholder="Descrição da guilda" autocomplete="off" style="margin:8px 0">
    <label class="chkrow"><input type="checkbox" id="geditopen" ${g.open ? 'checked' : ''}> Guilda aberta (entrada livre)</label>
    <button class="sec w mt" data-a="guildedit">💾 Salvar alterações</button>
  </div>` : ''}`;
}
function staffBodyHtml(u) {
  const st = u.staff || { reports: [], pendingCount: 0, novatoKick: { enabled: true, exemptOwner: true, exemptMods: false, kickedCount: 0 } };
  const plug = st.novatoKick || { enabled: true, exemptOwner: true, exemptMods: false, kickedCount: 0 };
  const all = st.reports || [];
  const list = S.repFilter === 'all' ? all : all.filter((r) => r.status === 'pendente');
  const repCards = list.length ? list.map((r) => {
    const canAct = (u.cargo || 0) > (r.targetLiveCargo || 0) || (u.cargo || 0) >= 6;
    const canPrison = (r.targetLiveCargo || 0) < 5 && (r.targetLiveCargo || 0) < (u.cargo || 0);
    const canKick = (r.targetLiveCargo || 0) < (u.cargo || 0);
    const inNovato = /^novato\b/i.test(r.targetRoom || '');
    const evHtml = (r.evidence || []).length ? `<div class="rep-ev">${r.evidence.map((m) => `<div><b>${esc(m.from)}:</b> ${esc(m.text)}</div>`).join('')}</div>` : '';
    const actHtml = r.status === 'pendente'
      ? `<input type="text" id="repnote-${r.id}" maxlength="140" placeholder="Observação da análise (opcional)" autocomplete="off" style="margin-top:8px">
         <div class="row mt">
           ${canPrison ? `<button data-a="reportreview" data-id="${r.id}" data-act="prender">🔒 Prender</button>` : ''}
           ${canKick ? `<button class="sec" data-a="reportreview" data-id="${r.id}" data-act="expulsar">🚪 Expulsar</button>` : ''}
           ${inNovato && canAct ? `<button class="danger" data-a="reportreview" data-id="${r.id}" data-act="expulsar_novato">🔌 Expulsar Novato</button>` : ''}
           <button class="sec" data-a="reportreview" data-id="${r.id}" data-act="advertir">⚠️ Advertir</button>
           <button class="sec" data-a="reportreview" data-id="${r.id}" data-act="descartar">🗑️ Descartar</button>
         </div>`
      : `<div class="muted mt">📋 Analisada por <b>${esc(r.reviewedBy || 'Staff')}</b> (${CARGOS[r.reviewedCargo || 0] || 'Staff'}) · Ação: <b>${esc(r.action || r.status)}</b>${r.reviewNote ? ` · Obs: "${esc(r.reviewNote)}"` : ''}</div>`;
    return `<div class="sitem" style="flex-direction:column;align-items:stretch">
      <div class="row between">
        <b>#${r.id} · ${esc(r.targetName)} <span class="muted">(${CARGOS[r.targetLiveCargo || 0] || 'Viajante'} · ⭐ ${r.targetStars || 0})</span></b>
        <span class="st-pill ${esc(r.status)}">${esc(r.status)}</span>
      </div>
      <div class="rep-meta">Denunciante: <b>${esc(r.reporterName)}</b> · Sala: <b>${esc(r.room)}</b> · ${r.targetOnline ? `🟢 Online (${esc(r.targetRoom || 'Menu')})` : '⚪ Offline'}${r.targetPrison ? ' · 🔒 Preso' : ''} · ${new Date(r.ts).toLocaleString('pt-BR')}</div>
      <div style="margin-top:6px"><b>Motivo:</b> ${esc(r.reason)}</div>
      ${evHtml}
      ${actHtml}
    </div>`;
  }).join('') : `<div class="muted mt">${S.repFilter === 'pendente' ? 'Nenhuma denúncia pendente no momento.' : 'Nenhuma denúncia registrada.'}</div>`;

  const allVer = st.verifications || [];
  const pendVer = st.pendingVerifyCount || 0;
  const verList = S.verFilter === 'all' ? allVer : allVer.filter((v) => v.status === 'pending');
  const verStatusLabel = { pending: 'Pendente', real: '✅ Pessoa Real', fake: '🚫 Fake', rejected: '🔄 Nova foto' };
  const verCards = verList.length ? verList.map((v) => {
    const canMarkFake = (u.cargo || 0) > (v.cargo || 0) || (u.cargo || 0) >= 6;
    const pUrl = v.photoUrl ? `${v.photoUrl}${v.photoUrl.includes('?') ? '&' : '?'}key=${encodeURIComponent(S.key || '')}` : '';
    return `<div class="sitem" style="flex-direction:column;align-items:stretch">
      <div class="row between">
        <span><b style="${nameStyleAttr(v.nameColor, v.cargo)}">${v.vip ? '👑' : ''}${esc(v.name)}</b> <span class="muted">(${CARGOS[v.cargo || 0] || 'Viajante'} · ⭐ ${v.stars || 0})</span></span>
        <span class="ver-badge ${esc(v.status)}">${verStatusLabel[v.status] || esc(v.status)}</span>
      </div>
      <div class="rep-meta">Papel esperado: <b>"UNIVERSO"</b> · ${v.online ? `🟢 Online (${esc(v.room || 'Menu')})` : '⚪ Offline'}${v.submittedAt ? ` · Enviado ${new Date(v.submittedAt).toLocaleString('pt-BR')}` : ''}</div>
      ${v.bio ? `<div class="muted" style="font-size:12px;margin-top:4px">📝 Bio: ${esc(v.bio)}</div>` : ''}
      ${pUrl ? `<img class="verify-photo" src="${esc(pUrl)}" alt="Foto de verificação de ${esc(v.name)}">` : '<div class="muted mt">Sem foto anexada.</div>'}
      ${v.reviewedBy ? `<div class="muted mt">📋 Analisado por <b>${esc(v.reviewedBy)}</b>${v.note ? ` · Obs: "${esc(v.note)}"` : ''}</div>` : ''}
      <input type="text" id="vnote-${esc(v.key)}" maxlength="140" placeholder="Observação (ex.: papel UNIVERSO legível)" autocomplete="off" style="margin-top:8px">
      <div class="row mt">
        <button data-a="verifyreview" data-k="${esc(v.key)}" data-dec="real">✅ Pessoa Real</button>
        ${canMarkFake ? `<button class="danger" data-a="verifyreview" data-k="${esc(v.key)}" data-dec="fake">🚫 Fake</button>` : ''}
        <button class="sec" data-a="verifyreview" data-k="${esc(v.key)}" data-dec="rejected">🔄 Pedir nova foto</button>
      </div>
    </div>`;
  }).join('') : `<div class="muted mt">${S.verFilter === 'pending' ? 'Nenhuma verificação pendente no momento.' : 'Nenhuma verificação registrada.'}</div>`;

  return `<div class="card">
    <div class="row between"><b>🔌 Plugin: Expulsar Autoridade dos Novatos</b><span class="st-pill ${plug.enabled ? 'on' : 'off'}">${plug.enabled ? 'ATIVO' : 'DESATIVADO'}</span></div>
    <div class="muted mt">Impede e expulsa automaticamente jogadores com autoridade (Sentinela+) dos planetas Novato · Expulsões registradas: <b>${plug.kickedCount || 0}</b></div>
    <div class="row mt">
      <button class="${plug.enabled ? 'sec' : ''}" data-a="plugnovato" data-act="toggle">${plug.enabled ? '⏸️ Desativar Plugin' : '▶️ Ativar Plugin'}</button>
      <button class="danger" data-a="plugnovato" data-act="sweep">⚡ Expulsar Autoridades Agora</button>
    </div>
    <div class="mt" style="display:flex;flex-direction:column;gap:8px">
      <label class="chkrow"><input type="checkbox" data-a="plugnovato" data-act="exemptMods" ${plug.exemptMods ? 'checked' : ''}> Isentar Moderadores/Arcontes/Arquitetos do bloqueio</label>
      ${(u.cargo || 0) >= 6 ? `<label class="chkrow"><input type="checkbox" data-a="plugnovato" data-act="exemptOwner" ${plug.exemptOwner ? 'checked' : ''}> Isentar Dono do bloqueio nos Novatos</label>` : ''}
    </div>
  </div>
  <div class="card">
    <div class="row between"><b>🪪 Verificar Contas (Real ou Fake · UNIVERSO no papel)</b><span class="muted">${pendVer} pendente(s)</span></div>
    <div class="segbar mt">
      <button class="seg ${S.verFilter === 'pending' ? 'on' : ''}" data-a="verfilter" data-f="pending">Pendentes (${pendVer})</button>
      <button class="seg ${S.verFilter === 'all' ? 'on' : ''}" data-a="verfilter" data-f="all">Todas (${allVer.length})</button>
    </div>
    <div>${verCards}</div>
  </div>
  <div class="card">
    <div class="row between"><b>🚨 Analisar Denúncias</b><span class="muted">${st.pendingCount || 0} pendente(s)</span></div>
    <div class="segbar mt">
      <button class="seg ${S.repFilter === 'pendente' ? 'on' : ''}" data-a="repfilter" data-f="pendente">Pendentes (${st.pendingCount || 0})</button>
      <button class="seg ${S.repFilter === 'all' ? 'on' : ''}" data-a="repfilter" data-f="all">Todas (${all.length})</button>
    </div>
    <div>${repCards}</div>
  </div>`;
}
function userSearchResultsHtml() {
  if (!S.userSearch) return '';
  if (S.userSearchBusy && S.userResults === null) return '<div class="muted mt">Buscando jogadores…</div>';
  const list = S.userResults || [];
  if (!list.length) return `<div class="muted mt">Nenhum jogador encontrado com "${esc(S.userSearch)}".</div>`;
  const u = S.me;
  const g = u?.guild;
  const isOfficer = !!g && (g.leaderKey === u?.key || (g.officers || []).includes(u?.key));
  return list.map((x) => {
    const friendBtn = x.isFriend
      ? '<span class="muted">🤝 Amigo</span>'
      : x.reqReceived
        ? `<button data-a="friendaddpick" data-n="${esc(x.name)}">✅ Aceitar</button>`
        : x.reqSent
          ? '<span class="muted">⏳ Enviado</span>'
          : `<button class="sec" data-a="friendaddpick" data-n="${esc(x.name)}">👥 + Amigo</button>`;
    return `<div class="sitem">
      <div style="min-width:0">
        <div>${x.guildTag ? `<span class="gtag">[${esc(x.guildTag)}]</span>` : ''}<button type="button" class="name-btn" data-a="viewuser" data-n="${esc(x.name)}" style="${nameStyleAttr(x.nameColor, x.cargo)}">${x.vip ? '👑' : ''}${esc(x.name)}</button>${verBadgeHtml(x.verified, true)} <span class="muted">(${CARGOS[x.cargo || 0] || 'Viajante'} · ⭐ ${x.stars || 0})</span></div>
        <div class="muted">${x.online ? `🟢 Online (${esc(x.room || 'Menu')})` : '⚪ Offline'}${x.prison ? ' · 🔒 Preso' : ''}</div>
        ${x.bio ? `<div class="muted" style="font-size:12px;margin-top:2px">📝 ${esc(x.bio)}</div>` : ''}
      </div>
      <div class="row">
        <button class="sec" data-a="viewuser" data-n="${esc(x.name)}" title="Ver perfil completo">🪪 Perfil</button>
        ${x.online && x.room ? `<button data-a="friendjoin" data-r="${esc(x.room)}">🚀 Ir até</button>` : ''}
        ${friendBtn}
        ${isOfficer && !x.sameGuild ? `<button class="sec" data-a="guildinvpick" data-n="${esc(x.name)}" title="Convidar para guilda">🛡️</button>` : ''}
        <button class="sec" data-a="mailpick" data-n="${esc(x.name)}" title="Enviar correio">✉️</button>
      </div>
    </div>`;
  }).join('');
}
function topicsBodyHtml(u) {
  const isStaff = (u?.cargo || 0) >= 2;
  const list = (S.topics && S.topics.length) ? S.topics : [primaryTopic()];
  const formHtml = S.showNewTopic ? `<div id="newtopicform" class="mt">
    <input type="text" id="nttitle" maxlength="60" placeholder="Título do tópico (ex.: Regras ou Boas-vindas)" autocomplete="off" style="margin-bottom:8px">
    <textarea id="ntbody" class="topic-textarea" maxlength="320" placeholder="Escreva a mensagem do tópico…"></textarea>
    ${isStaff ? `<label class="chkrow mt"><input type="checkbox" id="ntpin"> 📌 Fixar tópico no topo</label>` : ''}
    <div class="row mt">
      <button data-a="topiccreate" style="flex:1">📌 Publicar Tópico</button>
      <button class="sec" data-a="togglenewtopic">Cancelar</button>
    </div>
  </div>` : '';

  const cardsHtml = list.map((tp) => {
    const replies = tp.replies || [];
    const expanded = S.expandedTopicId === tp.id || (S.expandedTopicId === null && tp.id === list[0]?.id);
    const repliesHtml = expanded ? `<div class="topic-replies">
      ${replies.length ? replies.map((rp) => `<div class="topic-reply">
        <div class="row between">
          <span>${rp.guildTag ? `<span class="gtag">[${esc(rp.guildTag)}]</span>` : ''}<button type="button" class="name-btn" data-a="viewuser" data-n="${esc(rp.authorName)}" style="${nameStyleAttr(rp.nameColor, rp.authorCargo)}">${esc(rp.authorName)}</button>${verBadgeHtml(rp.verified)}</span>
          <div class="row">
            <span class="muted" style="font-size:11px">${new Date(rp.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            ${rp.canDelete ? `<button class="sec" data-a="topicdelreply" data-id="${tp.id}" data-rid="${esc(rp.id)}" style="padding:2px 7px;font-size:11px">✕</button>` : ''}
          </div>
        </div>
        <div style="margin-top:3px">${esc(rp.text)}</div>
      </div>`).join('') : '<div class="muted">Nenhum comentário ainda. Deixe seu olá!</div>'}
      ${(!tp.locked || isStaff) ? `<div class="row mt">
        <input type="text" id="treply-${tp.id}" maxlength="200" placeholder="Comentar neste tópico…" autocomplete="off" style="flex:1">
        <button data-a="topicreply" data-id="${tp.id}">Enviar</button>
      </div>` : '<div class="muted mt">🔒 Comentários trancados pela moderação.</div>'}
    </div>` : '';

    return `<div class="topic-card ${tp.pinned ? 'pinned' : ''}">
      <div class="row between">
        <b style="font-size:15.5px">${tp.pinned ? '📌 ' : '💬 '}${esc(tp.title)}</b>
        <div class="row">
          ${tp.pinned ? '<span class="st-pill pin">Fixado</span>' : ''}
          ${tp.locked ? '<span class="st-pill lock">Trancado</span>' : ''}
        </div>
      </div>
      <div class="rep-meta">Por ${tp.authorGuildTag ? `<span class="gtag">[${esc(tp.authorGuildTag)}]</span>` : ''}<button type="button" class="name-btn" data-a="viewuser" data-n="${esc(tp.authorName)}" style="${nameStyleAttr(tp.authorNameColor, tp.authorCargo)}">${esc(tp.authorName)}</button>${verBadgeHtml(tp.authorVerified)} (${CARGOS[tp.authorCargo || 0] || 'Viajante'}) · ${new Date(tp.ts).toLocaleString('pt-BR')}</div>
      <div class="topic-body">${esc(tp.body)}</div>
      <div class="row mt">
        <button class="${tp.liked ? '' : 'sec'}" data-a="topiclike" data-id="${tp.id}">${tp.liked ? '❤️' : '🤍'} ${tp.likesCount || 0}</button>
        <button class="sec" data-a="toggletopic" data-id="${tp.id}">💬 ${replies.length} ${expanded ? '▲' : '▼'}</button>
        ${isStaff ? `<button class="sec" data-a="topicmanage" data-act="pin" data-id="${tp.id}" title="${tp.pinned ? 'Desafixar' : 'Fixar'}">${tp.pinned ? '📍 Desafixar' : '📌 Fixar'}</button>` : ''}
        ${isStaff ? `<button class="sec" data-a="topicmanage" data-act="lock" data-id="${tp.id}" title="${tp.locked ? 'Destrancar' : 'Trancar'}">${tp.locked ? '🔓' : '🔒'}</button>` : ''}
        ${tp.canDelete && !(tp.official && (u?.cargo || 0) < 6) ? `<button class="danger" data-a="topicmanage" data-act="delete" data-id="${tp.id}" title="Apagar tópico">🗑️</button>` : ''}
      </div>
      ${repliesHtml}
    </div>`;
  }).join('');

  return `<div class="card">
    <div class="row between">
      <div><b>📌 Tópicos da Comunidade</b><div class="muted">Boas-vindas, avisos e conversas com todos os players</div></div>
      <button data-a="togglenewtopic">${S.showNewTopic ? 'Fechar' : '✍️ Novo Tópico'}</button>
    </div>
    ${formHtml}
  </div>${cardsHtml}`;
}
function socialHtml() {
  const u = S.me;
  const isStaff = (u?.cargo || 0) >= 2;
  if (!isStaff && S.socialTab === 'staff') S.socialTab = 'friends';
  const fCount = u?.friendReqs?.length || 0;
  const gCount = (u?.guildInvites?.length || 0) + (S.unreadGuild || 0);
  const sCount = isStaff ? ((u?.staff?.pendingCount || 0) + (u?.staff?.pendingVerifyCount || 0)) : 0;
  const tCount = (S.topics || []).length;
  return `<h2>👥 Social</h2>
  <div class="card"><b>🔍 Buscar usuários</b>
    <div class="row mt">
      <input type="text" id="usearch" maxlength="16" value="${esc(S.userSearch)}" placeholder="Digite o nome do jogador…" autocomplete="off" style="flex:1">
      <button id="usearchclr" class="sec" data-a="usersearchclear" title="Limpar busca" ${S.userSearch ? '' : 'hidden'}>✕</button>
      <button data-a="usersearch">Buscar</button>
    </div>
    <div id="usearchlist">${userSearchResultsHtml()}</div>
  </div>
  <div class="segbar" style="margin-bottom:12px">
    <button class="seg ${S.socialTab === 'friends' ? 'on' : ''}" data-a="socialtab" data-t="friends">🤝 Amigos${fCount ? ` (${fCount})` : ''}</button>
    <button class="seg ${S.socialTab === 'guild' ? 'on' : ''}" data-a="socialtab" data-t="guild">🛡️ Guilda${gCount ? ` (${gCount})` : ''}</button>
    <button class="seg ${S.socialTab === 'topics' ? 'on' : ''}" data-a="socialtab" data-t="topics">📌 Tópicos${tCount ? ` (${tCount})` : ''}</button>
    ${isStaff ? `<button class="seg ${S.socialTab === 'staff' ? 'on' : ''}" data-a="socialtab" data-t="staff">🛡️ Staff${sCount ? ` (${sCount})` : ''}</button>` : ''}
  </div>
  <div id="socialbody">${S.socialTab === 'guild' ? guildBodyHtml(u) : S.socialTab === 'topics' ? topicsBodyHtml(u) : (S.socialTab === 'staff' && isStaff) ? staffBodyHtml(u) : friendsBodyHtml(u)}</div>`;
}
function updateSocialParts() {
  if (S.tab !== 'social' || !S.me) return;
  const activeId = document.activeElement?.id || '';
  if (['usearch', 'nttitle', 'ntbody', 'gname', 'gtag', 'gdesc', 'gmsg', 'faddname', 'ginvname', 'geditdesc', 'gsearch', 'repuser', 'repwhy', 'repreason'].includes(activeId) || activeId.startsWith('repnote-') || activeId.startsWith('vnote-') || activeId.startsWith('treply-')) return;
  render();
}
const mailUid = (x, idx = 0) => String(x?.id ?? `${x?.ts ?? 0}_${idx}`);
// ---- Correio no estilo de conversas (uma linha por pessoa) ----
const mailKey = (name) => (name ? String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() : '__sys');
const MAIL_BASE = (() => { let b = Number(LS.get('uc_mail_base')); if (!b) { b = Date.now(); LS.set('uc_mail_base', String(b)); } return b; })();
const mailReadTs = (k) => S.mailRead[k] ?? MAIL_BASE;
function mailMarkRead(k, ts) {
  if ((S.mailRead[k] || 0) >= ts) return;
  S.mailRead[k] = ts; LS.set('uc_mail_read', JSON.stringify(S.mailRead));
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function mailDay(ts) {
  const d = new Date(ts), n = new Date();
  const same = (x, y) => x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
  if (same(d, n)) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const ontem = new Date(n); ontem.setDate(n.getDate() - 1);
  if (same(d, ontem)) return 'Ontem';
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== n.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
const mailAvatar = (name, sys) => {
  if (sys) return '<div class="pv-av" style="background:#243055">🔔</div>';
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<div class="pv-av" style="background:hsl(${h} 55% 38%)">${esc(String(name).trim().charAt(0).toUpperCase() || '?')}</div>`;
};
const mailPreview = (x) => {
  const body = x.voice || x.audioDur ? `🎤 Áudio${x.txt ? ' · ' + x.txt : ''}` : (x.txt || '');
  return (x.mine ? 'Você: ' : '') + body;
};
function mailConvos() {
  const map = new Map();
  for (const x of (Array.isArray(S.me?.mail) ? S.me.mail : [])) {
    const name = x.from || x.to || '';
    const k = mailKey(name);
    let c = map.get(k);
    if (!c) { c = { k, name: name || 'Sistema', sys: !name, msgs: [], unread: 0 }; map.set(k, c); }
    c.msgs.push(x);
    if (!x.mine && (x.ts || 0) > mailReadTs(k)) c.unread++;
  }
  return [...map.values()].sort((p, q) => (q.msgs.at(-1).ts || 0) - (p.msgs.at(-1).ts || 0));
}
const mailList = () => {
  if (S.mailThread) {
    const c = mailConvos().find((z) => z.k === S.mailThread);
    const msgs = c ? c.msgs : [];
    if (c) mailMarkRead(c.k, msgs.at(-1).ts || 0);
    if (!msgs.length) return '<div class="card muted">Ainda não há mensagens. Escreva a primeira abaixo.</div>';
    let lastDay = '', out = '';
    for (const x of msgs) {
      const day = new Date(x.ts).toDateString();
      if (day !== lastDay) { lastDay = day; out += `<div class="pv-day">${esc(mailDay(x.ts).includes(':') ? 'Hoje' : mailDay(x.ts))}</div>`; }
      const audio = x.voice
        ? `<div class="pv-audio"><audio controls preload="none" src="/voice/${esc(x.voice.id)}?key=${encodeURIComponent(S.key)}"></audio> <span class="muted">${x.voice.dur}s</span></div>`
        : x.audioDur ? `<div class="pv-audio muted">🎤 Áudio enviado (${x.audioDur}s)</div>` : '';
      out += `<div class="pv-b ${x.mine ? 'me' : 'them'}">${x.txt ? `<div>${esc(x.txt)}</div>` : ''}${audio}<span class="pv-t">${new Date(x.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>`;
    }
    return out;
  }
  const convos = mailConvos();
  if (!convos.length) return '<div class="card muted">Nenhuma conversa ainda. Toque no ✏️ para escrever para alguém.</div>';
  return convos.map((c) => {
    const last = c.msgs.at(-1);
    return `<div class="pv-row" data-a="mailopen" data-n="${esc(c.sys ? '' : c.name)}">
      ${mailAvatar(c.name, c.sys)}
      <div class="pv-mid"><div class="pv-name">${c.sys ? 'Notificações' : esc(c.name)}</div><div class="pv-prev${c.unread ? ' un' : ''}">${esc(mailPreview(last))}</div></div>
      <div class="pv-side"><span class="pv-time">${esc(mailDay(last.ts))}</span>${c.unread ? `<span class="pv-dot">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}</div>
    </div>`;
  }).join('');
};
function mailRefresh() {
  const l = $('#maillist'); if (!l) return;
  l.innerHTML = mailList();
  if (S.mailThread) l.lastElementChild?.scrollIntoView({ block: 'end' });
}
const voiceInfo = () => { const e = $('#vinfo'); if (e) e.innerHTML = S.voice ? `🎤 Áudio pronto (${Math.round(S.voice.dur)}s) <button class="sec" data-a="delvoice">✕</button>` : ''; };
const mailComposer = (withTo) => `<div class="pv-compose">
    ${withTo ? '<input type="text" id="mto" maxlength="16" placeholder="Nome do jogador" autocomplete="off">' : `<input type="hidden" id="mto" value="${esc(S.mailThreadName)}">`}
    <div class="row"><input type="text" id="mtxt" maxlength="200" placeholder="Mensagem..." autocomplete="off" style="flex:1"><button id="mic" class="${S.rec ? 'rec' : 'sec'}" data-a="mic">${S.rec ? '⏹ Parar' : '🎤 Gravar'}</button><button data-a="sendmail">Enviar</button></div>
    <div id="vinfo" class="muted">${S.voice ? `🎤 Áudio pronto (${Math.round(S.voice.dur)}s) <button class="sec" data-a="delvoice">✕</button>` : ''}</div>
  </div>`;
function mailHtml() {
  if (S.mailThread) {
    const sys = S.mailThread === '__sys';
    return `<div class="pv-head"><button class="sec" data-a="mailback">←</button>${mailAvatar(S.mailThreadName, sys)}<b class="pv-name">${sys ? 'Notificações' : esc(S.mailThreadName)}</b></div>
    <div id="maillist" class="pv-thread">${mailList()}</div>
    ${sys ? '' : mailComposer(false)}`;
  }
  return `<h2>✉️ Correio</h2>
  ${S.mailCompose ? `<div class="card"><b>Nova mensagem</b><div class="mt"></div>${mailComposer(true)}</div>` : ''}
  <div id="maillist">${mailList()}</div>
  <button class="pv-fab" data-a="mailnew" title="Nova mensagem">${S.mailCompose ? '✕' : '✏️'}</button>`;
}
const gLabel = (g) => g === 'f' ? 'Feminino' : g === 'm' ? 'Masculino' : 'Unissex';
const ownsItem = (u, kind, id) => {
  if (kind === 'char') return (u.unlockedChars || ['piloto', 'estrela']).includes(id) || CATALOG.chars[id]?.price === 0;
  if (kind === 'roupa') return u.items.some((x) => x.id === 'roupa:' + id || x.outfitId === id);
  if (kind === 'traje') return u.items.some((x) => x.id === 'traje:' + id || x.trajeId === id);
  if (kind === 'acessorio') return u.items.some((x) => x.id === 'acessorio:' + id || x.accId === id);
  if (kind === 'aura') return u.items.some((x) => x.id === 'aura:' + id || x.auraId === id);
  return false;
};
const menuStatsHtml = (u) => {
  const inv = u.inv;
  const chName = CATALOG.chars[u.char]?.name || (u.g === 'f' ? 'Viajante Estelar' : 'Piloto Estelar');
  const trName = u.traje ? (CATALOG.trajes[u.traje]?.name || u.traje) : null;
  const acName = u.acc ? (CATALOG.accessories[u.acc]?.name || u.acc) : null;
  const auName = u.aura ? (CATALOG.auras[u.aura]?.name || u.aura) : null;
  return `${CARGOS[u.cargo]}${u.vip ? ' • VIP' : ''} · ${esc(chName)} (${gLabel(u.g)})<br>💎 ${u.uc || 0} UniGemas · ⭐ ${u.stars} estrelas · 🪙 ${u.coins} Cosmos${trName ? `<br>🎭 Traje: <b>${esc(trName)}</b>` : ''}${acName ? `${trName ? ' · ' : '<br>'}✨ Acessório: <b>${esc(acName)}</b>` : ''}${auName ? `<br>🌀 Aura: <b>${esc(auName)}</b>` : ''}<br>🎁 ${u.chests} baú(s) · 🗝️ ${inv.chave || 0} chave(s) · 🎳 ${u.best.bowling} · 💥 ${u.best.cannon} · 🧟 ${u.best.zumbi || 0} · 🎣 ${u.best.fishing || 0}${u.bio ? `<div class="bio-box">📝 ${esc(u.bio)}</div>` : ''}`;
};
function menuProfileHtml(u) {
  const curColor = u.nameColor || '';
  const bioVal = u.bio || '';
  return `<b>🎨 Biografia & Cor do Nome no Chat</b>
  <div class="name-preview">${u.guild?.tag ? `<span class="gtag">[${esc(u.guild.tag)}]</span>` : ''}<b style="${nameStyleAttr(curColor, u.cargo)}">${u.vip ? '👑' : ''}${esc(u.name)}</b>${verBadgeHtml(u.verified, true)}: <span class="muted">Olá, Universo Chat 3D!</span></div>
  <div class="muted mt">Cor de destaque no chat:</div>
  <div class="color-swatches">${NAME_COLORS.map((c) => {
    const sel = curColor === c.hex;
    const bg = c.hex || COR[u.cargo || 0];
    return `<button type="button" class="color-swatch ${sel ? 'sel' : ''}" data-a="picknamecolor" data-c="${esc(c.hex)}" title="${esc(c.name)}" style="background:${c.hex ? bg : `linear-gradient(135deg,${bg},#1e293b)`}">${c.hex ? (sel ? '✓' : '') : '★'}</button>`;
  }).join('')}</div>
  <div class="row between mt" style="margin-bottom:6px"><b>📝 Biografia pessoal</b><span id="biolen" class="muted">${bioVal.length}/160</span></div>
  <textarea id="biopick" class="topic-textarea" maxlength="160" placeholder="Conte um pouco sobre você para os jogadores…">${esc(bioVal)}</textarea>
  <div class="row mt">
    <button data-a="saveprofile" style="flex:1">💾 Salvar Biografia</button>
    ${bioVal ? '<button class="sec" data-a="clearbio">Limpar</button>' : ''}
  </div>`;
}
function menuVerifyHtml(u) {
  const vf = u.verify || { status: 'none', note: '', photoUrl: null };
  const statusMap = {
    none: { cls: 'none', txt: '⏳ Não verificado' },
    pending: { cls: 'pending', txt: '🕒 Em análise pela moderação' },
    real: { cls: 'real', txt: '✅ Pessoa Real Verificada' },
    fake: { cls: 'fake', txt: '🚫 Marcado como Fake' },
    rejected: { cls: 'rejected', txt: '🔄 Envie nova foto' },
  };
  const st = statusMap[vf.status] || statusMap.none;
  const savedPhoto = vf.photoUrl ? `${vf.photoUrl}${vf.photoUrl.includes('?') ? '&' : '?'}key=${encodeURIComponent(S.key || '')}` : '';
  const draft = S.verifyDraft;
  return `<div class="row between"><b>🪪 Verificação Real ou Fake</b><span class="ver-badge ${st.cls}">${st.txt}</span></div>
  <div class="muted mt">Prove que você é uma pessoa real (e não fake): escreva <b>UNIVERSO</b> bem visível em uma folha de papel e envie uma foto segurando o papel.</div>
  <div class="paper-demo"><b>UNIVERSO</b><span>Exemplo do que escrever no papel (nick opcional: ${esc(u.name)})</span></div>
  ${vf.note ? `<div class="bio-box" style="margin-top:8px">📋 Moderação (${esc(vf.reviewedBy || 'Staff')}): ${esc(vf.note)}</div>` : ''}
  ${vf.status === 'real'
    ? `<div class="muted mt">✅ Sua conta já possui o selo <b>Pessoa Real</b> visível no chat, no palco 3D e na busca de jogadores!</div>`
    : `<input type="file" id="vphotocam" accept="image/*" capture="user" hidden>
       <input type="file" id="vphotofile" accept="image/*" hidden>
       <div class="row mt">
         <button class="sec" style="flex:1" data-a="pickvcam">📷 Tirar Foto</button>
         <button class="sec" style="flex:1" data-a="pickvfile">🖼️ Galeria / Arquivo</button>
       </div>
       ${draft ? `<img class="verify-photo" src="${esc(draft.previewUrl)}" alt="Prévia da foto com papel UNIVERSO">
         <label class="chkrow mt"><input type="checkbox" id="vconfirm"> Confirmo que o nome "UNIVERSO" está legível no papel</label>
         <div class="row mt">
           <button data-a="verifysubmit" style="flex:1">📤 Enviar para Verificação</button>
           <button class="sec" data-a="clearvphoto">✕</button>
         </div>`
         : (savedPhoto ? `<img class="verify-photo" src="${esc(savedPhoto)}" alt="Última foto enviada">` : '')}`}`;
}
const AUTH_DESC = [
  'Anel estelar sutil atrás das costas (aparece a partir de 1 ⭐)',
  'Anel Sentinela esmeralda + 2 lâminas de guarda atrás do personagem',
  'Halo duplo ciano + 4 lâminas energéticas de Comandante',
  'Selo rúnico hexagonal violeta + asas arcanas e núcleo cristalino',
  'Halo solar dourado + 6 raios celestiais atrás do personagem',
  'Mandala cósmica dupla magenta/ciano + 6 lâminas prismáticas',
  'Resplendor Supremo do Dono: coroa solar vermelho-ouro + 8 lâminas reais',
];
function menuBagHtml(u) {
  const tabs = [
    ['chars', 'Personagens'],
    ['roupas', 'Roupas'],
    ['trajes', 'Trajes'],
    ['acessorios', 'Acessórios'],
    ['auras', '✨ Auras'],
    ['autoridade', '👑 Autoridade'],
    ['pets', 'Pets'],
    ['tools', 'Ferramentas'],
  ];
  const bar = `<div class="segbar">${tabs.map(([id, lbl]) => `<button class="seg ${S.bagTab === id ? 'on' : ''}" data-a="bagtab" data-t="${id}">${lbl}</button>`).join('')}</div>`;
  let body = '';
  if (S.bagTab === 'chars') {
    const owned = Object.values(CATALOG.chars).filter((c) => ownsItem(u, 'char', c.id) && (S.genderFilter === 'all' || c.g === S.genderFilter));
    const gfBar = `<div class="segbar" style="margin-bottom:8px">${[['all', 'Todos'], ['m', '👦 Masculino'], ['f', '👧 Feminino']].map(([gf, lbl]) => `<button class="seg ${S.genderFilter === gf ? 'on' : ''}" data-a="gfilter" data-f="${gf}">${lbl}</button>`).join('')}</div>`;
    body = gfBar + `<div class="cgrid">${owned.map((c) => {
      const on = (u.char || (u.g === 'f' ? 'estrela' : 'piloto')) === c.id;
      return `<div class="citem ${on ? 'on' : ''}"><b>${c.g === 'f' ? '👧' : '👦'} ${esc(c.name)}</b><span class="muted">${gLabel(c.g)} · ${esc(c.desc)}</span><button class="${on ? '' : 'sec'} w" data-a="equip" data-id="char:${c.id}">${on ? 'Equipado' : 'Usar personagem'}</button></div>`;
    }).join('')}</div>`;
  } else if (S.bagTab === 'roupas') {
    const list = u.items.filter((i) => i.type === 'roupa');
    body = list.length ? `<div class="cgrid">${list.map((i) => {
      const val = i.outfitId || i.color;
      const on = u.outfit === val;
      return `<div class="citem ${on ? 'on' : ''}"><div class="row"><span class="swatch" style="background:${esc(i.color || '#3b82f6')}"></span><b>${esc(i.name)}</b></div><button class="${on ? '' : 'sec'} w" data-a="equip" data-id="${esc(i.id)}">${on ? 'Tirar roupa' : 'Vestir'}</button></div>`;
    }).join('')}</div>` : '<div class="muted">Nenhuma roupa na mochila ainda. Compre na Loja abaixo ou abra baús!</div>';
  } else if (S.bagTab === 'trajes') {
    const list = u.items.filter((i) => i.type === 'traje');
    body = list.length ? `<div class="cgrid">${list.map((i) => {
      const on = u.traje === i.trajeId;
      return `<div class="citem ${on ? 'on' : ''}"><b>🎭 ${esc(i.name)}</b><button class="${on ? '' : 'sec'} w" data-a="equip" data-id="${esc(i.id)}">${on ? 'Remover traje' : 'Vestir traje'}</button></div>`;
    }).join('')}</div>` : '<div class="muted">Nenhum traje adquirido ainda. Confira os trajes na Loja!</div>';
  } else if (S.bagTab === 'acessorios') {
    const list = u.items.filter((i) => i.type === 'acessorio');
    body = list.length ? `<div class="cgrid">${list.map((i) => {
      const on = u.acc === i.accId;
      return `<div class="citem ${on ? 'on' : ''}"><b>${i.emoji || '✨'} ${esc(i.name)}</b><button class="${on ? '' : 'sec'} w" data-a="equip" data-id="${esc(i.id)}">${on ? 'Remover' : 'Equipar'}</button></div>`;
    }).join('')}</div>` : '<div class="muted">Nenhum acessório ainda. Veja óculos, coroa, capa e asas na Loja!</div>';
  } else if (S.bagTab === 'auras') {
    const list = u.items.filter((i) => i.type === 'aura');
    body = list.length ? `<div class="cgrid">${list.map((i) => {
      const on = u.aura === i.auraId;
      return `<div class="citem ${on ? 'on' : ''}"><div class="row"><span class="swatch" style="background:${esc(i.color || '#22d3ee')}"></span><b>${i.emoji || '🌀'} ${esc(i.name)}</b></div><button class="${on ? '' : 'sec'} w" data-a="equip" data-id="${esc(i.id)}">${on ? 'Desativar aura' : 'Ativar aura'}</button></div>`;
    }).join('')}</div>` : '<div class="muted">Nenhuma skin de aura ainda. Compre na aba ✨ Auras da Loja ou ganhe em baús!</div>';
  } else if (S.bagTab === 'autoridade') {
    const c = Math.min(6, Math.max(0, Number(u.cargo) || 0));
    const shown = u.showAuth !== false;
    const progress = c === 0 ? `<div class="muted mt">⭐ Estrelas: <b>${u.stars || 0}/10</b> para subir automaticamente para <b>Sentinela</b>!</div>` : `<div class="muted mt">⭐ ${u.stars || 0} estrela(s) orbitando seu selo de autoridade atrás do personagem.</div>`;
    body = `<div class="bio-box">
      <div class="row between"><b>👑 Símbolo atrás do personagem: <span style="color:${COR[c]}">${esc(CARGOS[c])}</span></b><span class="st-pill ${shown ? 'on' : 'off'}">${shown ? 'VISÍVEL' : 'OCULTO'}</span></div>
      <div class="muted mt">${esc(AUTH_DESC[c] || AUTH_DESC[0])}</div>
      ${progress}
      <div class="row mt">
        <button class="${shown ? 'sec' : ''}" data-a="toggleauth">${shown ? '🙈 Ocultar símbolo 3D' : '👁️ Mostrar atrás do personagem'}</button>
        <button class="sec" data-a="previewmyavatar">↩ Meu avatar</button>
      </div>
    </div>
    <div class="muted mt" style="margin-bottom:6px">Pré-visualizar níveis de autoridade no modelo 3D acima (gire para ver atrás):</div>
    <div class="cgrid">${CARGOS.map((nm, idx) => `<div class="citem ${c === idx ? 'on' : ''}">
      <div class="row"><span class="swatch" style="background:${COR[idx]}"></span><b>${esc(nm)}</b></div>
      <span class="muted">${esc(AUTH_DESC[idx])}</span>
      <button class="sec w" data-a="previewauth" data-c="${idx}">🧍 Testar no 3D</button>
    </div>`).join('')}</div>`;
  } else if (S.bagTab === 'pets') {
    const list = u.items.filter((i) => i.type === 'pet');
    body = list.length ? `<div class="row">${list.map((i) => `<button class="sec ${i.emoji === u.pet ? 'sel' : ''}" data-a="equip" data-id="${esc(i.id)}">${i.emoji || '🐾'} ${esc(i.name)}</button>`).join('')}</div>` : '<div class="muted">Nenhum pet ainda. Abra baús para conseguir pets!</div>';
  } else {
    const tools = u.tools || [];
    body = tools.length ? `<div class="cgrid">${tools.map((t) => `<div class="citem"><b>${t.type === 'pa_fuga' ? '🟣 Pá Lendária' : '🥄 Colher de Fuga'}</b><span class="muted">Durabilidade: ${t.durability}/${t.maxDurability} · ${t.type === 'pa_fuga' ? '100% de chance de escapar' : '20% de chance por tentativa'}</span></div>`).join('')}</div>` : '<div class="muted">Você ainda não tem ferramentas de fuga.</div>';
  }
  return bar + '<div class="mt">' + body + '</div>';
}
function menuShopHtml(u) {
  const tabs = [
    ['trajes', 'Trajes'],
    ['roupas', 'Roupas'],
    ['acessorios', 'Acessórios'],
    ['auras', '✨ Auras'],
    ['fuga', 'Fuga'],
    ['ug', '💎 UniGemas'],
    ['chars', 'Personagens'],
    ['equip', 'Jogos'],
  ];
  const bar = `<div class="segbar">${tabs.map(([id, lbl]) => `<button class="seg ${S.shopTab === id ? 'on' : ''}" data-a="shoptab" data-t="${id}">${lbl}</button>`).join('')}</div>`;
  const gFilterBar = (S.shopTab === 'roupas' || S.shopTab === 'chars')
    ? `<div class="segbar mt">${[['all', 'Todos'], ['m', 'Masculino'], ['f', 'Feminino']].map(([gf, lbl]) => `<button class="seg ${S.genderFilter === gf ? 'on' : ''}" data-a="gfilter" data-f="${gf}">${lbl}</button>`).join('')}</div>`
    : '';
  let body = '';
  if (S.shopTab === 'trajes') {
    const trajes = Object.values(CATALOG.trajes);
    const feat = trajes.find((t) => t.featured);
    const rest = trajes.filter((t) => !t.featured);
    const featOwned = feat && ownsItem(u, 'traje', feat.id);
    const featOn = feat && u.traje === feat.id;
    const featCard = feat ? `<div class="feat-card ${featOn ? 'on' : ''}">
      <div class="feat-img-wrap">
        <img src="${esc(feat.img)}" alt="${esc(feat.name)}" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="feat-fallback" style="display:none"><span>🐰⭐🐾</span></div>
      </div>
      <div class="feat-body">
        <div class="muted">Destaque da Loja · Traje Completo</div>
        <b>${esc(feat.name)}</b>
        <div class="muted">${esc(feat.desc)}</div>
        <div class="row mt" style="gap:6px;flex-wrap:wrap">
          <button class="sec" data-a="previewbunny">🧍 Ver modelo 3D</button>
          <button class="sec" data-a="previewmyavatar">↩ Meu avatar</button>
        </div>
        <div class="row between mt">
          <b>🪙 ${feat.price} Cosmos</b>
          ${featOwned
            ? `<button class="${featOn ? '' : 'sec'}" data-a="equip" data-id="traje:${feat.id}">${featOn ? 'Equipado' : 'Vestir'}</button>`
            : `<button data-a="buycosmetic" data-kind="traje" data-id="${feat.id}">Comprar</button>`}
        </div>
      </div>
    </div>` : '';
    const otherCards = `<div class="cgrid mt">${rest.map((t) => {
      const own = ownsItem(u, 'traje', t.id), on = u.traje === t.id;
      return `<div class="citem ${on ? 'on' : ''}"><b>🎭 ${esc(t.name)}</b><span class="muted">${esc(t.desc)}</span><div class="row between mt"><span>🪙 ${t.price} CS</span><div class="row"><button class="sec" data-a="previewcosmetic" data-kind="traje" data-id="${t.id}" title="Testar no 3D">👁️</button>${own ? `<button class="${on ? '' : 'sec'}" data-a="equip" data-id="traje:${t.id}">${on ? 'Equipado' : 'Vestir'}</button>` : `<button data-a="buycosmetic" data-kind="traje" data-id="${t.id}">Comprar</button>`}</div></div></div>`;
    }).join('')}</div>`;
    body = featCard + otherCards;
  } else if (S.shopTab === 'roupas') {
    const list = Object.values(CATALOG.outfits).filter((o) => S.genderFilter === 'all' || o.g === S.genderFilter || o.g === 'u');
    body = `<div class="cgrid">${list.map((o) => {
      const own = ownsItem(u, 'roupa', o.id), on = u.outfit === o.id;
      return `<div class="citem ${on ? 'on' : ''}"><div class="row"><span class="swatch" style="background:${esc(o.color)}"></span><b>${esc(o.name)}</b></div><span class="muted">${gLabel(o.g)} · 🪙 ${o.price} Cosmos</span><div class="row mt"><button class="sec" data-a="previewcosmetic" data-kind="roupa" data-id="${o.id}" title="Testar no 3D">👁️</button>${own ? `<button class="${on ? '' : 'sec'}" style="flex:1" data-a="equip" data-id="roupa:${o.id}">${on ? 'Equipada' : 'Vestir'}</button>` : `<button style="flex:1" data-a="buycosmetic" data-kind="roupa" data-id="${o.id}">Comprar</button>`}</div></div>`;
    }).join('')}</div>`;
  } else if (S.shopTab === 'acessorios') {
    body = `<div class="cgrid">${Object.values(CATALOG.accessories).map((ac) => {
      const own = ownsItem(u, 'acessorio', ac.id), on = u.acc === ac.id;
      return `<div class="citem ${on ? 'on' : ''}"><b>${ac.emoji} ${esc(ac.name)}</b><span class="muted">${esc(ac.desc)}</span><div class="row between mt"><span>🪙 ${ac.price} CS</span><div class="row"><button class="sec" data-a="previewcosmetic" data-kind="acessorio" data-id="${ac.id}" title="Testar no 3D">👁️</button>${own ? `<button class="${on ? '' : 'sec'}" data-a="equip" data-id="acessorio:${ac.id}">${on ? 'Equipado' : 'Usar'}</button>` : `<button data-a="buycosmetic" data-kind="acessorio" data-id="${ac.id}">Comprar</button>`}</div></div></div>`;
    }).join('')}</div>`;
  } else if (S.shopTab === 'auras') {
    body = `<div class="cgrid">${Object.values(CATALOG.auras).map((au) => {
      const own = ownsItem(u, 'aura', au.id), on = u.aura === au.id;
      return `<div class="citem ${on ? 'on' : ''}"><div class="row"><span class="swatch" style="background:${esc(au.color)}"></span><b>${au.emoji} ${esc(au.name)}</b></div><span class="muted">${esc(au.desc)}</span><div class="row between mt"><span>🪙 ${au.price} CS</span><div class="row"><button class="sec" data-a="previewcosmetic" data-kind="aura" data-id="${au.id}" title="Testar no 3D">👁️</button>${own ? `<button class="${on ? '' : 'sec'}" data-a="equip" data-id="aura:${au.id}">${on ? 'Equipada' : 'Ativar'}</button>` : `<button data-a="buycosmetic" data-kind="aura" data-id="${au.id}">Comprar</button>`}</div></div></div>`;
    }).join('')}</div>`;
  } else if (S.shopTab === 'fuga') {
    body = `<div class="cgrid"><div class="citem"><b>🥄 Colher de Fuga</b><span class="muted">Comum · 20% de chance de escapar · 5 usos de durabilidade</span><button class="w" data-a="buy" data-i="colher_fuga">Comprar — 🪙 20 Cosmos</button></div><div class="citem"><b>🟣 Pá Lendária</b><span class="muted">Lendária · 100% de chance de escapar · 1 uso</span><button class="w" data-a="buy" data-i="pa_fuga">Comprar — 🪙 100 Cosmos</button></div></div>`;
  } else if (S.shopTab === 'ug') {
    const card = (kind, id, x, extra) => {
      const own = kind === 'pet' && u.items.some((i) => i.id === 'pet:' + id);
      return `<div class="citem"><b>${x.emoji} ${esc(x.name)}</b><span class="muted">${extra}</span><div class="row between mt"><span>💎 ${x.price} UG</span>${own ? '<span class="muted">✅ Seu</span>' : `<button data-a="buyug" data-kind="${kind}" data-id="${id}">Comprar</button>`}</div></div>`;
    };
    body = `<p class="muted">Você tem 💎 <b>${u.uc || 0} UG</b>. Recarregue em Menu → Recarga.</p>
      <b>🐾 Pets Super Épicos</b><div class="cgrid mt">${Object.entries(UG_SHOP.pet).map(([id, x]) => card('pet', id, x, 'Super épico · te segue em todos os planetas')).join('')}</div>
      <b class="mt" style="display:block">🪐 Planetas Pessoais</b><div class="cgrid mt">${Object.entries(UG_SHOP.planeta).map(([id, x]) => card('planeta', id, x, 'Seu próprio planeta de chat (até 3)')).join('')}</div>
      <b class="mt" style="display:block">🎭 Traje exclusivo</b><div class="cgrid mt">${Object.entries(UG_SHOP.traje).map(([id, x]) => { const own = ownsItem(u, 'traje', id); return `<div class="citem"><img src="${esc(x.image)}" alt="${esc(x.name)}" style="width:100%;max-height:210px;object-fit:contain;border-radius:12px;background:#171323"><b>${x.emoji} ${esc(x.name)}</b><span class="muted">Traje especial de Natal · máscara e capuz</span><div class="row between mt"><span>💎 ${x.price} UG</span>${own ? '<span class="muted">✅ Seu</span>' : `<button data-a="buyug" data-kind="traje" data-id="${id}">Comprar</button>`}</div></div>`; }).join('')}</div>`;
  } else if (S.shopTab === 'chars') {
    const list = Object.values(CATALOG.chars).filter((c) => S.genderFilter === 'all' || c.g === S.genderFilter);
    body = `<div class="cgrid">${list.map((c) => {
      const own = ownsItem(u, 'char', c.id), on = (u.char || (u.g === 'f' ? 'estrela' : 'piloto')) === c.id;
      return `<div class="citem ${on ? 'on' : ''}"><b>${c.g === 'f' ? '👧' : '👦'} ${esc(c.name)}</b><span class="muted">${gLabel(c.g)} · ${esc(c.desc)}</span><div class="row between mt"><span>${c.price ? `🪙 ${c.price} CS` : 'Inicial'}</span><div class="row"><button class="sec" data-a="previewcosmetic" data-kind="char" data-id="${c.id}" title="Testar no 3D">👁️</button>${own ? `<button class="${on ? '' : 'sec'}" data-a="equip" data-id="char:${c.id}">${on ? 'Equipado' : 'Usar'}</button>` : `<button data-a="buycosmetic" data-kind="char" data-id="${c.id}">Desbloquear</button>`}</div></div></div>`;
    }).join('')}</div>`;
  } else {
    body = `<div class="row">${Object.entries(BOLAS).filter(([n, b]) => b[1] && !u.balls.includes(n)).map(([n, b]) => `<button class="sec" data-a="buy" data-i="${n}">${b[0]} Bola ${n} — 🪙 ${b[1]} CS</button>`).join('')}<button class="sec" data-a="buy" data-i="bala_explosiva">💣 Bala explosiva — 🪙 5 CS</button>${Object.entries(ARMAS).filter(([n, w]) => w[2] && !(u.armas || []).includes(n)).map(([n, w]) => `<button class="sec" data-a="buyarma" data-i="${n}">${w[0]} ${n} — 🪙 ${w[2]} CS</button>`).join('')}${Object.entries(VARAS).filter(([id, v]) => v[3] && !(u.varas || ['vara_bambu']).includes(id)).map(([id, v]) => `<button class="sec" data-a="buyvara" data-i="${id}">${v[0]} Vara ${v[1]} (+${v[2]}% sorte) — 🪙 ${v[3]} CS</button>`).join('')}</div>`;
  }
  return bar + gFilterBar + '<div class="mt">' + body + '</div>';
}
function menuEmailHtml(u) {
  const ok = u.emailVerified;
  const form = S.emailStage === 'code'
    ? `<input type="text" id="emailcode" inputmode="numeric" maxlength="6" placeholder="Código de 6 dígitos" autocomplete="one-time-code" style="margin-bottom:8px">
       <div class="row"><button data-a="emailconfirm" style="flex:1">✅ Confirmar código</button><button class="sec" data-a="emailcancel">Cancelar</button></div>`
    : `<input type="text" id="emailinput" maxlength="120" inputmode="email" placeholder="seu@email.com" autocomplete="email" style="margin-bottom:8px">
       <div class="row"><button data-a="emailsend" style="flex:1">📨 ${ok ? 'Trocar e-mail' : 'Enviar código'}</button>${ok ? '<button class="sec" data-a="emailremove">Remover</button>' : ''}</div>`;
  return `<b>📧 E-mail de recuperação</b>
  <div class="muted" style="margin:4px 0 8px">${ok ? `✅ E-mail confirmado: <b>${esc(u.emailMasked || '')}</b>. Se esquecer a senha, você recebe um código nele.` : '⚠️ Sem e-mail confirmado. Cadastre um para poder redefinir a senha se esquecer (o jogo envia um código para o e-mail).'}${u.mailReady === false ? '<br>ℹ️ O envio de e-mail ainda não foi ativado neste servidor (o Dono precisa configurar).' : ''}</div>
  ${form}`;
}
function refreshEmailCard() {
  const el = $('#menuemail');
  if (el && S.me) el.innerHTML = menuEmailHtml(S.me);
}
// ---------- editor de código (Dono) ----------
const codeLines = (s) => (s ? s.split('\n').length : 0);
function codeInnerHtml() {
  const c = S.code;
  if (!c.open) return `<div class="row between"><div><b>🛠️ Editor de Código (Dono)</b><div class="muted">Edite os arquivos do jogo aqui dentro e estude programação</div></div><button data-a="codeopen">Abrir</button></div>`;
  const head = `<div class="row between"><b>🛠️ Editor de Código</b><button class="sec" data-a="codeclose" style="padding:4px 10px">✕</button></div>`;
  if (c.enabled === null) return head + '<div class="muted mt">Carregando…</div>';
  if (c.enabled === false) return head + `<div class="umodal-warn mt">Editor desativado. No painel do servidor (Render → Environment), defina a variável <b>DEV_PASS</b> com uma senha de pelo menos 6 caracteres e reinicie.</div>`;
  if (!c.unlocked) return head + `<div class="muted mt" style="margin-bottom:8px">Digite a senha <b>DEV_PASS</b> do servidor (não é a senha da conta). Fica liberado por 30 minutos.</div>
    <input type="password" id="codepass" maxlength="64" placeholder="Senha DEV_PASS" autocomplete="off">
    <button data-a="codeunlock" class="w mt">🔓 Desbloquear editor</button>${c.err ? `<div class="umodal-warn mt">${esc(c.err)}</div>` : ''}`;
  const dirty = c.draft !== c.orig;
  const opts = (c.files || []).map((f) => `<option value="${esc(f.name)}" ${f.name === c.file ? 'selected' : ''}>${f.readonly ? '🔒' : '✏️'} ${esc(f.name)}${f.modified ? ' ●' : ''}</option>`).join('');
  const backups = c.backups ? `<div class="mt">${c.backups.length ? c.backups.map((b) => `<div class="sitem"><span class="muted">${new Date(b.ts).toLocaleString('pt-BR')} · ${Math.round(b.size / 1024)} KB</span><button class="sec" data-a="coderestore" data-id="${esc(b.id)}">Restaurar</button></div>`).join('') : '<div class="muted">Nenhuma versão anterior ainda.</div>'}</div>` : '';
  return head + `<div class="row mt"><select id="codefile" class="fb-select" style="flex:1">${opts}</select></div>
  ${c.readonly ? '<div class="muted mt">🔒 Somente leitura aqui (para estudar). Edite pelo GitHub.</div>' : ''}
  <textarea id="codetext" class="code-ed mt" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" ${c.readonly ? 'readonly' : ''}>\n${esc(c.draft)}</textarea>
  <div id="codestat" class="muted" style="margin-top:4px">${esc(c.file)} · ${codeLines(c.draft)} linhas${c.modified ? ' · ● versão editada' : ' · original'}${dirty ? ' · ✏️ não salvo' : ''}</div>
  ${c.err ? `<div class="umodal-warn mt">${esc(c.err)}${c.errLine ? ` <button class="sec" data-a="codegoto" data-line="${c.errLine}" style="padding:2px 8px;margin-left:6px">Ir para a linha ${c.errLine}</button>` : ''}</div>` : ''}
  <div class="row mt">
    ${c.readonly ? '' : `<button data-a="codesave" ${c.busy ? 'disabled' : ''}>${c.busy ? '⏳ Salvando…' : '💾 Salvar'}</button><button data-a="codesave" data-reload="1" ${c.busy ? 'disabled' : ''}>💾 Salvar e recarregar</button><button class="sec" data-a="codediscard">↩ Descartar</button>`}
    <button class="sec" data-a="codebackups">🕘 Versões</button>
    ${c.modified && !c.readonly ? '<button class="sec" data-a="codereset">♻️ Voltar ao original</button>' : ''}
  </div>
  <div class="row mt"><input type="text" id="codeline" inputmode="numeric" maxlength="6" placeholder="Ir para a linha…" style="flex:1"><button class="sec" data-a="codegoto">Ir</button></div>
  ${backups}
  <div class="muted mt" style="font-size:12px">Cada salvamento faz backup automático e só aceita código sem erro de sintaxe. Se o jogo quebrar, abra <b>/recuperar</b> no navegador para voltar a uma versão que funcionava. Os jogadores veem a mudança ao recarregar a página.</div>`;
}
function refreshCode() {
  const el = $('#ownercode-editor');
  if (el && S.me && (S.me.cargo || 0) >= 6) el.innerHTML = codeInnerHtml();
}
async function codeLoadList() {
  const r = await codeApi({ act: 'list' });
  if (r.error) { if (r.locked) S.code.unlocked = false; S.code.err = r.error; refreshCode(); return false; }
  S.code.files = r.files || [];
  if (!S.code.loaded) { S.code.loaded = true; await codeLoadFile(S.code.file); } else refreshCode();
  return true;
}
async function codeLoadFile(name) {
  const c = S.code;
  const r = await codeApi({ act: 'read', name });
  if (r.error) { if (r.locked) c.unlocked = false; c.err = r.error; refreshCode(); return; }
  Object.assign(c, { file: name, orig: r.content, draft: r.content, readonly: !!r.readonly, modified: !!r.modified, err: '', errLine: null, backups: null });
  refreshCode();
}
const menuSaveHtml = (u) => `<b>💾 Salvar dados da conta</b>
  <div class="muted" style="margin:4px 0 8px">${u.hasPass ? '🔐 Senha ativa — você pode entrar com nome e senha em qualquer aparelho.' : '⚠️ Defina uma senha para não perder sua conta ao sair ou trocar de aparelho.'}<br>✅ Salvamento automático na inicialização e a cada 5 min · Último: ${new Date(u.savedAt || Date.now()).toLocaleTimeString('pt-BR')}</div>
  <input type="password" id="newpw" maxlength="64" placeholder="${u.hasPass ? 'Alterar senha (mín. 4 caracteres)' : 'Definir senha da conta (mín. 4 caracteres)'}" autocomplete="new-password" style="margin-bottom:8px">
  <div class="row"><button data-a="setpass" style="flex:1">🔐 Salvar senha</button><button class="sec" data-a="saveaccount">🔄 Salvar agora</button></div>
  <button class="sec w mt" data-a="copykey">🔑 Copiar código da conta</button>
  </div>`;
const AI_MUSIC_STYLES = ['Synthwave Espacial', 'Lo-Fi Cósmico', 'Electro Arcade', 'Future Funk VIP', 'Trap Estelar'];
function menuMusicHtml() {
  const mState = musicPlayer.state();
  const cur = S.activeSong || mState.song || BUILTIN_SONGS[0];
  const isPlayingCur = mState.playing && mState.song?.id === cur.id;
  const allSongs = [...BUILTIN_SONGS, ...(S.aiSongs || [])];
  return `<div class="row between">
    <div><b>🎵 Música do Jogo & Estúdio IA</b><div class="muted">Ouça a trilha sonora oficial ou crie músicas inéditas com IA</div></div>
    <button data-a="playsong" data-sid="${esc(cur.id)}">${isPlayingCur ? '⏸️ Pausar' : '▶️ Tocar'}</button>
  </div>
  <div class="bio-box" style="margin-top:8px">
    <b>${cur.ai ? '✨ ' : '🎶 '}${esc(cur.title)}</b> · <span class="muted">${esc(cur.style)} · ${cur.bpm || 118} BPM${cur.author ? ` · por ${esc(cur.author)}` : ''}</span>
    ${S.activeWavUrl ? `<div class="mt"><audio controls src="${esc(S.activeWavUrl)}" style="width:100%;height:36px"></audio></div>` : ''}
    ${cur.lyrics ? `<div class="muted mt" style="white-space:pre-line;font-size:12.5px;line-height:1.45">${esc(cur.lyrics)}</div>` : ''}
    <div class="row mt">
      <button class="sec" data-a="dlsong" data-sid="${esc(cur.id)}">⬇️ Baixar .wav</button>
      ${S.room ? `<button class="sec" data-a="sharemusic" data-sid="${esc(cur.id)}">📢 Tocar no Chat (${esc(S.room)})</button>` : ''}
    </div>
  </div>
  <div class="muted mt" style="margin-bottom:6px">Faixas disponíveis (${allSongs.length}):</div>
  <div class="cgrid">${allSongs.map((sg) => {
    const sel = sg.id === cur.id;
    const playing = mState.playing && mState.song?.id === sg.id;
    return `<div class="citem ${sel ? 'on' : ''}">
      <b>${sg.ai ? '✨' : '🎵'} ${esc(sg.title)}</b>
      <span class="muted">${esc(sg.style)} · ${sg.bpm} BPM</span>
      <button class="${playing ? '' : 'sec'} w" data-a="playsong" data-sid="${esc(sg.id)}">${playing ? '⏸️ Tocando' : '▶️ Ouvir'}</button>
    </div>`;
  }).join('')}</div>
  <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
    <b>✨ Compor Nova Música com IA (Gemini)</b>
    <div class="segbar mt">${AI_MUSIC_STYLES.map((st) => `<button type="button" class="seg ${S.aiMusicStyle === st ? 'on' : ''}" data-a="aimusicstyle" data-st="${esc(st)}">${esc(st)}</button>`).join('')}</div>
    <input type="text" id="aimusicprompt" maxlength="200" value="${esc(S.aiMusicPrompt)}" placeholder="Descreva a música (ex.: tema animado para festa VIP)" autocomplete="off" class="mt">
    ${S.aiMusicErr ? `<div class="umodal-warn mt">${esc(S.aiMusicErr)}</div>` : ''}
    <button data-a="genaimusic" class="w mt" ${S.aiMusicBusy ? 'disabled' : ''}>${S.aiMusicBusy ? '🎼 Compondo com IA…' : '✨ Criar Música com IA'}</button>
  </div>`;
}
function refreshMusicBox() {
  const mm = $('#menumusic');
  if (mm && document.activeElement?.id !== 'aimusicprompt') mm.innerHTML = menuMusicHtml();
}
function updateMenuParts() {
  const u = S.me; if (!u) return;
  const mt = $('#menutitle'), st = $('#menustats'), mp = $('#menuprofile'), mv = $('#menuverify'), bg = $('#menubag'), sh = $('#menushop'), sv = $('#menusave');
  if (st && mp && mv && bg && sh && sv) {
    if (mt) mt.innerHTML = `${u.vip ? '👑 ' : ''}<span style="${nameStyleAttr(u.nameColor, u.cargo)}">${esc(u.name)}</span>${verBadgeHtml(u.verified, true)}`;
    st.innerHTML = menuStatsHtml(u);
    if (document.activeElement?.id !== 'biopick') mp.innerHTML = menuProfileHtml(u);
    if (document.activeElement?.id !== 'vconfirm') mv.innerHTML = menuVerifyHtml(u);
    refreshMusicBox();
    bg.innerHTML = menuBagHtml(u);
    sh.innerHTML = menuShopHtml(u);
    sv.innerHTML = menuSaveHtml(u);
    const em = $('#menuemail');
    if (em && !['emailinput', 'emailcode'].includes(document.activeElement?.id)) em.innerHTML = menuEmailHtml(u);
    if (preview3d) preview3d.update(u);
  } else render();
}
function ownerCodeHtml() {
  if ((S.me?.cargo || 0) < 6) return '<div class="card">⛔ Área exclusiva do Dono.</div>';
  return `<h2>🛠️ Central do Dono</h2><div class="card"><b>🖥️ Servidor</b><div class="muted mt">Ações de servidor em uma seção separada.</div><button class="w mt" data-a="restartserver">🔄 Reiniciar servidor</button><div class="muted mt">Em hospedagens com reinício automático (como Render), ele volta online após reiniciar.</div></div><div class="card mt"><b>🔧 Manutenção</b><div class="row mt"><button class="sec" style="flex:1" data-a="unbug">🛠️ Desbugar</button><button class="sec" style="flex:1" data-a="updateapk">📲 Atualizar app</button></div></div><div class="card mt"><b>Editor de Código</b><div id="ownercode-editor">${codeInnerHtml()}</div></div><div class="card mt"><b>📦 Cópia completa do jogo</b><div class="muted mt">Baixe o ZIP atualizado do projeto para guardar ou enviar ao GitHub.</div><button class="w mt" data-a="dlzip">⬇️ Baixar universo-chat.zip</button></div>`;
}
function menuHtml() {
  const u = S.me;
  return `<h2 id="menutitle">${u.vip ? '👑 ' : ''}<span style="${nameStyleAttr(u.nameColor, u.cargo)}">${esc(u.name)}</span>${verBadgeHtml(u.verified, true)}</h2>
  <div id="preview3d" class="preview3d"></div>
  <div id="menustats" class="card">${menuStatsHtml(u)}</div>
  <div class="card" id="menurules">
    <button class="sec w" data-a="rulesopen">📜 ${S.rulesOpen ? 'Ocultar Regras' : 'Ver Regras do Universo Chat'}</button>
    ${S.rulesOpen ? `<div class="mt" style="line-height:1.65"><h3 style="margin:8px 0">📜 Regras Oficiais</h3><ol style="padding-left:22px;margin:8px 0"><li>Respeite todos os jogadores e trate todos com educação.</li><li>Não pratique assédio, ameaças, discriminação ou provocações para prejudicar alguém.</li><li>Não use hacks, trapaças ou exploits para obter vantagens.</li><li>Não abuse de bugs; reporte problemas à equipe.</li><li>Evite spam, flood e mensagens repetidas no chat.</li><li>Não publique links suspeitos, golpes ou conteúdo malicioso.</li><li>Não tente roubar contas, senhas ou dados de outros jogadores.</li><li>Respeite a equipe de moderação e as decisões de segurança.</li><li>Jogue os minijogos de forma justa e não atrapalhe outros participantes.</li><li>Use os recursos e recompensas do jogo sem fraude ou abuso.</li><li>Contas e cargos não devem ser usados para intimidar ou prejudicar jogadores.</li><li>Descumprimentos podem resultar em aviso, restrição ou suspensão, conforme a gravidade.</li></ol><div class="muted">Ao jogar no Universo Chat, você concorda em seguir estas regras. A equipe pode atualizar as regras para manter o ambiente seguro e divertido.</div></div>` : ''}
  </div>
  <div id="menumusic" class="card">${menuMusicHtml()}</div>
  <div id="menuprofile" class="card">${menuProfileHtml(u)}</div>
  <div id="menuverify" class="card">${menuVerifyHtml(u)}</div>
  <div class="card"><b>🎭 Camarim e Guarda-Roupa</b><div id="menubag" class="mt">${menuBagHtml(u)}</div></div>
  <div class="card"><b>🛍️ Loja Cósmica</b><div id="menushop" class="mt">${menuShopHtml(u)}</div></div>
  <button data-a="chest" class="w" style="margin-bottom:12px">🎁 Abrir baú (usa baú ou chave)</button>
  <div class="card"><b>🎟️ Resgatar Código</b>
    <div class="muted" style="margin:4px 0 8px">Digite um código promocional para ganhar Cosmos, baús, estrelas ou UniGemas!</div>
    <div class="row"><input type="text" id="redeemcode" maxlength="24" placeholder="Ex.: UNIVERSO2026" autocomplete="off" style="flex:1;min-width:140px;text-transform:uppercase"><button data-a="redeem">🎁 Resgatar</button></div>
  </div>
  <div id="menuemail" class="card">${menuEmailHtml(u)}</div>
  <div id="menusave" class="card">${menuSaveHtml(u)}</div>
  <div class="card"><b>💎 Recarregar UniGemas</b> <span class="muted">R$ 1,00 = 1 UniGema</span>
    <div class="grid3 mt">${[1, 2, 3, 5, 10, 20].map((v) => `<button class="sec" data-a="pixbuy" data-v="${v}">💎 ${v} ${v === 1 ? 'UniGema' : 'UniGemas'}<br><span class="muted">R$ ${v},00</span></button>`).join('')}</div>
    <div id="pixbox">${pixBox()}</div></div>
  ${divulgarCard()}
  <button class="sec w" data-a="logout">Sair da conta</button>`;
}
// ---------- recarga via Pix ----------
const brl = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
function pixBox() {
  const P = S.pix; if (!P) return '';
  if (P.error) return `<p class="muted mt">${esc(P.error)}</p>`;
  if (!P.ready) return '<p class="muted mt">Recarga ainda não disponível (chave Pix não configurada).</p>';
  if (!P.orders.length) return '<p class="muted mt">Escolha um valor acima para gerar o pagamento.</p>';
  return P.orders.map((o) => `<div class="card" style="margin:10px 0 0"><b>Pedido #${o.id} — ${brl(o.uc)} → ${o.uc} ${o.uc === 1 ? 'UniGema' : 'UniGemas'}</b>
    <ol style="margin:8px 0 8px 18px;font-size:13px;line-height:1.6">
      <li>Abra o app do seu banco e pague <b>${brl(o.uc)}</b> via Pix para <b>${esc(P.receiver)}</b>.</li>
      <li>Use o <b>Pix copia e cola</b> (já vem com o valor certo) ou a chave abaixo.</li>
      <li>Quando o Pix cair, as <b>${o.uc} ${o.uc === 1 ? 'UniGema' : 'UniGemas'}</b> entram na sua conta e você recebe um aviso no ✉️ Correio.</li>
    </ol>
    <div class="row"><button data-a="pixcopy" data-id="${o.id}" data-w="payload">📋 Copiar Pix copia e cola</button><button class="sec" data-a="pixcopy" data-id="${o.id}" data-w="key">🔑 Copiar chave</button><button class="sec" data-a="pixcancel" data-id="${o.id}">Cancelar</button></div>
    <div class="muted mt" style="word-break:break-all">Chave Pix: ${esc(P.key)}</div></div>`).join('');
}
async function loadPix() {
  const r = await api({ type: 'pixinfo' }); S.pix = r.ok ? r : { error: r.error || 'Não foi possível carregar a recarga.' };
  const b = $('#pixbox'); if (b) b.innerHTML = pixBox();
}
async function loadTop() {
  const r = await api({ type: 'top' }); const m = $('#main'); if (S.tab !== 'events') return;
  if (!r.top) { m.innerHTML = `<h2>🏆 Ranking</h2><div class="card muted">${esc(r.error || 'Não foi possível carregar.')}</div>`; return; }
  m.innerHTML = `<h2>🏆 Ranking de autoridade</h2>${r.top.map((x, i) => `<button type="button" class="top-row-btn" data-a="viewuser" data-n="${esc(x.name)}"><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} <b style="${nameStyleAttr(x.nameColor, x.cargo)}">${esc(x.name)}</b>${verBadgeHtml(x.verified)} <span class="muted">${CARGOS[x.cargo]}</span></span><span>⭐ ${x.stars}</span></button>`).join('')}`;
}
const eventsHtml = () => '<h2>🏆 Ranking</h2><div class="card muted">Carregando…</div>';

const FB_CATS = {
  sugestao: { label: '💡 Sugestão', cls: 'sugestao' },
  bug: { label: '🐞 Bug / Erro', cls: 'bug' },
  elogio: { label: '🌟 Elogio', cls: 'elogio' },
  musica: { label: '🎵 Música / 3D', cls: 'musica' },
};
const FB_STATUS = {
  novo: 'Novo',
  analise: 'Em análise',
  planejado: 'Planejado',
  resolvido: 'Resolvido',
};
function feedbackSummaryHtml() {
  const all = S.feedbacks || [];
  const total = all.length;
  const avg = total ? (all.reduce((s, f) => s + (Number(f.rating) || 5), 0) / total).toFixed(1) : '5.0';
  const resolved = all.filter((f) => f.status === 'resolvido').length;
  return `<div class="fb-stat"><b>⭐ ${avg}</b><span>Nota média</span></div>
    <div class="fb-stat"><b>${total}</b><span>Enviados</span></div>
    <div class="fb-stat"><b>${resolved}</b><span>Resolvidos</span></div>`;
}
function feedbackListHtml() {
  const all = S.feedbacks || [];
  let list = all.filter((f) => {
    if (S.fbFilter === 'mine') return f.isMine;
    if (S.fbFilter !== 'all') return f.category === S.fbFilter;
    return true;
  });
  list = [...list].sort((a, b) => S.fbSort === 'top' ? (b.votesCount - a.votesCount || b.id - a.id) : (b.id - a.id));
  if (!list.length) return '<div class="card muted">Nenhum feedback encontrado neste filtro. Seja o primeiro a enviar!</div>';
  const isStaff = (S.me?.cargo || 0) >= 2;
  return list.map((f) => {
    const cat = FB_CATS[f.category] || FB_CATS.sugestao;
    const stars = '★'.repeat(f.rating || 5) + '☆'.repeat(Math.max(0, 5 - (f.rating || 5)));
    const stLbl = FB_STATUS[f.status] || 'Novo';
    return `<div class="card">
      <div class="row between">
        <div class="row">
          <span class="fb-cat ${esc(cat.cls)}">${cat.label}</span>
          <span class="st-pill ${esc(f.status)}">${stLbl}</span>
        </div>
        <span style="color:var(--gold);letter-spacing:1px;font-size:14px" title="${f.rating}/5 estrelas">${stars}</span>
      </div>
      <div style="margin-top:8px"><b style="font-size:15.5px">#${f.id} · ${esc(f.title)}</b></div>
      <div class="rep-meta">Por ${f.authorGuildTag ? `<span class="gtag">[${esc(f.authorGuildTag)}]</span>` : ''}<button type="button" class="name-btn" data-a="viewuser" data-n="${esc(f.authorName)}" style="${nameStyleAttr(f.authorNameColor, f.authorCargo)}">${esc(f.authorName)}</button>${verBadgeHtml(f.authorVerified)} (${CARGOS[f.authorCargo || 0] || 'Viajante'}) · ${new Date(f.ts).toLocaleString('pt-BR')}</div>
      <div class="topic-body">${esc(f.text)}</div>
      ${f.staffReply ? `<div class="fb-reply-box">🛡️ <b>Resposta da Staff (${esc(f.repliedBy || 'Staff')}):</b> ${esc(f.staffReply)}</div>` : ''}
      <div class="row mt">
        <button class="${f.voted ? '' : 'sec'}" data-a="fbvote" data-id="${f.id}">${f.voted ? '👍 Apoiado' : '👍 Apoiar'} (${f.votesCount || 0})</button>
        ${f.canDelete ? `<button class="danger" data-a="fbdelete" data-id="${f.id}" title="Apagar feedback">🗑️</button>` : ''}
      </div>
      ${isStaff ? `<div class="mt" style="padding-top:10px;border-top:1px solid var(--line)">
        <div class="row">
          <select id="fbstatus-${f.id}" class="fb-select">
            <option value="novo" ${f.status === 'novo' ? 'selected' : ''}>Novo</option>
            <option value="analise" ${f.status === 'analise' ? 'selected' : ''}>Em análise</option>
            <option value="planejado" ${f.status === 'planejado' ? 'selected' : ''}>Planejado</option>
            <option value="resolvido" ${f.status === 'resolvido' ? 'selected' : ''}>Resolvido</option>
          </select>
          <input type="text" id="fbreply-${f.id}" maxlength="240" value="${esc(f.staffReply || '')}" placeholder="Responder ao jogador…" autocomplete="off" style="flex:1;min-width:140px">
          <button data-a="fbreview" data-id="${f.id}">💾 Salvar</button>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
}
function feedbackHtml() {
  const starsHtml = [1, 2, 3, 4, 5].map((n) => `<button type="button" class="fb-star ${n <= S.fbRating ? 'on' : ''}" data-a="fbrating" data-r="${n}" aria-label="${n} estrelas">★</button>`).join('');
  const catsHtml = Object.entries(FB_CATS).map(([id, c]) => `<button type="button" class="seg ${S.fbCat === id ? 'on' : ''}" data-a="fbcat" data-c="${id}">${c.label}</button>`).join('');
  return `<h2>📝 Feedback & Sugestões</h2>
  <div id="fbsummary" class="fb-summary">${feedbackSummaryHtml()}</div>
  <div class="card">
    <b>✍️ Enviar seu feedback</b>
    <div class="muted mt" style="margin-bottom:6px">Categoria:</div>
    <div id="fbcats" class="segbar">${catsHtml}</div>
    <div class="row between mt">
      <span class="muted">Avaliação do jogo:</span>
      <div id="fbstars" class="fb-stars" style="margin:0">${starsHtml}</div>
    </div>
    <input type="text" id="fbtitle" maxlength="60" placeholder="Título curto (ex.: Nova ideia de planeta)" autocomplete="off" style="margin:10px 0 8px">
    <div class="row between" style="margin-bottom:6px"><span class="muted">Detalhes do feedback</span><span id="fblen" class="muted">0/360</span></div>
    <textarea id="fbtext" class="topic-textarea" maxlength="360" placeholder="Conte sua sugestão, relate um bug ou deixe um elogio…"></textarea>
    <button id="fbsubmitbtn" class="w mt" data-a="fbsubmit" ${S.fbBusy ? 'disabled' : ''}>${S.fbBusy ? '⏳ Enviando…' : '📤 Enviar Feedback'}</button>
  </div>
  <div class="card">
    <div class="row between" style="margin-bottom:8px">
      <b>📬 Feedbacks da Comunidade</b>
      <div class="row">
        <button type="button" class="sec ${S.fbSort === 'recent' ? 'sel' : ''}" data-a="fbsort" data-s="recent" style="padding:5px 9px;font-size:12px">🕒 Recentes</button>
        <button type="button" class="sec ${S.fbSort === 'top' ? 'sel' : ''}" data-a="fbsort" data-s="top" style="padding:5px 9px;font-size:12px">🔥 Top</button>
      </div>
    </div>
    <div class="segbar">
      <button type="button" class="seg ${S.fbFilter === 'all' ? 'on' : ''}" data-a="fbfilter" data-f="all">Todos</button>
      <button type="button" class="seg ${S.fbFilter === 'sugestao' ? 'on' : ''}" data-a="fbfilter" data-f="sugestao">💡 Ideias</button>
      <button type="button" class="seg ${S.fbFilter === 'bug' ? 'on' : ''}" data-a="fbfilter" data-f="bug">🐞 Bugs</button>
      <button type="button" class="seg ${S.fbFilter === 'elogio' ? 'on' : ''}" data-a="fbfilter" data-f="elogio">🌟 Elogios</button>
      <button type="button" class="seg ${S.fbFilter === 'mine' ? 'on' : ''}" data-a="fbfilter" data-f="mine">👤 Meus</button>
    </div>
  </div>
  <div id="feedbacklist">${feedbackListHtml()}</div>`;
}

// ---------- jogos ----------
function cavePanelHtml(G) {
  const stage = G.stage || 'intro';
  const status = stage === 'search' ? 'Procure a chave ou o relicário.' : stage === 'escape' ? 'O Guardião está atrás de você! Corra até a saída.' : stage === 'won' ? 'Você conseguiu escapar!' : stage === 'lost' ? 'A tentativa terminou.' : 'Uma aventura de fuga na caverna.';
  return `<div class="cave-status">${status}</div>
    <div class="cave-inventory row"><span>${G.key ? '🗝️ Chave encontrada' : '🗝️ Chave: —'}</span><span>${G.relic ? '✨ Relicário encontrado' : '✨ Relicário: —'}</span><span>🏃 Passos: ${G.escapeSteps || 0}/2</span></div>
    ${stage === 'intro' ? `<p class="muted">Explore a caverna, encontre a chave ou um relicário raro, abra o portão reforçado e escape do Guardião. Recompensas virtuais são concedidas ao vencer.</p><button class="w" data-a="cavestart">▶️ Entrar na caverna</button>` : ''}
    ${stage === 'search' ? `<div class="grid2 mt"><button data-a="caveaction" data-action="search">🔎 Procurar</button><button class="sec" data-a="caveaction" data-action="hide">🪨 Esconder-se</button>${(G.key || G.relic) ? `<button class="w" data-a="caveaction" data-action="unlock">🔓 Abrir portão</button>` : ''}</div>` : ''}
    ${stage === 'escape' ? `<div class="grid2 mt"><button data-a="caveaction" data-action="run">🏃 Correr para a saída</button><button class="sec" data-a="caveaction" data-action="hide">🪨 Esconder-se</button></div>` : ''}
    ${stage === 'won' || stage === 'lost' ? `<div class="card mt"><b>${G.result || status}</b><button class="w mt" data-a="cavestart">🔁 Jogar novamente</button></div>` : ''}`;
}
function caveHtml(G) {
  return `<div class="cave-game">
    <div class="row between"><b>🕯️ Caverna do Guardião 3D</b><span id="cavehead" class="muted">Ameaça ${G.chase || 0}/5</span></div>
    <div id="cave3d" class="game3d"></div>
    <div id="cavepanel">${cavePanelHtml(G)}</div>
  </div>`;
}
function zombieHtml(G) {
  const own = S.me.armas || ['pistola']; if (!own.includes(S.arma)) S.arma = 'pistola';
  return `<div class="row between"><b>🧟 Derrubar os Zumbis 3D</b><span id="zhead" class="muted">onda ${G.wave} • ${'❤️'.repeat(Math.max(0, G.lives))} • recorde ${G.best}</span></div>
  <div id="zombie3d" class="zombie3d"></div>
  <div id="zarmas" class="row mt">${own.map((n) => `<button class="sec ${S.arma === n ? 'sel' : ''}" data-a="arma" data-n="${n}">${ARMAS[n][0]} ${n} (dano ${ARMAS[n][1]})</button>`).join('')}</div>
  <p class="muted mt">Toque num zumbi 3D para atirar. A cada tiro todos avançam 1 casa — se chegarem na barreira você perde ❤️. Vença ondas para ganhar Cosmos, e a cada 5 ondas um chefe 👹 dá estrela!</p>`;
}
function drawGame(shotMeta) {
  const g = $('#game'); if (!g || !S.game) return;
  const G = S.game;
  if (S.planet.t === 'cave') {
    let cv = $('#cave3d');
    if (!cv) { disposeCave3D(); g.innerHTML = caveHtml(G); cv = $('#cave3d'); }
    else {
      const ch = $('#cavehead'); if (ch) ch.textContent = `Ameaça ${G.chase || 0}/5`;
      const cp = $('#cavepanel'); if (cp) cp.innerHTML = cavePanelHtml(G);
    }
    // Se o módulo 3D da caverna estiver ausente ou falhar, não deixe o canvas preto bloquear a interface.
    if (!caveMod || typeof mountCave3D !== 'function') {
      disposeCave3D(); caveElRef = cv;
      cv.innerHTML = '<div class="muted" style="padding:18px;text-align:center;background:linear-gradient(145deg,#171827,#30213b);border-radius:12px;color:#eee">🕯️ Caverna em modo compatível. Use os controles da aventura abaixo.</div>';
    } else if (!cave3d || caveElRef !== cv) {
      disposeCave3D(); caveElRef = cv;
      try { cave3d = mountCave3D(cv, G); }
      catch (err) {
        console.error('cave3d:', err); cave3d = null; caveElRef = cv;
        cv.innerHTML = '<div class="muted" style="padding:18px;text-align:center;background:#171827;border-radius:12px;color:#eee">🕯️ Modo compatível ativado. Use os controles abaixo para jogar!</div>';
      }
    } else cave3d.setState(G);
    return;
  }
  if (S.planet.t === 'zombie') {
    const own = S.me.armas || ['pistola']; if (!own.includes(S.arma)) S.arma = 'pistola';
    let zv = $('#zombie3d');
    if (!zv) {
      disposeZombie3D();
      g.innerHTML = zombieHtml(G);
      zv = $('#zombie3d');
    } else {
      const zh = $('#zhead');
      if (zh) zh.textContent = `onda ${G.wave} • ${'❤️'.repeat(Math.max(0, G.lives))} • recorde ${G.best}`;
      const za = $('#zarmas');
      if (za) za.innerHTML = own.map((n) => `<button class="sec ${S.arma === n ? 'sel' : ''}" data-a="arma" data-n="${n}">${ARMAS[n][0]} ${n} (dano ${ARMAS[n][1]})</button>`).join('');
    }
    if (!zombie3d || zombieElRef !== zv) {
      disposeZombie3D();
      zombieElRef = zv;
      try {
        zombie3d = mountZombie3D(zv, {
          state: G,
          me: S.me,
          arma: S.arma,
          onShoot: (id) => A.zshoot({ id }),
        });
      } catch (err) {
        console.error('zombie3d:', err);
        zombie3d = null; zombieElRef = null;
        zv.innerHTML = '<div class="muted" style="padding:18px;text-align:center">Arena 3D indisponível no momento.</div>';
      }
    } else {
      zombie3d.setMe(S.me);
      zombie3d.setArma(S.arma);
      zombie3d.update(G, shotMeta);
    }
    return;
  }
  disposeZombie3D();
  if (S.planet.t === 'bowling') {
    disposeCannon3D();
    if (!S.me.balls.includes(S.ball)) S.ball = 'verde';
    let bv = $('#bowling3d');
    if (!bv) {
      disposeBowling3D();
      g.innerHTML = `<div class="row between"><b>🎳 Boliche 3D</b><span id="bhead" class="muted">arremesso ${G.throws}/10 • pontos ${G.total} • recorde ${G.best}</span></div>
      <div id="bowling3d" class="game3d"></div>
      <div id="bballs" class="row">${S.me.balls.map((b) => `<button class="sec ${S.ball === b ? 'sel' : ''}" data-a="ball" data-b="${b}">${BOLAS[b][0]}</button>`).join('')}</div>
      <button data-a="bowl" class="w mt">🎳 Arremessar</button><p class="muted mt">Cada pino derrubado dá Cosmos e chance de prêmio. Strike dá estrela. Compre bolas melhores no Menu.</p>`;
      bv = $('#bowling3d');
    } else {
      const bh = $('#bhead');
      if (bh) bh.textContent = `arremesso ${G.throws}/10 • pontos ${G.total} • recorde ${G.best}`;
      const bb = $('#bballs');
      if (bb) bb.innerHTML = S.me.balls.map((b) => `<button class="sec ${S.ball === b ? 'sel' : ''}" data-a="ball" data-b="${b}">${BOLAS[b][0]}</button>`).join('');
    }
    if (!bowling3d || bowlingElRef !== bv) {
      disposeBowling3D();
      bowlingElRef = bv;
      try {
        bowling3d = mountBowling3D(bv, { pins: G.pins, ball: S.ball, onThrow: () => A.bowl() });
      } catch (err) {
        console.error('bowling3d:', err);
        bowling3d = null; bowlingElRef = null;
        bv.innerHTML = '<div class="muted" style="padding:18px;text-align:center">Pista 3D indisponível no momento. Use o botão abaixo para arremessar.</div>';
      }
    } else {
      bowling3d.setBall(S.ball);
      bowling3d.updatePins(G.pins);
    }
    return;
  }
  disposeBowling3D();
  if (S.planet.t === 'cannon') {
    const ang = S.ang || 45;
    const pow = S.pow || 25;
    const tgt = Number.isFinite(+G.target) ? +G.target : 60;
    const kind = G.kind === 'bicho' ? 'bicho' : 'barril';
    const hits = G.hits || 0;
    let cv = $('#cannon3d');
    if (!cv) {
      disposeCannon3D();
      g.innerHTML = `<div class="row between"><b>💥 Canhão 3D</b><span id="chead" class="muted">acertos ${hits} • alvo: ${kind === 'barril' ? '🛢️ barril' : '🐗 bicho'} (${Math.round(tgt)}m)</span></div>
      <div id="cannon3d" class="game3d"></div>
      <label class="muted">Ângulo <span id="av">${ang}</span>°</label><input type="range" id="ang" min="5" max="85" value="${ang}">
      <label class="muted">Força <span id="pv">${pow}</span></label><input type="range" id="pow" min="10" max="40" value="${pow}">
      <div id="cammo" class="row" style="margin:10px 0"><button class="sec ${S.ammo === 'fogo' ? 'sel' : ''}" data-a="ammo" data-m="fogo">🔥 fogo</button><button class="sec ${S.ammo === 'explosiva' ? 'sel' : ''}" data-a="ammo" data-m="explosiva">💣 explosiva (${S.me.inv.bala_explosiva || 0})</button><button class="sec ${S.traj ? 'sel' : ''}" data-a="traj">📈 trajetória</button></div>
      <button data-a="fire" class="w">💥 FOGO!</button><p class="muted mt">Acertando barril ou bicho: Cosmos e chance de estrela, chave ou fuga.</p>`;
      cv = $('#cannon3d');
      $('#ang').oninput = $('#pow').oninput = () => {
        S.ang = +$('#ang').value;
        S.pow = +$('#pow').value;
        $('#av').textContent = S.ang;
        $('#pv').textContent = S.pow;
        if (cannon3d) cannon3d.updateAim(S.ang, S.pow, S.traj);
      };
    } else {
      const ch = $('#chead');
      if (ch) ch.textContent = `acertos ${hits} • alvo: ${kind === 'barril' ? '🛢️ barril' : '🐗 bicho'} (${Math.round(tgt)}m)`;
      const ca = $('#cammo');
      if (ca) ca.innerHTML = `<button class="sec ${S.ammo === 'fogo' ? 'sel' : ''}" data-a="ammo" data-m="fogo">🔥 fogo</button><button class="sec ${S.ammo === 'explosiva' ? 'sel' : ''}" data-a="ammo" data-m="explosiva">💣 explosiva (${S.me.inv.bala_explosiva || 0})</button><button class="sec ${S.traj ? 'sel' : ''}" data-a="traj">📈 trajetória</button>`;
    }
    if (!cannon3d || cannonElRef !== cv) {
      disposeCannon3D();
      cannonElRef = cv;
      try {
        cannon3d = mountCannon3D(cv, { target: tgt, kind, angle: ang, power: pow, ammo: S.ammo, traj: S.traj });
      } catch (err) {
        console.error('cannon3d:', err);
        cannon3d = null; cannonElRef = null;
        cv.innerHTML = '<div class="muted" style="padding:18px;text-align:center">Campo 3D indisponível no momento. Ajuste os controles e toque em 💥 FOGO!</div>';
      }
    } else {
      cannon3d.setTarget(tgt, kind);
      cannon3d.updateAim(ang, pow, S.traj);
    }
    return;
  }
  disposeCannon3D();
  if (S.planet.t === 'soccer') {
    const kicks = G.kicks || 0, goals = G.goals || 0, best = G.best || 0;
    const headTxt = `chute ${Math.min(kicks + 1, 5)}/5 • gols ${goals} • recorde ${best}`;
    let sv = $('#soccer3d');
    if (!sv) {
      disposeSoccer3D();
      g.innerHTML = `<div class="row between"><b>⚽ Futebol 3D — Pênaltis</b><span id="shead" class="muted">${headTxt}</span></div>
      <div id="soccer3d" class="game3d"></div>
      <label class="muted">Força <span id="spv">${S.spow || 70}</span>%</label><input type="range" id="spow" min="20" max="100" value="${S.spow || 70}">
      <button data-a="soccerkick" class="w mt">⚽ CHUTAR!</button>
      <p class="muted mt">Toque no gol para mirar e ajuste a força. Chute fraco o goleiro pega; mirar fora do gol é erro! Cantinhos no ângulo valem mais. 5 chutes por rodada: faça 3+ gols para bônus e 5/5 para ganhar estrela.</p>`;
      sv = $('#soccer3d');
      $('#spow').oninput = () => { S.spow = +$('#spow').value; $('#spv').textContent = S.spow; };
    } else {
      const sh = $('#shead'); if (sh) sh.textContent = headTxt;
    }
    if (!soccer3d || soccerElRef !== sv) {
      disposeSoccer3D();
      soccerElRef = sv;
      try { soccer3d = mountSoccer3D(sv, {}); }
      catch (err) {
        console.error('soccer3d:', err);
        soccer3d = null; soccerElRef = null;
        sv.innerHTML = '<div class="muted" style="padding:18px;text-align:center">Campo 3D indisponível no momento. Toque em ⚽ CHUTAR! para bater o pênalti.</div>';
      }
    }
    return;
  }
  disposeSoccer3D();
  if (S.planet.t === 'fishing') {
    const ownVaras = S.me.varas || ['vara_bambu'];
    if (!ownVaras.includes(S.vara)) S.vara = 'vara_bambu';
    const caught = G.caught ?? S.me.best?.fishing ?? 0;
    const lastTxt = G.last ? ` · último: ${G.last.emoji} ${esc(G.last.name)}` : '';
    const stageLbl = S.fishStage === 'bite'
      ? '⚡ PEIXE FISGOU! Toque em PUXAR AGORA!'
      : S.fishStage === 'waiting'
        ? '🌊 Linha na água… aguarde a boia afundar!'
        : S.fishStage === 'reeling'
          ? '✨ Puxando peixe…'
          : '🎣 Lance a linha no Lago Estelar para pescar!';
    const btnLbl = S.fishStage === 'bite'
      ? '⚡ PUXAR AGORA!'
      : S.fishStage === 'waiting'
        ? '⏳ Aguardando peixe…'
        : '🎣 Lançar linha';
    let fv = $('#fishing3d');
    if (!fv) {
      disposeFishing3D();
      g.innerHTML = `<div class="row between"><b>🎣 Pesca Estelar 3D</b><span id="fhead" class="muted">pescados: ${caught}${lastTxt}</span></div>
      <div id="fishing3d" class="game3d"></div>
      <div id="fvaras" class="row">${ownVaras.map((v) => `<button class="sec ${S.vara === v ? 'sel' : ''}" data-a="vara" data-v="${v}">${VARAS[v][0]} ${VARAS[v][1]}</button>`).join('')}</div>
      <div id="fstatus" class="muted mt">${stageLbl}</div>
      <button id="fishbtn" data-a="fishaction" class="w mt ${S.fishStage === 'bite' ? 'fish-bite' : ''}">${btnLbl}</button>
      <p class="muted mt">Pesque Peixe Lunar, Tubarão Estelar, Baleia Dourada ⭐ ou Baú Submerso 🎁. Compre varas melhores na aba Jogos da Loja!</p>`;
      fv = $('#fishing3d');
    } else {
      const fh = $('#fhead');
      if (fh) fh.innerHTML = `pescados: ${caught}${lastTxt}`;
      const fvr = $('#fvaras');
      if (fvr) fvr.innerHTML = ownVaras.map((v) => `<button class="sec ${S.vara === v ? 'sel' : ''}" data-a="vara" data-v="${v}">${VARAS[v][0]} ${VARAS[v][1]}</button>`).join('');
      const fst = $('#fstatus');
      if (fst) fst.textContent = stageLbl;
      const fb = $('#fishbtn');
      if (fb) {
        fb.textContent = btnLbl;
        fb.classList.toggle('fish-bite', S.fishStage === 'bite');
      }
    }
    if (!fishing3d || fishingElRef !== fv) {
      disposeFishing3D();
      fishingElRef = fv;
      try {
        fishing3d = mountFishing3D(fv, { vara: S.vara, stage: S.fishStage, onAction: () => A.fishaction() });
      } catch (err) {
        console.error('fishing3d:', err);
        fishing3d = null; fishingElRef = null;
        fv.innerHTML = '<div class="muted" style="padding:18px;text-align:center">Lago 3D indisponível no momento. Use o botão abaixo para pescar!</div>';
      }
    } else {
      fishing3d.setState({ vara: S.vara, stage: S.fishStage });
    }
  }
}

// ---------- ações ----------
const A = {
  topoptions: () => { S.showTopOptions = !S.showTopOptions; topbar(); },
  planetplayer: async (d) => {
    const labels = { star: 'adicionar uma estrela', unstar: 'retirar uma estrela', jail: 'prender', release: 'soltar' };
    if (!confirm(`Deseja ${labels[d.k] || 'alterar'} ${d.n}?`)) return;
    const r = await api({ type: 'planetowneract', name: d.n, action: d.k });
    if (r.error) return toast(r.error);
    toast(r.msg || 'Ação aplicada.');
  },

  rulesopen: () => { S.rulesOpen = !S.rulesOpen; render(); },
  reload: () => location.reload(),
  toggleaudio: () => {
    const muted = spatialAudio.toggleMute();
    topbar();
    toast(muted ? '🔇 Áudio espacial silenciado' : '🔊 Áudio espacial ativado');
  },
  togglemusic: async () => {
    try {
      const playing = await musicPlayer.toggle(S.activeSong);
      const { url } = await renderSongToWav(S.activeSong);
      S.activeWavUrl = url;
      topbar();
      refreshMusicBox();
      toast(playing ? `🎵 Tocando: ${S.activeSong.title}` : '⏸️ Música pausada');
    } catch (e) {
      toast(e?.message || 'Não foi possível reproduzir a música.');
    }
  },
  playsong: async (d) => {
    const song = S.songCache[d.sid] || BUILTIN_SONGS.find((s) => s.id === d.sid) || S.activeSong;
    if (!song) return;
    S.activeSong = song;
    try {
      const mState = musicPlayer.state();
      if (mState.playing && mState.song?.id === song.id) {
        musicPlayer.pause();
        toast('⏸️ Música pausada');
      } else {
        const { url } = await musicPlayer.play(song, true);
        S.activeWavUrl = url;
        toast(`🎵 Tocando: ${song.title}`);
      }
      topbar();
      refreshMusicBox();
    } catch (e) {
      toast(e?.message || 'Erro ao tocar música.');
    }
  },
  dlsong: async (d) => {
    const song = S.songCache[d.sid] || S.activeSong;
    if (!song) return;
    try {
      const { url } = await renderSongToWav(song);
      S.activeWavUrl = url;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(song.title || 'musica').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('⬇️ Download da música (.wav) iniciado!');
      refreshMusicBox();
    } catch (e) {
      toast(e?.message || 'Erro ao exportar música.');
    }
  },
  sharemusic: async (d) => {
    const song = S.songCache[d.sid] || S.activeSong;
    if (!song) return;
    const r = await api({ type: 'sharemusic', song });
    if (r.error) return toast(r.error);
    toast(`📢 Música "${song.title}" compartilhada em ${S.room}!`);
  },
  aimusicstyle: (d) => {
    S.aiMusicStyle = d.st || AI_MUSIC_STYLES[0];
    refreshMusicBox();
  },
  genaimusic: async () => {
    if (S.aiMusicBusy) return;
    const prompt = ($('#aimusicprompt')?.value ?? S.aiMusicPrompt ?? '').trim();
    S.aiMusicPrompt = prompt;
    S.aiMusicBusy = true;
    S.aiMusicErr = '';
    refreshMusicBox();
    try {
      const r = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: S.key, prompt, style: S.aiMusicStyle }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok || !d.song) {
        S.aiMusicErr = d.error || 'Não foi possível gerar música com IA.';
        toast(S.aiMusicErr);
        return;
      }
      S.songCache[d.song.id] = d.song;
      S.aiSongs = [...(S.aiSongs || []).filter((x) => x.id !== d.song.id), d.song].slice(-12);
      S.activeSong = d.song;
      const { url } = await musicPlayer.play(d.song, true);
      S.activeWavUrl = url;
      topbar();
      toast(`✨ Música criada com IA: ${d.song.title}!`);
    } catch (e) {
      S.aiMusicErr = e?.message || 'Erro de conexão ao gerar música.';
      toast(S.aiMusicErr);
    } finally {
      S.aiMusicBusy = false;
      refreshMusicBox();
    }
  },
  pixbuy: async (d) => {
    const r = await api({ type: 'pixorder', uc: +d.v }); if (r.error) return toast(r.error);
    await loadPix(); toast(`Pedido criado: ${brl(d.v)}. Pague pelo Pix abaixo.`);
    $('#pixbox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  pixcancel: async (d) => { const r = await api({ type: 'pixcancel', id: +d.id }); if (r.error) toast(r.error); loadPix(); },
  pixcopy: async (d) => {
    const o = S.pix?.orders.find((x) => x.id === +d.id); const txt = d.w === 'key' ? S.pix.key : o?.payload; if (!txt) return;
    if (await copyText(txt)) toast(d.w === 'key' ? '🔑 Chave copiada!' : '📋 Pix copia e cola copiado! Cole no app do banco.');
    else toast('Não foi possível copiar automaticamente.');
  },
  tab: (d) => {
    S.tab = d.t;
    if (S.tab === 'social' && S.socialTab === 'guild' && S.me?.guild) S.unreadGuild = 0;
    render();
  },
  socialtab: (d) => {
    const isStaff = (S.me?.cargo || 0) >= 2;
    S.socialTab = d.t === 'guild' ? 'guild' : d.t === 'topics' ? 'topics' : (d.t === 'staff' && isStaff) ? 'staff' : 'friends';
    if (S.socialTab === 'guild' && S.me?.guild) S.unreadGuild = 0;
    render();
  },
  gender: (d) => {
    S.g = d.g === 'f' ? 'f' : 'm';
    S.char = S.g === 'f' ? 'estrela' : 'piloto';
    render();
  },
  pickchar: (d) => {
    const c = CATALOG.chars[d.c];
    if (!c || c.price !== 0) return;
    S.char = c.id;
    S.g = c.g;
    document.querySelectorAll('[data-a="pickchar"]').forEach((b) => b.classList.toggle('sel', b.dataset.c === S.char));
    if (preview3d) preview3d.update({ name: 'Você', g: S.g, char: S.char, cargo: 0, vip: false });
    else render();
  },
  authmode: (d) => {
    const prev = ($('#lname')?.value || '').trim();
    S.authMode = d.m === 'login' ? 'login' : d.m === 'reset' ? 'reset' : 'create';
    if (S.authMode === 'reset') S.reset = { stage: 'ask', name: prev || S.reset?.name || '', token: '', busy: false };
    render();
    if (S.authMode === 'reset') setTimeout(() => $('#rname')?.focus(), 50);
  },
  resetrequest: async () => {
    const rs = S.reset; if (rs.busy) return;
    const name = ($('#rname')?.value ?? rs.name ?? '').trim();
    if (!name) return toast('Digite o nome da sua conta.');
    rs.name = name; rs.busy = true; render();
    const r = await resetApi({ act: 'request', name });
    rs.busy = false;
    if (r.error) { render(); return toast(r.error); }
    rs.stage = 'code'; render(); toast(r.msg || '📨 Código enviado!');
    setTimeout(() => $('#rcode')?.focus(), 50);
  },
  resetverify: async () => {
    const rs = S.reset;
    const code = ($('#rcode')?.value || '').trim();
    if (!/^\d{6}$/.test(code)) return toast('Digite os 6 números do código.');
    const r = await resetApi({ act: 'verify', name: rs.name, code });
    if (r.error) return toast(r.error);
    rs.token = r.token; rs.stage = 'newpass'; render();
    toast('✅ Código confirmado! Defina a nova senha.');
    setTimeout(() => $('#rpass')?.focus(), 50);
  },
  resetset: async () => {
    const rs = S.reset;
    const p1 = $('#rpass')?.value || '', p2 = $('#rpass2')?.value || '';
    if (p1.length < 4) return toast('A senha precisa ter pelo menos 4 caracteres.');
    if (p1 !== p2) return toast('As senhas não são iguais.');
    const r = await resetApi({ act: 'set', token: rs.token, pass: p1 });
    if (r.error) { if (r.expired) { rs.stage = 'ask'; rs.token = ''; render(); } return toast(r.error); }
    S.reset = { stage: 'ask', name: '', token: '', busy: false };
    S.authMode = 'login'; render();
    setTimeout(() => { const n = $('#lname'); if (n) n.value = r.name || ''; $('#lpw')?.focus(); }, 50);
    toast('🔐 Senha redefinida! Agora entre com a nova senha.');
  },
  next: () => { S.step = 2; render(); },
  create: async () => {
    if (S.busy) return; S.busy = true;
    const r = await api({ type: 'create', name: $('#nm').value, pass: $('#npw')?.value || '', g: S.g, char: S.char, key: undefined });
    S.busy = false;
    if (r.error) return toast(r.error);
    S.key = r.key; LS.set('uc_key', r.key); render(); connect();
  },
  login: async () => {
    if (S.busy) return; S.busy = true;
    const r = await api({ type: 'login', name: $('#lname')?.value || '', pass: $('#lpw')?.value || '', code: $('#lcode')?.value || '', key: undefined });
    S.busy = false;
    if (r.error) return toast(r.error);
    S.key = r.key; LS.set('uc_key', r.key); render(); connect();
  },
  join: async (d) => {
    const r = await api({ type: 'join', room: d.r, ...(d.pass ? { pass: d.pass } : {}) });
    if (r.needPass) {
      S.passPrompt = { room: d.r, err: d.pass ? r.error : null };
      render();
      setTimeout(() => $('#ppass')?.focus(), 50);
      return;
    }
    if (r.error) return toast(r.error);
    S.passPrompt = null;
    clearTimeout(typingStopTimer); typingActive = false; lastTypingSent = 0;
    S.room = d.r; S.planet = r.planet; S.game = r.game; S.showGame = false; S.unreadRoom = 0; S.tab = 'room'; S.members = r.members || []; S.typing = r.typing || []; S.logs = []; S.modT = null; S.activeEmote = 'idle'; S.showActions = false; render();
  },
  joinpass: async () => {
    if (!S.passPrompt) return;
    const pass = $('#ppass')?.value || '';
    if (!pass) return toast('Digite a senha do planeta.');
    await A.join({ r: S.passPrompt.room, pass });
  },
  cancelpass: () => { S.passPrompt = null; render(); },
  friendjoin: async (d) => { await A.join({ r: d.r }); },
  send: async () => {
    const i = $('#msg'); const t = i.value; if (!t) return;
    i.value = ''; clearTimeout(typingStopTimer); typingActive = false; lastTypingSent = 0;
    const r = await api({ type: 'chat', text: t }); if (r.error) toast(r.error); i.focus();
  },
  mic: async () => {
    if (S.rec) { S.rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Seu aparelho não suporta gravar áudio aqui.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return toast('Permita o microfone para gravar voz.'); }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
    const chunks = [], t0 = Date.now(); let tick, auto;
    const setBtn = () => { const b = $('#mic'); if (b) { b.className = S.rec ? 'rec' : 'sec'; b.textContent = S.rec ? `⏹ Parar ${Math.round((Date.now() - t0) / 1000)}s` : '🎤 Gravar'; } };
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      clearInterval(tick); clearTimeout(auto); stream.getTracks().forEach((x) => x.stop()); S.rec = null;
      const dur = (Date.now() - t0) / 1000; if (dur < 0.7) { setBtn(); return toast('Áudio muito curto.'); }
      const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' });
      const data = await new Promise((res) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
      S.voice = { mime: blob.type, data, dur }; setBtn(); voiceInfo();
    };
    S.rec = mr; mr.start(); setBtn(); tick = setInterval(setBtn, 500); auto = setTimeout(() => S.rec === mr && mr.stop(), 30000);
  },
  delvoice: () => { S.voice = null; voiceInfo(); },
  pinmail: (d) => {
    const targetId = String(d?.id || '');
    S.pinnedMailId = S.pinnedMailId === targetId ? null : targetId;
    const l = $('#maillist');
    if (l) l.innerHTML = mailList();
    else render();
  },
  sendmail: async () => {
    if (S.rec) return toast('Pare a gravação antes de enviar.');
    const to = $('#mto').value.trim(), text = $('#mtxt').value.trim();
    if (!to) return toast('Digite o nome de quem vai receber.');
    if (!text && !S.voice) return toast('Escreva algo ou grave um áudio.');
    const r = await api({ type: 'sendmail', to, text, ...(S.voice || {}) });
    if (r.error) return toast(r.error);
    S.voice = null; $('#mtxt').value = ''; voiceInfo();
    if (S.mailThread) { mailRefresh(); toast('✉️ Enviado!'); }
    else { S.mailThread = mailKey(r.to); S.mailThreadName = r.to; S.mailCompose = false; render(); mailRefresh(); toast(`✉️ Enviado para ${r.to}!`); }
  },
  mod: (d) => { S.showReportPick = false; S.modT = { n: d.n, j: d.j === '1' }; const b = $('#modbox'); if (b) b.innerHTML = modBox(); },
  modx: () => { S.showReportPick = false; S.modT = null; const b = $('#modbox'); if (b) b.innerHTML = ''; },
  modgo: async (d) => {
    const t = S.modT; if (!t) return;
    const r = await api({ type: 'modact', action: d.k, name: t.n, reason: $('#mreason')?.value || '' });
    if (r.error) return toast(r.error); A.modx();
  },
  togglereportpick: () => {
    S.showReportPick = !S.showReportPick;
    const b = $('#modbox'); if (b) b.innerHTML = modBox();
    if (S.showReportPick) setTimeout(() => $('#repreason')?.focus(), 20);
  },
  sendreportpick: async () => {
    const t = S.modT; if (!t) return;
    const reason = ($('#repreason')?.value || '').trim();
    const r = await api({ type: 'report', targetName: t.n, reason });
    if (r.error) return toast(r.error);
    S.showReportPick = false;
    const b = $('#modbox'); if (b) b.innerHTML = modBox();
    toast(`🚨 Denúncia #${r.report.id} enviada para os Moderadores e Dono!`);
  },
  sendreport: async () => {
    const nameEl = $('#repuser'), whyEl = $('#repwhy');
    const targetName = (nameEl?.value || '').trim();
    const reason = (whyEl?.value || '').trim();
    if (!targetName) return toast('Digite o nome do jogador denunciado.');
    const r = await api({ type: 'report', targetName, reason });
    if (r.error) return toast(r.error);
    if (nameEl) nameEl.value = '';
    if (whyEl) whyEl.value = '';
    toast(`🚨 Denúncia #${r.report.id} enviada para os Moderadores e Dono!`);
  },
  novatokickpick: async (d) => {
    const r = await api({ type: 'novatokickone', name: d.n });
    if (r.error) return toast(r.error);
    A.modx();
    toast(`🔌 ${r.name} possui autoridade e foi expulso(a) para ${r.to}!`);
  },
  soccerkick: async () => {
    if (S.busy) return; S.busy = true;
    try {
      const aim = soccer3d ? soccer3d.getAim() : { x: 0, y: 0.35 };
      const power = (S.spow || 70) / 100;
      const r = await api({ type: 'soccerKick', x: aim.x, y: aim.y, power });
      if (r.error) return toast(r.error);
      if (soccer3d) await soccer3d.playKick({ x: aim.x, y: aim.y, power, outcome: r.outcome, keeper: r.keeper });
      Object.assign(S.game, { kicks: r.over ? 0 : r.kicks, goals: r.over ? 0 : r.goals, best: r.best });
      drawGame();
      const txt = { goal: '⚽ GOOOL!', saved: '🧤 O goleiro defendeu!', post: '💥 Na trave!', out: '😬 Pra fora!' }[r.outcome] || '';
      toast([txt, r.over ? `Fim da rodada: ${r.goals}/5 gols` : '', ...(r.rewards || [])].filter(Boolean).join('\n'));
    } finally { S.busy = false; }
  },
  cavestart: async () => {
    if (S.busy) return; S.busy = true;
    try { const r = await api({ type: 'caveStart' }); if (r.error) return toast(r.error); S.game = r.state; drawGame(); }
    finally { S.busy = false; }
  },
  caveaction: async (d) => {
    if (S.busy) return; S.busy = true;
    try {
      const r = await api({ type: 'caveAction', action: d.action });
      if (r.error) return toast(r.error);
      S.game = r.state; drawGame();
      if (r.rewards?.length) toast(r.rewards.join('\n'));
    } finally { S.busy = false; }
  },
  arma: (d) => { S.arma = d.n; drawGame(); },
  zshoot: async (d) => {
    if (S.busy) return; S.busy = true;
    const targetId = +d.id;
    const armaNow = S.arma;
    const r = await api({ type: 'zshoot', id: targetId, arma: armaNow });
    S.busy = false; if (r.error) return toast(r.error);
    S.game = r.state;
    drawGame(r.stale ? null : { id: targetId, dmg: ARMAS[armaNow]?.[0] || 1, lost: r.lost || 0 });
    const m = [];
    if (r.lost) m.push(`🧟 ${r.lost} zumbi(s) chegou(aram) na base! -${r.lost} ❤️`);
    if (r.clear) m.push(`🌊 Onda ${r.clear} vencida! +${r.bonus} 🪙`);
    if (r.over) m.push(`☠️ Fim de jogo! Você chegou até a onda ${r.reached + 1}. Tente de novo!`);
    if (r.rewards) m.push(...r.rewards);
    if (m.length) toast(m.join('\n'));
  },
  buyarma: async (d) => { const r = await api({ type: 'buyarma', arma: d.i }); toast(r.error || 'Arma comprada!'); },
  togglegame: () => { S.showGame = !S.showGame; if (!S.showGame) S.unreadRoom = 0; render(); },
  bagtab: (d) => { S.bagTab = d.t; const bg = $('#menubag'); if (bg && S.me) bg.innerHTML = menuBagHtml(S.me); },
  shoptab: (d) => { S.shopTab = d.t; const sh = $('#menushop'); if (sh && S.me) sh.innerHTML = menuShopHtml(S.me); },
  previewbunny: () => { if (!preview3d || !S.me) return toast('Prévia 3D ainda está carregando.'); preview3d.update({ ...S.me, traje: 'coelho_estelar' }); toast('🐰 Prévia 3D do Traje Coelho Estelar!'); },
  previewcosmetic: (d) => {
    if (!preview3d || !S.me) return toast('Prévia 3D ainda está carregando.');
    const patch = {};
    if (d.kind === 'char') { patch.char = d.id; patch.g = CATALOG.chars[d.id]?.g || S.me.g; patch.traje = null; }
    else if (d.kind === 'roupa') { patch.outfit = d.id; patch.traje = null; }
    else if (d.kind === 'traje') patch.traje = d.id;
    else if (d.kind === 'acessorio') patch.acc = d.id;
    else if (d.kind === 'aura') patch.aura = d.id;
    preview3d.update({ ...S.me, ...patch });
    $('#preview3d')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('🧍 Prévia aplicada no modelo 3D acima! Toque em "↩ Meu avatar" para voltar.');
  },
  toggleactions: () => { S.showActions = !S.showActions; syncEmoteBar(); },
  roommenu: () => openRoomMenu(),
  rmclose: () => closeRoomMenu(),
  rm: (d) => { closeRoomMenu(); if (d.go && d.go !== 'rm') A[d.go]?.(d); },
  toggleroomtopic: () => { S.hideRoomTopic = !S.hideRoomTopic; render(); },
  emote: async (d) => {
    if (!S.room || !stage3d) return;
    const act = ROOM_ACTIONS.find((a) => a.id === d.e);
    const samePersistent = act?.persistent && S.activeEmote === d.e;
    const nextEmote = samePersistent ? 'idle' : (d.e || 'idle');
    const isPersistent = !!(nextEmote !== 'idle' && act?.persistent);
    S.activeEmote = isPersistent ? nextEmote : 'idle';
    stage3d.triggerEmote(S.me?.name, nextEmote, isPersistent);
    syncEmoteBar();
    await api({ type: 'emote', emote: nextEmote });
  },
  previewauth: (d) => {
    if (!preview3d || !S.me) return toast('Prévia 3D ainda está carregando.');
    const c = Math.min(6, Math.max(0, +d.c || 0));
    preview3d.update({ ...S.me, cargo: c, stars: Math.max(S.me.stars || 0, c === 0 ? 5 : 10), showAuth: true });
    $('#preview3d')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`👑 Prévia da autoridade ${CARGOS[c]} atrás do personagem!`);
  },
  toggleauth: async () => {
    const r = await api({ type: 'toggleauth' });
    if (r.error) return toast(r.error);
    toast(r.showAuth ? '👁️ Símbolo de autoridade ativado atrás do personagem!' : '🙈 Símbolo de autoridade oculto.');
  },
  previewmyavatar: () => { if (!preview3d || !S.me) return; preview3d.update(S.me); toast('Seu avatar voltou à prévia.'); },
  gfilter: (d) => {
    S.genderFilter = d.f;
    const sh = $('#menushop'); if (sh && S.me) sh.innerHTML = menuShopHtml(S.me);
    const bg = $('#menubag'); if (bg && S.me && S.bagTab === 'chars') bg.innerHTML = menuBagHtml(S.me);
  },
  chest: async () => { const r = await api({ type: 'openchest' }); toast(r.error || '🎁 Você ganhou:\n' + r.rewards.join('\n')); },
  equip: async (d) => { const r = await api({ type: 'equip', id: d.id }); if (r.error) toast(r.error); },
  buycosmetic: async (d) => {
    const r = await api({ type: 'buycosmetic', kind: d.kind, id: d.id });
    toast(r.error || `✨ ${r.name} desbloqueado e equipado!`);
  },
  buy: async (d) => { const r = await api({ type: 'buy', item: d.i }); toast(r.error || 'Comprado!'); },
  buyug: async (d) => { const r = await api({ type: 'buyug', kind: d.kind, id: d.id }); toast(r.error || `✨ ${r.name} ${r.kind === 'pet' || r.kind === 'traje' ? 'adquirido e equipado!' : 'criado! Veja em Planetas.'}`); if (!r.error) { const sh = $('#menushop'); if (sh && S.me) sh.innerHTML = menuShopHtml(S.me); } },
  escape: async () => {
    const tools = S.me.tools || [];
    const tool = tools.find((x) => x.type === 'pa_fuga') || tools.find((x) => x.type === 'colher_fuga');
    if (!tool) return toast('Compre uma colher ou uma Pá Lendária na Loja.');
    const r = await api({ type: 'escape', toolId: tool.id });
    toast(r.error || (r.escaped ? `🏃 Você escapou!${r.broke ? ' A ferramenta quebrou.' : ''}` : `A colher falhou. ${r.durability} uso(s) restante(s).${r.broke ? ' A colher quebrou.' : ''}`));
  },
  dcopy: async () => {
    if (await copyText(S.discord)) toast('📋 Link copiado!');
    else toast('Link: ' + S.discord);
  },
  dshare: async () => {
    const data = { title: 'UNIVERSO CHAT', text: '💬 Entre no nosso Discord!', url: S.discord };
    if (navigator.share) { try { await navigator.share(data); } catch {} } else A.dcopy();
  },
  setpass: async () => {
    const p = $('#newpw')?.value || '';
    if (p.length < 4) return toast('A senha precisa ter pelo menos 4 caracteres.');
    const r = await api({ type: 'setpass', pass: p });
    if (r.error) return toast(r.error);
    toast('🔐 Senha da conta salva!');
  },
  saveaccount: async () => {
    const r = await api({ type: 'saveaccount' });
    if (r.error) return toast(r.error);
    toast('💾 Dados da conta salvos!');
  },
  copykey: async () => {
    if (!S.key) return;
    if (await copyText(S.key)) toast('🔑 Código da conta copiado! Guarde em local seguro.');
    else toast('Código: ' + S.key);
  },
  logout: () => { LS.del('uc_key'); LS.del('uc_mail_seen'); location.reload(); },
  dlzip: async () => {
    toast('Preparando download…');
    try {
      const r = await fetch('/universo-chat.zip?key=' + encodeURIComponent(S.key || ''), { credentials: 'same-origin' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'universo-chat.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast('📦 Download iniciado!');
    } catch (e) {
      toast('Erro ao baixar o .zip (' + (e?.message || 'tente o link direto') + ').');
    }
  },
  ball: (d) => { S.ball = d.b; drawGame(); },
  ammo: (d) => { S.ammo = d.m; drawGame(); },
  traj: () => { S.traj = !S.traj; drawGame(); },
  bowl: async () => {
    if (S.busy) return; S.busy = true;
    try {
      const r = await api({ type: 'bowl', ball: S.ball });
      if (r.error) return toast(r.error);
      if (bowling3d) await bowling3d.playThrow(r.down, r.pins, r.strike);
      Object.assign(S.game, { pins: r.pins, total: r.over ? 0 : r.total, throws: r.over ? 0 : r.throws, best: r.best });
      drawGame();
      toast((r.over ? `Fim de jogo! Total: ${r.total}\n` : '') + r.rewards.join('\n'));
    } finally { S.busy = false; }
  },
  fire: async () => {
    if (S.busy) return; S.busy = true;
    try {
      const angEl = $('#ang'), powEl = $('#pow');
      const a = angEl ? +angEl.value : (S.ang || 45);
      const p = powEl ? +powEl.value : (S.pow || 25);
      const exp = S.ammo === 'explosiva';
      const r = await api({ type: 'fire', angle: a, power: p, ammo: S.ammo });
      if (r.error) return toast(r.error);
      if (cannon3d) await cannon3d.playShot({ angle: a, power: p, exp, hit: r.hit, range: r.range });
      if (S.game && r.next) {
        S.game.target = r.next.target; S.game.kind = r.next.kind; S.game.hits = r.hits;
        drawGame();
      }
      toast(r.hit ? '🎯 Acertou!\n' + r.rewards.join('\n') : `Errou! Caiu a ${Math.round(r.range)}m (alvo a ${Math.round(r.was.target)}m)`);
    } finally { S.busy = false; }
  },
  vara: (d) => {
    if (S.fishStage !== 'idle') return toast('Termine esta pescaria antes de trocar de vara.');
    S.vara = d.v;
    drawGame();
  },
  buyvara: async (d) => {
    const r = await api({ type: 'buyvara', vara: d.i });
    toast(r.error || `🎣 ${r.name} comprada!`);
  },
  fishaction: async () => {
    if (S.busy) return;
    if (S.fishStage === 'idle') {
      S.busy = true;
      try {
        const castAt = Date.now();
        const r = await api({ type: 'fishcast', vara: S.vara });
        if (r.error) return toast(r.error);
        S.fishStage = 'waiting';
        drawGame();
        if (fishing3d) await fishing3d.playCast();
        clearFishTimers();
        const remaining = Math.max(80, (r.delayMs || 1500) + 80 - (Date.now() - castAt));
        S.fishTimer = setTimeout(() => {
          if (S.fishStage !== 'waiting') return;
          S.fishStage = 'bite';
          drawGame();
          toast('⚡ Um peixe mordeu! Toque em PUXAR AGORA!');
          S.fishMissTimer = setTimeout(() => {
            if (S.fishStage !== 'bite') return;
            S.fishStage = 'idle';
            drawGame();
            toast('💨 O peixe escapou! Tente lançar novamente.');
          }, 3200);
        }, remaining);
      } finally { S.busy = false; }
      return;
    }
    if (S.fishStage === 'waiting' || S.fishStage === 'bite') {
      clearFishTimers();
      S.busy = true;
      try {
        const r = await api({ type: 'fishcatch' });
        if (r.error) { S.fishStage = 'idle'; drawGame(); return toast(r.error); }
        if (r.early || r.missed) {
          S.fishStage = 'idle';
          drawGame();
          return toast(r.msg);
        }
        S.fishStage = 'reeling';
        drawGame();
        if (fishing3d) await fishing3d.playCatch(r.fish);
        S.fishStage = 'idle';
        if (S.game) {
          S.game.caught = r.caught;
          S.game.last = { name: r.fish.name, emoji: r.fish.emoji };
        }
        drawGame();
        toast(`${r.fish.emoji} Você pescou ${r.fish.name}!\n${r.rewards.join('\n')}`);
      } finally { S.busy = false; }
    }
  },
  redeem: async () => {
    if (S.busy) return;
    const inp = $('#redeemcode');
    const code = (inp?.value || '').trim().toUpperCase();
    if (!code) return toast('Digite um código para resgatar.');
    S.busy = true;
    try {
      const r = await api({ type: 'redeem', code });
      if (r.error) return toast(r.error);
      if (inp) inp.value = '';
      toast(`🎟️ Código ${r.code} resgatado!\n${r.rewards.join('\n')}`);
    } finally { S.busy = false; }
  },
  unbug: async () => {
    S.busy = false;
    clearFishTimers();
    S.fishStage = 'idle';
    const r = await api({ type: 'unbug' });
    if (r.error) return toast(r.error);
    toast('🛠️ Desbugando personagem e sala…');
  },
  restartserver: async () => {
    if (!confirm('Reiniciar o servidor agora? Os jogadores podem desconectar por alguns instantes.')) return;
    const r = await api({ type: 'restartserver' });
    if (r.error) return toast(r.error);
    toast('🔄 Reinicialização solicitada. O servidor deve voltar online automaticamente pela hospedagem.');
  },
  updateapk: async () => {
    await api({ type: 'updateapk' });
    toast('📲 Atualizando aplicativo e limpando cache…');
    setTimeout(() => purgeApkCacheAndReload(), 350);
  },
  doapkupdate: async () => {
    S.apkUpdate = null;
    renderApkBanner();
    toast('📲 Aplicando atualização…');
    setTimeout(() => purgeApkCacheAndReload(), 350);
  },
  dismissapk: () => { S.apkUpdate = null; renderApkBanner(); },
  mailpick: (d) => {
    S.mailThread = mailKey(d.n); S.mailThreadName = d.n || ''; S.mailCompose = false;
    S.tab = 'mail';
    render();
    mailRefresh();
  },
  mailopen: (d) => {
    S.mailThread = mailKey(d.n); S.mailThreadName = d.n || ''; S.mailCompose = false;
    render();
    mailRefresh();
  },
  mailback: () => { S.mailThread = null; S.mailThreadName = ''; S.voice = null; render(); },
  mailnew: () => { S.mailCompose = !S.mailCompose; render(); if (S.mailCompose) setTimeout(() => $('#mto')?.focus(), 20); },
  friendadd: async () => {
    const inp = $('#faddname');
    const name = (inp?.value || '').trim();
    if (!name) return toast('Digite o nome do jogador.');
    const r = await api({ type: 'friendadd', name });
    if (r.error) return toast(r.error);
    if (inp) inp.value = '';
    toast(r.msg || '📨 Pedido enviado!');
  },
  friendaddpick: async (d) => {
    const r = await api({ type: 'friendadd', name: d.n });
    toast(r.error || r.msg || '📨 Pedido de amizade enviado!');
    if (!r.error && S.userSearch) runUserSearch(S.userSearch);
  },
  usersearch: () => {
    clearTimeout(userSearchTimer);
    const val = $('#usearch')?.value?.trim() || '';
    if (!val) return toast('Digite o nome do jogador para buscar.');
    runUserSearch(val);
  },
  usersearchclear: () => {
    clearTimeout(userSearchTimer);
    S.userSearch = '';
    S.userResults = null;
    S.userSearchBusy = false;
    const inp = $('#usearch');
    if (inp) inp.value = '';
    render();
  },
  friendaccept: async (d) => {
    const r = await api({ type: 'friendaccept', targetKey: d.k });
    toast(r.error || `🤝 Agora você e ${r.name} são amigos!`);
  },
  friendreject: async (d) => {
    const r = await api({ type: 'friendreject', targetKey: d.k });
    if (r.error) toast(r.error);
  },
  friendremove: async (d) => {
    const r = await api({ type: 'friendremove', targetKey: d.k });
    toast(r.error || 'Amigo removido.');
  },
  guildsearch: async () => {
    S.guildSearch = $('#gsearch')?.value?.trim() || '';
    await loadGuildList();
  },
  guildcreate: async () => {
    if (S.busy) return;
    const name = $('#gname')?.value?.trim() || '';
    const tag = $('#gtag')?.value?.trim() || '';
    const desc = $('#gdesc')?.value?.trim() || '';
    const open = $('#gopen')?.checked !== false;
    S.busy = true;
    try {
      const r = await api({ type: 'guildcreate', name, tag, desc, open });
      if (r.error) return toast(r.error);
      S.guildList = null;
      toast(`🛡️ Guilda [${r.guild.tag}] ${r.guild.name} criada!`);
    } finally { S.busy = false; }
  },
  guildjoin: async (d) => {
    const r = await api({ type: 'guildjoin', guildId: d.id });
    if (r.error) return toast(r.error);
    S.guildList = null;
    toast(`🎉 Você entrou na guilda [${r.guild.tag}] ${r.guild.name}!`);
  },
  guildinvite: async () => {
    const inp = $('#ginvname');
    const name = (inp?.value || '').trim();
    if (!name) return toast('Digite o nome do jogador para convidar.');
    const r = await api({ type: 'guildinvite', name });
    if (r.error) return toast(r.error);
    if (inp) inp.value = '';
    toast(`📩 Convite de guilda enviado para ${r.name}!`);
  },
  guildinvpick: async (d) => {
    const r = await api({ type: 'guildinvite', name: d.n });
    toast(r.error || `📩 Convite de guilda enviado para ${r.name}!`);
  },
  guildaccept: async (d) => {
    const r = await api({ type: 'guildaccept', guildId: d.id });
    if (r.error) return toast(r.error);
    S.guildList = null;
    toast(`🛡️ Bem-vindo(a) à guilda [${r.guild.tag}] ${r.guild.name}!`);
  },
  guildreject: async (d) => {
    const r = await api({ type: 'guildreject', guildId: d.id });
    if (r.error) toast(r.error);
  },
  guildsend: async () => {
    const inp = $('#gmsg');
    const text = (inp?.value || '').trim();
    if (!text) return;
    inp.value = '';
    const r = await api({ type: 'guildchat', text });
    if (r.error) toast(r.error);
    inp.focus();
  },
  guildedit: async () => {
    const desc = $('#geditdesc')?.value?.trim() || '';
    const open = $('#geditopen')?.checked !== false;
    const r = await api({ type: 'guildmanage', act: 'edit', desc, open });
    toast(r.error || '⚙️ Configurações da guilda atualizadas!');
  },
  guilddisband: async () => {
    if (!S.confirmDisband) {
      S.confirmDisband = true;
      render();
      toast('Toque mais uma vez em Confirmar Dissolver para apagar a guilda.');
      return;
    }
    S.confirmDisband = false;
    const r = await api({ type: 'guildmanage', act: 'disband' });
    toast(r.error || '💥 Guilda dissolvida.');
  },
  guildmanage: async (d) => {
    const r = await api({ type: 'guildmanage', act: d.act, targetKey: d.k || '' });
    if (r.error) return toast(r.error);
    if (d.act === 'leave') { S.guildList = null; toast('🚪 Você saiu da guilda.'); }
    else if (d.act === 'promote') toast('⚔️ Membro promovido a Oficial!');
    else if (d.act === 'demote') toast('⬇️ Oficial rebaixado a Membro.');
    else if (d.act === 'transfer') toast('👑 Liderança transferida!');
    else if (d.act === 'kick') toast('🚪 Membro removido da guilda.');
  },
  plugnovato: async (d) => {
    const r = await api({ type: 'plugnovato', act: d.act });
    if (r.error) return toast(r.error);
    const kicked = r.kicked?.length ? ` · Expulsos: ${r.kicked.join(', ')}` : '';
    if (d.act === 'toggle') toast(`🔌 Plugin Novatos ${r.enabled ? 'ATIVADO' : 'DESATIVADO'}${kicked}`);
    else if (d.act === 'sweep') toast(r.kicked?.length ? `⚡ Expulsos dos Novatos: ${r.kicked.join(', ')}` : '⚡ Nenhuma autoridade nos planetas Novatos.');
    else if (d.act === 'exemptMods') toast(`🔌 Isenção de Moderadores: ${r.exemptMods ? 'Ligada' : 'Desligada'}${kicked}`);
    else if (d.act === 'exemptOwner') toast(`🔌 Isenção do Dono: ${r.exemptOwner ? 'Ligada' : 'Desligada'}${kicked}`);
  },
  repfilter: (d) => {
    S.repFilter = d.f === 'all' ? 'all' : 'pendente';
    render();
  },
  reportreview: async (d) => {
    const note = $(`#repnote-${d.id}`)?.value?.trim() || '';
    const r = await api({ type: 'reportreview', id: +d.id, action: d.act, note });
    if (r.error) return toast(r.error);
    toast(`✅ Denúncia #${r.report.id} ${r.report.status} (${r.report.action})!`);
  },
  opentopics: (d) => {
    S.tab = 'social';
    S.socialTab = 'topics';
    if (d.id) S.expandedTopicId = +d.id;
    render();
  },
  closeroomtopic: () => {
    S.hideRoomTopic = true;
    const rt = $('#roomtopic');
    if (rt) rt.remove();
  },
  togglenewtopic: () => {
    S.showNewTopic = !S.showNewTopic;
    render();
    if (S.showNewTopic) setTimeout(() => $('#nttitle')?.focus(), 20);
  },
  toggletopic: (d) => {
    const id = +d.id;
    S.expandedTopicId = S.expandedTopicId === id ? -1 : id;
    const sb = $('#socialbody');
    if (sb && S.me && S.socialTab === 'topics') sb.innerHTML = topicsBodyHtml(S.me);
    else render();
  },
  topiccreate: async () => {
    const title = ($('#nttitle')?.value || '').trim();
    const body = ($('#ntbody')?.value || '').trim();
    const pinned = !!$('#ntpin')?.checked;
    const r = await api({ type: 'topiccreate', title, body, pinned });
    if (r.error) return toast(r.error);
    S.showNewTopic = false;
    if (r.topic?.id) S.expandedTopicId = r.topic.id;
    toast('📌 Tópico publicado!');
    render();
  },
  topiclike: async (d) => {
    const r = await api({ type: 'topiclike', id: +d.id });
    if (r.error) return toast(r.error);
  },
  topicreply: async (d) => {
    const id = +d.id;
    const inp = $(`#treply-${id}`);
    const text = (inp?.value || '').trim();
    if (!text) return toast('Escreva um comentário.');
    const r = await api({ type: 'topicreply', id, text });
    if (r.error) return toast(r.error);
    if (inp) inp.value = '';
    S.expandedTopicId = id;
    toast('💬 Comentário enviado!');
  },
  topicmanage: async (d) => {
    const r = await api({ type: 'topicmanage', id: +d.id, act: d.act });
    if (r.error) return toast(r.error);
    toast(d.act === 'delete' ? '🗑️ Tópico removido.' : d.act === 'pin' ? '📌 Fixação atualizada!' : '🔒 Status do tópico atualizado!');
  },
  topicdelreply: async (d) => {
    const r = await api({ type: 'topicmanage', id: +d.id, act: 'deletereply', replyId: d.rid });
    if (r.error) return toast(r.error);
  },
  fbcat: (d) => {
    S.fbCat = FB_CATS[d.c] ? d.c : 'sugestao';
    document.querySelectorAll('#fbcats [data-a="fbcat"]').forEach((b) => b.classList.toggle('on', b.dataset.c === S.fbCat));
  },
  fbrating: (d) => {
    S.fbRating = Math.min(5, Math.max(1, +d.r || 5));
    document.querySelectorAll('#fbstars [data-a="fbrating"]').forEach((b) => b.classList.toggle('on', (+b.dataset.r || 0) <= S.fbRating));
  },
  fbsubmit: async () => {
    if (S.fbBusy) return;
    const title = ($('#fbtitle')?.value || '').trim();
    const text = ($('#fbtext')?.value || '').trim();
    if (title.length < 3 || text.length < 5) return toast('Preencha o título (mín. 3 letras) e os detalhes (mín. 5 letras).');
    S.fbBusy = true;
    const btn = $('#fbsubmitbtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Enviando…'; }
    const r = await api({ type: 'feedbackcreate', category: S.fbCat, rating: S.fbRating, title, text });
    S.fbBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = '📤 Enviar Feedback'; }
    if (r.error) return toast(r.error);
    if ($('#fbtitle')) $('#fbtitle').value = '';
    if ($('#fbtext')) $('#fbtext').value = '';
    if ($('#fblen')) $('#fblen').textContent = '0/360';
    toast('📝 Feedback enviado! Obrigado pela contribuição.');
  },
  fbfilter: (d) => {
    S.fbFilter = d.f || 'all';
    render();
  },
  fbsort: (d) => {
    S.fbSort = d.s === 'top' ? 'top' : 'recent';
    render();
  },
  fbvote: async (d) => {
    const r = await api({ type: 'feedbackvote', id: +d.id });
    if (r.error) toast(r.error);
  },
  fbdelete: async (d) => {
    const r = await api({ type: 'feedbackmanage', id: +d.id, act: 'delete' });
    if (r.error) return toast(r.error);
    toast('🗑️ Feedback removido.');
  },
  fbreview: async (d) => {
    const id = +d.id;
    const status = $(`#fbstatus-${id}`)?.value || 'analise';
    const reply = ($(`#fbreply-${id}`)?.value || '').trim();
    const r = await api({ type: 'feedbackmanage', id, act: 'review', status, reply });
    if (r.error) return toast(r.error);
    toast(`✅ Feedback #${id} atualizado!`);
  },
  picknamecolor: async (d) => {
    const bio = $('#biopick')?.value ?? S.me?.bio ?? '';
    const r = await api({ type: 'updateprofile', bio, nameColor: d.c || null });
    if (r.error) return toast(r.error);
    toast(d.c ? '🎨 Cor do nome no chat atualizada!' : '🎨 Cor padrão do cargo restaurada!');
  },
  saveprofile: async () => {
    const bio = ($('#biopick')?.value || '').trim();
    const r = await api({ type: 'updateprofile', bio, nameColor: S.me?.nameColor || null });
    if (r.error) return toast(r.error);
    $('#biopick')?.blur();
    toast('📝 Biografia salva!');
  },
  clearbio: async () => {
    const r = await api({ type: 'updateprofile', bio: '', nameColor: S.me?.nameColor || null });
    if (r.error) return toast(r.error);
    toast('📝 Biografia limpa.');
  },
  emailsend: async () => {
    const email = ($('#emailinput')?.value || '').trim();
    if (!email) return toast('Digite seu e-mail.');
    const r = await emailApi({ act: 'send', email });
    if (r.error) return toast(r.error);
    S.emailStage = 'code'; refreshEmailCard();
    toast('📨 Código enviado! Veja também a caixa de spam.');
    setTimeout(() => $('#emailcode')?.focus(), 50);
  },
  emailconfirm: async () => {
    const code = ($('#emailcode')?.value || '').trim();
    if (!/^\d{6}$/.test(code)) return toast('Digite os 6 números do código.');
    const r = await emailApi({ act: 'confirm', code });
    if (r.error) return toast(r.error);
    S.emailStage = 'idle'; toast('✅ E-mail confirmado!');
    setTimeout(refreshEmailCard, 400);
  },
  emailcancel: () => { S.emailStage = 'idle'; refreshEmailCard(); },
  emailremove: async () => {
    if (!confirm('Remover o e-mail de recuperação desta conta?')) return;
    const r = await emailApi({ act: 'remove' });
    if (r.error) return toast(r.error);
    S.emailStage = 'idle'; toast('📧 E-mail removido.');
    setTimeout(refreshEmailCard, 400);
  },
  codeopen: async () => {
    S.code.open = true; S.code.err = ''; refreshCode();
    const r = await codeApi({ act: 'status' });
    S.code.enabled = !!r.enabled; S.code.unlocked = !!r.unlocked;
    if (r.error) S.code.err = r.error;
    refreshCode();
    if (S.code.unlocked) await codeLoadList();
  },
  codeclose: () => { S.code.open = false; refreshCode(); },
  codeunlock: async () => {
    const r = await codeApi({ act: 'unlock', pass: $('#codepass')?.value || '' });
    if (r.error) { S.code.err = r.error; refreshCode(); return toast(r.error); }
    S.code.unlocked = true; S.code.err = '';
    toast('🔓 Editor desbloqueado por 30 minutos.');
    await codeLoadList();
  },
  codesave: async (d) => {
    const c = S.code;
    if (c.readonly || c.busy) return;
    if (c.draft === c.orig) return toast('Nada para salvar.');
    c.busy = true; c.err = ''; refreshCode();
    const r = await codeApi({ act: 'save', name: c.file, content: c.draft });
    c.busy = false;
    if (r.error) { c.err = r.error; c.errLine = r.line || null; if (r.locked) c.unlocked = false; refreshCode(); return toast(r.error); }
    c.orig = c.draft; c.modified = true; c.errLine = null; c.backups = null;
    const f = (c.files || []).find((x) => x.name === c.file); if (f) f.modified = true;
    refreshCode();
    toast(`💾 ${c.file} salvo! (backup criado)`);
    if (d?.reload) setTimeout(() => purgeApkCacheAndReload(), 500);
  },
  codediscard: () => {
    const c = S.code;
    if (c.draft === c.orig) return;
    if (!confirm('Descartar as alterações não salvas deste arquivo?')) return;
    c.draft = c.orig; c.err = ''; c.errLine = null; refreshCode();
  },
  codebackups: async () => {
    const c = S.code;
    if (c.backups) { c.backups = null; return refreshCode(); }
    const r = await codeApi({ act: 'backups', name: c.file });
    if (r.error) return toast(r.error);
    c.backups = r.backups || []; refreshCode();
  },
  coderestore: async (d) => {
    const c = S.code;
    if (!confirm('Restaurar esta versão? O arquivo atual vira uma nova versão de backup.')) return;
    const r = await codeApi({ act: 'restore', name: c.file, id: d.id });
    if (r.error) return toast(r.error);
    Object.assign(c, { orig: r.content, draft: r.content, modified: true, err: '', errLine: null, backups: null });
    refreshCode(); toast('🕘 Versão restaurada.');
  },
  codereset: async () => {
    const c = S.code;
    if (!confirm('Voltar este arquivo à versão original do servidor? (a sua versão fica nos backups)')) return;
    const r = await codeApi({ act: 'reset', name: c.file });
    if (r.error) return toast(r.error);
    Object.assign(c, { orig: r.content, draft: r.content, modified: false, err: '', errLine: null, backups: null });
    const f = (c.files || []).find((x) => x.name === c.file); if (f) f.modified = false;
    refreshCode(); toast('♻️ Arquivo voltou ao original.');
  },
  codegoto: (d) => {
    const ta = $('#codetext'); if (!ta) return;
    const n = Math.max(1, parseInt(d?.line || $('#codeline')?.value, 10) || 1);
    const lines = ta.value.split('\n');
    const idx = Math.min(n, lines.length) - 1;
    let off = 0; for (let i = 0; i < idx; i++) off += lines[i].length + 1;
    ta.focus(); ta.setSelectionRange(off, off + (lines[idx] || '').length);
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 19;
    ta.scrollTop = Math.max(0, (idx - 4) * lh);
    ta.scrollIntoView({ block: 'nearest' });
  },
  pickvcam: () => $('#vphotocam')?.click(),
  pickvfile: () => $('#vphotofile')?.click(),
  clearvphoto: () => {
    S.verifyDraft = null;
    const mv = $('#menuverify');
    if (mv && S.me) mv.innerHTML = menuVerifyHtml(S.me);
  },
  verifysubmit: async () => {
    if (!S.verifyDraft) return toast('Escolha ou tire uma foto primeiro.');
    if (!$('#vconfirm')?.checked) return toast('Marque a confirmação de que "UNIVERSO" está visível no papel.');
    const r = await api({ type: 'verifysubmit', data: S.verifyDraft.data, mime: S.verifyDraft.mime, confirmedUniverso: true });
    if (r.error) return toast(r.error);
    S.verifyDraft = null;
    toast('🪪 Foto enviada! Moderadores e Dono vão confirmar se é Real ou Fake.');
  },
  verfilter: (d) => {
    S.verFilter = d.f === 'all' ? 'all' : 'pending';
    render();
  },
  verifyreview: async (d) => {
    const note = $(`#vnote-${d.k}`)?.value?.trim() || '';
    const r = await api({ type: 'verifyreview', targetKey: d.k, decision: d.dec, note });
    if (r.error) return toast(r.error);
    toast(`🪪 ${r.name}: marcado como ${d.dec === 'real' ? '✅ Pessoa Real' : d.dec === 'fake' ? '🚫 Fake' : '🔄 Nova foto solicitada'}!`);
  },
  viewuser: (d) => {
    const name = d?.n || S.me?.name;
    if (name) openUserProfile(name);
  },
  closeprofile: () => closeUserProfile(),
  profilego: (d) => {
    const r = d.r;
    closeUserProfile();
    if (r) A.join({ r });
  },
  profilefriend: async (d) => {
    const name = d.n;
    if (!name) return;
    const r = await api({ type: 'friendadd', name });
    toast(r.error || r.msg || '📨 Pedido de amizade enviado!');
    if (!r.error && S.profileModal?.name === name) openUserProfile(name);
  },
  profileguildinv: async (d) => {
    const name = d.n;
    if (!name) return;
    const r = await api({ type: 'guildinvite', name });
    toast(r.error || `📩 Convite de guilda enviado para ${r.name}!`);
    if (!r.error && S.profileModal?.name === name) openUserProfile(name);
  },
  profilemail: (d) => {
    const n = d.n;
    closeUserProfile();
    A.mailpick({ n });
  },
  profiletogglereport: () => {
    if (!S.profileModal) return;
    S.profileModal.showReport = !S.profileModal.showReport;
    renderProfileModal();
    if (S.profileModal.showReport) setTimeout(() => $('#uprepreason')?.focus(), 20);
  },
  profilesendreport: async () => {
    const pm = S.profileModal;
    if (!pm?.profile) return;
    const reason = ($('#uprepreason')?.value || '').trim();
    if (!reason) return toast('Escreva o motivo da denúncia.');
    const r = await api({ type: 'report', targetName: pm.profile.name, reason });
    if (r.error) return toast(r.error);
    pm.showReport = false;
    renderProfileModal();
    toast(`🚨 Denúncia #${r.report.id} enviada para os Moderadores e Dono!`);
  },
  profileedit: () => {
    closeUserProfile();
    S.tab = 'menu';
    render();
    setTimeout(() => $('#menuprofile')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  },
  profilemod: async (d) => {
    const pm = S.profileModal;
    if (!pm?.profile) return;
    const p = pm.profile;
    if (d.k === 'novatokick') {
      const r = await api({ type: 'novatokickone', name: p.name });
      if (r.error) return toast(r.error);
      toast(`🔌 ${r.name} foi expulso(a) do Novato para ${r.to}!`);
      return openUserProfile(p.name);
    }
    const text = d.k === 'soltar' ? `/soltar ${p.name}` : `/${d.k} ${p.name}`;
    const r = await api({ type: 'chat', text });
    if (r.error) return toast(r.error);
    toast(`🛡️ Ação "${d.k}" aplicada em ${p.name}.`);
    setTimeout(() => { if (S.profileModal?.name === p.name) openUserProfile(p.name); }, 200);
  },
};
function formatRelDate(ts) {
  if (!ts) return 'Recente';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function closeUserProfile() {
  disposeModal3D();
  S.profileModal = null;
  const ov = $('#umodal');
  if (ov) { ov.hidden = true; ov.innerHTML = ''; }
}
function syncModal3D() {
  const el = $('#umodal3d');
  const p = S.profileModal?.profile;
  if (!el || !p) { disposeModal3D(); return; }
  if (!modal3d || modalElRef !== el) {
    disposeModal3D();
    modalElRef = el;
    try {
      modal3d = mountPreview(el, {
        name: p.name,
        g: p.g,
        char: p.char,
        cargo: p.cargo,
        stars: p.stars || 0,
        showAuth: p.showAuth !== false,
        vip: p.vip,
        outfit: p.outfit,
        traje: p.traje,
        acc: p.acc,
        aura: p.aura,
        pet: p.pet,
      });
    } catch {
      modal3d = null; modalElRef = null;
      el.innerHTML = '<div class="muted" style="padding:56px 12px;text-align:center">Avatar 3D indisponível neste dispositivo.</div>';
    }
  } else {
    modal3d.update({
      name: p.name, g: p.g, char: p.char, cargo: p.cargo, stars: p.stars || 0, showAuth: p.showAuth !== false,
      vip: p.vip, outfit: p.outfit, traje: p.traje, acc: p.acc, aura: p.aura, pet: p.pet,
    });
  }
}
function profileModalHtml() {
  const pm = S.profileModal;
  if (!pm) return '';
  if (pm.loading) {
    return `<div class="umodal" role="dialog" aria-modal="true" aria-label="Informações do jogador">
      <div class="umodal-handle"></div>
      <div class="umodal-head"><span class="umodal-kicker">Perfil do Viajante</span><button type="button" class="umodal-close" data-a="closeprofile" aria-label="Fechar">✕</button></div>
      <div class="muted" style="padding:36px 0;text-align:center">Carregando informações de <b>${esc(pm.name)}</b>…</div>
    </div>`;
  }
  if (pm.error || !pm.profile) {
    return `<div class="umodal" role="dialog" aria-modal="true" aria-label="Informações do jogador">
      <div class="umodal-handle"></div>
      <div class="umodal-head"><span class="umodal-kicker">Perfil do Viajante</span><button type="button" class="umodal-close" data-a="closeprofile" aria-label="Fechar">✕</button></div>
      <div class="muted" style="padding:28px 0;text-align:center">${esc(pm.error || 'Não foi possível carregar este perfil.')}</div>
    </div>`;
  }
  const p = pm.profile;
  const charName = CATALOG.chars[p.char]?.name || (p.g === 'f' ? 'Viajante Estelar' : 'Piloto Estelar');
  const trajeName = p.traje ? (CATALOG.trajes[p.traje]?.name || p.traje) : 'Nenhum';
  const outfitName = p.outfit ? (CATALOG.outfits[p.outfit]?.name || p.outfit) : 'Padrão';
  const accName = p.acc ? (CATALOG.accessories[p.acc]?.name || p.acc) : 'Nenhum';
  const auraName = p.aura ? (CATALOG.auras[p.aura]?.name || p.aura) : 'Nenhuma';
  const verText = p.verifyStatus === 'real'
    ? '<span class="ver-badge real">✅ Pessoa Real (UNIVERSO)</span>'
    : p.verifyStatus === 'fake'
      ? '<span class="ver-badge fake">🚫 Marcado como Fake</span>'
      : p.verifyStatus === 'pending'
        ? '<span class="ver-badge pending">🕒 Verificação em análise</span>'
        : '<span class="ver-badge none">⏳ Não verificado</span>';
  const gRole = p.guild?.role === 'leader' ? '👑 Líder' : p.guild?.role === 'officer' ? '⚔️ Oficial' : 'Membro';
  const guildLine = p.guild ? `[${p.guild.tag}] ${p.guild.name} · ${gRole} (${p.guild.membersCount})` : 'Sem guilda';
  const statusLine = p.online ? `🟢 Online em <strong>${esc(p.room || 'Menu')}</strong>` : `⚪ Offline · visto em ${formatRelDate(p.lastSeen)}`;
  const canModAct = (S.me?.cargo || 0) >= 2 && (p.cargo || 0) < (S.me?.cargo || 0) && !p.isSelf;
  const canNovatoKick = (S.me?.cargo || 0) >= 2 && p.online && /^novato\b/i.test(p.room || '') && (p.cargo || 0) >= 1 && ((p.cargo || 0) < (S.me?.cargo || 0) || (S.me?.cargo || 0) >= 6);
  const friendBtn = p.isSelf
    ? ''
    : p.isFriend
      ? '<button type="button" class="sec" disabled>🤝 Já é amigo</button>'
      : p.reqReceived
        ? `<button type="button" data-a="profilefriend" data-n="${esc(p.name)}">✅ Aceitar Amizade</button>`
        : p.reqSent
          ? '<button type="button" class="sec" disabled>⏳ Pedido Enviado</button>'
          : `<button type="button" class="sec" data-a="profilefriend" data-n="${esc(p.name)}">👥 + Amigo</button>`;

  return `<div class="umodal" role="dialog" aria-modal="true" aria-label="Informações de ${esc(p.name)}">
    <div class="umodal-handle"></div>
    <div class="umodal-head">
      <span class="umodal-kicker">Ficha do Jogador</span>
      <button type="button" class="umodal-close" data-a="closeprofile" aria-label="Fechar">✕</button>
    </div>
    <div class="umodal-hero">
      <div id="umodal3d" class="umodal-3d"><div class="umodal-3d-hint">Gire o avatar 3D</div></div>
      <div class="umodal-id">
        <div class="umodal-name">
          ${p.guild ? `<span class="gtag">[${esc(p.guild.tag)}]</span>` : ''}<span style="${nameStyleAttr(p.nameColor, p.cargo)}">${p.vip ? '👑' : ''}${esc(p.name)}</span>${verText}
        </div>
        <div class="umodal-meta">
          <strong>${esc(p.cargoName)}</strong>${p.vip ? ' · <strong>VIP</strong>' : ''} · ${p.g === 'f' ? 'Feminino' : 'Masculino'} · ${statusLine}
        </div>
        ${p.prison ? `<div class="umodal-warn">🔒 Preso por ${esc(p.prison.by || 'Moderação')}: ${esc(p.prison.reason)}</div>` : ''}
      </div>
    </div>
    <div class="umodal-bio ${p.bio ? '' : 'empty'}">${p.bio ? `📝 ${esc(p.bio)}` : 'Este jogador ainda não adicionou uma biografia pessoal.'}</div>
    <div class="umodal-stats">
      <div class="umodal-stat"><span>Estrelas</span><b>⭐ ${p.stars}</b></div>
      <div class="umodal-stat"><span>Cosmos</span><b>🪙 ${p.coins}</b></div>
      <div class="umodal-stat"><span>Amigos</span><b>🤝 ${p.friendsCount}</b></div>
      <div class="umodal-stat"><span>Desde</span><b>${formatRelDate(p.createdAt)}</b></div>
    </div>
    <div class="umodal-section">
      <div class="umodal-stitle">Visual e Guilda</div>
      <div class="umodal-kv-list">
        <div class="umodal-kv"><span>Personagem</span><b>${esc(charName)}</b></div>
        <div class="umodal-kv"><span>Traje</span><b>${esc(trajeName)}</b></div>
        <div class="umodal-kv"><span>Roupa</span><b>${esc(outfitName)}</b></div>
        <div class="umodal-kv"><span>Acessório / Pet</span><b>${esc(accName)}${p.pet ? ` · ${esc(p.pet)}` : ''}</b></div>
        <div class="umodal-kv"><span>Skin de Aura</span><b>${esc(auraName)}</b></div>
        <div class="umodal-kv"><span>Guilda</span><b>${esc(guildLine)}</b></div>
      </div>
    </div>
    <div class="umodal-section">
      <div class="umodal-stitle">Recordes nos Minigames</div>
      <div class="umodal-records">
        <div class="umodal-rec"><span>🎳 Boliche</span><b>${p.best?.bowling || 0}</b></div>
        <div class="umodal-rec"><span>💥 Canhão</span><b>${p.best?.cannon || 0}</b></div>
        <div class="umodal-rec"><span>🧟 Zumbi</span><b>${p.best?.zumbi || 0}</b></div>
        <div class="umodal-rec"><span>🎣 Pesca</span><b>${p.best?.fishing || 0}</b></div>
      </div>
    </div>
    ${pm.showReport && !p.isSelf ? `<div class="umodal-section">
      <div class="row">
        <input type="text" id="uprepreason" maxlength="180" placeholder="Motivo da denúncia…" autocomplete="off" style="flex:1">
        <button type="button" data-a="profilesendreport">Enviar</button>
      </div>
    </div>` : ''}
    <div class="umodal-actions">
      ${p.isSelf ? `<button type="button" data-a="profileedit">✏️ Editar Biografia & Cor</button>` : `
        ${p.online && p.room ? `<button type="button" data-a="profilego" data-r="${esc(p.room)}">🚀 Ir até ${esc(p.room)}</button>` : ''}
        ${friendBtn}
        ${p.canInviteGuild ? `<button type="button" class="sec" data-a="profileguildinv" data-n="${esc(p.name)}">🛡️ Convidar Guilda</button>` : ''}
        <button type="button" class="sec" data-a="profilemail" data-n="${esc(p.name)}">✉️ Correio</button>
        <button type="button" class="sec" data-a="profiletogglereport">🚨 Denunciar</button>
      `}
      ${canModAct ? (p.prison ? `<button type="button" class="sec" data-a="profilemod" data-k="soltar">🔓 Soltar</button>` : `<button type="button" class="danger" data-a="profilemod" data-k="prender">🔒 Prender</button><button type="button" class="sec" data-a="profilemod" data-k="expulsar">🚪 Expulsar</button>`) : ''}
      ${canNovatoKick ? `<button type="button" class="danger" data-a="profilemod" data-k="novatokick">🔌 Expulsar Novato</button>` : ''}
    </div>
  </div>`;
}
function renderProfileModal() {
  const ov = $('#umodal');
  if (!ov) return;
  if (!S.profileModal) {
    disposeModal3D();
    ov.hidden = true;
    ov.innerHTML = '';
    return;
  }
  disposeModal3D();
  ov.hidden = false;
  ov.innerHTML = profileModalHtml();
  if (S.profileModal.profile) syncModal3D();
}
async function openUserProfile(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName || !S.key) return;
  S.profileModal = { loading: true, name: cleanName, profile: null, error: null, showReport: false };
  renderProfileModal();
  const r = await api({ type: 'userinfo', name: cleanName });
  if (!S.profileModal || S.profileModal.name !== cleanName) return;
  if (r.error || !r.profile) {
    S.profileModal = { loading: false, name: cleanName, profile: null, error: r.error || 'Jogador não encontrado.', showReport: false };
  } else {
    S.profileModal = { loading: false, name: cleanName, profile: r.profile, error: null, showReport: false };
  }
  renderProfileModal();
}
async function readVerifyImageFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) return toast('Selecione um arquivo de imagem válido.');
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    let dataUrl = cv.toDataURL('image/jpeg', 0.78);
    if (dataUrl.length > 260000) dataUrl = cv.toDataURL('image/jpeg', 0.52);
    const data = dataUrl.split(',')[1] || '';
    if (!data || data.length > 285000) return toast('Imagem grande demais. Tente outra foto.');
    S.verifyDraft = { mime: 'image/jpeg', data, previewUrl: dataUrl };
    const mv = $('#menuverify');
    if (mv && S.me) mv.innerHTML = menuVerifyHtml(S.me);
  } catch {
    toast('Não foi possível ler essa imagem.');
  }
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'codefile') {
    const c = S.code, name = e.target.value;
    if (c.draft !== c.orig && !confirm('Há alterações não salvas. Trocar de arquivo e descartá-las?')) { refreshCode(); return; }
    codeLoadFile(name);
    return;
  }
  if (e.target.id === 'vphotofile' || e.target.id === 'vphotocam') {
    const f = e.target.files?.[0];
    if (f) readVerifyImageFile(f);
    e.target.value = '';
  }
});
document.addEventListener('click', (e) => {
  if (e.target.id === 'rmenu') { spatialAudio.playUi('close'); closeRoomMenu(); return; }
  if (e.target.id === 'umodal') { spatialAudio.playUi('close'); closeUserProfile(); return; }
  const b = e.target.closest('[data-a]');
  if (b) {
    const act = b.dataset.a;
    if (act === 'tab') {
      const tabs = ['planets', 'social', 'mail', 'room', 'events', 'feedback', 'menu', 'ownercode'];
      spatialAudio.playUi('nav', Math.max(0, tabs.indexOf(b.dataset.t)));
    } else if (act === 'join' || act === 'friendjoin' || act === 'profilego') {
      spatialAudio.playUi('planet');
    } else if (act === 'closeprofile' || act === 'rmclose' || act === 'modx' || act === 'cancelpass' || act === 'closeroomtopic' || act === 'dismissapk') {
      spatialAudio.playUi('close');
    } else if (act !== 'toggleaudio') {
      spatialAudio.playUi('click');
    }
    A[act]?.(b.dataset);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#rmenu') && !$('#rmenu').hidden) { closeRoomMenu(); return; }
  if (e.key === 'Escape' && S.profileModal) { closeUserProfile(); return; }
  if (e.key === 'Tab' && e.target.id === 'codetext' && !e.target.readOnly) {
    e.preventDefault();
    e.target.setRangeText('  ', e.target.selectionStart, e.target.selectionEnd, 'end');
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (e.key !== 'Enter') return;
  if (e.target.id === 'rname') return A.resetrequest();
  if (e.target.id === 'rcode') return A.resetverify();
  if (e.target.id === 'rpass' || e.target.id === 'rpass2') return A.resetset();
  if (e.target.id === 'emailinput') return A.emailsend();
  if (e.target.id === 'emailcode') return A.emailconfirm();
  if (e.target.id === 'codepass') return A.codeunlock();
  if (e.target.id === 'codeline') return A.codegoto({});
  if (e.target.id === 'msg') A.send();
  else if (e.target.id === 'fbtitle') $('#fbtext')?.focus();
  else if (e.target.id?.startsWith('fbreply-')) A.fbreview({ id: e.target.id.slice(8) });
  else if (e.target.id === 'uprepreason') A.profilesendreport();
  else if (e.target.id === 'redeemcode') A.redeem();
  else if (e.target.id === 'aimusicprompt') A.genaimusic();
  else if (e.target.id === 'ppass') A.joinpass();
  else if (e.target.id === 'usearch') A.usersearch();
  else if (e.target.id === 'nttitle') $('#ntbody')?.focus();
  else if (e.target.id?.startsWith('treply-')) A.topicreply({ id: e.target.id.slice(7) });
  else if (e.target.id === 'faddname') A.friendadd();
  else if (e.target.id === 'repwhy') A.sendreport();
  else if (e.target.id === 'repreason') A.sendreportpick();
  else if (e.target.id === 'gmsg') A.guildsend();
  else if (e.target.id === 'ginvname') A.guildinvite();
  else if (e.target.id === 'gsearch') A.guildsearch();
  else if (e.target.id === 'nm' || e.target.id === 'npw') A.create();
  else if (e.target.id === 'lname' || e.target.id === 'lpw' || e.target.id === 'lcode') A.login();
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'codetext') {
    const c = S.code;
    if (!c.readonly) c.draft = e.target.value;
    const st = $('#codestat');
    if (st) st.textContent = `${c.file} · ${codeLines(c.draft)} linhas${c.modified ? ' · ● versão editada' : ' · original'}${c.draft !== c.orig ? ' · ✏️ não salvo' : ''}`;
    return;
  }
  if (e.target.id === 'msg') setMyTyping(!!e.target.value.trim());
  else if (e.target.id === 'aimusicprompt') S.aiMusicPrompt = e.target.value;
  else if (e.target.id === 'fbtext') {
    const fl = $('#fblen');
    if (fl) fl.textContent = `${e.target.value.length}/360`;
  } else if (e.target.id === 'biopick') {
    const bl = $('#biolen');
    if (bl) bl.textContent = `${e.target.value.length}/160`;
  } else if (e.target.id === 'usearch') {
    clearTimeout(userSearchTimer);
    const val = e.target.value.trim();
    const clr = $('#usearchclr');
    if (clr) clr.hidden = !val;
    if (!val) {
      S.userSearch = '';
      S.userResults = null;
      S.userSearchBusy = false;
      const w = $('#usearchlist');
      if (w) w.innerHTML = '';
      return;
    }
    userSearchTimer = setTimeout(() => runUserSearch(val), 220);
  }
});
document.addEventListener('focusout', (e) => { if (e.target.id === 'msg') setMyTyping(false); });

load3DAll().catch(() => {}).then(() => {
  render();
  if (S.key) connect();
});
