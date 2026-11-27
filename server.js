// UNIVERSO CHAT — servidor sem dependências de runtime (Node 18+; o `three` só serve o visual 3D). Tempo real via SSE + POST.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import { createGithubStore } from './githubstore.js';

// Firebase/Firestore: espelha e restaura contas, guildas e dados do jogo na nuvem.
let firestore = null;
const FIREBASE_PROJECT = (process.env.FIREBASE_PROJECT_ID || 'universo-chat-3d-3d2b5').trim();
try {
  const firebaseAdmin = await import('firebase-admin');
  if (!firebaseAdmin.apps.length) {
    const rawCred = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    if (!rawCred) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não definido');
    }
    let parsedCred = JSON.parse(rawCred);
    if (typeof parsedCred === 'string') parsedCred = JSON.parse(parsedCred);
    if (parsedCred && typeof parsedCred.private_key === 'string') {
      parsedCred.private_key = parsedCred.private_key.replace(/\\n/g, '\n');
    }
    const credential = firebaseAdmin.credential.cert(parsedCred);
    firebaseAdmin.initializeApp({
      credential,
      projectId: parsedCred.project_id || FIREBASE_PROJECT || undefined,
    });
  }
  firestore = firebaseAdmin.firestore();
  console.log(`Firebase Firestore conectado (projeto: ${FIREBASE_PROJECT}).`);
} catch (e) {
  console.warn('Firebase Firestore inativo (usando armazenamento local):', e.message);
}

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUB = fs.existsSync(path.join(DIR, 'public')) ? path.join(DIR, 'public') : DIR;
const PORT = Number(process.env.PORT) || 3000;
const FILE = process.env.DATA_FILE || path.join(DIR, 'data.json');
const ENV_DEV_NAME = (process.env.DEV_NAME || '').trim();
const DEV_NAME = (!ENV_DEV_NAME || /^(seunome|IIBERTOX|admin|dono)$/i.test(ENV_DEV_NAME)) ? 'IIBERTOX' : ENV_DEV_NAME;
const DEV_PASS = process.env.DEV_PASS || '';
const isValidOwnerPass = (pw) => pw === '' || (!!process.env.DEV_PASS && pw === process.env.DEV_PASS);
const CARGOS = ['Viajante', 'Sentinela', 'Comandante', 'Arconte', 'Celestial', 'Arquiteto', 'Dono'];
const R = { GUARD: 1, MOD: 2, IMP: 3, SOB: 4, ARQ: 5, DEV: 6 };
const TYPES = ['chat', 'prison', 'vip', 'bowling', 'cannon', 'zombie', 'fishing', 'cave', 'soccer'];

