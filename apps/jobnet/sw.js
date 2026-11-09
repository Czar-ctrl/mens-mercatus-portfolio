/* JobNet Application offline cache (Toolkit feature 10). Scope /apps/jobnet/ only. App shell: cache-first with
   background refresh; data JSON: network-first with cached fallback. No analytics, nothing sent anywhere. */
const C = 'jobnet-app-jna1';
const SHELL = ['/apps/jobnet/', '/apps/jobnet/css/jobnet-ai.css?v=jna1', '/apps/jobnet/js/app.js?v=jna1', '/apps/jobnet/js/ml.js?v=jna1', '/apps/jobnet/js/hawk.js?v=jna1', '/apps/jobnet/js/forward.js?v=jna1',
  '/apps/jobnet/js/features.js?v=jna1', '/apps/jobnet/js/gh.js?v=jna1', '/apps/jobnet/js/more.js?v=jna1', '/apps/jobnet/data/profile.json', '/apps/jobnet/data/sample-jobs.json', '/apps/mercatus-careers/data/listings.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('jobnet-app-') && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (!(u.pathname.startsWith('/apps/jobnet/') || u.pathname === '/apps/mercatus-careers/data/listings.json')) return;
  if (/\.json$/.test(u.pathname) || e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' })));
  } else {
    e.respondWith(caches.match(e.request).then(hit => { const net = fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }); return hit || net; }));
  }
});
