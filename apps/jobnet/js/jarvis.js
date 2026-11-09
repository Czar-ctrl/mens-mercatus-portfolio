/* JARVIS mode — a typed command console + HUD for JobNet Application. Lazy-loaded on first open.
   Commands mirror a classic assistant's style (repos, match, draft, forward …) but every action is read-only or
   draft-only. GitHub data comes from the public, unauthenticated API (see gh.js). Nothing is sent. */
import * as G from './gh.js?v=jna1';
const A = window.JobNetApp; const { S } = A; const api = A.api;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let root, log, input, canvas, raf = 0, voice = false, hist = [], hi = -1, lastFocus = null;

function build() {
  root = document.createElement('div'); root.className = 'jv'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'JARVIS mode');
  root.innerHTML = `<div class="jv-scan" aria-hidden="true"></div><div class="jv-grid" aria-hidden="true"></div>
  <div class="jv-core" aria-hidden="true"><canvas width="520" height="520"></canvas><div class="jv-core-t"><b>J.A.R.V.I.S.</b><span>JobNet Application</span></div></div>
  <header class="jv-top"><span class="jv-dot"></span><b>JARVIS MODE</b><span class="jv-q" id="jv-q"></span><button type="button" class="jv-x" aria-label="Close JARVIS mode">✕</button></header>
  <section class="jv-console" aria-label="Command console"><div class="jv-log" aria-live="polite"></div>
    <form class="jv-in"><span aria-hidden="true">›</span><label class="sr" for="jv-cmd">Command</label><input id="jv-cmd" autocomplete="off" spellcheck="false" placeholder="type “help” · repos · org · ai · match · draft · forward"></form>
    <div class="jv-chips">${['help', 'match', 'draft', 'repos', 'org', 'ai', 'forward', 'stack'].concat(api.owner ? ['bulk'] : []).map(c => `<button type="button" data-c="${c}">${c}</button>`).join('')}<button type="button" data-c="voice">voice</button></div></section>
  <div class="jv-panels" aria-live="polite"></div>`;
  document.body.appendChild(root);
  log = root.querySelector('.jv-log'); input = root.querySelector('#jv-cmd'); canvas = root.querySelector('canvas');
  root.querySelector('.jv-x').addEventListener('click', close);
  root.querySelector('.jv-in').addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim(); if (!v) return; hist.unshift(v); hi = -1; input.value = ''; run(v); });
  input.addEventListener('keydown', e => { if (e.key === 'ArrowUp') { hi = Math.min(hist.length - 1, hi + 1); input.value = hist[hi] || ''; e.preventDefault(); } if (e.key === 'ArrowDown') { hi = Math.max(-1, hi - 1); input.value = hi < 0 ? '' : hist[hi]; e.preventDefault(); } });
  root.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => run(b.dataset.c)));
  root.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'Tab') { const f = [...root.querySelectorAll('button,input,a[href]')].filter(x => !x.disabled && x.offsetParent); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); } else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); } } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (root.classList.contains('on')) start(); });
}
/* arc-reactor HUD: canvas, transform-only rotation math, rAF, paused when hidden/closed, one static frame under reduced motion */
function frame(t) {
  const c = canvas.getContext('2d'), W = canvas.width, cx = W / 2, R = W / 2 - 8; c.clearRect(0, 0, W, W); const a = t / 1000;
  const ring = (r, w, col, start, len, dash) => { c.beginPath(); c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.arc(cx, cx, r, start, start + len); c.stroke(); c.setLineDash([]); };
  const glow = c.createRadialGradient(cx, cx, 0, cx, cx, R * .42); glow.addColorStop(0, 'rgba(160,240,255,.95)'); glow.addColorStop(.35, 'rgba(60,200,255,.45)'); glow.addColorStop(1, 'rgba(224,24,56,0)');
  c.fillStyle = glow; c.beginPath(); c.arc(cx, cx, R * .42 * (1 + .03 * Math.sin(a * 3)), 0, 7); c.fill();
  ring(R * .28, 3, 'rgba(120,230,255,.9)', a * 1.6, Math.PI * 1.6);
  for (let i = 0; i < 10; i++) { const s = a * -.8 + i * Math.PI / 5; ring(R * .36, 9, i % 2 ? 'rgba(224,24,56,.85)' : 'rgba(80,210,255,.6)', s, .42); }
  ring(R * .5, 1.5, 'rgba(80,210,255,.55)', a * .5, Math.PI * 2, [3, 7]);
  ring(R * .62, 4, 'rgba(224,24,56,.8)', -a * .7, Math.PI * .9); ring(R * .62, 4, 'rgba(224,24,56,.8)', -a * .7 + Math.PI, Math.PI * .5);
  ring(R * .74, 1, 'rgba(120,230,255,.5)', 0, Math.PI * 2, [1, 9]);
  ring(R * .86, 2.5, 'rgba(80,210,255,.75)', a * .35, Math.PI * .35); ring(R * .86, 2.5, 'rgba(80,210,255,.75)', a * .35 + 2.2, Math.PI * .6);
  ring(R * .97, 1, 'rgba(224,24,56,.6)', -a * .2, Math.PI * 1.7, [14, 6]);
  const sw = (a * 1.2) % (Math.PI * 2); c.beginPath(); c.moveTo(cx, cx); c.arc(cx, cx, R * .97, sw, sw + .35); c.closePath(); const g2 = c.createRadialGradient(cx, cx, R * .3, cx, cx, R); g2.addColorStop(0, 'rgba(80,210,255,0)'); g2.addColorStop(1, 'rgba(80,210,255,.18)'); c.fillStyle = g2; c.fill();
}
function start() { if (RM) { frame(1200); return; } cancelAnimationFrame(raf); const loop = t => { frame(t); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }
function stop() { cancelAnimationFrame(raf); raf = 0; }
function say(html, cls = '') {
  const p = document.createElement('p'); p.className = 'jv-l ' + cls; log.appendChild(p);
  if (RM || !cls.includes('ai')) p.innerHTML = html;
  else { const tmp = document.createElement('div'); tmp.innerHTML = html; const txt = tmp.textContent; let i = 0; const step = () => { i = Math.min(txt.length, i + 3); p.textContent = txt.slice(0, i); if (i < txt.length) setTimeout(step, 12); else p.innerHTML = html; log.scrollTop = log.scrollHeight; }; step(); }
  log.scrollTop = log.scrollHeight;
  if (voice && cls.includes('ai') && 'speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(p.textContent || html.replace(/<[^>]+>/g, '')); const v = speechSynthesis.getVoices().find(v => /en-ZA/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^en/i.test(v.lang)); if (v) u.voice = v; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); }
}
function panel(title, html) {
  const box = root.querySelector('.jv-panels'); const el = document.createElement('article'); el.className = 'jv-p'; el.innerHTML = `<h3>${esc(title)}</h3>${html}`;
  box.prepend(el); [...box.children].slice(3).forEach(x => x.remove()); requestAnimationFrame(() => el.classList.add('in'));
}
const q = () => { root.querySelector('#jv-q').textContent = G.quotaText(); };
const cur = () => api.current();
const HELP = [['help', 'this list'], ['match', 'fit for the selected role and why'], ['draft', 'AI Hawk draft for the selected role'], ['repos [user <name>]', 'Katlego\'s public GitHub repos that fit this vacancy'],
  ['org [name]', 'a hiring company\'s public GitHub org: languages and topics'], ['ai', 'top public AI/ML repos for this vacancy\'s topics'], ['stack', 'org stack vs evidenced skills'],
  ['forward [email]', 'forward the role or finished draft via your own mail app'], ['use <n>', 'select role n from the shortlist'], ['voice', 'toggle spoken replies (browser voice)'], ['close', 'leave JARVIS mode']];
async function run(raw) {
  say(esc(raw), 'you'); const [cmd, ...rest] = raw.trim().split(/\s+/); const arg = rest.join(' ');
  try {
    switch (cmd.toLowerCase()) {
      case 'help': say('Commands: ' + HELP.map(([c, d]) => `<b>${esc(c)}</b> ${esc(d)}`).join(' · '), 'ai'); break;
      case 'close': case 'exit': close(); break;
      case 'clear': log.innerHTML = ''; break;
      case 'voice': voice = !voice; say(voice ? ('speechSynthesis' in window ? 'Voice on. Using your browser\'s voice (en-ZA if installed).' : 'Voice is not supported in this browser.') : 'Voice off.', 'ai'); if (!voice && window.speechSynthesis) speechSynthesis.cancel(); break;
      case 'use': { const L = api.sorted(); const j = L[(+arg || 1) - 1]; if (!j) { say('No role with that number.', 'ai err'); break; } api.select(j.id); say(`Selected <b>${esc(j.title)}</b> · ${esc(j.company)} (${S.fits.get(j.id).fit}%).`, 'ai'); break; }
      case 'match': { const j = cur(); if (!j) { say('No role selected.', 'ai err'); break; } const r = S.fits.get(j.id);
        say(`<b>${esc(j.title)}</b>: fit ${r.fit}% (${r.mode === 'semantic' ? 'MiniLM' : 'BM25'}). Evidenced: ${esc(r.matched.map(m => m.label).join(', ') || 'none')}. Gaps: ${esc(r.gaps.map(m => m.label).join(', ') || 'none')}.`, 'ai');
        panel('Match · ' + j.title, `<div class="jv-big">${r.fit}<small>%</small></div><p>Skills ${Math.round(r.parts.skills * 100)} · Semantic ${Math.round(r.parts.semantic * 100)} · Location ${Math.round(r.parts.logistics * 100)}</p>`); break; }
      case 'draft': { const j = cur(); if (!j) { say('No role selected.', 'ai err'); break; } await api.openHawk(j.id, false); say(`AI Hawk draft ready for <b>${esc(j.title)}</b> (signal ${esc(S.hawk.signal)}). Review it in the AI Hawk panel before using it.`, 'ai'); panel('AI Hawk draft', `<pre>${esc(S.hawk.text.slice(0, 900))}${S.hawk.text.length > 900 ? '\n…' : ''}</pre>`); break; }
      case 'forward': { const j = cur(); if (!j) { say('No role selected.', 'ai err'); break; }
        const kind = S.hawk && S.hawk.job.id === j.id ? 'draft' : 'role'; close(); api.openForward(kind, j.id); if (arg) { const i = document.querySelector('#fwd-to'); i.value = arg; } break; }
      case 'repos': {
        if (/^user\s+/i.test(arg)) { const u = arg.replace(/^user\s+/i, '').trim(); if (!G.validSlug(u)) { say('That is not a valid GitHub username.', 'ai err'); break; } G.setUser(u); say(`GitHub user set to <b>${esc(u)}</b> (saved in this browser only).`, 'ai'); }
        if (!G.CFG.user) { say('Katlego\'s GitHub username is not published on this site, so it isn\'t set. Type <b>repos user &lt;name&gt;</b> to set it.', 'ai err'); break; }
        const j = cur(); const { repos, cached } = await G.userRepos(); q(); const rel = j ? G.relevant(repos, j.title + ' ' + (j.text || ''), S.ctx.skills) : [];
        say(`${repos.length} public repos for <b>${esc(G.CFG.user)}</b>${cached ? ' (cached)' : ''}. ${rel.length ? rel.length + ' match this vacancy.' : 'None match this vacancy\'s skills by name, description or topics.'}`, 'ai');
        panel('Repos to cite', (rel.length ? rel : repos.slice(0, 5)).map(r => `<p><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a> <small>${esc(r.lang)}${r.hits ? ' · ' + esc(r.hits.join(', ')) : ''}</small><br><span>${esc(r.desc)}</span></p>`).join('') + (rel.length ? '<button type="button" class="jv-act" data-cite>Add these to the draft sources</button>' : ''));
        const b = root.querySelector('[data-cite]'); if (b) b.addEventListener('click', async () => { if (!S.hawk || S.hawk.job.id !== j.id) await api.openHawk(j.id, false); api.appendSources(rel.map(r => `${r.name} (GitHub) · ${r.url}`)); say('Added the repo links to the draft sources. Check they really support each claim.', 'ai'); });
        break; }
      case 'org': case 'stack': {
        const j = cur(); const name = (cmd === 'org' && arg) || (j && G.orgGuess(j.company)); if (!name) { say('Give an org name: org &lt;github-org&gt;.', 'ai err'); break; }
        const o = await G.orgRepos(name); q(); A.org = o;
        const ev = new Set(S.ctx.skills.filter(s => s.level !== 'gap').flatMap(s => [s.key, s.label.toLowerCase()]));
        const overlap = o.langs.filter(([l]) => ev.has(l.toLowerCase()) || ev.has(l.toLowerCase().replace(/[^a-z]/g, '')));
        say(`${esc(o.org)}: ${o.repos.length} public repos${o.cached ? ' (cached)' : ''}. Top languages: ${esc(o.langs.slice(0, 5).map(x => x[0]).join(', ') || 'none listed')}. ${o.langs.length ? `Overlap with Katlego's evidenced skills: ${overlap.length} of ${Math.min(5, o.langs.length)} top languages.` : ''}${cmd === 'stack' || !arg ? ' (Org name guessed from the company: verify it is the right org.)' : ''}`, 'ai');
        panel('Stack fingerprint · ' + o.org, `<ul class="jv-bars">${o.langs.slice(0, 6).map(([l, n]) => `<li><span>${esc(l)}</span><i style="--s:${(n / o.langs[0][1]).toFixed(3)}"></i><b>${n}</b></li>`).join('')}</ul><p><small>Topics: ${esc(o.topics.map(t => t[0]).join(', ') || 'none')}</small></p><p><small>Source: <a href="https://github.com/${esc(o.org)}" target="_blank" rel="noopener noreferrer">github.com/${esc(o.org)}</a> · public repos only, primary language per repo.</small></p>`);
        break; }
      case 'ai': {
        const j = cur(); const text = arg || (j ? j.title + ' ' + (j.text || '') : ''); const r = await G.aiRepos(text); q();
        if (!r.topics.length) { say(r.note, 'ai'); break; }
        say(`Topics in this vacancy: ${esc(r.topics.join(', '))}. Showing the most-starred public repos for each, straight from GitHub search. Use them as things to learn or mention only if you've really used them.`, 'ai');
        panel('AI/ML repos · ' + r.topics.join(', '), r.repos.map(x => `<p><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.full)}</a> <small>★ ${x.stars.toLocaleString('en-ZA')} · ${esc(x.lang)} · #${esc(x.topic)}</small><br><span>${esc(x.desc.slice(0, 140))}</span></p>`).join('')); break; }
      case 'bulk': if (api.owner) { close(); api.openOwner(); } else say('Bulk is owner-only and not available on the public site.', 'ai err'); break;
      default: say(`Unknown command “${esc(cmd)}”. Type <b>help</b>.`, 'ai err');
    }
  } catch (e) { say(esc(e.message || String(e)), 'ai err'); q(); }
}
export function open() {
  if (!root) build(); lastFocus = document.activeElement; root.hidden = false; document.documentElement.classList.add('jv-open');
  requestAnimationFrame(() => root.classList.add('on')); start(); q(); input.focus();
  if (!log.children.length) { const j = cur(); say(`Online. ${S.jobs.length} roles in the shortlist${j ? `; selected: <b>${esc(j.title)}</b>` : ''}. Type <b>help</b>.`, 'ai'); }
}
export function close() { if (!root) return; root.classList.remove('on'); document.documentElement.classList.remove('jv-open'); stop(); if (window.speechSynthesis) speechSynthesis.cancel(); setTimeout(() => { if (!root.classList.contains('on')) root.hidden = true; }, RM ? 0 : 380); lastFocus && lastFocus.focus && lastFocus.focus(); }
export { run };