let db = {
  users: {},
  planets: [
    ...[1, 2, 3, 4].map((i) => ({ n: `Novato ${il},
    { n: 'Canhão', t: 'cannon' },
    { n: 'Zumbis', t: 'zombie' },
    { n: 'Pesca', t: 'fishing' },
    { n: 'Caverna do Guardião', t: 'cave' },
    { n: 'Futebol', t: 'soccer' },
    { n: 'Prisão 1', t: 'prison' },
    { n: 'Salão VIP', t: 'vip' },
  ],
  guilds: {},
  topics: [],
  reports: [],
  plugNovato: { enabled: true, exemptOwner: true, exemptMods: false, kickedCount: 0 },
};
try { db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
if (firestore) {
  try {
    const root = firestore.collection('universoChat').doc('database');
    const [snap, accountsSnap] = await Promise.all([
      root.get(),
      root.collection('accounts').get(),
    ]);
    if (snap.exists) {
      const cloud = snap.data()?.state;
      if (cloud && typeof cloud === 'object') {
        const localUsers = db.users || {};
        db = { ...db, ...cloud };
        // Mantém a versão mais recente por conta; não deixa um data.json antigo
        // sobrescrever silenciosamente o que já está no Firestore.
        db.users = { ...(db.users || {}) };
        for (const [key, localAcc] of Object.entries(localUsers)) {
          const cloudAcc = db.users[key];
          if (!cloudAcc || (Number(localAcc?.savedAt) || 0) > (Number(cloudAcc?.savedAt) || 0)) {
            db.users[key] = localAcc;
          }
        }
      }
    }
    db.users ||= {};
    let restoredCount = 0;
    for (const account of accountsSnap.docs) {
      const accData = account.data();
      if (accData && typeof accData === 'object') {
        const localAcc = db.users[account.id];
        if (!localAcc || (Number(accData.savedAt) || 0) >= (Number(localAcc.savedAt) || 0)) {
          db.users[account.id] = accData;
        }
        restoredCount++;
      }
    }
    console.log(`Firebase restaurado: ${restoredCount} conta(s) carregada(s).`);
  } catch (e) {
    console.error('Firebase restore falhou:', e.message);
  }
}

// Backup no GitHub: usado quando o Firebase não está ativo (não precisa de chave do Google).
const gh = createGithubStore({
  token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH, path: process.env.GITHUB_DATA_PATH, apiBase: process.env.GITHUB_API_BASE,
});
if (gh.enabled && !firestore) {
  try {
    const cloud = await gh.restore();
    if (cloud && typeof cloud === 'object') {
      const localUsers = db.users || {};
      db = { ...db, ...cloud };
      db.users = { ...(cloud.users || {}) };
      // Mantém a versão mais recente de cada conta.
      for (const [key, localAcc] of Object.entries(localUsers)) {
        const cloudAcc = db.users[key];
        if (!cloudAcc || (Number(localAcc?.savedAt) || 0) > (Number(cloudAcc?.savedAt) || 0)) db.users[key] = localAcc;
      }
      console.log(`GitHub restaurado: ${Object.keys(db.users).length} conta(s) carregada(s).`);
    } else {
      console.log('GitHub conectado: ainda não há backup (será criado no primeiro salvamento).');
    }
  } catch (e) {
    console.error('GitHub restore falhou (confira GITHUB_TOKEN e GITHUB_REPO):', e.message);
  }
} else if (!firestore) {
  console.warn('Sem backup na nuvem: defina GITHUB_TOKEN e GITHUB_REPO no Render, senão as contas somem quando o servidor reinicia.');
}

if (!Array.isArray(db.planets)) db.planets = [];
db.planets = db.planets.filter((p) => p && typeof p.n === 'string' && TYPES.includes(p.t));
if (!db.planets.length) {
  db.planets = [
    ...[1, 2, 3, 4].map((i) => ({ n: `Novato ${i}`, t: 'chat' })),
    { n: 'Boliche', t: 'bowling' },
    { n: 'Canhão', t: 'cannon' },
    { n: 'Zumbis', t: 'zombie' },
    { n: 'Pesca', t: 'fishing' },
    { n: 'Caverna do Guardião', t: 'cave' },
    { n: 'Futebol', t: 'soccer' },
    { n: 'Prisão 1', t: 'prison' },
    { n: 'Salão VIP', t: 'vip' },
  ];
}
if (!db.planets.some((p) => p.t === 'zombie')) db.planets.push({ n: 'Zumbis', t: 'zombie' });
if (!db.planets.some((p) => p.t === 'fishing')) db.planets.push({ n: 'Pesca', t: 'fishing' });
if (!db.planets.some((p) => p.t === 'cave')) db.planets.push({ n: 'Caverna do Guardião', t: 'cave' });
if (!db.planets.some((p) => p.t === 'soccer')) db.planets.push({ n: 'Futebol', t: 'soccer' });
// Planetas sociais oficiais adicionados nesta versão (preserva planetas já criados).
for (const p of [
  { n: 'Lar Feliz', t: 'chat', icon: '🏡' },
  { n: 'Raio de Sol', t: 'chat', icon: '☀️' },
  { n: 'Bate-papo Universo', t: 'chat', icon: '🌌' },
  { n: 'Solstício', t: 'chat', icon: '🌅' },
  { n: 'VOIDX', t: 'chat', icon: '🕳️' },
  { n: 'Caurion', t: 'chat', icon: '🪐' },
]) if (!db.planets.some((x) => x.n.toLowerCase() === p.n.toLowerCase())) db.planets.push(p);

db.caveRedeemCodes ||= {};
db.guilds ||= {};
db.topics = Array.isArray(db.topics) ? db.topics : [];
db.reports = Array.isArray(db.reports) ? db.reports : [];
db.feedbacks = Array.isArray(db.feedbacks) ? db.feedbacks : [];
db.aiSongs = Array.isArray(db.aiSongs) ? db.aiSongs : [];
db.plugNovato = { enabled: true, exemptOwner: true, exemptMods: false, kickedCount: 0, ...(db.plugNovato || {}) };

if (!db.topics.length) {
  db.topics.push({
    id: 1,
    title: 'Olá! Sejam bem-vindos ao Universo Chat 3D!',
    body: 'Olá, sejam bem-vindos ao Universo Chat 3D! Se divirtam e respeitem os players.',
    authorName: 'Universo Chat 3D',
    authorCargo: R.DEV,
    pinned: true,
    locked: false,
    official: true,
    ts: Date.now(),
    likes: [],
    replies: [],
  });
}

for (const u of Object.values(db.users || {})) {
  if (!u || typeof u !== 'object') continue;
  u.cargo = Math.min(R.DEV, Math.max(0, Math.trunc(Number(u.cargo) || 0)));
  u.coins = Number(u.coins) || 0;
  u.uc = Number(u.uc) || 0;
  u.stars = Number(u.stars) || 0;
  u.chests = Number(u.chests) || 0;
  u.inv ||= {};
  u.tools = Array.isArray(u.tools) ? u.tools : [];
  u.items = Array.isArray(u.items) ? u.items : [];
  u.balls = Array.isArray(u.balls) && u.balls.length ? u.balls : ['verde', 'vermelha'];
  u.armas = Array.isArray(u.armas) && u.armas.length ? u.armas : ['pistola'];
  u.varas = Array.isArray(u.varas) && u.varas.length ? u.varas : ['vara_bambu'];
  u.unlockedChars = Array.isArray(u.unlockedChars) && u.unlockedChars.length ? u.unlockedChars : ['piloto', 'estrela'];
  u.best ||= { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 };
  u.best.fishing ||= 0;
  u.mail = Array.isArray(u.mail) ? u.mail : [];
  u.friends = Array.isArray(u.friends) ? u.friends : [];
  u.friendReqs = Array.isArray(u.friendReqs) ? u.friendReqs : [];
  u.guildInvites = Array.isArray(u.guildInvites) ? u.guildInvites : [];
  u.redeemed = Array.isArray(u.redeemed) ? u.redeemed : [];
  u.createdAt ||= Date.now();
  u.savedAt ||= Date.now();
}

// ---------- divulgação do Discord ----------
const DISCORD_RE = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,32}$/i;
db.discord = { url: process.env.DISCORD_URL || 'https://discord.gg/V28vGAvy', auto: true, ...(db.discord || {}) };
const discordMsg = () => `💬 Entre no nosso Discord e fique por dentro de tudo!\n${db.discord.url}`;

if (gh.enabled && !firestore) gh.attach(() => db);
let timer;
const persistLocal = () => {
  try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(db)); fs.renameSync(FILE + '.tmp', FILE); }
  catch (e) { console.error('erro ao salvar:', e.message); }
};
let firebaseQueue = Promise.resolve();

const persistFirebase = () => {
  if (!firestore) return;
  const root = firestore.collection('universoChat').doc('database');
  const { users, ...state } = db;
  const accounts = Object.entries(users || {}).filter(([, v]) => v && typeof v === 'object');

  firebaseQueue = firebaseQueue
    .catch(() => {})
    .then(async () => {
      const cleanState = JSON.parse(JSON.stringify(state));
      await root.set({ state: cleanState, updatedAt: Date.now() }, { merge: true });
      // Cada conta em documento separado para evitar limite de 1 MiB por documento.
      for (let i = 0; i < accounts.length; i += 400) {
        const batch = firestore.batch();
        for (const [key, account] of accounts.slice(i, i + 400)) {
          const cleanAccount = JSON.parse(JSON.stringify(account));
          batch.set(root.collection('accounts').doc(String(key)), cleanAccount);
        }
        await batch.commit();
      }
    })
    .catch((e) => {
      console.error('Firebase sync falhou:', e.code || 'sem código', e.message);
      throw e;
    });
  return firebaseQueue;
};
const flushAll = async () => {
  clearTimeout(timer);
  persistLocal();
  if (firestore) await persistFirebase();
  else await gh.flush();
};
const save = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    persistLocal();
    if (firestore) void persistFirebase().catch(() => {});
    else gh.schedule(false);
  }, 400);
};
const saveNow = () => {
  clearTimeout(timer);
  persistLocal();
  if (!firestore) gh.schedule(true);
  if (firestore) return persistFirebase().catch((e) => {
    console.error('[Firebase] Falha no salvamento imediato:', e.code || 'sem código', e.message);
    return false;
  });
  return Promise.resolve(false);
};

const online = new Map(); // key -> { res, room, g, pos, typingUntil }
const send = (res, ev, d) => { try { res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`); } catch {} };
const sendTo = (k, ev, d) => { const o = online.get(k); if (o) send(o.res, ev, d); };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const hashPass = (pw) => crypto.createHash('sha256').update(String(pw || '')).digest('hex');

const guildOf = (u) => (u?.guildId && db.guilds[u.guildId]) ? db.guilds[u.guildId] : null;
const verifiedTag = (u) => (u?.verify?.status === 'real' || u?.verify?.status === 'fake') ? u.verify.status : null;

const pub = (u) => {
  const g = guildOf(u);
  return {
    jail: !!u.prison,
    name: u.name,
    g: u.g,
    char: u.char || (u.g === 'f' ? 'estrela' : 'piloto'),
    cargo: u.cargo,
    stars: u.stars || 0,
    vip: u.vip,
    outfit: u.outfit || null,
    traje: u.traje || null,
    acc: u.acc || null,
    aura: u.aura || null,
    showAuth: u.showAuth !== false,
    pet: u.pet || null,
    bio: u.bio || '',
    nameColor: u.nameColor || null,
    guildTag: g ? g.tag : null,
    verified: verifiedTag(u),
  };
};

function guildView(g, viewerKey) {
  if (!g) return null;
  const membersList = (g.members || []).map((mk) => {
    const mu = db.users[mk];
    if (!mu) return null;
    const mo = online.get(mk);
    return {
      key: mk,
      name: mu.name,
      cargo: mu.cargo,
      vip: !!mu.vip,
      nameColor: mu.nameColor || null,
      verified: verifiedTag(mu),
      role: g.leaderKey === mk ? 'leader' : (g.officers || []).includes(mk) ? 'officer' : 'member',
      online: !!mo,
      room: mo?.room || null,
    };
  }).filter(Boolean);
  return {
    id: g.id,
    name: g.name,
    tag: g.tag,
    desc: g.desc || '',
    open: !!g.open,
    leaderKey: g.leaderKey,
    officers: g.officers || [],
    members: membersList,
    chat: (g.chat || []).slice(-60),
  };
}

function staffView(u) {
  if ((u.cargo || 0) < R.MOD) return null;
  const reports = (db.reports || []).slice(-80).reverse().map((rp) => {
    const tu = db.users[rp.targetKey];
    const to = online.get(rp.targetKey);
    return {
      ...rp,
      targetLiveCargo: tu?.cargo ?? rp.targetCargo ?? 0,
      targetStars: tu?.stars ?? 0,
      targetOnline: !!to,
      targetRoom: to?.room || null,
      targetPrison: !!tu?.prison,
    };
  });
  const verifications = Object.values(db.users)
    .filter((x) => x.verify && x.verify.status && x.verify.status !== 'none')
    .sort((a, b) => (b.verify.submittedAt || 0) - (a.verify.submittedAt || 0))
    .slice(0, 60)
    .map((x) => {
      const xo = online.get(x.key);
      return {
        key: x.key,
        name: x.name,
        cargo: x.cargo,
        stars: x.stars,
        vip: !!x.vip,
        bio: x.bio || '',
        nameColor: x.nameColor || null,
        online: !!xo,
        room: xo?.room || null,
        status: x.verify.status,
        photoUrl: x.verify.file ? `/verifyphoto/${encodeURIComponent(x.key)}` : null,
        submittedAt: x.verify.submittedAt,
        reviewedBy: x.verify.reviewedBy || null,
        note: x.verify.note || '',
      };
    });
  return {
    reports,
    pendingCount: reports.filter((x) => x.status === 'pendente').length,
    verifications,
    pendingVerifyCount: verifications.filter((x) => x.status === 'pending').length,
    novatoKick: db.plugNovato,
  };
}

const me = (u) => {
  u.best ||= { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 };
  const g = guildOf(u);
  const friends = (u.friends || []).map((fk) => {
    const fu = db.users[fk];
    if (!fu) return null;
    const fo = online.get(fk);
    const fg = guildOf(fu);
    return {
      key: fk,
      name: fu.name,
      cargo: fu.cargo,
      vip: !!fu.vip,
      bio: fu.bio || '',
      nameColor: fu.nameColor || null,
      guildTag: fg?.tag || null,
      verified: verifiedTag(fu),
      online: !!fo,
      room: fo?.room || null,
    };
  }).filter(Boolean);
  const friendReqs = (u.friendReqs || []).map((fk) => {
    const fu = db.users[fk];
    if (!fu) return null;
    const fg = guildOf(fu);
    return {
      key: fk,
      name: fu.name,
      cargo: fu.cargo,
      vip: !!fu.vip,
      nameColor: fu.nameColor || null,
      guildTag: fg?.tag || null,
      verified: verifiedTag(fu),
    };
  }).filter(Boolean);
  const guildInvites = (u.guildInvites || []).map((gid) => {
    const ig = db.guilds[gid];
    if (!ig) return null;
    return { id: ig.id, name: ig.name, tag: ig.tag, memberCount: (ig.members || []).length };
  }).filter(Boolean);

  return {
    ...pub(u),
    key: u.key,
    coins: u.coins,
    uc: u.uc || 0,
    stars: u.stars,
    chests: u.chests,
    inv: u.inv,
    items: u.items,
    tools: u.tools || [],
    balls: u.balls,
    armas: u.armas || ['pistola'],
    varas: u.varas || ['vara_bambu'],
    unlockedChars: u.unlockedChars || ['piloto', 'estrela'],
    best: u.best,
    prison: u.prison,
    hasPass: !!u.passHash,
    emailMasked: maskEmail(u.email),
    emailVerified: !!(u.email && u.emailVerified),
    mailReady: mailConfigured(),
    savedAt: u.savedAt || Date.now(),
    verify: u.verify ? {
      status: u.verify.status || 'none',
      note: u.verify.note || '',
      reviewedBy: u.verify.reviewedBy || '',
      photoUrl: u.verify.file ? `/verifyphoto/${encodeURIComponent(u.key)}` : null,
    } : { status: 'none', note: '', photoUrl: null },
    friends,
    friendReqs,
    guild: guildView(g, u.key),
    guildInvites,
    staff: staffView(u),
    mail: (u.mail || []).map((m) => (m.voice ? { ...m, voice: { id: m.voice.id, dur: m.voice.dur } } : m)),
  };
};

const topicsForUser = (u) => (db.topics || []).map((t) => ({
  id: t.id,
  title: t.title,
  body: t.body,
  authorName: t.authorName,
  authorCargo: t.authorCargo || 0,
  authorNameColor: t.authorNameColor || null,
  authorGuildTag: t.authorGuildTag || null,
  authorVerified: t.authorVerified || null,
  pinned: !!t.pinned,
  locked: !!t.locked,
  official: !!t.official,
  ts: t.ts,
  likesCount: (t.likes || []).length,
  liked: !!u && (t.likes || []).includes(u.key),
  canDelete: !!u && ((u.cargo || 0) >= R.MOD || t.authorKey === u.key),
  replies: (t.replies || []).map((rp) => ({
    ...rp,
    canDelete: !!u && ((u.cargo || 0) >= R.MOD || rp.authorKey === u.key),
  })),
})).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id);

const pushTopics = () => {
  for (const [k, o] of online) send(o.res, 'topics', topicsForUser(db.users[k]));
};

const feedbacksForUser = (u) => (db.feedbacks || []).map((f) => ({
  id: f.id,
  category: f.category || 'sugestao',
  rating: Math.min(5, Math.max(1, Number(f.rating) || 5)),
  title: f.title,
  text: f.text,
  authorName: f.authorName,
  authorCargo: f.authorCargo || 0,
  authorNameColor: f.authorNameColor || null,
  authorGuildTag: f.authorGuildTag || null,
  authorVerified: f.authorVerified || null,
  status: f.status || 'novo',
  staffReply: f.staffReply || '',
  repliedBy: f.repliedBy || '',
  repliedAt: f.repliedAt || null,
  ts: f.ts,
  votesCount: (f.votes || []).length,
  voted: !!u && (f.votes || []).includes(u.key),
  isMine: !!u && f.authorKey === u.key,
  canDelete: !!u && ((u.cargo || 0) >= R.MOD || f.authorKey === u.key),
  canReview: !!u && (u.cargo || 0) >= R.MOD,
})).sort((a, b) => b.id - a.id);

const pushFeedbacks = () => {
  for (const [k, o] of online) send(o.res, 'feedbacks', feedbacksForUser(db.users[k]));
};

const members = (room) => [...online].filter(([k, o]) => o.room === room && db.users[k]).map(([k, o]) => ({
  ...pub(db.users[k]),
  pos: o.pos || null,
  action: o.action && (o.action.persistent || o.action.until > Date.now()) ? o.action : null,
}));
const pushRoom = (room) => { if (!room) return; const m = members(room); for (const o of online.values()) if (o.room === room) send(o.res, 'members', m); };
const pushMe = (k) => { const u = db.users[k]; if (u) sendTo(k, 'me', me(u)); };
const PLANET_CAP = 50;
const roomCount = (n) => [...online.values()].filter((o) => o.room === n).length;
const planetList = () => db.planets.map(({ owner, ...p }) => ({ ...p, mine: false, ownerName: owner ? db.users[owner]?.name || null : null, locked: !!p.pass, count: roomCount(p.n), cap: PLANET_CAP }));
const pushPlanets = () => { const l = planetList(); for (const o of online.values()) send(o.res, 'planets', l); };
const roomLogs = new Map();
const say = (room, from, text, sys, extra = {}) => {
  const msg = { from, text, sys: !!sys, ts: Date.now(), ...extra };
  if (!sys && from?.name) {
    const arr = roomLogs.get(room) || [];
    arr.push({ from: from.name, text });
    if (arr.length > 15) arr.shift();
    roomLogs.set(room, arr);
  }
  for (const o of online.values()) if (o.room === room) send(o.res, 'chat', msg);
};
const typingUsers = (room) => {
  const now = Date.now(), out = [];
  for (const [k, o] of online) if (o.room === room && (o.typingUntil || 0) > now && db.users[k]) out.push(db.users[k].name);
  return out;
};
const pushTyping = (room) => {
  if (!room) return;
  const users = typingUsers(room);
  for (const o of online.values()) if (o.room === room) send(o.res, 'typing', { room, users });
};
const pushMove = (room, name, pos) => {
  if (!room) return;
  for (const o of online.values()) if (o.room === room) send(o.res, 'move', { room, name, x: pos.x, z: pos.z, ry: pos.ry });
};
const addMail = (u, txt, extra = {}) => { u.mail.push({ txt, ts: Date.now(), ...extra }); trimMail(u); };

function moveTo(k, room) {
  const o = online.get(k); if (!o) return;
  const old = o.room, wasTyping = (o.typingUntil || 0) > 0;
  o.typingUntil = 0; o.pos = null; o.room = room;
  send(o.res, 'moved', { room });
  pushRoom(old); pushRoom(room); pushPlanets();
  if (wasTyping && old) pushTyping(old);
}

function isNovatoBlocked(u) {
  const plug = db.plugNovato;
  if (!plug?.enabled || (u.cargo || 0) < 1) return false;
  if (u.cargo >= R.DEV && plug.exemptOwner) return false;
  if (u.cargo >= R.MOD && u.cargo < R.DEV && plug.exemptMods) return false;
  return true;
}

function sweepNovatos() {
  const kicked = [];
  const dest = db.planets.find((p) => p.t === 'chat' && !/^novato\b/i.test(p.n)) || db.planets.find((p) => p.t !== 'prison' && !/^novato\b/i.test(p.n)) || db.planets[0];
  if (!dest) return kicked;
  for (const [k, o] of online) {
    const u = db.users[k];
    if (!u || !o.room || !/^novato\b/i.test(o.room)) continue;
    if (!isNovatoBlocked(u)) continue;
    const from = o.room;
    db.plugNovato.kickedCount = (db.plugNovato.kickedCount || 0) + 1;
    sendTo(k, 'plugkick', { cargo: CARGOS[u.cargo], from, to: dest.n });
    moveTo(k, dest.n);
    kicked.push(u.name);
  }
  if (kicked.length) save();
  return kicked;
}

// ---------- recarga de UC via Pix ----------
const PACOTES = [1, 2, 3, 5, 10, 20];
db.orders ||= [];
const asc = (t, n) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, n);
const DEFAULT_PIX_KEY = '2d05bc39-98d5-4237-ac23-bcc69ec44607';
const pixCfg = () => {
  const p = db.pix || {};
  return { key: (p.key || process.env.PIX_KEY || DEFAULT_PIX_KEY).trim(), name: asc(p.name || process.env.PIX_NAME || DEV_NAME, 25) || 'UNIVERSO', city: asc(p.city || process.env.PIX_CITY || 'BRASIL', 15) || 'BRASIL' };
};
const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
function crc16(str) {
  let c = 0xffff;
  for (const b of Buffer.from(str, 'utf8')) { c ^= b << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
function pixPayload(px, valor, txid) {
  const body = tlv('00', '01') + tlv('01', '12') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', px.key)) + tlv('52', '0000') + tlv('53', '986')
    + tlv('54', valor.toFixed(2)) + tlv('58', 'BR') + tlv('59', px.name) + tlv('60', px.city) + tlv('62', tlv('05', txid)) + '6304';
  return body + crc16(body);
}
const mailUser = (u, subject, intro, outro) => {
  if (!u?.email || !u.emailVerified || !mailConfigured()) return;
  sendMail(u.email, subject, `${intro}\n\n${outro}`, `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:22px;background:#0e0e2e;color:#e8e8ff;border-radius:14px"><h2 style="margin:0 0 12px">🌌 UNIVERSO CHAT</h2><p>${escHtml(intro)}</p><p style="opacity:.8">${escHtml(outro)}</p></div>`).catch((e) => console.error('[email] aviso:', e.message));
};
const orderView = (o, px) => ({ id: o.id, uc: o.uc, payload: pixPayload(px, o.uc, 'UC' + o.id) });

// ---------- recompensas & loja ----------
function grant(u, kind, n = 1) {
  if (kind === 'star') {
    u.stars += n;
    if (u.cargo === 0 && u.stars >= 10) { u.cargo = R.GUARD; addMail(u, '🎖️ Você subiu para Sentinela!'); }
  } else if (kind === 'coins') u.coins += n;
  else u.inv[kind] = (u.inv[kind] || 0) + n;
}
const LABEL = { star: '⭐ estrela de autoridade', chave: '🗝️ chave de baú', fuga_bronze: '🥉 fuga de bronze', fuga_diamante: '💎 fuga de diamante' };
function grantMiniGameUniGema(u, o, game, rewards, chance = 0.25) {
  // Recompensa controlada por servidor: no máximo 1 UniGema por jogo a cada 60s.
  o.miniGemAt ||= {};
  const now = Date.now();
  if (now - (o.miniGemAt[game] || 0) < 60_000 || Math.random() >= chance) return false;
  o.miniGemAt[game] = now;
  u.uc = (u.uc || 0) + 1;
  rewards.push('💎 +1 UniGema por recompensa do minijogo!');
  return true;
}
function rollReward(u) {
  const r = Math.random();
  const kind = r < 0.6 ? 'star' : r < 0.85 ? 'chave' : r < 0.97 ? 'fuga_bronze' : 'fuga_diamante';
  grant(u, kind); return LABEL[kind];
}

const CLOTHES = {
  m: [['Jaqueta Estelar Azul', '#3b82f6', 'roupa_azul'], ['Jaqueta Noturna', '#1e293b', 'roupa_preta'], ['Terno Dourado Real', '#d4af37', 'roupa_terno']],
  f: [['Vestido Rosa Lunar', '#ec4899', 'roupa_rosa'], ['Conjunto Nebulosa', '#8b5cf6', 'roupa_roxa'], ['Vestido Solar Dourado', '#eab308', 'roupa_vestido_ouro']],
};
const PETS = { raro: ['🐱', '🐶', '🐰'], épico: ['🦊', '🦉', '🐼'], lendário: ['🐉', '🦄', '🔥'] };
// ---------- Loja de UniGemas (UG): pets super épicos e planetas pessoais ----------
const UG_SHOP = {
  pet: {
    pet_alien: { name: 'Alien Cristalino', emoji: '👾', price: 120, tier: 'super épico' },
    pet_pavao: { name: 'Pavão Aurora', emoji: '🦚', price: 150, tier: 'super épico' },
    pet_lobo: { name: 'Lobo Lunar', emoji: '🐺', price: 200, tier: 'super épico' },
    pet_kraken: { name: 'Kraken Estelar', emoji: '🐙', price: 280, tier: 'super épico' },
    pet_rex: { name: 'Rex Nebuloso', emoji: '🦖', price: 350, tier: 'super épico' },
    pet_dragao: { name: 'Dragão Cósmico', emoji: '🐲', price: 500, tier: 'super épico' },
  },
  planeta: {
    planeta_cristal: { name: 'Planeta Cristal', emoji: '💎', price: 400 },
    planeta_gelo: { name: 'Planeta Gelo', emoji: '🧊', price: 450 },
    planeta_vulcao: { name: 'Planeta Vulcão', emoji: '🌋', price: 500 },
  },
  traje: { fantasma_noel: { name: 'Fantasma Noel', emoji: '🎅👻', price: 300, image: '/traje-fantasma-noel.png' } },
};
function addItem(u, it) { if (u.items.some((x) => x.id === it.id)) return false; u.items.push(it); return true; }

function openChest(u) {
  const out = [];
  const s = Math.random() < 0.4 ? 2 : 1; grant(u, 'star', s); out.push(`⭐ ${s} estrela(s) de autoridade`);
  const c = 20 + Math.floor(Math.random() * 81); grant(u, 'coins', c); out.push(`🪙 ${c} Cosmos`);
  const [cn, cc, oid] = pick(CLOTHES[u.g === 'f' ? 'f' : 'm']);
  if (addItem(u, { id: 'roupa:' + oid, type: 'roupa', outfitId: oid, name: cn, color: cc })) out.push(`👕 ${cn}`);
  if (Math.random() < 0.5) {
    const r = Math.random(); const tier = r < 0.7 ? 'raro' : r < 0.95 ? 'épico' : 'lendário';
    const em = pick(PETS[tier]);
    if (addItem(u, { id: 'pet:' + em, type: 'pet', name: `Pet ${tier}`, emoji: em, tier })) out.push(`${em} Pet ${tier}`);
  }
  if (Math.random() < 0.25) out.push(rollReward(u));
  if (Math.random() < 0.18) { const aur = openChestRewardAura(u); if (aur) out.push(aur); }
  return out;
}

const COSMETICS = {
  char: {
    piloto: { name: 'Piloto Estelar', g: 'm', price: 0 },
    explorador_m: { name: 'Explorador Urbano', g: 'm', price: 0 },
    cyber: { name: 'Cyborg Órion', g: 'm', price: 90 },
    principe: { name: 'Príncipe Solar', g: 'm', price: 130 },
    eclipse_m: { name: 'Guardião Eclipse', g: 'm', price: 160 },
    samurai_m: { name: 'Ronin Estelar', g: 'm', price: 180 },
    lobo_m: { name: 'Lobo Lunar', g: 'm', price: 220 },
    estrela: { name: 'Viajante Estelar', g: 'f', price: 0 },
    luna_f: { name: 'Luna Pop', g: 'f', price: 0 },
    valquiria: { name: 'Valquíria Nebulosa', g: 'f', price: 90 },
    aurora: { name: 'Aurora Cósmica', g: 'f', price: 130 },
    dama_eclipse: { name: 'Dama Eclipse', g: 'f', price: 160 },
    kitsune_f: { name: 'Kitsune Celestial', g: 'f', price: 180 },
    imperatriz_f: { name: 'Imperatriz Galáctica', g: 'f', price: 220 },
  },
  roupa: {
    roupa_azul: { name: 'Jaqueta Estelar Azul', color: '#3b82f6', price: 60 },
    roupa_preta: { name: 'Jaqueta Noturna', color: '#1e293b', price: 95 },
    roupa_terno: { name: 'Terno Dourado Real', color: '#d4af37', price: 150 },
    roupa_rosa: { name: 'Vestido Rosa Lunar', color: '#ec4899', price: 60 },
    roupa_roxa: { name: 'Conjunto Nebulosa', color: '#8b5cf6', price: 95 },
    roupa_vestido_ouro: { name: 'Vestido Solar Dourado', color: '#eab308', price: 150 },
    roupa_galactica: { name: 'Moletom Galáctico', color: '#0891b2', price: 110 },
    roupa_carmesim: { name: 'Armadura Carmesim', color: '#be123c', price: 180 },
    roupa_neon: { name: 'Jaqueta Cyber Neon', color: '#06b6d4', price: 120 },
    roupa_imperial: { name: 'Manto Real Imperial', color: '#7c3aed', price: 170 },
  },
  traje: {
    coelho_estelar: { name: 'Traje Coelho Estelar', price: 180 },
    astronauta: { name: 'Traje Astronauta Órion', price: 150 },
    cyber_ninja: { name: 'Traje Ninja Cibernético', price: 190 },
    dragao_rubi: { name: 'Traje Cavaleiro Dragão', price: 240 },
    guardiao_celestial: { name: 'Traje Guardião Celestial', price: 220 },
    fantasma_cosmico: { name: 'Traje Espectro Cósmico', price: 200 },
    fantasma_noel: { name: 'Fantasma Noel', price: 300 },
  },
  acessorio: {
    oculos_cyber: { name: 'Óculos Visor Cyber', emoji: '🕶️', price: 55 },
    fones_pulsar: { name: 'Fones Pulsar Neon', emoji: '🎧', price: 65 },
    cartola_estelar: { name: 'Cartola Estelar', emoji: '🎩', price: 80 },
    orelhas_gatinho: { name: 'Tiara Orelhas Cósmicas', emoji: '🐱', price: 85 },
    aura_borboletas: { name: 'Borboletas Azuis', emoji: '🦋', price: 120 },
    mochila_foguete: { name: 'Jetpack Cometa', emoji: '🚀', price: 150 },
    asas_luz: { name: 'Asas Celestiais', emoji: '🪽', price: 180 },
    coroa_real: { name: 'Coroa Estelar Real', emoji: '👑', price: 160 },
    mascara_oni: { name: 'Máscara Oni Neon', emoji: '👹', price: 110 },
    capa_heroi: { name: 'Capa Galáctica', emoji: '🦸', price: 140 },
  },
  aura: {
    aura_fogo: { name: 'Aura Chama Solar', emoji: '🔥', color: '#f97316', price: 140 },
    aura_raio: { name: 'Aura Tempestade Raios', emoji: '⚡', color: '#38bdf8', price: 150 },
    aura_sombria: { name: 'Aura Eclipse Sombrio', emoji: '🌑', color: '#a855f7', price: 160 },
    aura_sakura: { name: 'Aura Pétalas Estelares', emoji: '🌸', color: '#f472b6', price: 155 },
    aura_arcana: { name: 'Aura Círculo Arcano', emoji: '🔮', color: '#22d3ee', price: 185 },
    aura_celestial: { name: 'Aura Chama Divina', emoji: '✨', color: '#fbbf24', price: 220 },
  },
};

function openChestRewardAura(u) {
  const keys = Object.keys(COSMETICS.aura);
  const id = pick(keys);
  const spec = COSMETICS.aura[id];
  if (addItem(u, { id: 'aura:' + id, type: 'aura', auraId: id, name: spec.name, emoji: spec.emoji, color: spec.color })) {
    return `${spec.emoji} ${spec.name}`;
  }
  return null;
}

// ---------- jogos ----------
const BALLS = { verde: [0.35, 0], vermelha: [0.45, 0], eletrica: [0.6, 30], prata: [0.5, 50], preto: [0.55, 80], gold: [0.65, 120], fire: [0.75, 200] };
const newBowl = () => ({ pins: Array(10).fill(1), throws: 0, total: 0 });
const newTarget = () => ({ target: 20 + Math.floor(Math.random() * 100), kind: Math.random() < 0.5 ? 'barril' : 'bicho' });
const ARMAS = { pistola: [1, 0], espingarda: [2, 40], metralhadora: [3, 100] };
const VARAS = { vara_bambu: ['Bambu', 0, 0], vara_titanio: ['Titânio', 16, 60], vara_estelar: ['Estelar', 32, 140] };
const FISH_POOL = [
  { name: 'Peixe Lunar', emoji: '🐟', coins: 6, w: 45 },
  { name: 'Carpa Nebulosa', emoji: '🐠', coins: 12, w: 28 },
  { name: 'Tubarão Estelar', emoji: '🦈', coins: 24, w: 15 },
  { name: 'Baleia Dourada', emoji: '🐳', coins: 45, star: true, w: 7 },
  { name: 'Baú Submerso', emoji: '🎁', coins: 15, chest: true, w: 5 },
];
const ensureZ = (u) => { u.armas ||= ['pistola']; u.best ||= { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 }; u.best.zumbi ||= 0; };
const rnd = (n) => Math.floor(Math.random() * n);
function spawnWave(z) {
  const n = Math.min(10, 2 + z.wave), used = new Set(), boss = z.wave % 5 === 0;
  for (let i = 0; i < n; i++) {
    let lane, dist, tries = 0;
    do { lane = rnd(5); dist = 4 + rnd(6); } while (used.has(lane + ',' + dist) && tries++ < 60);
    used.add(lane + ',' + dist);
    const strong = z.wave >= 3 && Math.random() < 0.3;
    const hp = boss && i === 0 ? 4 + z.wave : strong ? 2 + Math.floor(z.wave / 6) : 1;
    z.zs.push({ id: z.nid++, lane, dist, hp, max: hp, e: boss && i === 0 ? '👹' : strong ? '🧟‍♂️' : '🧟' });
  }
}
const newZ = () => { const z = { wave: 1, lives: 3, zs: [], nid: 1 }; spawnWave(z); return z; };
const zstate = (o, u) => { ensureZ(u); const z = (o.g.zumbi ||= newZ()); return { wave: z.wave, lives: z.lives, zs: z.zs, armas: u.armas, best: u.best.zumbi }; };
const newCave = () => ({ stage: 'intro', turns: 0, key: false, relic: false, gate: false, chase: 0, escapeSteps: 0, result: null });
const caveState = (u) => (u.caveGame ||= newCave());
const newSoccer = () => ({ kicks: 0, goals: 0 });
const gameState = (o, u, t) => {
  u.best ||= { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 };
  if (t === 'zombie') return zstate(o, u);
  if (t === 'bowling') return { ...(o.g.bowl ||= newBowl()), balls: u.balls, best: u.best.bowling };
  if (t === 'cannon') return { ...(o.g.cannon ||= newTarget()), hits: u.best.cannon, explosiva: u.inv.bala_explosiva || 0 };
  if (t === 'fishing') return { caught: u.best.fishing || 0, last: o.g.lastFish || null };
  if (t === 'cave') return { ...caveState(u) };
  if (t === 'soccer') return { ...(o.g.soccer ||= newSoccer()), best: u.best.soccer || 0 };
  return null;
};

// ---------- comandos (Moderadores e Dono separados) ----------
const HELP_USER = [
  '/ajuda — Mostra comandos por categoria',
  '/discord — Link oficial do Discord',
  '/dono <senha> — Ativa acesso de Dono (IIBERTOX)',
  '/amigo <nome> — Envia ou aceita pedido de amizade',
  '/denunciar <nome> <motivo> — Denuncia um jogador',
  '/g <mensagem> — Fala no chat privado da guilda',
  '/sentar /dancar /acenar /aplaudir /dormir /meditar /rir /girar /parar — Ações 3D',
];
const HELP_MOD = [
  '/mod — Lista só os comandos de Moderadores',
  '/prender <nome> [motivo] — Prende o jogador na Prisão',
  '/soltar <nome> — Solta o jogador da Prisão',
  '/expulsar <nome> — Expulsa o jogador do planeta atual',
  '/mutar <nome> [segundos] — Silencia o jogador no chat (padrão 60s)',
  '/desmutar <nome> — Remove o silêncio do jogador',
  '/avisar <nome> <mensagem> — Envia aviso oficial na tela e correio',
  '/limparchat — Limpa as mensagens da sala atual',
  '/rebaixar <nome> — Rebaixa 1 cargo (Arconte+)',
  '(Toque no avatar ✋ no palco 3D para ações rápidas)',
];
const HELP_STAFF = [
  '/divulgar — Anuncia o Discord em todas as salas',
  '/vip <nome> [off] — Ativa ou remove VIP',
  '/autoridade <nome> <cargo> — Define autoridade abaixo da sua',
  '/bau <nome> [qtd] — Envia baús para um jogador',
];
const HELP_OWNER = [
  '/comandosdono — Lista só os comandos exclusivos do Dono',
  '/anuncio <mensagem> — Envia anúncio global em todas as salas',
  '/promover <nome> <cargo> — Promove jogador (Viajante..Arquiteto ou 0..5)',
  '/banir <nome> [motivo] — Bane a conta e desconecta imediatamente',
  '/desbanir <nome> — Remove banimento da conta',
  '/estrelas <nome> <qtd> — Soma ou remove ⭐ estrelas de autoridade',
  '/darmoedas <nome> <Cosmos> — Envia ou remove Cosmos',
  '/dar <nome> <UC> — Envia ou remove UniGemas (e fecha pedido Pix)',
  '/resetjogos <nome> — Zera recordes de minigames do jogador',
  '/planetasenha <planeta> <senha|off> — Coloca ou tira senha de um planeta',
  '/criarplaneta <nome> [chat|prison|vip|bowling|cannon|zombie|fishing|cave|soccer]',
  '/apagarplaneta <nome> · /prisoes · /novatos',
  '/pedidos · /recusar <nº> · /pixchave <chave> · /pixnome <nome>',
  '/emailchave <chave Brevo> · /emailde <remetente> · /emailteste [e-mail]',
  '/discordlink <link> · /discordauto on|off',
  '/desbugar <nome|todos> · /atualizarapk <versão> [nota]',
];

const fails = new Map();
function command(k, u, text) {
  const [cmd, ...a] = text.slice(1).trim().split(/\s+/);
  const c = norm(cmd), r = u.cargo;
  const reply = (t) => sendTo(k, 'chat', { from: null, text: t, sys: true, ts: Date.now() });
  const find = (n) => Object.values(db.users).find((x) => norm(x.name) === norm(n));
  const need = (min) => { if (r < min) { reply('Sem permissão.'); return false; } return true; };
  const target = () => { const t = find(a[0]); if (!t) reply('Jogador não encontrado.'); return t; };

  if (c === 'ajuda') {
    const blocks = [`👤 Comandos Gerais:\n${HELP_USER.join('\n')}`];
    if (r >= R.MOD) blocks.push(`🛡️ Comandos de Moderadores (/mod):\n${HELP_MOD.join('\n')}`);
    if (r >= R.SOB) blocks.push(`✨ Comandos de Alta Staff:\n${HELP_STAFF.join('\n')}`);
    if (r >= R.DEV) blocks.push(`👑 Comandos Exclusivos do Dono (/comandosdono):\n${HELP_OWNER.join('\n')}`);
    return reply(blocks.join('\n\n'));
  }
  if (c === 'mod' || c === 'comandosmod' || c === 'moderador') {
    if (!need(R.MOD)) return;
    return reply(`🛡️ COMANDOS DE MODERADORES:\n${HELP_MOD.join('\n')}`);
  }
  if (c === 'comandosdono' || c === 'donocmd' || c === 'owner') {
    if (!need(R.DEV)) return;
    return reply(`👑 COMANDOS EXCLUSIVOS DO DONO:\n${HELP_OWNER.join('\n')}`);
  }
  if (c === 'discord') return reply(discordMsg());
  if (c === 'amigo') {
    const res = handle({ type: 'friendadd', key: k, name: a[0] || '' });
    return reply(res.error || res.msg || 'Pedido enviado.');
  }
  if (c === 'denunciar') {
    const res = handle({ type: 'report', key: k, targetName: a[0] || '', reason: a.slice(1).join(' ') });
    return reply(res.error || `🚨 Denúncia #${res.report.id} enviada.`);
  }
  const EMOTE_CMDS = {
    acenar: 'wave', aplaudir: 'clap', dancar: 'dance', comemorar: 'cheer', pular: 'cheer',
    reverencia: 'bow', rir: 'laugh', girar: 'spin', sentar: 'sit', dormir: 'sleep',
    deitar: 'sleep', meditar: 'float', flutuar: 'float', parar: 'idle', levantar: 'idle',
  };
  if (EMOTE_CMDS[c]) {
    const res = handle({ type: 'emote', key: k, emote: EMOTE_CMDS[c] });
    if (res?.error) return reply(res.error);
    return;
  }
  if (c === 'g') {
    const res = handle({ type: 'guildchat', key: k, text: a.join(' ') });
    if (res.error) return reply(res.error);
    return;
  }
  if (c === 'dono' || c === 'dev') {
    if ((fails.get(k) || 0) >= 5) return reply('Bloqueado por muitas tentativas.');
    if (!isValidOwnerPass(a[0])) { fails.set(k, (fails.get(k) || 0) + 1); return reply('Senha incorreta.'); }
    fails.delete(k);
    const taken = Object.values(db.users).find((x) => norm(x.name) === norm(DEV_NAME) && x !== u);
    if (!taken) u.name = DEV_NAME;
    u.cargo = R.DEV; u.vip = true; u.banned = null;
    saveNow(); pushMe(k); pushRoom(online.get(k)?.room);
    return reply(`👑 Você agora é Dono (${u.name})! Use /comandosdono para ver os comandos do Dono ou /mod para moderação.`);
  }

  // --- Comandos de Moderadores (R.MOD+) ---
  if (c === 'prender') {
    if (!need(R.MOD)) return; const t = target(); if (!t) return;
    if (t.cargo >= R.IMP || t.cargo >= r) return reply('Esse jogador não pode ser preso.');
    const prisons = db.planets.filter((p) => p.t === 'prison'); if (!prisons.length) return reply('Não existe planeta Prisão.');
    t.prison = { reason: a.slice(1).join(' ') || 'sem motivo', by: u.name, at: Date.now() };
    addMail(t, `🔒 Você foi preso por ${u.name}: ${t.prison.reason}`); save();
    const from = online.get(t.key)?.room; if (from) say(from, null, `🔒 ${t.name} foi preso por ${u.name} e levado para a prisão.`, true);
    moveTo(t.key, pick(prisons).n); pushMe(t.key);
    return reply(`${t.name} foi preso.`);
  }
  if (c === 'expulsar') {
    if (!need(R.MOD)) return; const t = target(); if (!t) return;
    if (t.cargo >= r) return reply('Você não pode expulsar esse jogador.');
    if (t.prison) return reply('Esse jogador está preso. Use /soltar.');
    const o = online.get(t.key); if (!o || !o.room) return reply(`${t.name} não está em nenhum planeta.`);
    const dest = db.planets.find((p) => p.t === 'chat' && p.n !== o.room) || db.planets.find((p) => p.n !== o.room);
    if (!dest) return reply('Não há outro planeta para enviar.');
    say(o.room, null, `🚪 ${t.name} foi expulso do planeta por ${u.name}.`, true);
    addMail(t, `🚪 Você foi expulso do planeta ${o.room} por ${u.name}.`); save(); pushMe(t.key); moveTo(t.key, dest.n);
    return reply(`${t.name} foi expulso.`);
  }
  if (c === 'soltar') {
    if (!need(R.MOD)) return; const t = target(); if (!t) return;
    t.prison = null; addMail(t, '🔓 Você foi solto.'); save(); pushMe(t.key); moveTo(t.key, 'Novato 1'); return reply(`${t.name} foi solto.`);
  }
  if (c === 'mutar') {
    if (!need(R.MOD)) return; const t = target(); if (!t) return;
    if (t.cargo >= r) return reply('Você não pode mutar esse jogador.');
    const sec = Math.min(3600, Math.max(10, parseInt(a[1]) || 60));
    t.mutedUntil = Date.now() + sec * 1000;
    addMail(t, `🔇 Você foi silenciado por ${u.name} por ${sec}s.`);
    save(); pushMe(t.key);
    const to = online.get(t.key);
    if (to?.room) say(to.room, null, `🔇 ${t.name} foi silenciado no chat por ${sec}s por ${u.name}.`, true);
    return reply(`🔇 ${t.name} foi silenciado por ${sec} segundos.`);
  }
  if (c === 'desmutar') {
    if (!need(R.MOD)) return; const t = target(); if (!t) return;
    t.mutedUntil = 0;
    addMail(t, `🔊 Seu silêncio no chat foi removido por ${u.name}.`);
    save(); pushMe(t.key);
    return reply(`🔊 ${t.name} foi desmutado.`);
  }
  if (c === 'avisar') {
    if (!need(R.MOD)) return; const t = target(); if (!t) return;
    const msg = a.slice(1).join(' ').trim().slice(0, 160);
    if (!msg) return reply('Uso: /avisar <nome> <mensagem>');
    addMail(t, `⚠️ Aviso da moderação (${u.name}): ${msg}`);
    save(); pushMe(t.key);
    sendTo(t.key, 'staffalert', { msg: `⚠️ Aviso de ${u.name}: ${msg}` });
    return reply(`⚠️ Aviso enviado para ${t.name}.`);
  }
  if (c === 'limparchat') {
    if (!need(R.MOD)) return;
    const room = online.get(k)?.room;
    if (!room) return reply('Entre em um planeta primeiro.');
    roomLogs.delete(room);
    for (const o of online.values()) if (o.room === room) send(o.res, 'clearchat', { room, by: u.name });
    say(room, null, `🧹 Chat limpo por ${u.name}.`, true);
    return;
  }
  if (c === 'rebaixar') {
    if (!need(R.IMP)) return; const t = target(); if (!t) return;
    if (t.cargo >= r || t.cargo === 0) return reply('Não é possível rebaixar esse jogador.');
    t.cargo--; addMail(t, `⬇️ Sua autoridade agora é ${CARGOS[t.cargo]}.`); save(); pushMe(t.key); pushRoom(online.get(t.key)?.room);
    return reply(`${t.name} agora é ${CARGOS[t.cargo]}.`);
  }

  // --- Alta Staff (R.SOB+) ---
  if (c === 'divulgar') {
    if (!need(R.SOB)) return;
    announceDiscord(); return reply('📣 Discord divulgado em todas as salas.');
  }
  if (c === 'autoridade') {
    if (!need(R.SOB)) return; const t = target(); if (!t) return;
    const n = CARGOS.findIndex((x) => norm(x) === norm(a[1]));
    if (n < 0 || n >= r || t.cargo >= r) return reply('Cargo inválido ou acima da sua autoridade.');
    t.cargo = n; addMail(t, `🎖️ Sua autoridade agora é ${CARGOS[n]}.`); save(); pushMe(t.key); pushRoom(online.get(t.key)?.room);
    return reply(`${t.name} agora é ${CARGOS[n]}.`);
  }
  if (c === 'vip') {
    if (!need(R.SOB)) return; const t = target(); if (!t) return;
    t.vip = norm(a[1]) !== 'off'; addMail(t, t.vip ? '👑 Você agora é VIP!' : 'Seu VIP foi removido.'); save(); pushMe(t.key); pushRoom(online.get(t.key)?.room);
    return reply(`${t.name}: VIP ${t.vip ? 'ativado' : 'removido'}.`);
  }
  if (c === 'bau') {
    if (!need(R.SOB)) return; const t = target(); if (!t) return;
    const n = Math.min(10, Math.max(1, parseInt(a[1]) || 1)); t.chests += n; addMail(t, `🎁 Você recebeu ${n} baú(s) de ${u.name}!`); save(); pushMe(t.key);
    return reply(`${n} baú(s) enviado(s) para ${t.name}.`);
  }

  // --- Comandos Exclusivos do Dono (R.DEV) ---
  if (c === 'anuncio') {
    if (!need(R.DEV)) return;
    const msg = a.join(' ').trim().slice(0, 200);
    if (!msg) return reply('Uso: /anuncio <mensagem>');
    const rooms = new Set([...online.values()].map((o) => o.room).filter(Boolean));
    for (const rm of rooms) say(rm, null, `👑 [ANÚNCIO DO DONO ${u.name}]: ${msg}`, true);
    for (const key of online.keys()) sendTo(key, 'staffalert', { msg: `👑 ${u.name}: ${msg}` });
    return reply(`📢 Anúncio global enviado para ${online.size} jogador(es).`);
  }
  if (c === 'promover') {
    if (!need(R.DEV)) return; const t = target(); if (!t) return;
    const raw = a[1] || '';
    const n = /^\d+$/.test(raw) ? parseInt(raw) : CARGOS.findIndex((x) => norm(x) === norm(raw));
    if (n < 0 || n >= R.DEV) return reply('Cargo inválido. Use 0..5 ou Viajante/Sentinela/Comandante/Arconte/Celestial/Arquiteto.');
    t.cargo = n; addMail(t, `👑 O Dono ${u.name} definiu seu cargo para ${CARGOS[n]}!`);
    save(); pushMe(t.key); pushRoom(online.get(t.key)?.room);
    return reply(`🎖️ ${t.name} agora é ${CARGOS[n]}.`);
  }
  if (c === 'estrelas') {
    if (!need(R.DEV)) return; const t = target(); const n = parseInt(a[1]);
    if (!t || !n) return reply('Uso: /estrelas <nome> <quantidade>');
    if (Math.abs(n) > 100000) return reply('Valor grande demais.');
    t.stars = Math.max(0, (t.stars || 0) + n);
    addMail(t, n > 0 ? `⭐ Você recebeu ${n} estrela(s) do Dono ${u.name}!` : `⭐ ${-n} estrela(s) foram removidas da sua conta.`);
    save(); pushMe(t.key); return reply(`⭐ ${t.name} agora tem ${t.stars} estrela(s).`);
  }
  if (c === 'banir') {
    if (!need(R.DEV)) return; const t = target(); if (!t) return;
    if (t === u || t.cargo >= R.DEV) return reply('Não é possível banir o Dono.');
    const reason = a.slice(1).join(' ').trim().slice(0, 140) || 'Violação das regras';
    t.banned = { reason, by: u.name, at: Date.now() };
    const to = online.get(t.key);
    if (to?.room) say(to.room, null, `⛔ ${t.name} foi banido por ${u.name}: ${reason}`, true);
    sendTo(t.key, 'staffalert', { msg: `⛔ Sua conta foi banida: ${reason}` });
    if (to) {
      const oldRoom = to.room;
      try { to.res.end(); } catch {}
      online.delete(t.key);
      if (oldRoom) pushRoom(oldRoom);
      pushPlanets();
    }
    saveNow();
    return reply(`⛔ ${t.name} foi banido (${reason}).`);
  }
  if (c === 'desbanir') {
    if (!need(R.DEV)) return; const t = target(); if (!t) return;
    t.banned = null; saveNow();
    return reply(`✅ Banimento de ${t.name} removido.`);
  }
  if (c === 'resetjogos') {
    if (!need(R.DEV)) return; const t = target(); if (!t) return;
    t.best = { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 };
    save(); pushMe(t.key);
    return reply(`🎮 Recordes de minigames de ${t.name} zerados.`);
  }
  if (c === 'planetasenha') {
    if (!need(R.DEV)) return;
    if (a.length < 2) return reply('Uso: /planetasenha <planeta> <senha|off>');
    const pw = a[a.length - 1];
    const pname = a.slice(0, -1).join(' ');
    const p = db.planets.find((x) => norm(x.n) === norm(pname));
    if (!p) return reply('Planeta não encontrado.');
    p.pass = norm(pw) === 'off' ? null : pw.slice(0, 24);
    save(); pushPlanets();
    return reply(p.pass ? `🔐 Planeta ${p.n} agora exige senha.` : `🔓 Senha removida de ${p.n}.`);
  }
  if (c === 'discordlink') {
    if (!need(R.DEV)) return;
    if (!DISCORD_RE.test(a[0] || '')) return reply('Link inválido. Use algo como https://discord.gg/seucodigo');
    db.discord.url = a[0]; save();
    for (const o of online.values()) send(o.res, 'discord', { url: db.discord.url });
    return reply('Link do Discord atualizado.');
  }
  if (c === 'discordauto') {
    if (!need(R.DEV)) return;
    db.discord.auto = norm(a[0]) !== 'off'; save();
    return reply(`Divulgação automática ${db.discord.auto ? 'ligada (a cada 10 min)' : 'desligada'}.`);
  }
  if (c === 'desbugar') {
    if (!need(R.DEV)) return;
    const who = norm(a[0] || '');
    if (!who) return reply('Uso: /desbugar nome ou /desbugar todos');
    const targets = who === 'todos' ? [...online.keys()] : [...online.keys()].filter((key) => norm(db.users[key]?.name) === who);
    if (!targets.length) return reply('Jogador não encontrado ou ninguém está online.');
    for (const key of targets) {
      const targetOnline = online.get(key);
      if (!targetOnline) continue;
      targetOnline.pos = null; targetOnline.typingUntil = 0;
      sendTo(key, 'unbug', { room: targetOnline.room || null });
      if (targetOnline.room) { pushRoom(targetOnline.room); pushTyping(targetOnline.room); }
    }
    return reply(`🛠️ Desbug concluído para ${targets.length} jogador(es).`);
  }
  if (c === 'atualizarapk') {
    if (!need(R.DEV)) return;
    const ver = String(a[0] || '').trim().slice(0, 24);
    const note = a.slice(1).join(' ').slice(0, 100);
    if (!/^[0-9A-Za-z._-]{1,24}$/.test(ver)) return reply('Uso: /atualizarapk 3.1.0 [descrição curta]');
    for (const key of online.keys()) sendTo(key, 'appupdate', { ver, note, ts: Date.now(), global: true });
    return reply(`📲 Aviso da versão ${ver} enviado para ${online.size} jogador(es).`);
  }
  if (c === 'dar') {
    if (!need(R.DEV)) return; const t = find(a[0]); const n = parseInt(a[1]);
    if (!t || !n) return reply(t ? 'Uso: /dar nome UC' : 'Jogador não encontrado. Uso: /dar nome UC');
    if (Math.abs(n) > 100000) return reply('Valor grande demais.');
    t.uc = Math.max(0, (t.uc || 0) + n);
    let ped = '';
    if (n > 0) { const o = db.orders.find((x) => x.key === t.key && x.status === 'pendente' && x.uc === n); if (o) { o.status = 'pago'; o.paidAt = Date.now(); ped = ` (pedido #${o.id} concluído)`; } }
    if (n > 0) mailUser(t, 'Recarga confirmada — UNIVERSO CHAT', `Olá, ${t.name}! Sua recarga foi confirmada: ${n} UniGema(s) creditadas. Saldo: ${t.uc}.`, 'Obrigado pela recarga!');
    addMail(t, n > 0 ? `💎 Você recebeu ${n} UniGema(s)! Obrigado pela recarga.` : `💎 ${-n} UniGema(s) foram removidas da sua conta.`);
    save(); pushMe(t.key); return reply(`${n} UniGema(s) para ${t.name}. Saldo: ${t.uc}.${ped}`);
  }
  if (c === 'darmoedas') {
    if (!need(R.DEV)) return; const t = target(); const n = parseInt(a[1]); if (!t || !n) return reply('Uso: /darmoedas nome valor');
    t.coins += n; save(); pushMe(t.key); return reply(`${n} Cosmos para ${t.name}.`);
  }
  if (c === 'pixchave') {
    if (!need(R.DEV)) return; const k2 = (a[0] || '').trim();
    if (!k2 || k2.length > 77) return reply('Uso: /pixchave sua-chave-pix');
    db.pix = { ...(db.pix || {}), key: k2 }; save(); return reply('Chave Pix salva.');
  }
  if (c === 'emailchave') {
    if (!need(R.DEV)) return; const kk = (a[0] || '').trim();
    if (!kk || kk.length < 20 || kk.length > 300) return reply('Uso: /emailchave SUA_CHAVE_API_BREVO (crie em brevo.com → SMTP & API → API Keys)');
    db.mail = { ...(db.mail || {}), brevo: kk }; save(); return reply('Chave da Brevo salva. Agora use /emailde seu@email.com (o remetente verificado na Brevo) e depois /emailteste.');
  }
  if (c === 'emailde') {
    if (!need(R.DEV)) return; const em = (a[0] || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return reply('Uso: /emailde remetente@email.com [Nome]');
    db.mail = { ...(db.mail || {}), from: em, ...(a[1] ? { name: a.slice(1).join(' ').slice(0, 40) } : {}) }; save(); return reply(`Remetente: ${em}. Use /emailteste para testar.`);
  }
  if (c === 'emailteste') {
    if (!need(R.DEV)) return; const to = (a[0] || u.email || '').trim().toLowerCase();
    if (!mailConfigured()) return reply('Faltam chave e remetente. Use /emailchave e /emailde.');
    if (!EMAIL_RE.test(to)) return reply('Uso: /emailteste seu@email.com');
    reply('Enviando teste...');
    sendMail(to, 'Teste — UNIVERSO CHAT', 'Teste de e-mail', '<p>Funcionou! O envio de e-mail do UNIVERSO CHAT está ativo.</p>').then(() => reply(`✅ E-mail de teste enviado para ${to}.`), (e) => reply('❌ Falhou: ' + e.message));
    return;
  }
  if (c === 'pixnome') {
    if (!need(R.DEV)) return; const nm = asc(a.join(' '), 25); if (!nm) return reply('Uso: /pixnome Seu Nome');
    db.pix = { ...(db.pix || {}), name: nm }; save(); return reply(`Nome do recebedor: ${nm}.`);
  }
  if (c === 'pedidos') {
    if (!need(R.DEV)) return;
    const l = db.orders.filter((x) => x.status === 'pendente');
    return reply(l.length ? 'Recargas pendentes:\n' + l.map((x) => `#${x.id} ${x.user} — R$ ${x.uc},00 → ${x.uc} UC  /dar ${x.user} ${x.uc}`).join('\n') : 'Nenhuma recarga pendente.');
  }
  if (c === 'recusar') {
    if (!need(R.DEV)) return; const o = db.orders.find((x) => x.id === parseInt(a[0]) && x.status === 'pendente');
    if (!o) return reply('Pedido não encontrado.');
    o.status = 'recusado'; save(); const t = db.users[o.key]; if (t) { addMail(t, `💎 Seu pedido de recarga #${o.id} foi recusado.`); pushMe(t.key); }
    return reply(`Pedido #${o.id} recusado.`);
  }
  if (c === 'criarplaneta' || c === 'prisoes' || c === 'novatos') {
    if (!need(R.DEV)) return;
    const add = (n, t) => { if (!db.planets.some((p) => norm(p.n) === norm(n))) db.planets.push({ n, t }); };
    if (c === 'prisoes') for (let i = 1; i <= 10; i++) add(`Prisão ${i}`, 'prison');
    else if (c === 'novatos') for (let i = 1; i <= 4; i++) add(`Novato ${i}`, 'chat');
    else {
      const t = TYPES.includes(norm(a[a.length - 1])) && a.length > 1 ? norm(a.pop()) : 'chat';
      const n = a.join(' ').slice(0, 24); if (!n) return reply('Uso: /criarplaneta nome [tipo]'); add(n, t);
    }
    save(); pushPlanets(); return reply('Planetas atualizados.');
  }
  if (c === 'apagarplaneta') {
    if (!need(R.DEV)) return; const n = a.join(' ');
    const i = db.planets.findIndex((p) => norm(p.n) === norm(n)); if (i < 0 || db.planets.length <= 2) return reply('Planeta não encontrado.');
    const gone = db.planets.splice(i, 1)[0].n; const fb = db.planets[0].n;
    for (const [key, o] of online) if (o.room === gone) moveTo(key, fb);
    save(); pushPlanets(); return reply(`Planeta ${gone} apagado.`);
  }
  reply('Comando desconhecido. Use /ajuda, /mod ou /comandosdono.');
}

// ---------- criação e login ----------
function create(d) {
  const name = String(d.name || '').trim();
  if (!/^[A-Za-z0-9_À-ÿ]{3,16}$/.test(name)) return { error: 'Nome: 3 a 16 letras, números ou _ (sem espaços).' };
  const pass = String(d.pass || '');
  const isOwnerCreate = norm(name) === norm(DEV_NAME) && isValidOwnerPass(pass);
  if (/admin/i.test(name) || (norm(name) === norm(DEV_NAME) && !isOwnerCreate)) return { error: 'Esse nome não está disponível.' };
  if (Object.values(db.users).some((x) => norm(x.name) === norm(name))) return { error: 'Esse nome já está em uso.' };
  if (pass && pass.length < 4) return { error: 'A senha precisa ter pelo menos 4 caracteres.' };
  const requestedChar = COSMETICS.char[d.char];
  const char = requestedChar && requestedChar.price === 0 ? String(d.char) : (d.g === 'f' ? 'estrela' : 'piloto');
  const g = COSMETICS.char[char]?.g || (d.g === 'f' ? 'f' : 'm');
  const key = crypto.randomUUID();
  db.users[key] = {
    key,
    name: isOwnerCreate ? DEV_NAME : name,
    g,
    char,
    passHash: pass ? hashPass(pass) : null,
    cargo: isOwnerCreate ? R.DEV : 0,
    vip: isOwnerCreate,
    coins: 50,
    uc: 0,
    stars: 0,
    chests: 1,
    inv: {},
    tools: [],
    items: [],
    balls: ['verde', 'vermelha'],
    armas: ['pistola'],
    varas: ['vara_bambu'],
    unlockedChars: ['piloto', 'estrela'],
    outfit: null,
    traje: null,
    acc: null,
    pet: null,
    bio: '',
    nameColor: null,
    best: { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 },
    friends: [],
    friendReqs: [],
    guildId: null,
    guildInvites: [],
    redeemed: [],
    prison: null,
    banned: null,
    mutedUntil: 0,
    createdAt: Date.now(),
    savedAt: Date.now(),
    mail: [
      { txt: '🎁 Bem-vindo ao UNIVERSO CHAT! Um baú de boas-vindas espera por você no Menu.', ts: Date.now() },
      { txt: `💬 Entre no nosso Discord: ${db.discord.url}`, ts: Date.now() },
    ],
  };
  saveNow();
  return { ok: true, key };
}

function login(d) {
  const code = String(d.code || '').trim();
  if (code) {
    const u = db.users[code];
    if (!u) return { error: 'Código da conta não encontrado.' };
    if (u.banned) return { error: `⛔ Conta banida: ${u.banned.reason || 'violação das regras'}.` };
    return { ok: true, key: u.key };
  }
  const name = String(d.name || '').trim();
  const pass = String(d.pass || '');
  if (!name || !pass) return { error: 'Digite nome e senha (ou o código da conta).' };
  const u = Object.values(db.users).find((x) => norm(x.name) === norm(name));
  if (!u || !u.passHash || u.passHash !== hashPass(pass)) return { error: 'Nome ou senha incorretos.' };
  if (u.banned) return { error: `⛔ Conta banida: ${u.banned.reason || 'violação das regras'}.` };
  return { ok: true, key: u.key };
}

// ---------- correio com voz & fotos de verificação ----------
const VDIR = path.join(path.dirname(FILE), 'voices');
const PDIR = path.join(path.dirname(FILE), 'verifyphotos');
const VOICE_EXT = { webm: 'webm', mp4: 'm4a', ogg: 'ogg', mpeg: 'mp3', aac: 'aac', 'x-m4a': 'm4a' };
const VOICE_MIME = /^audio\/(webm|mp4|ogg|mpeg|aac|x-m4a)(;.*)?$/i;
const MAX_VOICE_MAIL = 5;
const lastMail = new Map();
const rmVoice = (v) => { if (v?.file) fs.unlink(path.join(VDIR, v.file), () => {}); };
function trimMail(u) {
  const cut = u.mail.length > 150 ? u.mail.slice(0, u.mail.length - 150) : [];
  for (const m of cut) rmVoice(m.voice);
  u.mail = u.mail.slice(-150);
  const vs = u.mail.filter((m) => m.voice);
  for (const m of vs.slice(0, Math.max(0, vs.length - MAX_VOICE_MAIL))) { rmVoice(m.voice); m.voice = null; m.txt = (m.txt ? m.txt + ' ' : '') + '(áudio expirado)'; }
}

const lastChat = new Map();
const lastFeedback = new Map();
function handle(d) {
  if (d.type === 'create') return create(d);
  if (d.type === 'login') return login(d);
  const k = d.key, u = db.users[k];
  if (!u) return { error: 'Conta não encontrada.', reset: true };
  if (u.banned) return { error: 'Conta banida.', reset: true };
  if (d.type === 'ping') return { ok: true };
  const o = online.get(k); if (!o) return { error: 'Sem conexão. Reconectando…' };

  switch (d.type) {
    case 'unbug': {
      o.pos = null; o.typingUntil = 0;
      sendTo(k, 'unbug', { room: o.room || null });
      if (o.room) { pushRoom(o.room); pushTyping(o.room); }
      return { ok: true };
    }
    case 'restartserver': {
      if (u.cargo < R.DEV) return { error: 'Apenas o Dono pode reiniciar o servidor.' };
      for (const key of online.keys()) sendTo(key, 'staffalert', { msg: `🔄 O Dono ${u.name} solicitou reinício do servidor. Desconecte e aguarde a volta.` });
      (async () => {
        try { await flushAll(); }
        catch (e) { console.error('Falha ao concluir salvamento antes do reinício:', e.message); }
        try { server.close(() => process.exit(0)); server.closeAllConnections?.(); }
        catch { process.exit(0); }
      })();
      return { ok: true };
    }
    case 'updateapk': {
      sendTo(k, 'appupdate', { ver: 'atual', note: 'Recarregando o aplicativo', ts: Date.now(), global: false });
      return { ok: true };
    }
    case 'setpass': {
      const p = String(d.pass || '');
      if (p.length < 4) return { error: 'A senha precisa ter pelo menos 4 caracteres.' };
      u.passHash = hashPass(p);
      u.savedAt = Date.now();
      saveNow();
      pushMe(k);
      return { ok: true };
    }
    case 'saveaccount': {
      u.savedAt = Date.now();
      saveNow();
      pushMe(k);
      return { ok: true };
    }
    case 'updateprofile': {
      u.bio = String(d.bio || '').trim().slice(0, 160);
      u.nameColor = d.nameColor ? String(d.nameColor).slice(0, 16) : null;
      save();
      pushMe(k);
      pushRoom(o.room);
      return { ok: true };
    }
    case 'toggleauth': {
      u.showAuth = u.showAuth === false ? true : false;
      save();
      pushMe(k);
      pushRoom(o.room);
      return { ok: true, showAuth: u.showAuth !== false };
    }
    case 'planetowneract': {
      const planet = db.planets.find((p) => p.n === o.room);
      if (!planet || planet.owner !== k) return { error: 'Apenas o dono deste planeta pode usar esses controles.' };
      const target = Object.values(db.users).find((x) => norm(x.name) === norm(d.name));
      if (!target) return { error: 'Jogador não encontrado.' };
      const targetKey = target.key, targetOnline = online.get(targetKey);
      if (!targetOnline || targetOnline.room !== planet.n) return { error: 'O jogador precisa estar online neste planeta.' };
      if (targetKey === k) return { error: 'Você não pode aplicar essa ação em si mesmo.' };
      const action = String(d.action || '');
      if (action === 'star') {
        target.stars = Math.min(999999, (Number(target.stars) || 0) + 1);
        save(); pushMe(targetKey); pushRoom(planet.n);
        return { ok: true, msg: `⭐ Uma estrela foi adicionada para ${target.name}.` };
      }
      if (action === 'unstar') {
        target.stars = Math.max(0, (Number(target.stars) || 0) - 1);
        save(); pushMe(targetKey); pushRoom(planet.n);
        return { ok: true, msg: `⭐ Uma estrela foi retirada de ${target.name}.` };
      }
      if (action === 'jail') {
        if (target.prison) return { error: 'Esse jogador já está preso.' };
        target.prisonReturnRoom = targetOnline.room;
        target.prison = { by: u.name, reason: `Ação do dono do planeta ${planet.n}`, ts: Date.now() };
        const oldRoom = targetOnline.room;
        targetOnline.room = 'Prisão 1'; targetOnline.pos = null;
        pushRoom(oldRoom); pushRoom(targetOnline.room); pushPlanets(); pushMe(targetKey);
        return { ok: true, msg: `${target.name} foi enviado à Prisão 1.` };
      }
      if (action === 'release') {
        if (!target.prison) return { error: 'Esse jogador não está preso.' };
        target.prison = null;
        const oldRoom = targetOnline.room;
        const destination = db.planets.some((p) => p.n === target.prisonReturnRoom) ? target.prisonReturnRoom : 'Bate-papo Universo';
        target.prisonReturnRoom = null;
        targetOnline.room = destination; targetOnline.pos = null;
        pushRoom(oldRoom); pushRoom(destination); pushPlanets(); pushMe(targetKey);
        return { ok: true, msg: `${target.name} foi solto e voltou para ${destination}.` };
      }
      return { error: 'Ação inválida.' };
    }
    case 'join': {
      const p = db.planets.find((x) => x.n === d.room); if (!p) return { error: 'Planeta não existe.' };
      if (u.prison && p.t !== 'prison') return { error: 'Você está preso. Só pode ficar na Prisão.' };
      if (p.t === 'prison' && !u.prison && u.cargo < R.MOD) return { error: 'Só prisioneiros e moderadores entram na Prisão.' };
      if (p.t === 'vip' && !u.vip && u.cargo < R.DEV) return { error: 'Planeta exclusivo para VIP.' };
      if (/^novato\b/i.test(p.n) && isNovatoBlocked(u)) {
        return { error: `Plugin Novatos: ${CARGOS[u.cargo]} não pode entrar nos planetas Novato.` };
      }
      if (p.pass && d.pass !== p.pass && u.cargo < R.DEV) {
        return { error: d.pass ? 'Senha incorreta.' : 'Digite a senha do planeta.', needPass: true };
      }
      if (o.room !== p.n && u.cargo < R.MOD && roomCount(p.n) >= PLANET_CAP) return { error: `Planeta lotado (${PLANET_CAP}/${PLANET_CAP}). Tente outro planeta.` };
      const old = o.room, wasTyping = (o.typingUntil || 0) > 0;
      if (old !== p.n) { o.typingUntil = 0; o.pos = null; o.action = null; }
      o.room = p.n; pushRoom(old); pushRoom(p.n); pushPlanets();
      if (wasTyping && old && old !== p.n) pushTyping(old);
      return { ok: true, planet: { n: p.n, t: p.t }, game: gameState(o, u, p.t), members: members(p.n), typing: typingUsers(p.n) };
    }
    case 'typing': {
      if (!o.room) return { ok: true };
      const on = d.on !== false, was = (o.typingUntil || 0) > Date.now();
      o.typingUntil = on ? Date.now() + 3500 : 0;
      if (on || was) pushTyping(o.room);
      return { ok: true };
    }
    case 'move': {
      if (!o.room) return { ok: true };
      if (Date.now() - (o.mt || 0) < 45) return { ok: true };
      o.mt = Date.now();
      let x = Number(d.x) || 0, z = Number(d.z) || 0, ry = Number(d.ry) || 0;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: true };
      const r = Math.hypot(x, z), maxR = 3.45;
      if (r > maxR) { x = (x / r) * maxR; z = (z / r) * maxR; }
      if (!Number.isFinite(ry)) ry = 0;
      o.pos = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, ry: Math.round(ry * 100) / 100 };
      if (o.action) o.action = null;
      pushMove(o.room, u.name, o.pos);
      return { ok: true };
    }
    case 'emote': {
      if (!o.room) return { ok: true };
      const PERSISTENT_EMOTES = new Set(['sit', 'sleep', 'dance', 'float']);
      const ALL_EMOTES = new Set(['idle', 'wave', 'clap', 'dance', 'cheer', 'jump', 'bow', 'laugh', 'spin', 'sit', 'sleep', 'float']);
      const kind = ALL_EMOTES.has(d.emote) ? d.emote : null;
      if (!kind) return { error: 'Animação inválida.' };
      if (Date.now() - (o.et || 0) < 350) return { ok: true };
      o.et = Date.now();
      const persistent = PERSISTENT_EMOTES.has(kind);
      o.action = kind === 'idle' ? null : { emote: kind, persistent, until: persistent ? 0 : (Date.now() + 2800) };
      for (const ok of online.values()) if (ok.room === o.room) send(ok.res, 'emote', { name: u.name, emote: kind, persistent });
      return { ok: true, emote: kind, persistent };
    }
    case 'chat': {
      const text = String(d.text || '').trim().slice(0, 200); if (!text || !o.room) return { ok: true };
      if (Date.now() - (lastChat.get(k) || 0) < 600) return { error: 'Devagar!' }; lastChat.set(k, Date.now());
      if ((o.typingUntil || 0) > 0) { o.typingUntil = 0; pushTyping(o.room); }
      if (text[0] === '/') { command(k, u, text); return { ok: true }; }
      if ((u.mutedUntil || 0) > Date.now()) {
        const sec = Math.ceil((u.mutedUntil - Date.now()) / 1000);
        return { error: `🔇 Você está silenciado no chat por mais ${sec}s.` };
      }
      say(o.room, pub(u), text); return { ok: true };
    }
    case 'sharemusic': {
      if (!o.room) return { error: 'Entre em um planeta para compartilhar a música.' };
      if ((u.mutedUntil || 0) > Date.now()) return { error: '🔇 Você está silenciado no chat.' };
      const s = sanitizeSongPayload(d.song, u.name);
      if (!s) return { error: 'Música inválida.' };
      say(o.room, pub(u), `🎵 Tocando agora: ${s.title} (${s.style})`, false, { music: s });
      return { ok: true };
    }
    case 'sendmail': {
      if (Date.now() - (lastMail.get(k) || 0) < 3000) return { error: 'Devagar! Espere uns segundos.' };
      const t = Object.values(db.users).find((x) => norm(x.name) === norm(d.to));
      if (!t) return { error: 'Jogador não encontrado. Confira o nome.' };
      if (t === u) return { error: 'Você não pode enviar para você mesmo.' };
      const text = String(d.text || '').trim().slice(0, 200);
      let voice = null;
      if (d.data) {
        const mime = String(d.mime || ''), data = String(d.data);
        if (!VOICE_MIME.test(mime) || !/^[A-Za-z0-9+/=]+$/.test(data) || data.length < 100 || data.length > 200000) return { error: 'Áudio inválido ou grande demais (máx. 30s).' };
        const ext = VOICE_EXT[mime.split(';')[0].split('/')[1].toLowerCase().trim()];
        if (!ext) return { error: 'Formato de áudio não suportado.' };
        const id = crypto.randomUUID(), file = `${id}.${ext}`;
        try { fs.mkdirSync(VDIR, { recursive: true }); fs.writeFileSync(path.join(VDIR, file), Buffer.from(data, 'base64')); }
        catch (e) { console.error('erro ao salvar áudio:', e.message); return { error: 'Não consegui salvar o áudio.' }; }
        voice = { id, file, dur: Math.max(1, Math.min(30, Math.round(+d.dur || 1))) };
      }
      if (!text && !voice) return { error: 'Escreva algo ou grave um áudio.' };
      lastMail.set(k, Date.now());
      addMail(t, text, { from: u.name, voice });
      // Cópia para quem enviou, para a conversa mostrar os dois lados (o áudio fica só com quem recebe).
      addMail(u, text, { to: t.name, mine: true, ...(voice ? { audioDur: voice.dur } : {}) });
      save(); pushMe(t.key); pushMe(u.key);
      return { ok: true, to: t.name };
    }
    case 'modact': {
      const name = String(d.name || '').replace(/\s+/g, '').slice(0, 16), act = String(d.action);
      if (!name || !['prender', 'soltar', 'expulsar'].includes(act)) return { error: 'Ação inválida.' };
      const reason = act === 'prender' ? ' ' + String(d.reason || '').replace(/[\r\n]+/g, ' ').slice(0, 60) : '';
      command(k, u, `/${act} ${name}${reason}`); return { ok: true };
    }
    case 'openchest': {
      if (u.chests > 0) u.chests--; else if (u.inv.chave > 0) u.inv.chave--; else return { error: 'Você não tem baú nem chave.' };
      const out = openChest(u); save(); pushMe(k); return { ok: true, rewards: out };
    }
    case 'buyug': {
      const kind = String(d.kind || ''), id = String(d.id || '');
      const spec = UG_SHOP[kind]?.[id];
      if (!spec) return { error: 'Item indisponível.' };
      if ((u.uc || 0) < spec.price) return { error: `UniGemas insuficientes (${spec.price} UG). Recarregue em Menu → Recarga.` };
      if (kind === 'pet') {
        if (u.items.some((x) => x.id === 'pet:' + id)) return { error: 'Você já tem esse pet.' };
        u.uc -= spec.price;
        u.items.push({ id: 'pet:' + id, type: 'pet', name: spec.name, emoji: spec.emoji, tier: spec.tier });
        u.pet = spec.emoji;
      } else if (kind === 'traje') {
        if (u.items.some((x) => x.id === 'traje:' + id || x.trajeId === id)) return { error: 'Você já tem esse traje.' };
        u.uc -= spec.price;
        u.items.push({ id: 'traje:' + id, type: 'traje', trajeId: id, name: spec.name });
        u.traje = id;
      } else {
        const meus = db.planets.filter((p) => p.owner === k);
        if (meus.length >= 3) return { error: 'Você já tem 3 planetas pessoais.' };
        if (meus.some((p) => p.theme === id)) return { error: 'Você já tem esse planeta.' };
        const pname = `${spec.name} de ${u.name}`.slice(0, 40);
        if (db.planets.some((p) => norm(p.n) === norm(pname))) return { error: 'Esse planeta já existe.' };
        u.uc -= spec.price;
        db.planets.push({ n: pname, t: 'chat', owner: k, theme: id, icon: spec.emoji });
        addMail(u, `🪐 Você comprou o ${spec.name}! Ele está na lista de Planetas: ${pname}.`);
        pushPlanets();
      }
      save(); pushMe(k); pushRoom(o.room);
      return { ok: true, name: spec.name, kind };
    }
    case 'buycosmetic': {
      const kind = String(d.kind || ''), id = String(d.id || '');
      const spec = COSMETICS[kind]?.[id];
      if (!spec) return { error: 'Item indisponível.' };
      if (kind === 'char') {
        u.unlockedChars ||= ['piloto', 'estrela'];
        if (u.unlockedChars.includes(id) || spec.price === 0) return { error: 'Você já tem esse personagem.' };
        if (u.coins < spec.price) return { error: 'Cosmos insuficientes.' };
        u.coins -= spec.price;
        u.unlockedChars.push(id);
        u.char = id;
        u.g = spec.g || u.g;
      } else if (kind === 'roupa') {
        if (u.items.some((x) => x.id === 'roupa:' + id || x.outfitId === id)) return { error: 'Você já tem essa roupa.' };
        if (u.coins < spec.price) return { error: 'Cosmos insuficientes.' };
        u.coins -= spec.price;
        u.items.push({ id: 'roupa:' + id, type: 'roupa', outfitId: id, name: spec.name, color: spec.color });
        u.outfit = id;
      } else if (kind === 'traje') {
        if (u.items.some((x) => x.id === 'traje:' + id || x.trajeId === id)) return { error: 'Você já tem esse traje.' };
        if (u.coins < spec.price) return { error: 'Cosmos insuficientes.' };
        u.coins -= spec.price;
        u.items.push({ id: 'traje:' + id, type: 'traje', trajeId: id, name: spec.name });
        u.traje = id;
      } else if (kind === 'acessorio') {
        if (u.items.some((x) => x.id === 'acessorio:' + id || x.accId === id)) return { error: 'Você já tem esse acessório.' };
        if (u.coins < spec.price) return { error: 'Cosmos insuficientes.' };
        u.coins -= spec.price;
        u.items.push({ id: 'acessorio:' + id, type: 'acessorio', accId: id, name: spec.name, emoji: spec.emoji });
        u.acc = id;
      } else if (kind === 'aura') {
        if (u.items.some((x) => x.id === 'aura:' + id || x.auraId === id)) return { error: 'Você já tem essa skin de aura.' };
        if (u.coins < spec.price) return { error: 'Cosmos insuficientes.' };
        u.coins -= spec.price;
        u.items.push({ id: 'aura:' + id, type: 'aura', auraId: id, name: spec.name, emoji: spec.emoji, color: spec.color });
        u.aura = id;
      }
      save(); pushMe(k); pushRoom(o.room);
      return { ok: true, name: spec.name };
    }
    case 'equip': {
      const id = String(d.id || '');
      if (id.startsWith('char:')) {
        const cid = id.slice(5);
        const owned = (u.unlockedChars || ['piloto', 'estrela']).includes(cid) || COSMETICS.char[cid]?.price === 0;
        if (!owned || !COSMETICS.char[cid]) return { error: 'Personagem bloqueado.' };
        u.char = cid;
        u.g = COSMETICS.char[cid].g || u.g;
        save(); pushMe(k); pushRoom(o.room); return { ok: true };
      }
      const it = u.items.find((x) => x.id === id); if (!it) return { error: 'Item não encontrado.' };
      if (it.type === 'roupa') {
        const val = it.outfitId || it.color;
        u.outfit = u.outfit === val ? null : val;
      } else if (it.type === 'traje') {
        u.traje = u.traje === it.trajeId ? null : it.trajeId;
      } else if (it.type === 'acessorio') {
        u.acc = u.acc === it.accId ? null : it.accId;
      } else if (it.type === 'aura') {
        u.aura = u.aura === it.auraId ? null : it.auraId;
      } else if (it.type === 'pet') {
        u.pet = u.pet === it.emoji ? null : it.emoji;
      } else return { error: 'Item incompatível.' };
      save(); pushMe(k); pushRoom(o.room); return { ok: true };
    }
    case 'buy': {
      const item = String(d.item);
      const toolPrices = { colher_fuga: 20, pa_fuga: 100 };
      if (toolPrices[item] !== undefined) {
        const price = toolPrices[item];
        if (u.coins < price) return { error: 'Cosmos insuficientes.' };
        u.coins -= price;
        u.tools ||= [];
        u.tools.push({ id: crypto.randomUUID(), type: item, durability: item === 'colher_fuga' ? 5 : 1, maxDurability: item === 'colher_fuga' ? 5 : 1 });
        save(); pushMe(k); return { ok: true, name: item === 'pa_fuga' ? 'Pá Lendária' : 'Colher de Fuga' };
      }
      const price = item === 'bala_explosiva' ? 5 : BALLS[item]?.[1];
      if (price === undefined || price === 0) return { error: 'Item inválido.' };
      if (BALLS[item] && u.balls.includes(item)) return { error: 'Você já tem essa bola.' };
      if (u.coins < price) return { error: 'Cosmos insuficientes.' };
      u.coins -= price; if (BALLS[item]) u.balls.push(item); else grant(u, item); save(); pushMe(k); return { ok: true };
    }
    case 'soccerKick': {
      u.best ||= { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 };
      const g = (o.g.soccer ||= newSoccer());
      if (Date.now() - (o.soccerAt || 0) < 500) return { error: 'Devagar!' };
      o.soccerAt = Date.now();
      const cl = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(+v) ? +v : 0));
      const x = cl(d.x, -1.3, 1.3), y = cl(d.y, 0, 1.3), pw = cl(d.power, 0, 1);
      const ax = Math.abs(x);
      const inside = ax < 0.92 && y < 0.92;
      const wood = !inside && ax < 1.04 && y < 1.04;
      const col = x < -0.33 ? -1 : x > 0.33 ? 1 : 0;
      const keeper = rnd(3) - 1;
      let outcome;
      if (inside) {
        // chute fraco ou no canto do goleiro pode ser defendido; força e altura dificultam a defesa
        const saveP = pw < 0.2 ? 0.95 : 0.85 - pw * 0.35 - y * 0.25;
        outcome = keeper === col && Math.random() < saveP ? 'saved' : 'goal';
      } else outcome = wood ? 'post' : 'out';
      g.kicks++;
      const rewards = [];
      if (outcome === 'goal') {
        g.goals++;
        const golaco = ax > 0.7 && y > 0.55;
        const coins = golaco ? 5 : 3;
        grant(u, 'coins', coins); rewards.push(`⚽ Gol! 🪙 +${coins} Cosmos${golaco ? ' (golaço no ângulo!)' : ''}`);
        grantMiniGameUniGema(u, o, 'soccer', rewards, 0.1);
      }
      const over = g.kicks >= 5, goals = g.goals, kicks = g.kicks;
      if (over) {
        if (goals > u.best.soccer) u.best.soccer = goals;
        if (goals === 5) { grant(u, 'star'); grant(u, 'coins', 20); rewards.push('🏆 5/5! +1 estrela e 🪙 +20 Cosmos'); }
        else if (goals >= 3) { grant(u, 'coins', 5); rewards.push('🥅 Bom jogo! 🪙 +5 Cosmos'); }
        o.g.soccer = newSoccer();
      }
      save(); pushMe(k);
      return { ok: true, outcome, keeper, goals, kicks, over, rewards, best: u.best.soccer };
    }
    case 'caveStart': {
      u.caveGame = { stage: 'search', turns: 0, key: false, relic: false, gate: false, chase: 0, escapeSteps: 0, result: null };
      save(); pushMe(k); return { ok: true, state: { ...u.caveGame } };
    }
    case 'caveAction': {
      const c = caveState(u), act = String(d.action || '');
      if (Date.now() - (o.caveAt || 0) < 300) return { error: 'Aguarde um instante.' };
      o.caveAt = Date.now();
      if (c.stage === 'intro') return { error: 'Toque em começar para entrar na caverna.' };
      if (['won', 'lost'].includes(c.stage)) return { error: 'Sua tentativa terminou. Comece outra.' };
      const rewards = [];
      if (act === 'search' && c.stage === 'search') {
        c.turns++;
        if (!c.key && c.turns >= 2) { c.key = true; rewards.push('🗝️ Você encontrou uma chave de ferro!'); }
        else if (!c.relic && Math.random() < 0.22) { c.relic = true; rewards.push('✨ Você encontrou um Relicário Luminoso!'); }
        else rewards.push('🔎 Você explorou um canto da caverna.');
        c.chase = Math.min(5, c.chase + (Math.random() < 0.7 ? 1 : 0));
        if (c.chase >= 5) { c.stage = 'lost'; c.result = 'O Guardião alcançou você. A caverna fechou a passagem.'; }
      } else if (act === 'unlock' && c.stage === 'search') {
        if (!c.key && !c.relic) return { error: 'Encontre a chave ou o Relicário Luminoso primeiro.' };
        c.gate = true; c.stage = 'escape'; c.chase = Math.max(2, c.chase); c.turns++;
        rewards.push(c.relic ? '✨ O relicário abriu o portão!' : '🗝️ A chave abriu o portão!');
      } else if (act === 'hide' && (c.stage === 'search' || c.stage === 'escape')) {
        c.turns++; c.chase = c.stage === 'search' ? Math.min(5, c.chase + 1) : Math.max(0, c.chase - 1);
        rewards.push(c.stage === 'search' ? '🪨 Você se esconde, mas o Guardião continua procurando.' : '🪨 Você se esconde atrás das rochas e ganha tempo.');
        if (c.chase >= 5) { c.stage = 'lost'; c.result = 'O Guardião alcançou você. A caverna fechou a passagem.'; }
      } else if (act === 'run' && c.stage === 'escape') {
        c.turns++; c.escapeSteps++; c.chase = Math.min(5, c.chase + 1);
        if (c.escapeSteps >= 2 && c.chase < 5) {
          c.stage = 'won'; c.result = 'Você escapou da Caverna do Guardião!';
          const rewardReady = !u.caveRewardAt || Date.now() - u.caveRewardAt >= 5 * 60 * 1000;
          if (rewardReady) {
            u.caveRewardAt = Date.now();
            const coins = 35 + rnd(36); grant(u, 'coins', coins); rewards.push(`🪙 +${coins} Cosmos`);
            grant(u, 'star'); rewards.push('⭐ +1 estrela de autoridade');
            if (Math.random() < 0.25) { u.uc = (u.uc || 0) + 1; rewards.push('💎 +1 UniGema'); }
            if (Math.random() < 0.35) { grant(u, 'chave'); rewards.push('🗝️ +1 chave de baú'); }
            if (Math.random() < 0.3) { u.chests = (u.chests || 0) + 1; rewards.push('🎁 +1 baú'); }
            if (Math.random() < 0.55) { grant(u, 'bala_explosiva'); rewards.push('💣 +1 item para o Canhão'); }
            let code; do { code = 'CAVERNA-' + crypto.randomBytes(3).toString('hex').toUpperCase(); } while (db.caveRedeemCodes[code]);
            db.caveRedeemCodes[code] = { key: k, createdAt: Date.now(), used: false };
            rewards.push(`🎟️ Código para resgatar: ${code}`);
          } else rewards.push('⏳ Você escapou! Recompensas da caverna ficam disponíveis a cada 5 minutos.');
        } else if (c.chase >= 5) { c.stage = 'lost'; c.result = 'O Guardião bloqueou a saída. Tente novamente!'; }
        else rewards.push(`🏃 Continue correndo! ${c.escapeSteps}/2 passos para escapar.`);
      } else return { error: 'Ação inválida nesta etapa.' };
      save(); pushMe(k);
      return { ok: true, state: { ...c }, rewards };
    }
    case 'bowl': {
      if (!u.balls.includes(d.ball)) return { error: 'Bola não disponível.' };
      const g = (o.g.bowl ||= newBowl()), full = g.pins.every(Boolean);
      const p = Math.min(0.92, BALLS[d.ball][0] + Math.random() * 0.15);
      const down = []; g.pins.forEach((s, i) => { if (s && Math.random() < p) { g.pins[i] = 0; down.push(i); } });
      const k2 = down.length; g.total += k2; g.throws++;
      const rewards = [];
      if (k2) { grant(u, 'coins', k2); rewards.push(`🪙 ${k2} Cosmos`); grantMiniGameUniGema(u, o, 'bowling', rewards, 0.12); }
      for (let i = 0; i < k2; i++) if (Math.random() < 0.08) rewards.push(rollReward(u));
      const strike = full && k2 === 10; if (strike) { grant(u, 'star'); rewards.push('⭐ Strike! +1 estrela'); }
      const cleared = !g.pins.some(Boolean), over = g.throws >= 10, total = g.total;
      if (cleared) g.pins = Array(10).fill(1);
      if (over) { if (total > u.best.bowling) u.best.bowling = total; o.g.bowl = newBowl(); }
      save(); pushMe(k);
      return { ok: true, down, pins: over ? Array(10).fill(1) : g.pins, total, throws: over ? 10 : g.throws, over, strike, rewards, best: u.best.bowling };
    }
    case 'zshoot': {
      ensureZ(u); const z = (o.g.zumbi ||= newZ());
      if (Date.now() - (o.zt || 0) < 150) return { error: 'Devagar!' }; o.zt = Date.now();
      const t = z.zs.find((x) => x.id === +d.id); if (!t) return { ok: true, state: zstate(o, u), stale: true };
      const arma = u.armas.includes(d.arma) && ARMAS[d.arma] ? d.arma : 'pistola';
      let coins = 0; const rewards = [];
      t.hp -= ARMAS[arma][0];
      if (t.hp <= 0) {
        z.zs = z.zs.filter((x) => x !== t); coins += t.max > 1 ? 5 : 2;
        if (Math.random() < 0.03) rewards.push(rollReward(u));
      }
      for (const x of z.zs) x.dist--;
      const lost = z.zs.filter((x) => x.dist <= 0).length; z.zs = z.zs.filter((x) => x.dist > 0); z.lives -= lost;
      let over = false, clear = 0, bonus = 0, reached = 0;
      if (z.lives <= 0) {
        over = true; reached = z.wave - 1; o.g.zumbi = newZ();
      } else if (!z.zs.length) {
        clear = z.wave; grantMiniGameUniGema(u, o, 'zombie', rewards, 0.25); bonus = 5 * z.wave; coins += bonus;
        if (z.wave % 5 === 0) { grant(u, 'star'); rewards.push('⭐ Chefe derrotado! +1 estrela'); }
        if (Math.random() < 0.25) rewards.push(rollReward(u));
        if (z.wave > u.best.zumbi) u.best.zumbi = z.wave;
        z.wave++; spawnWave(z);
      }
      if (coins) grant(u, 'coins', coins);
      save(); pushMe(k);
      return { ok: true, state: zstate(o, u), lost, over, reached, clear, bonus, coins, rewards };
    }
    case 'buyarma': {
      ensureZ(u); const a = ARMAS[d.arma];
      if (!a || !a[1]) return { error: 'Arma inválida.' };
      if (u.armas.includes(d.arma)) return { error: 'Você já tem essa arma.' };
      if (u.coins < a[1]) return { error: 'Cosmos insuficientes.' };
      u.coins -= a[1]; u.armas.push(d.arma); save(); pushMe(k); return { ok: true };
    }
    case 'buyvara': {
      u.varas ||= ['vara_bambu'];
      const v = VARAS[d.vara];
      if (!v || !v[2]) return { error: 'Vara inválida.' };
      if (u.varas.includes(d.vara)) return { error: 'Você já tem essa vara.' };
      if (u.coins < v[2]) return { error: 'Cosmos insuficientes.' };
      u.coins -= v[2]; u.varas.push(d.vara); save(); pushMe(k); return { ok: true, name: `Vara ${v[0]}` };
    }
    case 'fishcast': {
      u.varas ||= ['vara_bambu'];
      const vara = u.varas.includes(d.vara) ? d.vara : 'vara_bambu';
      const delayMs = 1200 + Math.floor(Math.random() * 1600);
      o.g.fish = { vara, biteAt: Date.now() + delayMs, expireAt: Date.now() + delayMs + 4200 };
      return { ok: true, delayMs };
    }
    case 'fishcatch': {
      const f = o.g.fish;
      if (!f) return { ok: true, missed: true, msg: 'Lance a linha primeiro!' };
      const now = Date.now();
      if (now < f.biteAt - 300) { o.g.fish = null; return { ok: true, early: true, msg: '⏳ Puxou cedo demais! Espere a boia afundar.' }; }
      if (now > f.expireAt) { o.g.fish = null; return { ok: true, missed: true, msg: '💨 O peixe escapou!' }; }
      const luck = (VARAS[f.vara]?.[1] || 0) / 100;
      o.g.fish = null;
      const totalW = FISH_POOL.reduce((s, p) => s + p.w, 0);
      let roll = Math.random() * totalW;
      if (luck > 0 && Math.random() < luck) roll = totalW * (0.65 + Math.random() * 0.35);
      let caughtFish = FISH_POOL[0];
      for (const fp of FISH_POOL) { roll -= fp.w; if (roll <= 0) { caughtFish = fp; break; } }
      const rewards = [];
      grantMiniGameUniGema(u, o, 'fishing', rewards, 0.18);
      grant(u, 'coins', caughtFish.coins);
      rewards.push(`🪙 +${caughtFish.coins} Cosmos`);
      if (caughtFish.star) { grant(u, 'star'); rewards.push('⭐ +1 estrela de autoridade'); }
      if (caughtFish.chest) { u.chests++; rewards.push('🎁 +1 baú!'); }
      u.best ||= { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 };
      u.best.fishing = (u.best.fishing || 0) + 1;
      o.g.lastFish = { name: caughtFish.name, emoji: caughtFish.emoji };
      save(); pushMe(k);
      return { ok: true, fish: caughtFish, caught: u.best.fishing, rewards };
    }
    case 'fire': {
      const t = (o.g.cannon ||= newTarget());
      const ang = Math.min(85, Math.max(5, +d.angle || 45)), pow = Math.min(40, Math.max(10, +d.power || 25));
      const exp = d.ammo === 'explosiva';
      if (exp) { if (!(u.inv.bala_explosiva > 0)) return { error: 'Sem bala explosiva. Compre na loja.' }; u.inv.bala_explosiva--; }
      const range = (pow * pow * Math.sin((2 * ang * Math.PI) / 180)) / 9.8;
      const hit = Math.abs(range - t.target) <= (exp ? 7 : 3);
      const rewards = [], was = { ...t };
      if (hit) {
        grantMiniGameUniGema(u, o, 'cannon', rewards, 0.20);
        grant(u, 'coins', 10); rewards.push('🪙 10 Cosmos'); u.best.cannon++;
        if (Math.random() < (t.kind === 'bicho' ? 0.8 : 0.5)) rewards.push(rollReward(u));
        o.g.cannon = newTarget();
      }
      save(); pushMe(k);
      return { ok: true, hit, range, was, next: o.g.cannon, rewards, hits: u.best.cannon };
    }
    case 'escape': {
      if (!u.prison) return { error: 'Você não está preso.' };
      u.tools ||= [];
      const tool = u.tools.find((x) => x.id === d.toolId && x.durability > 0);
      if (!tool) return { error: 'Você não tem uma ferramenta de fuga disponível. Compre na Loja.' };
      const legendary = tool.type === 'pa_fuga';
      const ok = legendary || Math.random() < 0.20;
      tool.durability = Math.max(0, (Number(tool.durability) || 1) - 1);
      const broke = tool.durability === 0;
      if (broke) u.tools = u.tools.filter((x) => x.id !== tool.id);
      if (ok) { u.prison = null; addMail(u, `🏃 Você fugiu do calabouço usando ${legendary ? 'a Pá Lendária' : 'a colher'}!`); }
      else addMail(u, `🥄 A tentativa de fuga falhou. Durabilidade restante: ${tool.durability}.`);
      save(); pushMe(k); if (ok) moveTo(k, 'Novato 1');
      return { ok: true, escaped: ok, broke, durability: tool.durability, legendary };
    }
    case 'redeem': {
      const code = String(d.code || '').trim().toUpperCase();
      u.redeemed ||= [];
      if (u.redeemed.includes(code)) return { error: 'Você já resgatou esse código.' };
      const PROMO = { UNIVERSO2026: { coins: 50, chests: 1 }, BEMVINDO: { coins: 30, star: 1 } };
      const caveCode = db.caveRedeemCodes?.[code];
      if (caveCode) {
        if (caveCode.key !== k) return { error: 'Este código da Caverna foi gerado para outra conta.' };
        if (caveCode.used) return { error: 'Este código já foi resgatado.' };
        caveCode.used = true; u.redeemed.push(code);
        grant(u, 'coins', 20); u.uc = (u.uc || 0) + 1; grant(u, 'chave');
        save(); pushMe(k); return { ok: true, code, rewards: ['🪙 +20 Cosmos', '💎 +1 UniGema', '🗝️ +1 chave de baú'] };
      }
      const p = PROMO[code];
      if (!p) return { error: 'Código inválido ou expirado.' };
      u.redeemed.push(code);
      const rewards = [];
      if (p.coins) { grant(u, 'coins', p.coins); rewards.push(`🪙 +${p.coins} Cosmos`); }
      if (p.chests) { u.chests += p.chests; rewards.push(`🎁 +${p.chests} baú(s)`); }
      if (p.star) { grant(u, 'star', p.star); rewards.push(`⭐ +${p.star} estrela`); }
      save(); pushMe(k);
      return { ok: true, code, rewards };
    }
    case 'usersearch': {
      const q = norm(d.q || '');
      if (!q) return { ok: true, users: [] };
      const users = Object.values(db.users)
        .filter((x) => norm(x.name).includes(q))
        .slice(0, 20)
        .map((x) => {
          const xo = online.get(x.key);
          const xg = guildOf(x);
          return {
            key: x.key,
            name: x.name,
            cargo: x.cargo,
            stars: x.stars,
            vip: !!x.vip,
            bio: x.bio || '',
            nameColor: x.nameColor || null,
            guildTag: xg?.tag || null,
            verified: verifiedTag(x),
            online: !!xo,
            room: xo?.room || null,
            prison: !!x.prison,
            isFriend: (u.friends || []).includes(x.key),
            reqSent: (x.friendReqs || []).includes(k),
            reqReceived: (u.friendReqs || []).includes(x.key),
            sameGuild: !!u.guildId && x.guildId === u.guildId,
          };
        });
      return { ok: true, users };
    }
    case 'userinfo': {
      const x = Object.values(db.users).find((t) => norm(t.name) === norm(d.name));
      if (!x) return { error: 'Jogador não encontrado.' };
      const xo = online.get(x.key);
      const xg = guildOf(x);
      const mg = guildOf(u);
      const isGuildOff = !!mg && (mg.leaderKey === k || (mg.officers || []).includes(k));
      return {
        ok: true,
        profile: {
          ...pub(x),
          cargoName: CARGOS[x.cargo] || 'Viajante',
          stars: x.stars,
          coins: x.coins,
          friendsCount: (x.friends || []).length,
          createdAt: x.createdAt || Date.now(),
          lastSeen: x.savedAt || Date.now(),
          online: !!xo,
          room: xo?.room || null,
          prison: x.prison || null,
          best: x.best || { bowling: 0, cannon: 0, zumbi: 0, fishing: 0, soccer: 0 },
          verifyStatus: x.verify?.status || 'none',
          guild: xg ? {
            name: xg.name,
            tag: xg.tag,
            role: xg.leaderKey === x.key ? 'leader' : (xg.officers || []).includes(x.key) ? 'officer' : 'member',
            membersCount: (xg.members || []).length,
          } : null,
          isSelf: x.key === k,
          isFriend: (u.friends || []).includes(x.key),
          reqSent: (x.friendReqs || []).includes(k),
          reqReceived: (u.friendReqs || []).includes(x.key),
          canInviteGuild: isGuildOff && x.key !== k && x.guildId !== u.guildId,
        },
      };
    }
    case 'friendadd': {
      const t = Object.values(db.users).find((x) => norm(x.name) === norm(d.name));
      if (!t) return { error: 'Jogador não encontrado.' };
      if (t.key === k) return { error: 'Você não pode adicionar a si mesmo.' };
      u.friends ||= []; t.friends ||= []; u.friendReqs ||= []; t.friendReqs ||= [];
      if (u.friends.includes(t.key)) return { error: 'Vocês já são amigos.' };
      if (u.friendReqs.includes(t.key)) {
        u.friendReqs = u.friendReqs.filter((x) => x !== t.key);
        u.friends.push(t.key); t.friends.push(k);
        save(); pushMe(k); pushMe(t.key);
        return { ok: true, msg: `🤝 Agora você e ${t.name} são amigos!` };
      }
      if (!t.friendReqs.includes(k)) t.friendReqs.push(k);
      save(); pushMe(t.key);
      return { ok: true, msg: `📨 Pedido de amizade enviado para ${t.name}!` };
    }
    case 'friendaccept': {
      const t = db.users[d.targetKey]; if (!t) return { error: 'Jogador não encontrado.' };
      u.friendReqs = (u.friendReqs || []).filter((x) => x !== t.key);
      u.friends ||= []; t.friends ||= [];
      if (!u.friends.includes(t.key)) u.friends.push(t.key);
      if (!t.friends.includes(k)) t.friends.push(k);
      save(); pushMe(k); pushMe(t.key);
      return { ok: true, name: t.name };
    }
    case 'friendreject': {
      u.friendReqs = (u.friendReqs || []).filter((x) => x !== d.targetKey);
      save(); pushMe(k); return { ok: true };
    }
    case 'friendremove': {
      const t = db.users[d.targetKey];
      u.friends = (u.friends || []).filter((x) => x !== d.targetKey);
      if (t) { t.friends = (t.friends || []).filter((x) => x !== k); pushMe(t.key); }
      save(); pushMe(k); return { ok: true };
    }
    case 'guildlist': {
      const q = norm(d.q || '');
      const guilds = Object.values(db.guilds)
        .filter((g) => !q || norm(g.name).includes(q) || norm(g.tag).includes(q))
        .map((g) => ({
          id: g.id,
          name: g.name,
          tag: g.tag,
          desc: g.desc || '',
          open: !!g.open,
          membersCount: (g.members || []).length,
          onlineCount: (g.members || []).filter((mk) => online.has(mk)).length,
        }));
      return { ok: true, guilds };
    }
    case 'guildcreate': {
      if (u.guildId && db.guilds[u.guildId]) return { error: 'Você já está em uma guilda.' };
      const name = String(d.name || '').trim().slice(0, 20);
      const tag = String(d.tag || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (name.length < 3) return { error: 'Nome da guilda precisa ter 3 a 20 caracteres.' };
      if (tag.length < 2) return { error: 'Tag precisa ter 2 a 5 letras/números.' };
      if (Object.values(db.guilds).some((g) => norm(g.name) === norm(name) || g.tag === tag)) return { error: 'Nome ou tag de guilda já em uso.' };
      const id = crypto.randomUUID();
      const g = { id, name, tag, desc: String(d.desc || '').trim().slice(0, 120), open: d.open !== false, leaderKey: k, officers: [], members: [k], chat: [] };
      db.guilds[id] = g;
      u.guildId = id;
      save(); pushMe(k); pushRoom(o.room);
      return { ok: true, guild: g };
    }
    case 'guildjoin': {
      if (u.guildId && db.guilds[u.guildId]) return { error: 'Você já pertence a uma guilda.' };
      const g = db.guilds[d.guildId]; if (!g) return { error: 'Guilda não encontrada.' };
      if (!g.open) return { error: 'Essa guilda aceita apenas convites.' };
      g.members.push(k); u.guildId = g.id;
      save(); for (const mk of g.members) pushMe(mk); pushRoom(o.room);
      return { ok: true, guild: g };
    }
    case 'guildinvite': {
      const g = guildOf(u);
      if (!g || (g.leaderKey !== k && !(g.officers || []).includes(k))) return { error: 'Sem permissão na guilda.' };
      const t = Object.values(db.users).find((x) => norm(x.name) === norm(d.name));
      if (!t) return { error: 'Jogador não encontrado.' };
      if (t.guildId && db.guilds[t.guildId]) return { error: 'Esse jogador já está em uma guilda.' };
      t.guildInvites ||= [];
      if (!t.guildInvites.includes(g.id)) t.guildInvites.push(g.id);
      save(); pushMe(t.key);
      return { ok: true, name: t.name };
    }
    case 'guildaccept': {
      const g = db.guilds[d.guildId];
      u.guildInvites = (u.guildInvites || []).filter((x) => x !== d.guildId);
      if (!g) { save(); pushMe(k); return { error: 'Guilda não existe mais.' }; }
      if (u.guildId && db.guilds[u.guildId]) return { error: 'Você já está em uma guilda.' };
      g.members.push(k); u.guildId = g.id;
      save(); for (const mk of g.members) pushMe(mk); pushRoom(o.room);
      return { ok: true, guild: g };
    }
    case 'guildreject': {
      u.guildInvites = (u.guildInvites || []).filter((x) => x !== d.guildId);
      save(); pushMe(k); return { ok: true };
    }
    case 'guildchat': {
      const g = guildOf(u); if (!g) return { error: 'Você não está em nenhuma guilda.' };
      const text = String(d.text || '').trim().slice(0, 220); if (!text) return { ok: true };
      const msg = { from: u.name, cargo: u.cargo, nameColor: u.nameColor || null, verified: verifiedTag(u), role: g.leaderKey === k ? 'leader' : (g.officers || []).includes(k) ? 'officer' : 'member', text, ts: Date.now() };
      g.chat ||= []; g.chat.push(msg); if (g.chat.length > 60) g.chat = g.chat.slice(-60);
      save();
      for (const mk of g.members) sendTo(mk, 'guildchat', { guildId: g.id, msg });
      return { ok: true };
    }
    case 'guildmanage': {
      const g = guildOf(u); if (!g) return { error: 'Sem guilda.' };
      const act = String(d.act || '');
      const isLeader = g.leaderKey === k, isOff = isLeader || (g.officers || []).includes(k);
      if (act === 'leave') {
        if (isLeader && g.members.length > 1) return { error: 'Transfira a liderança ou dissolva a guilda antes de sair.' };
        g.members = g.members.filter((x) => x !== k);
        g.officers = (g.officers || []).filter((x) => x !== k);
        u.guildId = null;
        if (!g.members.length) delete db.guilds[g.id];
        else for (const mk of g.members) pushMe(mk);
        save(); pushMe(k); pushRoom(o.room); return { ok: true };
      }
      if (act === 'disband') {
        if (!isLeader) return { error: 'Apenas o líder pode dissolver.' };
        const ms = [...g.members];
        delete db.guilds[g.id];
        for (const mk of ms) { if (db.users[mk]) db.users[mk].guildId = null; pushMe(mk); }
        save(); pushRoom(o.room); return { ok: true };
      }
      if (act === 'edit') {
        if (!isOff) return { error: 'Sem permissão.' };
        g.desc = String(d.desc || '').trim().slice(0, 120);
        g.open = d.open !== false;
        save(); for (const mk of g.members) pushMe(mk); return { ok: true };
      }
      const tk = d.targetKey;
      if (!tk || !g.members.includes(tk)) return { error: 'Membro não encontrado.' };
      if (act === 'promote' && isLeader) { g.officers ||= []; if (!g.officers.includes(tk)) g.officers.push(tk); }
      else if (act === 'demote' && isLeader) { g.officers = (g.officers || []).filter((x) => x !== tk); }
      else if (act === 'transfer' && isLeader) { g.leaderKey = tk; g.officers = (g.officers || []).filter((x) => x !== tk); }
      else if (act === 'kick' && isOff && tk !== g.leaderKey) {
        g.members = g.members.filter((x) => x !== tk);
        g.officers = (g.officers || []).filter((x) => x !== tk);
        if (db.users[tk]) db.users[tk].guildId = null;
        pushMe(tk);
      } else return { error: 'Ação inválida.' };
      save(); for (const mk of g.members) pushMe(mk); return { ok: true };
    }
    case 'topiccreate': {
      const title = String(d.title || '').trim().slice(0, 60);
      const body = String(d.body || '').trim().slice(0, 320);
      if (title.length < 3 || body.length < 3) return { error: 'Escreva título e mensagem (mín. 3 letras).' };
      const id = (db.nextTopic = (db.nextTopic || 1) + 1);
      const ug = guildOf(u);
      const tp = {
        id, title, body, authorKey: k, authorName: u.name, authorCargo: u.cargo, authorNameColor: u.nameColor || null,
        authorGuildTag: ug?.tag || null, authorVerified: verifiedTag(u), pinned: !!(d.pinned && u.cargo >= R.MOD),
        locked: false, ts: Date.now(), likes: [], replies: [],
      };
      db.topics.push(tp);
      if (db.topics.length > 50) db.topics = db.topics.slice(-50);
      save(); pushTopics();
      return { ok: true, topic: tp };
    }
    case 'topiclike': {
      const tp = db.topics.find((x) => x.id === +d.id);
      if (!tp) return { error: 'Tópico não encontrado.' };
      tp.likes ||= [];
      if (tp.likes.includes(k)) tp.likes = tp.likes.filter((x) => x !== k);
      else tp.likes.push(k);
      save(); pushTopics(); return { ok: true };
    }
    case 'topicreply': {
      const tp = db.topics.find((x) => x.id === +d.id);
      if (!tp) return { error: 'Tópico não encontrado.' };
      if (tp.locked && u.cargo < R.MOD) return { error: 'Tópico trancado.' };
      const text = String(d.text || '').trim().slice(0, 200);
      if (!text) return { error: 'Escreva um comentário.' };
      const ug = guildOf(u);
      tp.replies ||= [];
      tp.replies.push({
        id: crypto.randomUUID(), authorKey: k, authorName: u.name, authorCargo: u.cargo, authorNameColor: u.nameColor || null,
        guildTag: ug?.tag || null, verified: verifiedTag(u), text, ts: Date.now(),
      });
      if (tp.replies.length > 80) tp.replies = tp.replies.slice(-80);
      save(); pushTopics(); return { ok: true };
    }
    case 'topicmanage': {
      const tp = db.topics.find((x) => x.id === +d.id);
      if (!tp) return { error: 'Tópico não encontrado.' };
      if (d.act === 'pin' && u.cargo >= R.MOD) tp.pinned = !tp.pinned;
      else if (d.act === 'lock' && u.cargo >= R.MOD) tp.locked = !tp.locked;
      else if (d.act === 'delete' && (u.cargo >= R.MOD || tp.authorKey === k)) db.topics = db.topics.filter((x) => x !== tp);
      else if (d.act === 'deletereply') {
        const rp = (tp.replies || []).find((x) => x.id === d.replyId);
        if (!rp || (u.cargo < R.MOD && rp.authorKey !== k)) return { error: 'Sem permissão.' };
        tp.replies = tp.replies.filter((x) => x.id !== d.replyId);
      } else return { error: 'Sem permissão.' };
      save(); pushTopics(); return { ok: true };
    }
    case 'report': {
      const t = Object.values(db.users).find((x) => norm(x.name) === norm(d.targetName));
      if (!t) return { error: 'Jogador não encontrado.' };
      const reason = String(d.reason || '').trim().slice(0, 180);
      if (!reason) return { error: 'Escreva o motivo da denúncia.' };
      const id = (db.nextReport = (db.nextReport || 0) + 1);
      const rp = {
        id, targetKey: t.key, targetName: t.name, targetCargo: t.cargo, reporterKey: k, reporterName: u.name,
        room: online.get(t.key)?.room || o.room || 'Desconhecida', reason, status: 'pendente', ts: Date.now(),
        evidence: (roomLogs.get(online.get(t.key)?.room || o.room) || []).slice(-6),
      };
      db.reports.push(rp);
      save();
      for (const dv of Object.values(db.users)) if (dv.cargo >= R.MOD) { pushMe(dv.key); sendTo(dv.key, 'staffalert', { msg: `🚨 Nova denúncia #${rp.id} contra ${t.name}` }); }
      return { ok: true, report: rp };
    }
    case 'reportreview': {
      if (u.cargo < R.MOD) return { error: 'Sem permissão.' };
      const rp = db.reports.find((x) => x.id === +d.id);
      if (!rp) return { error: 'Denúncia não encontrada.' };
      rp.status = 'analisada';
      rp.action = String(d.action || 'advertir');
      rp.reviewedBy = u.name;
      rp.reviewedCargo = u.cargo;
      rp.reviewNote = String(d.note || '').slice(0, 140);
      const t = db.users[rp.targetKey];
      if (t) {
        if (rp.action === 'prender') command(k, u, `/prender ${t.name} ${rp.reviewNote || rp.reason}`);
        else if (rp.action === 'expulsar') command(k, u, `/expulsar ${t.name}`);
        else if (rp.action === 'advertir') { addMail(t, `⚠️ Advertência de ${u.name}: ${rp.reviewNote || rp.reason}`); pushMe(t.key); }
      }
      save();
      for (const dv of Object.values(db.users)) if (dv.cargo >= R.MOD) pushMe(dv.key);
      return { ok: true, report: rp };
    }
    case 'feedbackcreate': {
      if (Date.now() - (lastFeedback.get(k) || 0) < 10000) return { error: 'Aguarde alguns segundos antes de enviar outro feedback.' };
      const category = ['sugestao', 'bug', 'elogio', 'musica'].includes(d.category) ? d.category : 'sugestao';
      const rating = Math.min(5, Math.max(1, Math.round(+d.rating || 5)));
      const title = String(d.title || '').trim().slice(0, 60);
      const text = String(d.text || '').trim().slice(0, 360);
      if (title.length < 3 || text.length < 5) return { error: 'Escreva um título (mín. 3 letras) e detalhes (mín. 5 letras).' };
      lastFeedback.set(k, Date.now());
      const id = (db.nextFeedback = (db.nextFeedback || 0) + 1);
      const ug = guildOf(u);
      const fb = {
        id,
        category,
        rating,
        title,
        text,
        authorKey: k,
        authorName: u.name,
        authorCargo: u.cargo,
        authorNameColor: u.nameColor || null,
        authorGuildTag: ug?.tag || null,
        authorVerified: verifiedTag(u),
        status: 'novo',
        staffReply: '',
        repliedBy: '',
        repliedAt: null,
        votes: [k],
        ts: Date.now(),
      };
      db.feedbacks.push(fb);
      if (db.feedbacks.length > 100) db.feedbacks = db.feedbacks.slice(-100);
      save();
      pushFeedbacks();
      for (const dv of Object.values(db.users)) {
        if (dv.cargo >= R.MOD && dv.key !== k) sendTo(dv.key, 'staffalert', { msg: `📝 Novo feedback #${fb.id} de ${u.name}: ${fb.title}` });
      }
      return { ok: true, feedback: fb };
    }
    case 'feedbackvote': {
      const fb = (db.feedbacks || []).find((x) => x.id === +d.id);
      if (!fb) return { error: 'Feedback não encontrado.' };
      fb.votes ||= [];
      if (fb.votes.includes(k)) fb.votes = fb.votes.filter((x) => x !== k);
      else fb.votes.push(k);
      save();
      pushFeedbacks();
      return { ok: true };
    }
    case 'feedbackmanage': {
      const fb = (db.feedbacks || []).find((x) => x.id === +d.id);
      if (!fb) return { error: 'Feedback não encontrado.' };
      if (d.act === 'delete') {
        if (u.cargo < R.MOD && fb.authorKey !== k) return { error: 'Sem permissão.' };
        db.feedbacks = db.feedbacks.filter((x) => x !== fb);
        save();
        pushFeedbacks();
        return { ok: true };
      }
      if (d.act === 'review') {
        if (u.cargo < R.MOD) return { error: 'Sem permissão.' };
        const status = ['novo', 'analise', 'planejado', 'resolvido'].includes(d.status) ? d.status : fb.status;
        const replyTxt = String(d.reply || '').trim().slice(0, 240);
        const changed = status !== fb.status || (replyTxt && replyTxt !== fb.staffReply);
        fb.status = status;
        if (replyTxt) {
          fb.staffReply = replyTxt;
          fb.repliedBy = u.name;
          fb.repliedAt = Date.now();
        }
        const author = db.users[fb.authorKey];
        if (author && changed && fb.authorKey !== k) {
          addMail(author, `📝 Feedback #${fb.id} (${fb.status}) atualizado por ${u.name}${fb.staffReply ? `: "${fb.staffReply}"` : ''}`);
          pushMe(author.key);
        }
        save();
        pushFeedbacks();
        return { ok: true };
      }
      return { error: 'Ação inválida.' };
    }
    case 'verifysubmit': {
      const data = String(d.data || ''), mime = String(d.mime || '');
      if (!/^image\/(jpeg|png|webp)$/i.test(mime) || !/^[A-Za-z0-9+/=]+$/.test(data) || data.length > 320000) return { error: 'Imagem inválida.' };
      const file = `${k}.jpg`;
      try { fs.mkdirSync(PDIR, { recursive: true }); fs.writeFileSync(path.join(PDIR, file), Buffer.from(data, 'base64')); }
      catch { return { error: 'Erro ao salvar foto.' }; }
      u.verify = { status: 'pending', file, submittedAt: Date.now(), note: '', reviewedBy: '' };
      save(); pushMe(k);
      for (const dv of Object.values(db.users)) if (dv.cargo >= R.MOD) pushMe(dv.key);
      return { ok: true };
    }
    case 'verifyreview': {
      if (u.cargo < R.MOD) return { error: 'Sem permissão.' };
      const t = db.users[d.targetKey];
      if (!t || !t.verify) return { error: 'Verificação não encontrada.' };
      const dec = ['real', 'fake', 'rejected'].includes(d.decision) ? d.decision : 'rejected';
      t.verify.status = dec;
      t.verify.note = String(d.note || '').slice(0, 140);
      t.verify.reviewedBy = u.name;
      addMail(t, dec === 'real' ? '✅ Sua conta foi verificada como Pessoa Real!' : dec === 'fake' ? '🚫 Sua conta foi marcada como Fake.' : '🔄 Envie uma nova foto com UNIVERSO legível.');
      save(); pushMe(t.key); pushRoom(online.get(t.key)?.room);
      for (const dv of Object.values(db.users)) if (dv.cargo >= R.MOD) pushMe(dv.key);
      return { ok: true, name: t.name };
    }
    case 'plugnovato': {
      if (u.cargo < R.MOD) return { error: 'Sem permissão.' };
      const act = String(d.act || '');
      if (act === 'toggle') db.plugNovato.enabled = !db.plugNovato.enabled;
      else if (act === 'exemptMods') db.plugNovato.exemptMods = !db.plugNovato.exemptMods;
      else if (act === 'exemptOwner' && u.cargo >= R.DEV) db.plugNovato.exemptOwner = !db.plugNovato.exemptOwner;
      else if (act !== 'sweep') return { error: 'Ação inválida.' };
      const kicked = sweepNovatos();
      save();
      for (const dv of Object.values(db.users)) if (dv.cargo >= R.MOD) pushMe(dv.key);
      return { ok: true, ...db.plugNovato, kicked };
    }
    case 'novatokickone': {
      if (u.cargo < R.MOD) return { error: 'Sem permissão.' };
      const t = Object.values(db.users).find((x) => norm(x.name) === norm(d.name));
      if (!t) return { error: 'Jogador não encontrado.' };
      const to = online.get(t.key);
      if (!to || !/^novato\b/i.test(to.room || '')) return { error: 'Jogador não está em um planeta Novato.' };
      const dest = db.planets.find((p) => p.t === 'chat' && !/^novato\b/i.test(p.n)) || db.planets[0];
      moveTo(t.key, dest.n);
      return { ok: true, name: t.name, to: dest.n };
    }
    case 'pixinfo': {
      const px = pixCfg();
      return { ok: true, pacotes: PACOTES, ready: !!px.key, receiver: px.name, key: px.key, orders: px.key ? db.orders.filter((x) => x.key === k && x.status === 'pendente').map((x) => orderView(x, px)) : [] };
    }
    case 'pixorder': {
      const px = pixCfg(), v = +d.uc;
      if (!px.key) return { error: 'Recarga indisponível: a chave Pix ainda não foi configurada.' };
      if (!PACOTES.includes(v)) return { error: 'Valor de recarga inválido.' };
      const mine = db.orders.filter((x) => x.key === k && x.status === 'pendente');
      let ord = mine.find((x) => x.uc === v);
      if (!ord) {
        if (mine.length >= 3) return { error: 'Você já tem 3 pedidos pendentes. Cancele um para criar outro.' };
        ord = { id: (db.nextOrder = (db.nextOrder || 0) + 1), key: k, user: u.name, uc: v, ts: Date.now(), status: 'pendente' };
        db.orders.push(ord); db.orders = db.orders.filter((x) => x.status === 'pendente' || Date.now() - x.ts < 30 * 86400000).slice(-500);
        for (const dv of Object.values(db.users)) if (dv.cargo >= R.DEV) { addMail(dv, `💎 Pedido #${ord.id}: ${u.name} vai pagar R$ ${v},00 (${v} UniGemas). Quando o Pix cair, use /dar ${u.name} ${v}`); pushMe(dv.key); }
        mailUser(u, 'Pedido de recarga recebido — UNIVERSO CHAT', `Olá, ${u.name}! Recebemos seu pedido #${ord.id}: R$ ${v},00 = ${v} UniGema(s).`, 'Assim que o Pix for conferido, as UniGemas entram na sua conta e você recebe outro aviso.');
        save();
      }
      return { ok: true, order: orderView(ord, px), receiver: px.name, key: px.key };
    }
    case 'pixcancel': {
      const ord = db.orders.find((x) => x.id === +d.id && x.key === k && x.status === 'pendente');
      if (!ord) return { error: 'Pedido não encontrado.' };
      ord.status = 'cancelado'; save(); return { ok: true };
    }
    case 'top': {
      return { ok: true, top: Object.values(db.users).sort((a, b) => b.stars - a.stars).slice(0, 10).map((x) => ({ name: x.name, stars: x.stars, cargo: x.cargo, nameColor: x.nameColor || null, verified: verifiedTag(x) })) };
    }
  }
  return { error: 'Ação desconhecida.' };
}

