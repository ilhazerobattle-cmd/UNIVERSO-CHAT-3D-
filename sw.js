// Service worker simples: guarda o "esqueleto" do app para abrir mesmo com o servidor dormindo.
// Nunca guarda API, eventos em tempo real nem áudios.
const CACHE = 'universo-v29-planets-owner-menu';
const SHELL = ['/', '/style.css', '/app.js', '/avatar3d.js', '/audio3d.js', '/music.js', '/zombie3d.js', '/bowling3d.js', '/cannon3d.js', '/fishing3d.js', '/cave3d.js', '/soccer3d.js', '/neon-survivor.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (['/api', '/events', '/health', '/universo-chat.zip'].includes(u.pathname) || u.pathname.startsWith('/voice/')) return;
  // rede primeiro (sempre a versão nova); se falhar, usa o que está guardado
  e.respondWith(
    fetch(r).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r).then((m) => m || caches.match('/')))
  );
});
