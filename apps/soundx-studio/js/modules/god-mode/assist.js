/**
 * Optional Blueprint Assist health probe.
 * LIVE only when /health responds ok; otherwise DEMO (local heuristics).
 * Never claims Suno / cloud ML.
 */
export async function checkAssistHealth(timeoutMs = 1200) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch('/api/cartel/index.php?path=/api/mercatus-cartel/health', {
      signal: ctrl.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    clearTimeout(t);
    return r.ok ? 'LIVE' : 'DEMO';
  } catch {
    clearTimeout(t);
    return 'DEMO';
  }
}