function announceDiscord() {
  const rooms = new Set([...online.values()].map((o) => o.room).filter(Boolean));
  for (const r of rooms) say(r, null, discordMsg(), true);
}
setInterval(() => { if (db.discord.auto) announceDiscord(); }, 10 * 60 * 1000).unref();
setInterval(() => {
  const now = Date.now(), rooms = new Set();
  for (const o of online.values()) {
    if (o.typingUntil && o.typingUntil <= now) { o.typingUntil = 0; if (o.room) rooms.add(o.room); }
  }
  for (const r of rooms) pushTyping(r);
}, 1000).unref();

// ---------- gerador de .zip (sem dependências) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function collectZipFiles() {
  const out = [];
  const candidates = [
    'package.json', 'server.js', 'README.md', 'render.yaml', '.env.example', '.gitignore',
    'index.html', 'app.js', 'avatar3d.js', 'audio3d.js', 'music.js', 'zombie3d.js', 'bowling3d.js', 'cannon3d.js', 'fishing3d.js', 'cave3d.js', 'soccer3d.js', 'neon-survivor.html',
    'style.css', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'traje-coelho-estelar.png',
  ];
  for (const f of candidates) {
    const full = path.join(DIR, f);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) out.push({ rel: f, full });
  }
  const pubDir = path.join(DIR, 'public');
  if (fs.existsSync(pubDir)) {
    const walk = (dir, prefix) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
        if (ent.name.startsWith('.')) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, rel);
        else if (ent.isFile()) out.push({ rel, full });
      }
    };
    walk(pubDir, 'public');
  }
  return out;
}
function buildProjectZip() {
  const files = collectZipFiles();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { rel, full } of files) {
    const raw = readCodeOverride(rel) || fs.readFileSync(full);
    const st = fs.statSync(full);
    const d = st.mtime;
    const year = Math.max(1980, d.getFullYear()) - 1980;
    const dosDate = ((year & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
    const dosTime = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
    const crc = crc32(raw);
    const def = zlib.deflateRawSync(raw);
    const useDef = def.length < raw.length;
    const comp = useDef ? def : raw;
    const method = useDef ? 8 : 0;
    const nameBuf = Buffer.from(rel, 'utf8');

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + comp.length;
  }
  const cdBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

// ---------- IA Musical (Gemini server-side) ----------
function getGeminiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

function sanitizeSongPayload(raw, authorName = '') {
  if (!raw || typeof raw !== 'object') return null;
  const clamp = (n, min, max, fb) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fb;
  };
  const waves = ['sine', 'triangle', 'sawtooth', 'square'];
  const chords = Array.isArray(raw.chords) && raw.chords.length >= 4
    ? raw.chords.slice(0, 4).map((ch) => (Array.isArray(ch) && ch.length ? ch.slice(0, 4).map((m) => clamp(m, 36, 84, 54)) : [48, 52, 55]))
    : [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
  const cleanNotes = (arr, minM, maxM) =>
    Array.isArray(arr)
      ? arr.slice(0, 64).map((n) => ({
          step: clamp(n?.step, 0, 63, 0),
          midi: clamp(n?.midi, minM, maxM, 60),
          dur: clamp(n?.dur, 1, 8, 2),
        }))
      : [];
  const cleanSteps = (arr, fb) =>
    Array.isArray(arr) && arr.length ? [...new Set(arr.slice(0, 64).map((v) => clamp(v, 0, 63, 0)))] : fb;

  return {
    id: String(raw.id || 'ai:' + crypto.randomUUID().slice(0, 8)).slice(0, 40),
    title: String(raw.title || 'Música IA').trim().slice(0, 60) || 'Música IA',
    style: String(raw.style || 'Espacial IA').trim().slice(0, 48) || 'Espacial IA',
    author: String(raw.author || authorName || '').slice(0, 24),
    bpm: clamp(raw.bpm, 64, 168, 118),
    leadWave: waves.includes(raw.leadWave) ? raw.leadWave : 'triangle',
    bassWave: waves.includes(raw.bassWave) ? raw.bassWave : 'sawtooth',
    lyrics: String(raw.lyrics || '').trim().slice(0, 1200),
    chords,
    melody: cleanNotes(raw.melody, 52, 92),
    bass: cleanNotes(raw.bass, 26, 56),
    drums: {
      kick: cleanSteps(raw.drums?.kick, [0, 8, 16, 24, 32, 40, 48, 56]),
      snare: cleanSteps(raw.drums?.snare, [4, 12, 20, 28, 36, 44, 52, 60]),
      hat: cleanSteps(raw.drums?.hat, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62]),
    },
    ai: !!raw.ai,
  };
}

const lastAiMusic = new Map();
async function generateAiSong(prompt, style, authorName) {
  const ai = getGeminiClient();
  if (!ai) {
    const err = new Error('GEMINI_API_KEY não configurada no servidor. Configure a chave para compor novas músicas com IA (as faixas originais do jogo já funcionam sem chave!).');
    err.status = 400;
    throw err;
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Título criativo em português para a música' },
      style: { type: Type.STRING, description: 'Estilo musical (ex: Synthwave Espacial, Lo-Fi Cósmico)' },
      bpm: { type: Type.INTEGER, description: 'Andamento em BPM entre 72 e 150' },
      leadWave: { type: Type.STRING, description: 'Forma de onda principal: triangle, sine, sawtooth ou square' },
      bassWave: { type: Type.STRING, description: 'Forma de onda do baixo: sawtooth ou triangle' },
      lyrics: { type: Type.STRING, description: 'Letra original curta e cativante em português com Verso e Refrão' },
      chords: {
        type: Type.ARRAY,
        description: 'Exatamente 4 acordes (1 por compasso de 16 steps), cada acorde com 3 ou 4 notas MIDI (entre 40 e 72)',
        items: { type: Type.ARRAY, items: { type: Type.INTEGER } },
      },
      melody: {
        type: Type.ARRAY,
        description: 'De 16 a 32 notas melódicas harmônicas ao longo dos 64 steps (0..63)',
        items: {
          type: Type.OBJECT,
          properties: {
            step: { type: Type.INTEGER },
            midi: { type: Type.INTEGER },
            dur: { type: Type.INTEGER },
          },
          required: ['step', 'midi', 'dur'],
        },
      },
      bass: {
        type: Type.ARRAY,
        description: 'De 8 a 20 notas de baixo ao longo dos 64 steps (0..63), midi entre 28 e 52',
        items: {
          type: Type.OBJECT,
          properties: {
            step: { type: Type.INTEGER },
            midi: { type: Type.INTEGER },
            dur: { type: Type.INTEGER },
          },
          required: ['step', 'midi', 'dur'],
        },
      },
      drums: {
        type: Type.OBJECT,
        properties: {
          kick: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          snare: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          hat: { type: Type.ARRAY, items: { type: Type.INTEGER } },
        },
        required: ['kick', 'snare', 'hat'],
      },
    },
    required: ['title', 'style', 'bpm', 'leadWave', 'bassWave', 'lyrics', 'chords', 'melody', 'bass', 'drums'],
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Estilo desejado: ${style || 'Synthwave Espacial'}\nPedido do jogador: ${prompt || 'Música animada para explorar planetas no Universo Chat'}`,
    config: {
      systemInstruction:
        'Você é um produtor musical profissional compondo faixas para o jogo espacial multiplayer UNIVERSO CHAT. ' +
        'Gere uma composição musical harmônica, cativante e bem ritmada em grade de 64 semicolcheias (4 compassos: steps 0..15, 16..31, 32..47, 48..63). ' +
        'As notas da melodia (MIDI 60..84) devem pertencer à mesma escala dos 4 acordes e ter durações entre 2 e 6 steps.',
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  const parsed = JSON.parse((response.text || '{}').trim());
  const clean = sanitizeSongPayload({ ...parsed, id: 'ai:' + crypto.randomUUID().slice(0, 8), ai: true }, authorName);
  db.aiSongs.push(clean);
  if (db.aiSongs.length > 25) db.aiSongs = db.aiSongs.slice(-25);
  save();
  return clean;
}

// ---------- util de rotas JSON, limites e IP ----------
const sendJson = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
async function readJson(req, res, limit) {
  let body = '';
  for await (const c of req) { body += c; if (body.length > limit) { sendJson(res, 413, { error: 'Requisição grande demais.' }); return null; } }
  try { return JSON.parse(body); } catch { sendJson(res, 400, { error: 'JSON inválido.' }); return null; }
}
const clientIp = (req) => {
  const x = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return x.length ? x[x.length - 1] : (req.socket?.remoteAddress || 'ip');
};
const rateLog = new Map();
function rateOk(id, max, windowMs) {
  const now = Date.now();
  const arr = (rateLog.get(id) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { rateLog.set(id, arr); return false; }
  arr.push(now); rateLog.set(id, arr); return true;
}

// ---------- Editor de código dentro do jogo (somente Dono) ----------
// Os arquivos editados ficam em "codeedits/" ao lado do DATA_FILE e têm prioridade sobre os originais.
// Cada salvamento faz backup automático. Só funciona se a variável DEV_PASS estiver definida no servidor.
const CODE_DIR = path.join(path.dirname(FILE), 'codeedits');
const CODE_EDITABLE = ['index.html', 'app.js', 'avatar3d.js', 'audio3d.js', 'music.js', 'zombie3d.js', 'bowling3d.js', 'cannon3d.js', 'fishing3d.js', 'cave3d.js', 'soccer3d.js', 'style.css', 'sw.js', 'manifest.webmanifest'];
const CODE_READONLY = ['server.js', 'package.json', 'README.md'];
const CODE_MAX_BYTES = 600000;
const CODE_UNLOCK_MS = 30 * 60 * 1000;
const codeUnlocked = new Map();
const codeFails = new Map();
const codeEnvPass = () => (process.env.DEV_PASS || '').trim();
const codeEnabled = () => codeEnvPass().length >= 6;
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();
const codeCheckPass = (p) => codeEnabled() && crypto.timingSafeEqual(sha256(p), sha256(codeEnvPass()));
function codeOriginalFile(name) {
  for (const base of [PUB, DIR]) { const f = path.join(base, name); if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; }
  return null;
}
function readCodeOverride(name) {
  if (!CODE_EDITABLE.includes(name)) return null;
  try { return fs.readFileSync(path.join(CODE_DIR, name)); } catch { return null; }
}
const codeBackupDir = (name) => path.join(CODE_DIR, 'backups', name.replace(/\./g, '_'));
function codeEffective(name) {
  const ov = readCodeOverride(name);
  if (ov) return ov;
  const orig = codeOriginalFile(name);
  return orig ? fs.readFileSync(orig) : null;
}
function codeMakeBackup(name) {
  const cur = codeEffective(name);
  if (!cur) return;
  const dir = codeBackupDir(name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, String(Date.now())), cur);
  const all = fs.readdirSync(dir).filter((x) => /^\d+$/.test(x)).sort((a, b) => Number(a) - Number(b));
  for (const old of all.slice(0, Math.max(0, all.length - 15))) fs.rmSync(path.join(dir, old), { force: true });
}
function codeWrite(name, content) {
  fs.mkdirSync(CODE_DIR, { recursive: true });
  const dest = path.join(CODE_DIR, name);
  fs.writeFileSync(dest + '.tmp', content);
  fs.renameSync(dest + '.tmp', dest);
}
function codeSyntaxCheck(name, content) {
  return new Promise((resolve) => {
    if (/\.(json|webmanifest)$/.test(name)) { try { JSON.parse(content); resolve(null); } catch (e) { resolve({ error: 'JSON inválido: ' + e.message }); } return; }
    if (!/\.js$/.test(name)) return resolve(null);
    const tmp = path.join(os.tmpdir(), `uc-check-${crypto.randomBytes(6).toString('hex')}.${name === 'sw.js' ? 'cjs' : 'mjs'}`);
    try { fs.writeFileSync(tmp, content); } catch (e) { return resolve({ error: 'Não foi possível validar: ' + e.message }); }
    execFile(process.execPath, ['--check', tmp], { timeout: 10000 }, (err, _out, stderr) => {
      fs.rm(tmp, { force: true }, () => {});
      if (!err) return resolve(null);
      const text = String(stderr || err.message).split(tmp).join('arquivo');
      const m = text.match(/arquivo:(\d+)/);
      const msg = (text.match(/(\w*Error: [^\n]+)/) || [])[1] || 'Erro de sintaxe';
      resolve({ error: `${msg}${m ? ` (linha ${m[1]})` : ''}`, line: m ? Number(m[1]) : null });
    });
  });
}
async function handleCode(u, d) {
  const k = u.key || d.key;
  const act = String(d.act || '');
  if (act === 'status') return { ok: true, enabled: codeEnabled(), unlocked: (codeUnlocked.get(k) || 0) > Date.now() };
  if (!codeEnabled()) return { error: 'Editor desativado: defina a variável DEV_PASS (mínimo 6 caracteres) no painel do servidor.' };
  if (act === 'unlock') {
    const f = codeFails.get(k) || { n: 0, until: 0 };
    if (Date.now() < f.until) return { error: 'Muitas tentativas. Aguarde alguns minutos.' };
    if (!codeCheckPass(String(d.pass || ''))) {
      f.n++; if (f.n >= 5) { f.until = Date.now() + 15 * 60 * 1000; f.n = 0; }
      codeFails.set(k, f);
      return { error: 'Senha incorreta.' };
    }
    codeFails.delete(k); codeUnlocked.set(k, Date.now() + CODE_UNLOCK_MS);
    return { ok: true, unlocked: true };
  }
  if ((codeUnlocked.get(k) || 0) < Date.now()) return { error: 'Editor bloqueado. Digite a senha do Dono.', locked: true };
  const name = String(d.name || '');
  const known = CODE_EDITABLE.includes(name) || CODE_READONLY.includes(name);
  if (act === 'list') {
    return { ok: true, files: [...CODE_EDITABLE, ...CODE_READONLY].map((n) => ({ name: n, readonly: CODE_READONLY.includes(n), modified: !!readCodeOverride(n), size: (codeEffective(n) || '').length })) };
  }
  if (!known) return { error: 'Arquivo não permitido.' };
  if (act === 'read') {
    const buf = codeEffective(name);
    if (!buf) return { error: 'Arquivo não encontrado no servidor.' };
    return { ok: true, name, content: buf.toString('utf8'), readonly: CODE_READONLY.includes(name), modified: !!readCodeOverride(name) };
  }
  if (CODE_READONLY.includes(name)) return { error: 'Este arquivo é somente leitura dentro do jogo (edite pelo GitHub).' };
  if (act === 'save') {
    const content = typeof d.content === 'string' ? d.content : null;
    if (content === null || !content.trim()) return { error: 'Conteúdo vazio.' };
    if (Buffer.byteLength(content) > CODE_MAX_BYTES) return { error: 'Arquivo grande demais (máx. 600 KB).' };
    if (!rateOk('codesave:' + k, 1, 1500)) return { error: 'Calma! Aguarde um segundo para salvar de novo.' };
    const bad = await codeSyntaxCheck(name, content);
    if (bad) return { error: 'Não salvei: ' + bad.error, line: bad.line || null };
    codeMakeBackup(name);
    codeWrite(name, content);
    console.log(`[editor] ${u.name} salvou ${name} (${Buffer.byteLength(content)} bytes)`);
    return { ok: true, bytes: Buffer.byteLength(content), modified: true };
  }
  if (act === 'backups') {
    let list = [];
    try { list = fs.readdirSync(codeBackupDir(name)).filter((x) => /^\d+$/.test(x)).map((id) => ({ id, ts: Number(id), size: fs.statSync(path.join(codeBackupDir(name), id)).size })).sort((a, b) => b.ts - a.ts); } catch {}
    return { ok: true, backups: list };
  }
  if (act === 'restore') {
    const id = String(d.id || '');
    if (!/^\d+$/.test(id)) return { error: 'Versão inválida.' };
    let buf; try { buf = fs.readFileSync(path.join(codeBackupDir(name), id)); } catch { return { error: 'Versão não encontrada.' }; }
    codeMakeBackup(name);
    codeWrite(name, buf);
    console.log(`[editor] ${u.name} restaurou ${name} (${id})`);
    return { ok: true, content: buf.toString('utf8'), modified: true };
  }
  if (act === 'reset') {
    codeMakeBackup(name);
    fs.rmSync(path.join(CODE_DIR, name), { force: true });
    console.log(`[editor] ${u.name} voltou ${name} ao original`);
    const orig = codeOriginalFile(name);
    return { ok: true, content: orig ? fs.readFileSync(orig, 'utf8') : '', modified: false };
  }
  return { error: 'Ação desconhecida.' };
}

// ---------- E-mail: confirmar e-mail da conta e redefinir senha ----------
// Envia por API HTTPS (o plano grátis do Render bloqueia SMTP). Configure BREVO_API_KEY (ou RESEND_API_KEY) + MAIL_FROM.
const mailCfg = () => ({
  from: ((db.mail && db.mail.from) || process.env.MAIL_FROM || '').trim(),
  name: ((db.mail && db.mail.name) || process.env.MAIL_FROM_NAME || 'UNIVERSO CHAT').trim(),
  brevo: ((db.mail && db.mail.brevo) || process.env.BREVO_API_KEY || '').trim(),
  resend: (process.env.RESEND_API_KEY || '').trim(),
});
const mailConfigured = () => { const m = mailCfg(); return !!m.from && !!(m.brevo || m.resend); };
const maskEmail = (e) => { if (!e) return ''; const [l, dom] = String(e).split('@'); return (l[0] || '') + '***@' + (dom || ''); };
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
async function sendMail(to, subject, text, html) {
  let r; const M = mailCfg();
  if (M.brevo) {
    r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': M.brevo, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: M.name, email: M.from }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
      signal: AbortSignal.timeout(12000),
    });
  } else if (M.resend) {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + M.resend, 'content-type': 'application/json' },
      body: JSON.stringify({ from: `${M.name} <${M.from}>`, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(12000),
    });
  } else throw new Error('nenhum provedor de e-mail configurado');
  if (!r.ok) throw new Error(`provedor de e-mail respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
function sendCodeMail(to, subject, intro, code, outro) {
  const text = `${intro}\n\nCódigo: ${code}\n\n${outro}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:22px;background:#0e0e2e;color:#e8e8ff;border-radius:14px"><h2 style="margin:0 0 12px">🌌 UNIVERSO CHAT</h2><p>${escHtml(intro)}</p><p style="font-size:34px;letter-spacing:8px;font-weight:800;margin:16px 0;color:#22d3ee">${escHtml(code)}</p><p style="opacity:.8">${escHtml(outro)}</p></div>`;
  return sendMail(to, subject, text, html);
}
const mailCodes = new Map();
const resetTokens = new Map();
const mailCodeHash = (salt, code) => crypto.createHash('sha256').update(salt + ':' + code).digest('hex');
function mailCodeNew(id, extra = {}) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const salt = crypto.randomBytes(8).toString('hex');
  mailCodes.set(id, { salt, hash: mailCodeHash(salt, code), exp: Date.now() + 10 * 60 * 1000, tries: 0, ...extra });
  return code;
}
function mailCodeCheck(id, code) {
  const r = mailCodes.get(id);
  if (!r || r.exp < Date.now()) { mailCodes.delete(id); return null; }
  if (++r.tries > 5) { mailCodes.delete(id); return null; }
  const given = mailCodeHash(r.salt, String(code || '').trim());
  if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(r.hash))) return null;
  mailCodes.delete(id);
  return r;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLog) if (!v.some((t) => now - t < 3600000)) rateLog.delete(k);
  for (const [k, v] of mailCodes) if (v.exp < now) mailCodes.delete(k);
  for (const [k, v] of resetTokens) if (v.exp < now) resetTokens.delete(k);
}, 10 * 60 * 1000).unref();

