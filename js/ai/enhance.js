/* preview wave 3 AI — case-study tools: TL;DR (from the page's own text), "Explain like I'm a client", 60-second narrator, read-aloud.
   Fixed bar + drawer → no layout shift. All text is lifted from the case study itself; nothing is generated. */
import { esc, sentences } from './core.js';
const d = document;
const GLOSS = [[/\bAPI\b/, 'API', 'a doorway that lets one program ask another for data'], [/\bLLM/, 'LLM', 'a large language model — the kind of AI behind chat assistants'],
  [/\bembedding/i, 'embedding', 'a list of numbers that captures what a piece of text means, so similar texts can be found'], [/\bwebsocket/i, 'WebSocket', 'a live connection that pushes updates instantly'],
  [/\bsystemd\b/, 'systemd', 'the part of a Linux server that keeps programs running and restarts them'], [/\bnginx\b/i, 'nginx', 'the web server in front of the app'],
  [/\brate limit/i, 'rate limit', 'a cap on how many requests are allowed, so costs and abuse stay under control'], [/\bfallback/i, 'fallback', 'the backup behaviour when the main system is unavailable'],
  [/\bpaper[ _]/i, 'paper trading', 'practice trades with no real money'], [/\bOR-?Tools\b/i, 'OR-Tools', 'Google’s optimisation library for scheduling and routing problems']];
function sections(main) {
  const out = {}, hs = [...main.querySelectorAll('h2')];
  hs.forEach(h => { let t = '', n = h.nextElementSibling, guard = 0; const box = h.closest('section') || h.parentElement;
    const scope = box && box.querySelectorAll('h2').length === 1 ? box : null;
    if (scope) t = scope.innerText.replace(h.innerText, ''); else while (n && n.tagName !== 'H2' && guard++ < 20) { t += ' ' + n.innerText; n = n.nextElementSibling; }
    out[h.innerText.trim().toLowerCase()] = t.replace(/\s+/g, ' ').trim(); });
  return out;
}
const first = (t, n = 1) => sentences(t || '').filter(s => s.length > 25 && !/^\d+\s*$/.test(s)).slice(0, n).join(' ');
const pick = (S, ...keys) => { for (const k of keys) for (const h in S) if (h.startsWith(k)) return [h, S[h]]; return [null, ''] };
export function tldr(main) {
  const h1 = main.querySelector('h1'), lead = [...main.querySelectorAll('p')].find(p => p.innerText.length > 60), S = sections(main), pts = [];
  [['challenge', 'Problem'], ['measured result', 'Result'], ['ai behavior', 'AI'], ['security', 'Security'], ['limits', 'Limit']].forEach(([k, lab]) => { const [h, t] = pick(S, k); const s = first(t); if (s) pts.push([lab, s, h]); });
  return { title: h1 ? h1.innerText.trim() : d.title, lead: lead ? lead.innerText.trim() : '', pts };
}
export function client(main) {
  const S = sections(main), rows = [];
  [['What problem it solves', ['challenge']], ['What Katlego did', ['role and scope', 'role']], ['What came out of it', ['measured result', 'result']],
   ['How the AI is kept safe', ['ai behavior', 'security']], ['What it does not do', ['limits']]].forEach(([q, keys]) => { const [h, t] = pick(S, ...keys); const s = first(t, 2); if (s) rows.push([q, s, h]); });
  const all = rows.map(r => r[1]).join(' '), terms = GLOSS.filter(g => g[0].test(all)).map(g => [g[1], g[2]]);
  return { rows, terms };
}
let bar, drawer, cur;
// showcase product pages (THINK, Assist, Concierge, Drop Net, Blueprint): TL;DR + client view come from data/ai/showcase.json,
// whose sentences are quoted verbatim from the page or its case study (build fails otherwise: tools/showcase/build_showcase.py)
async function showItem(path) {
  try { const B = (window.MM_AI_CONFIG || {}).base || '/', D = await fetch(B + 'data/ai/showcase.json?v=m1').then(r => r.json());
    return Object.values(D.items).find(i => i.urls.includes(path)) || null; } catch (e) { return null; }
}
const fromShow = it => ({ tldr: () => ({ title: it.title, lead: it.lead.text, pts: it.pts.map(p => [p[0], p[1].text]) }),
  client: () => { const rows = it.client.map(r => [r[0], r[1].text]), all = rows.map(r => r[1]).join(' '); return { rows, terms: GLOSS.filter(g => g[0].test(all)).map(g => [g[1], g[2]]) }; } });
