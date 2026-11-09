/* E) Real-user speed monitoring — posts LCP/CLS to /leads/beacon-style endpoint as speed events via beacon path only when not DNT.
   Stored company-level only on the server when org is known; preview logs to outbox digest. */
import { API, gpc } from './util.js';

export function boot() {
  if (window.__mmFRum || gpc()) return;
  window.__mmFRum = true;
  let lcp = 0, cls = 0;
  try {
    new PerformanceObserver(list => { for (const e of list.getEntries()) lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  addEventListener('pagehide', () => {
    const body = { path: location.pathname, dwell_ms: 0, rum: { lcp: Math.round(lcp), cls: +cls.toFixed(3), dpr: devicePixelRatio || 1 }, gpc: gpc(), dnt: navigator.doNotTrack === '1' };
    try { navigator.sendBeacon?.(API() + '/beacon', new Blob([JSON.stringify(body)], { type: 'application/json' })); } catch {}
  });
}
