// SoundX MPC controller service worker — network-first so pairing fixes reach installed PWAs.
// v2 (20261008md): replaces the old cache-first worker that pinned a stale app.js forever.
const CACHE = 'soundx-mpc-v2-20261008md';
const ASSETS = ['./', './index.html', './style.css', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const stale = keys.filter((k) => k.startsWith('soundx-mpc-') && k !== CACHE);
    await Promise.all(stale.map((k) => caches.delete(k)));
    await self.clients.claim();
    if (stale.length) {
      // pages loaded by the old cache-first worker: reload them once onto fresh code
      const wins = await self.clients.matchAll({ type: 'window' });
      wins.forEach((w) => { try { w.navigate(w.url); } catch (_) {} });
    }
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