export async function mount(opts = {}) {
  const main = d.querySelector('main#content') || d.querySelector('main') || (opts.showcase && (d.getElementById('root') || d.body)); if (!main || bar) return;
  const path = location.pathname.replace(/index\.html$/, ''), nar = await import('./narrator.js'), item = await nar.forUrl(path);
  const SH = opts.showcase ? await showItem(path) : null; if (opts.showcase && !SH) return;
  const T_ = SH ? fromShow(SH) : { tldr: () => tldr(main), client: () => client(main) };
  bar = d.createElement('div'); bar.className = 'mm-csbar mm-ai'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Case-study tools');
  bar.innerHTML = `<button type="button" data-k="tldr" aria-pressed="false" aria-controls="mm-cs-drawer">TL;DR</button><button type="button" data-k="client" aria-pressed="false" aria-controls="mm-cs-drawer">Explain like I’m a client</button>` +
    (item ? `<button type="button" data-k="listen" aria-pressed="false" aria-controls="mm-cs-drawer">▶ Listen · ${Math.round(item.duration)} s</button>` : '') +
    ('speechSynthesis' in window ? `<button type="button" data-k="read" aria-pressed="false">Read aloud</button>` : '');
  drawer = d.createElement('div'); drawer.className = 'mm-drawer mm-ai'; drawer.id = 'mm-cs-drawer'; drawer.hidden = true; drawer.setAttribute('role', 'region'); drawer.setAttribute('aria-label', 'Case-study summary');
  d.body.append(bar, drawer);
  const close = () => { drawer.hidden = true; cur = null; bar.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', 'false')); const a = drawer.querySelector('audio'); if (a) a.pause(); };
  const show = (k, btn) => {
    if (cur === k) return close(); cur = k; bar.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    const head = t => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px"><h3 style="margin:0">${t}</h3><button type="button" class="mm-x" aria-label="Close" data-x>✕</button></div>`;
    if (k === 'tldr') { const T = T_.tldr(); drawer.innerHTML = head('TL;DR · ' + esc(T.title)) + `<p class="mm-note">${esc(T.lead)}</p><ul>${T.pts.map(p => `<li><b>${p[0]}:</b> ${esc(p[1])}</li>`).join('')}</ul><p class="mm-stat">${SH ? 'Sentences quoted from this page and its case study' : 'Sentences quoted from this page’s sections'} — nothing generated.</p>`; }
    if (k === 'client') { const C = T_.client(); drawer.innerHTML = head('Explain like I’m a client') + C.rows.map(r => `<p style="margin:.6rem 0 .2rem"><b>${r[0]}</b></p><p class="mm-note" style="margin:0">${esc(r[1])}</p>`).join('') +
      (C.terms.length ? `<p style="margin:.9rem 0 .2rem"><b>Jargon, decoded</b></p><ul>${C.terms.map(t => `<li><b>${esc(t[0])}</b> — ${esc(t[1])}</li>`).join('')}</ul>` : '') + `<p class="mm-stat">Plain-language headings over the page’s own sentences; glossary entries are general definitions.</p>`; }
    if (k === 'listen') { drawer.innerHTML = head('60-second walkthrough'); const h = d.createElement('div'); drawer.appendChild(h); nar.player(h, item); const a = h.querySelector('audio'); if (a) a.play().catch(() => {}); }
    drawer.hidden = false; drawer.querySelector('[data-x]').addEventListener('click', () => { close(); btn.focus(); }); drawer.dataset.view = k;
  };
  bar.addEventListener('click', async e => { const b = e.target.closest('[data-k]'); if (!b) return;
    if (b.dataset.k === 'read') { const C = await import('./commands.js'); if (window.__mmReading) { C.stopReading(); b.textContent = 'Read aloud'; b.setAttribute('aria-pressed', 'false'); } else { C.readAloud(main); b.textContent = '■ Stop reading'; b.setAttribute('aria-pressed', 'true'); } return; }
    show(b.dataset.k, b); });
  d.addEventListener('keydown', e => { if (e.key === 'Escape' && !drawer.hidden) close(); });
  window.MM_AI_CS = { showcase: !!SH, tldr: T_.tldr, client: T_.client, show: k => show(k, bar.querySelector(`[data-k="${k}"]`)) };
}
