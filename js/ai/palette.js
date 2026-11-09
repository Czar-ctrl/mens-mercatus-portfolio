/* preview wave 3 AI — Cmd/Ctrl+K semantic search palette: projects, demos, articles, pages, AI tools and site passages.
   Instant keyword results first, then an on-device embedding re-rank when the model is ready. "> command" runs voice commands by typing. */
import { search, loadData, embedder, model, esc, toks, norm } from './core.js';
import { parse } from './commands.js';
const d = document;
let box = null, input, list, opener, items = [], sel = 0, seq = 0;
const ICO = { project: 'P', demo: '▶', article: 'A', page: '§', ai: '✦', kb: '“', cmd: '>' };
const GRP = { cmd: 'Command', project: 'Projects', demo: 'Demos', ai: 'AI tools', article: 'Articles', page: 'Pages', kb: 'From the site' };
function hl(text, terms) {
  let h = esc(text); if (!terms.length) return h;
  return h.replace(/[A-Za-z0-9#.+]{3,}/g, w => terms.includes(toks(w)[0]) ? '<mark>' + w + '</mark>' : w);
}
function build() {
  box = d.createElement('div'); box.className = 'mm-pal mm-ai'; box.hidden = true;
  box.innerHTML = `<div class="mm-pal-box" role="dialog" aria-modal="true" aria-label="Search the site">
    <div class="mm-pal-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
    <input type="text" role="combobox" aria-expanded="true" aria-controls="mm-pal-list" aria-autocomplete="list" placeholder="Search projects, demos, articles… or type > for commands" autocomplete="off" spellcheck="false" aria-label="Search">
    <kbd class="mm-stat">esc</kbd></div>
    <div class="mm-pal-list" id="mm-pal-list" role="listbox" aria-label="Results"></div>
    <div class="mm-pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>></kbd> commands</span><span class="mm-pal-mode"></span><span class="mm-badge">On device · private</span></div></div>`;
  d.body.appendChild(box);
  input = box.querySelector('input'); list = box.querySelector('.mm-pal-list');
  input.addEventListener('input', () => run());
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel, e.metaKey || e.ctrlKey); } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1); }
  });
  box.addEventListener('mousedown', e => { if (e.target === box) close(); });
  list.addEventListener('click', e => { const it = e.target.closest('[data-i]'); if (it) { e.preventDefault(); pick(+it.dataset.i); } });
  list.addEventListener('mousemove', e => { const it = e.target.closest('[data-i]'); if (it && +it.dataset.i !== sel) setSel(+it.dataset.i); });
  const mode = () => { box.querySelector('.mm-pal-mode').textContent = model.state === 'ready' ? 'semantic + keyword' : model.state === 'loading' ? 'keyword · loading semantic…' : 'keyword'; };
  mode(); addEventListener('mm-ai-model', () => { mode(); if (!box.hidden && input.value.trim()) run(); });
}
function setSel(i) { sel = i; list.querySelectorAll('[data-i]').forEach(n => n.setAttribute('aria-selected', String(+n.dataset.i === i))); const n = list.querySelector(`[data-i="${i}"]`); if (n) { input.setAttribute('aria-activedescendant', n.id); n.scrollIntoView({ block: 'nearest' }); } }
function move(k) { if (!items.length) return; setSel((sel + k + items.length) % items.length); }
function pick(i, newTab) {
  const it = items[i]; if (!it) return;
  if (it.type === 'cmd') { close(); const msg = it.cmd.run(); if (window.MM_AI && window.MM_AI.toast) window.MM_AI.toast(esc(msg)); return; }
  close(); if (newTab) window.open(it.url, '_blank', 'noopener'); else location.href = it.url;
}
function render(terms) {
  if (!items.length) { list.innerHTML = '<div class="mm-pal-empty">No matches on the site. Try a project name, a skill, or “> help”.</div>'; return; }
  let html = '', g = '';
  items.forEach((it, i) => {
    if (it.type !== g) { g = it.type; html += `<div class="mm-pal-grp" role="presentation">${GRP[g] || g}</div>`; }
    html += `<a class="mm-pal-item" role="option" id="mm-pal-${i}" data-i="${i}" href="${esc(it.url || '#')}" aria-selected="false"><span class="ic" aria-hidden="true">${ICO[it.type] || '•'}</span><span><span class="t">${hl(it.title, terms)}</span>${it.desc ? `<span class="d">${hl(it.desc, terms)}</span>` : ''}</span></a>`;
  });
  list.innerHTML = html; setSel(0);
}
async function run() {
  const q = input.value.trim(), my = ++seq;
  if (q.startsWith('>')) {
    const c = parse(q.slice(1)); items = c ? [{ type: 'cmd', title: c.label, desc: c.url ? c.url : 'Runs on this page', url: c.url || '#', cmd: c }] : [];
    if (!c) { list.innerHTML = '<div class="mm-pal-empty">Try “> go to contact”, “> open SoundX AI”, “> switch to light mode”, “> read this project”.</div>'; return; }
    render([]); return;
  }
  const D = await loadData();
  if (!q) { items = D.items.filter(i => i.type === 'project' || i.type === 'ai').slice(0, 10).map(i => ({ ...i })); render([]); return; }
  const cmd = parse(q);
  const go = async () => {
    const [a, b] = await Promise.all([search(q, { pool: 'items', k: 10 }), search(q, { pool: 'kb', k: 6 })]);
    if (my !== seq) return;
    const terms = a.terms;
    const thr = a.mode === 'semantic' ? 0.2 : 0.08;
    const top = a.results.filter(r => r.score > thr && (r.cov > 0 || (r.cos || 0) > 0.3)).slice(0, 8).map(r => ({ ...r.d }));
    const pass = b.results.filter(r => r.score > (b.mode === 'semantic' ? 0.3 : 0.25) && (r.cov > 0 || (r.cos || 0) > 0.35)).slice(0, 4)
      .map(r => ({ type: 'kb', title: r.d.title + ' · ' + r.d.section, desc: r.d.text.slice(0, 160) + (r.d.text.length > 160 ? '…' : ''), url: r.d.url }));
    const order = ['project', 'demo', 'ai', 'article', 'page'];
    top.sort((x, y) => order.indexOf(x.type) - order.indexOf(y.type));
    items = (cmd ? [{ type: 'cmd', title: cmd.label, desc: 'Command', url: cmd.url || '#', cmd }] : []).concat(top, pass);
    render(terms);
  };
  await go();
}
export function open(btn, q) {
  if (!box) build(); opener = btn || d.activeElement; box.hidden = false; d.body.style.overflow = 'hidden';
  input.value = q || ''; run(); input.focus();
  if (!(navigator.connection && navigator.connection.saveData) && innerWidth >= 768) embedder();
}
export function close() { if (!box || box.hidden) return; box.hidden = true; d.body.style.overflow = ''; if (opener && opener.focus) opener.focus(); }
export function query(q) { open(null, q); }
