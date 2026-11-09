// SoundX Studio merged into SoundX AI (Option E2): this worker retires the old controller PWA.
// It clears the Studio caches, unregisters itself and moves open windows to the SoundX AI controller.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('soundx-studio-')) await caches.delete(k);
    await self.registration.unregister();
    for (const w of await self.clients.matchAll({ type: 'window' })) {
      try { w.navigate(w.url.replace('/apps/soundx-studio/', '/apps/soundx-ai/')); } catch (_) {}
    }
  })());
});