// confirmar o e-mail da própria conta (precisa estar logado)
async function handleEmail(req, res) {
  const d = await readJson(req, res, 4000); if (!d) return;
  const u = db.users[d.key];
  if (!u || u.banned) return sendJson(res, 401, { error: 'Sessão inválida.' });
  const act = String(d.act || '');
  if (act === 'send') {
    if (!mailConfigured()) return sendJson(res, 200, { error: 'O envio de e-mail ainda não foi ativado neste servidor.' });
    const email = String(d.email || '').trim().toLowerCase();
    if (email.length > 120 || !EMAIL_RE.test(email)) return sendJson(res, 200, { error: 'Digite um e-mail válido.' });
    if (!rateOk('mailcd:' + u.key, 1, 60000)) return sendJson(res, 200, { error: 'Aguarde 1 minuto para pedir outro código.' });
    if (!rateOk('mailhr:' + u.key, 5, 3600000) || !rateOk('mailip:' + clientIp(req), 10, 900000)) return sendJson(res, 200, { error: 'Muitos pedidos. Tente de novo mais tarde.' });
    const code = mailCodeNew('verify:' + u.key, { email });
    try { await sendCodeMail(email, 'Confirme seu e-mail — UNIVERSO CHAT', `Olá, ${u.name}! Use este código no jogo para confirmar seu e-mail (vale 10 minutos).`, code, 'Se você não pediu isso, ignore esta mensagem.'); }
    catch (e) { console.error('[email] falha ao enviar confirmação:', e.message); mailCodes.delete('verify:' + u.key); return sendJson(res, 200, { error: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' }); }
    return sendJson(res, 200, { ok: true });
  }
  if (act === 'confirm') {
    const r = mailCodeCheck('verify:' + u.key, d.code);
    if (!r) return sendJson(res, 200, { error: 'Código inválido ou expirado.' });
    u.email = r.email; u.emailVerified = true; u.savedAt = Date.now();
    saveNow(); pushMe(u.key);
    return sendJson(res, 200, { ok: true });
  }
  if (act === 'remove') {
    u.email = null; u.emailVerified = false; u.savedAt = Date.now();
    saveNow(); pushMe(u.key);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 200, { error: 'Ação desconhecida.' });
}

// esqueci a senha (sem login): pedir código -> conferir código -> nova senha
async function handleReset(req, res) {
  const d = await readJson(req, res, 4000); if (!d) return;
  const act = String(d.act || '');
  const name = String(d.name || '').trim().slice(0, 32);
  const findUser = () => Object.values(db.users).find((x) => norm(x.name) === norm(name));
  if (!rateOk('resetip:' + clientIp(req), 20, 900000)) return sendJson(res, 429, { error: 'Muitas tentativas. Tente de novo em alguns minutos.' });
  if (act === 'request') {
    if (!mailConfigured()) return sendJson(res, 200, { error: 'A recuperação por e-mail ainda não está ativada neste servidor.' });
    if (!name) return sendJson(res, 200, { error: 'Digite o nome da sua conta.' });
    const generic = { ok: true, msg: 'Se essa conta tiver um e-mail confirmado, enviamos um código de 6 dígitos (vale 10 minutos). Veja também o spam.' };
    if (!rateOk('resetcd:' + norm(name), 1, 60000)) return sendJson(res, 200, { error: 'Aguarde 1 minuto para pedir outro código.' });
    if (!rateOk('resethr:' + norm(name), 5, 3600000)) return sendJson(res, 200, { error: 'Muitos pedidos para essa conta. Tente de novo mais tarde.' });
    const u = findUser();
    if (!u || u.banned || !u.email || !u.emailVerified) return sendJson(res, 200, generic);
    const code = mailCodeNew('reset:' + u.key);
    try { await sendCodeMail(u.email, 'Código para redefinir sua senha — UNIVERSO CHAT', `Olá, ${u.name}! Use este código no jogo para redefinir sua senha (vale 10 minutos).`, code, 'Se não foi você, ignore esta mensagem: sua senha continua a mesma.'); }
    catch (e) { console.error('[email] falha ao enviar código de senha:', e.message); mailCodes.delete('reset:' + u.key); return sendJson(res, 200, { error: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' }); }
    return sendJson(res, 200, generic);
  }
  if (act === 'verify') {
    const u = name ? findUser() : null;
    const r = u ? mailCodeCheck('reset:' + u.key, d.code) : null;
    if (!r) return sendJson(res, 200, { error: 'Código inválido ou expirado.' });
    const token = crypto.randomBytes(24).toString('hex');
    resetTokens.set(token, { key: u.key, exp: Date.now() + 10 * 60 * 1000 });
    return sendJson(res, 200, { ok: true, token });
  }
  if (act === 'set') {
    const t = resetTokens.get(String(d.token || ''));
    const pass = String(d.pass || '');
    if (!t || t.exp < Date.now()) return sendJson(res, 200, { error: 'Sessão de redefinição expirada. Peça um novo código.', expired: true });
    if (pass.length < 4 || pass.length > 64) return sendJson(res, 200, { error: 'A senha precisa ter de 4 a 64 caracteres.' });
    const u = db.users[t.key];
    if (!u) return sendJson(res, 200, { error: 'Conta não encontrada.' });
    resetTokens.delete(String(d.token));
    u.passHash = hashPass(pass); u.savedAt = Date.now();
    (u.mail ||= []).push({ txt: '🔐 Sua senha foi redefinida por e-mail. Se não foi você, troque a senha no Menu.', ts: Date.now() });
    saveNow(); pushMe(u.key);
    console.log(`[senha] ${u.name} redefiniu a senha por e-mail`);
    return sendJson(res, 200, { ok: true, name: u.name });
  }
  return sendJson(res, 200, { error: 'Ação desconhecida.' });
}

// ---------- página de emergência do editor: /recuperar (não depende do app.js) ----------
const RECOVERY_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recuperar — UNIVERSO CHAT</title>
<style>body{margin:0;background:#070718;color:#e8e8ff;font-family:system-ui,sans-serif;padding:16px;max-width:560px;margin:auto}h2{margin:8px 0}input,select,button{font:inherit;padding:11px 13px;border-radius:12px;border:1px solid #ffffff22;background:#ffffff12;color:#fff;margin:4px 0;box-sizing:border-box}input{width:100%}button{background:#7c3aed;border:0;font-weight:600;cursor:pointer}button.sec{background:#ffffff14}.card{background:#ffffff0f;border:1px solid #ffffff1c;border-radius:14px;padding:12px;margin:10px 0}.muted{opacity:.7;font-size:13px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}</style></head><body>
<h2>🛟 Modo de recuperação</h2><div class="muted">Use se o jogo quebrou depois de editar um código. Só o Dono (com a senha DEV_PASS) consegue.</div>
<div id="app"></div>
<script>
var KEY=null;try{KEY=localStorage.getItem('uc_key')}catch(e){}
var app=document.getElementById('app');
function api(b){b.key=KEY;return fetch('/api/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json()}).catch(function(){return{error:'Sem internet.'}})}
function el(t,txt,cls){var e=document.createElement(t);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e}
function msg(t){var m=document.getElementById('msg');if(m)m.textContent=t}
function login(){app.innerHTML='';var c=el('div',null,'card');
 if(!KEY){c.appendChild(el('div','Você não está logado neste navegador. Abra o jogo, entre na conta de Dono e volte aqui.'));app.appendChild(c);return}
 c.appendChild(el('div','Senha DEV_PASS do servidor:'));var i=el('input');i.type='password';c.appendChild(i);
 var b=el('button','🔓 Entrar');b.onclick=function(){api({act:'unlock',pass:i.value}).then(function(r){if(r.error)return msg(r.error);list()})};c.appendChild(b);c.appendChild(el('div','','muted')).id='msg';app.appendChild(c)}
function list(){api({act:'list'}).then(function(r){if(r.error)return msg(r.error)||login();app.innerHTML='';app.appendChild(el('div','','muted')).id='msg';
 r.files.filter(function(f){return !f.readonly}).forEach(function(f){var c=el('div',null,'card'),row=el('div',null,'row');row.appendChild(el('b',f.name+(f.modified?' ● editado':' (original)')));
  var v=el('button','🕘 Versões','sec');v.onclick=function(){versions(f.name,c)};row.appendChild(v);
  if(f.modified){var o=el('button','♻️ Voltar ao original');o.onclick=function(){if(confirm('Voltar '+f.name+' ao original?'))api({act:'reset',name:f.name}).then(function(x){msg(x.error||'✅ '+f.name+' voltou ao original.');list()})};row.appendChild(o)}
  c.appendChild(row);app.appendChild(c)});
 var h=el('a','← Abrir o jogo');h.href='/';h.style.color='#22d3ee';app.appendChild(h)})}
function versions(name,c){api({act:'backups',name:name}).then(function(r){if(r.error)return msg(r.error);var old=c.querySelector('.vers');if(old)old.remove();var d=el('div',null,'vers');
 if(!r.backups.length)d.appendChild(el('div','Nenhuma versão anterior.','muted'));
 r.backups.forEach(function(b){var row=el('div',null,'row');row.appendChild(el('span',new Date(b.ts).toLocaleString('pt-BR')+' · '+Math.round(b.size/1024)+' KB','muted'));
  var x=el('button','Restaurar','sec');x.onclick=function(){if(confirm('Restaurar esta versão de '+name+'?'))api({act:'restore',name:name,id:b.id}).then(function(z){msg(z.error||'✅ Versão restaurada. Recarregue o jogo.');list()})};row.appendChild(x);d.appendChild(row)});c.appendChild(d)})}
api({act:'status'}).then(function(r){if(r.error&&!r.enabled)return login();if(!r.enabled){app.textContent='Editor desativado: falta a variável DEV_PASS no servidor.';return}r.unlocked?list():login()});
</script></body></html>`;

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const ALLOWED_ROOT_FILES = new Set([
  '/index.html', '/app.js', '/avatar3d.js', '/audio3d.js', '/music.js', '/zombie3d.js', '/bowling3d.js', '/cannon3d.js', '/fishing3d.js', '/cave3d.js', '/soccer3d.js', '/neon-survivor.html',
  '/style.css', '/sw.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/traje-coelho-estelar.png',
]);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }

  if (url.pathname === '/events') {
    const k = url.searchParams.get('key'), u = db.users[k];
    if (!u || u.banned) { res.writeHead(401); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const old = online.get(k);
    const o = { res, room: old?.room || null, g: old?.g || {}, pos: old?.pos || null };
    online.set(k, o);
    if (old) { try { old.res.end(); } catch {} }
    send(res, 'hello', { me: me(u), planets: planetList(), cargos: CARGOS, discord: db.discord.url, topics: topicsForUser(u), feedbacks: feedbacksForUser(u), aiSongs: (db.aiSongs || []).slice(-10) });
    const hb = setInterval(() => { try { res.write(':\n\n'); } catch {} }, 20000);
    req.on('close', () => {
      clearInterval(hb);
      if (online.get(k) === o) {
        const wasTyping = (o.typingUntil || 0) > 0;
        online.delete(k); pushRoom(o.room); pushPlanets();
        if (wasTyping && o.room) pushTyping(o.room);
      }
    });
    return;
  }

  if (url.pathname.startsWith('/voice/')) {
    const id = url.pathname.slice(7), u = db.users[url.searchParams.get('key')];
    const v = u?.mail.find((m) => m.voice && m.voice.id === id)?.voice;
    let buf; try { buf = v && fs.readFileSync(path.join(VDIR, v.file)); } catch {}
    if (!buf) { res.writeHead(404); return res.end(); }
    const ext = path.extname(v.file).slice(1), type = { webm: 'audio/webm', m4a: 'audio/mp4', ogg: 'audio/ogg', mp3: 'audio/mpeg', aac: 'audio/aac' }[ext];
    const n = buf.length, m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    const h = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=600' };
    if (m) {
      const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], n - 1) : n - 1;
      if (a > b || a >= n) { res.writeHead(416, { 'Content-Range': `bytes */${n}` }); return res.end(); }
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${n}`, 'Content-Length': b - a + 1 });
      return res.end(buf.subarray(a, b + 1));
    }
    res.writeHead(200, { ...h, 'Content-Length': n }); return res.end(buf);
  }

  if (url.pathname.startsWith('/verifyphoto/')) {
    const targetKey = decodeURIComponent(url.pathname.slice('/verifyphoto/'.length));
    const viewer = db.users[url.searchParams.get('key')];
    const target = db.users[targetKey];
    if (!viewer || !target?.verify?.file || (viewer.key !== target.key && viewer.cargo < R.MOD)) {
      res.writeHead(403); return res.end();
    }
    let buf; try { buf = fs.readFileSync(path.join(PDIR, target.verify.file)); } catch {}
    if (!buf) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
    return res.end(buf);
  }

  if (url.pathname === '/api/code' && req.method === 'POST') {
    const d = await readJson(req, res, 1000000); if (!d) return;
    const u = db.users[d?.key];
    if (!u || u.banned) return sendJson(res, 401, { error: 'Sessão inválida.' });
    if ((u.cargo || 0) < R.DEV) return sendJson(res, 403, { error: 'Somente o Dono pode usar o editor de código.' });
    try { return sendJson(res, 200, await handleCode(u, d)); }
    catch (e) { console.error('Erro /api/code:', e); return sendJson(res, 500, { error: 'Erro interno no editor.' }); }
  }
  if (url.pathname === '/api/email' && req.method === 'POST') {
    try { return await handleEmail(req, res); } catch (e) { console.error('Erro /api/email:', e); return sendJson(res, 500, { error: 'Erro interno.' }); }
  }
  if (url.pathname === '/api/reset' && req.method === 'POST') {
    try { return await handleReset(req, res); } catch (e) { console.error('Erro /api/reset:', e); return sendJson(res, 500, { error: 'Erro interno.' }); }
  }

  if (url.pathname === '/api/ai/music' && req.method === 'POST') {
    let body = '';
    for await (const c of req) { body += c; if (body.length > 60000) { res.writeHead(413); return res.end(JSON.stringify({ error: 'Requisição grande demais.' })); } }
    let d; try { d = JSON.parse(body); } catch { res.writeHead(400); return res.end(JSON.stringify({ error: 'JSON inválido.' })); }
    const u = db.users[d?.key];
    if (!u || u.banned) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Sessão inválida.' }));
    }
    if (Date.now() - (lastAiMusic.get(u.key) || 0) < 5000) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Aguarde 5 segundos antes de gerar outra música.' }));
    }
    lastAiMusic.set(u.key, Date.now());
    try {
      const song = await generateAiSong(String(d.prompt || '').slice(0, 240), String(d.style || '').slice(0, 48), u.name);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, model: 'gemini-4-hydrogen', song }));
    } catch (e) {
      console.error('Erro /api/ai/music:', e?.message || e);
      const status = Number(e?.status) >= 400 && Number(e?.status) < 600 ? Number(e.status) : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e?.message || 'Erro ao compor música com IA.' }));
    }
  }

  if (url.pathname === '/api' && req.method === 'POST') {
    let body = '';
    for await (const c of req) { body += c; if (body.length > 400000) { res.writeHead(413); return res.end(); } }
    let d; try { d = JSON.parse(body); } catch { res.writeHead(400); return res.end(); }
    let out; try { out = handle(d); } catch (e) { console.error(e); out = { error: 'Erro interno.' }; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(out));
  }

  if (url.pathname === '/recuperar') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(RECOVERY_HTML); }
  const THREE_DIR = path.join(DIR, 'node_modules', 'three');
  const THREE_VERSION = '0.187.0';
  let reqPath;
  try { reqPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
  catch { res.writeHead(400); return res.end('400'); }
  if (reqPath === '/assets/traje-coelho-estelar.png') reqPath = '/traje-coelho-estelar.png';

  if (reqPath === '/universo-chat.zip') {
    const zipUser = db.users[url.searchParams.get('key') || ''];
    if (!zipUser || zipUser.banned || (zipUser.cargo || 0) < R.DEV) { res.writeHead(403, { 'Cache-Control': 'no-store' }); return res.end('Somente o Dono pode baixar o ZIP.'); }
    try {
      const buf = buildProjectZip();
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="universo-chat.zip"',
        'Content-Length': buf.length,
        'Cache-Control': 'no-store',
      });
      return res.end(buf);
    } catch (e) {
      console.error('erro ao gerar zip:', e);
      res.writeHead(500);
      return res.end('Erro ao gerar zip');
    }
  }
  if (reqPath.startsWith('/vendor/three/')) {
    const vf = path.resolve(THREE_DIR, '.' + path.normalize(reqPath.slice('/vendor/three'.length)));
    if (!vf.startsWith(THREE_DIR + path.sep)) { res.writeHead(404); return res.end('404'); }
    if (!fs.existsSync(vf) || fs.statSync(vf).isDirectory()) {
      if (!fs.existsSync(THREE_DIR)) {
        res.writeHead(302, { Location: 'https://cdn.jsdelivr.net/npm/three@' + THREE_VERSION + vf.slice(THREE_DIR.length).split(path.sep).join('/'), 'Cache-Control': 'no-store' });
        return res.end();
      }
      res.writeHead(404); return res.end('404');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(vf)] || 'application/javascript', 'Cache-Control': 'public, max-age=86400' });
    return fs.createReadStream(vf).pipe(res);
  }

  const normalized = path.posix.normalize(reqPath);
  {
    const nm = normalized.slice(1);
    if (CODE_EDITABLE.includes(nm)) {
      const ov = readCodeOverride(nm);
      if (ov) { res.writeHead(200, { 'Content-Type': MIME[path.extname(nm)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); return res.end(ov); }
    }
  }
  if (PUB === DIR && !ALLOWED_ROOT_FILES.has(normalized)) {
    res.writeHead(404); return res.end('404');
  }
  const f = path.resolve(PUB, '.' + path.normalize(normalized));
  if (!f.startsWith(PUB + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
});
server.listen(PORT, '0.0.0.0', () => console.log(`UNIVERSO CHAT na porta ${PORT} | Dono: ${DEV_NAME}`));

// O Render envia SIGTERM ao reiniciar/deployar. Aguarde a fila do Firestore
// terminar antes de encerrar o processo, para não perder a última gravação.
let shuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal}: salvando dados locais e aguardando Firestore...`);
  try {
    await flushAll();
    console.log('[shutdown] Salvamento concluído.');
  } catch (e) {
    console.error('[shutdown] Erro ao salvar:', e.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });

