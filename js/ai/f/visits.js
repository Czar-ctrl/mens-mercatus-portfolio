/* B) Privacy-safe company-level visit beacon. No person data. Honours DNT/GPC. */
import { API, gpc } from './util.js';

let last = 0, dwell0 = performance.now();

function payload(extra) {
  return {
    path: location.pathname.replace(/index\.html$/, '') || '/',
    dwell_ms: Math.round(performance.now() - dwell0),
    referrer: (document.referrer || '').slice(0, 160),
    dnt: navigator.doNotTrack === '1',
    gpc: gpc(),
    ...extra
  };
}

export function boot() {
  if (window.__mmFVisits) return;
  window.__mmFVisits = true;
  if (gpc()) return; // hard stop
  const send = (why) => {
    if (document.visibilityState === 'hidden' && why !== 'hide') return;
    const now = Date.now();
    if (now - last < 4000 && why !== 'hide') return;
    last = now;
    const body = payload({ why });
    dwell0 = performance.now();
    try {
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      if (navigator.sendBeacon) navigator.sendBeacon(API() + '/beacon', blob);
      else fetch(API() + '/beacon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
    } catch (e) {}
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send('hide'); });
  addEventListener('pagehide', () => send('hide'));
  // First ping after 8s of real dwell (ignores bounce)
  setTimeout(() => { if (document.visibilityState === 'visible') send('dwell'); }, 8000);
}
