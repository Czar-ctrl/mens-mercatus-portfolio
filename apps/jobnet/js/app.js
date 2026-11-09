/* JobNet Application — one pipeline: Shortlist → Match → AI Hawk draft → Review → Handoff (forward / copy).
   All inference is on-device (ml.js; MiniLM runs in a worker). Draft-only: nothing here applies, signs in or sends.
   Sections 05–08 (outcome model, replies, freelance, pipeline dashboard) are code-split into more.js and load on approach. */
import * as M from './ml.js?v=jna1';
let H = null, F = null; // AI Hawk + forward helpers load on first use (code-split)
const needH = async () => (H = H || await import('./hawk.js?v=jna1'));
const needF = async () => (F = F || await import('./forward.js?v=jna1'));
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = x => Math.round(x * 100);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const J = f => fetch('data/' + f, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2400); };
const Q = new URLSearchParams(location.search);
const S = { jobs: [], fits: new Map(), sel: null, src: 'live', ctx: null, profile: null, sampleJobs: [], hawk: null, hawkJob: null, more: null };
const OWNER = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && Q.has('owner'); // owner/local gate: never true on mensmercatus.online
window.JobNetApp = { S, M };

/* ---------- chrome: theme, mode, nav, spotlight, reveal, magnet ---------- */
function chrome() {
  const th = $('#theme'), sync = () => { const l = document.documentElement.classList.contains('light'); th.setAttribute('aria-label', l ? 'Switch to dark mode' : 'Switch to light mode'); $('meta[name=theme-color]').content = l ? '#f4f2ee' : '#0a0a0a'; };
  th.addEventListener('click', () => { const l = document.documentElement.classList.toggle('light'); try { localStorage.setItem('mm-color-mode', l ? 'light' : 'dark'); } catch {} sync(); if (S.radar) drawRadar(); });
  sync();
  $$('[data-mode-btn]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.modeBtn, true)));
  document.addEventListener('pointermove', e => { const c = e.target.closest && e.target.closest('.card'); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, { passive: true });
  if (!RM && matchMedia('(pointer:fine)').matches) $$('.magnet').forEach(m => {
    m.addEventListener('pointermove', e => { const r = m.getBoundingClientRect(); m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px,${(e.clientY - r.top - r.height / 2) * .28}px)`; });
    m.addEventListener('pointerleave', () => m.style.transform = '');
  });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.sec-h, .sec .card, .mail, .leads-grid, .stats').forEach(el => { el.classList.add('reveal'); io.observe(el); });
  const links = $$('.secnav a'), secs = links.map(a => $(a.getAttribute('href')));
  const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach(s => s && so.observe(s));
}
function setMode(m, scroll) {
  document.body.dataset.mode = m;
  $$('[data-mode-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modeBtn === m)));
  $('[data-copy-jobs]').hidden = m !== 'jobs'; $('[data-copy-freelance]').hidden = m === 'jobs';
  if (scroll && m === 'freelance') $('#leads').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
}

/* ---------- model status ---------- */
function modelUI() {
  const pill = $('#model-pill'), btn = $('#load-model');
  const set = st => {
    pill.className = 'pill ' + st.state;
    $('span', pill).textContent = { idle: 'Keyword mode (BM25) · instant', loading: 'Loading MiniLM in a background worker…', ready: 'Semantic mode · MiniLM-L6 on-device', failed: 'Model unavailable · BM25 fallback active' }[st.state];
    btn.disabled = st.state === 'loading' || st.state === 'ready';
    $('span', btn).textContent = st.state === 'ready' ? 'Semantic model loaded' : st.state === 'failed' ? 'Retry unavailable · using BM25' : 'Load semantic model';
  };
  M.onModel(set); set(M.model);
  btn.addEventListener('click', async () => {
    const f = await M.loadEmbedder();
    if (!f) { toast('Semantic model unavailable. Keyword mode keeps working.'); return; }
    S.ctx.evVecs = await M.embed(S.ctx.ev.map(e => e.text));
    toast('Semantic model ready. Re-scoring on device…');
    await scoreAll(); renderAll(); if (S.more) S.more.rescore();
  });
}

/* ---------- 01 shortlist + match ---------- */
async function scoreAll() {
  if (S.ctx.evVecs) await M.embed(S.jobs.flatMap(j => { const t = `${j.title}. ${j.text || ''}`; const s = M.sentences(t).slice(0, 12); return s.length ? s : [t]; })); // one batched worker call
  S.fits.clear(); for (const j of S.jobs) S.fits.set(j.id, await M.fitJob(j, S.ctx));
}
const sorted = () => [...S.jobs].sort((a, b) => S.fits.get(b.id).fit - S.fits.get(a.id).fit);
function renderList() {
  const box = $('#job-list'); const L = sorted();
  if (!S.sel || !S.jobs.some(j => j.id === S.sel)) S.sel = L[0] && L[0].id;
  box.innerHTML = L.map(j => `<button class="job" role="option" type="button" data-id="${esc(j.id)}" aria-selected="${j.id === S.sel}"><b>${esc(j.title)}</b><span class="sc" style="color:${col(S.fits.get(j.id).fit)}">${S.fits.get(j.id).fit}</span><small>${esc(j.company)} · ${esc(j.location)}${j.mode ? ' · ' + esc(j.mode) : ''}${j.fresh ? ' · <em class="new">new</em>' : ''}</small></button>`).join('');
}
const col = f => f >= 72 ? 'var(--ok)' : f >= 55 ? 'var(--warn)' : 'var(--red-ink)';
function detailHTML(j, r) {
  const chip = (i, c) => i.evidence && i.evidence[0] ? `<a class="chip ${c}" href="${esc(i.evidence[0][1])}" title="${esc(i.evidence[0][0])}">${esc(i.label)}</a>` : `<span class="chip ${c}" title="${esc(i.note || '')}">${esc(i.label)}</span>`;
  const bar = (n, v) => `<div class="barrow"><span>${n}</span><span class="bar-t"><i style="--s:${v.toFixed(3)}"></i></span><b>${pct(v)}</b></div>`;
  return `<div class="det-top"><div class="ring" style="--v:${r.fit}"><span>${r.fit}<small>%</small></span></div><div><h3>${esc(j.title)}</h3><p>${esc(j.company)} · ${esc(j.location)}${j.mode ? ' · ' + esc(j.mode) : ''} · ${esc(j.source || '')}</p>
    <p style="margin-top:8px"><span class="tag ${r.mode === 'semantic' ? 'ok' : 'mute'}">${r.mode === 'semantic' ? 'semantic · MiniLM' : 'keyword · BM25'}</span></p></div></div>
    <div class="det-act"><button class="btn primary small" type="button" data-hawk="${esc(j.id)}"><span>Draft with AI Hawk →</span></button><button class="btn ghost small" type="button" data-fwd-role="${esc(j.id)}"><span>Forward by email</span></button>${j.url ? `<a class="btn ghost small" href="${esc(j.url)}" target="_blank" rel="noopener noreferrer"><span>Open posting ↗</span></a>` : ''}</div>
    <div class="bars">${bar('Skills (50%)', r.parts.skills)}${bar('Semantic (35%)', r.parts.semantic)}${bar('Location/mode (15%)', r.parts.logistics)}</div>
    <div class="h4">Evidenced (${r.matched.length})</div><div class="chips">${r.matched.map(i => chip(i, 's')).join('') || '<span class="hint">None detected</span>'}</div>
    ${r.partial.length ? `<div class="h4">Partial or listed only (${r.partial.length})</div><div class="chips">${r.partial.map(i => chip(i, 'p')).join('')}</div>` : ''}
    <div class="h4">Honest gaps (${r.gaps.length})</div><div class="chips">${r.gaps.map(i => chip(i, 'g')).join('') || '<span class="hint">No hard gaps detected</span>'}</div>
    <div class="h4">Why: closest CV evidence per requirement</div>
    <ul class="ev">${r.pairs.slice(0, 3).map(p => `<li><q>${esc(p.s)}</q><span>↳ ${esc(p.ev.text)} <em>${esc(p.ev.src)} · ${r.mode === 'semantic' ? 'cos ' + p.sim.toFixed(2) : 'bm25 ' + p.sim.toFixed(1)}</em></span></li>`).join('')}</ul>`;
}
function renderDetail() { queueMicrotask(() => document.dispatchEvent(new Event('jn:change'))); const j = S.jobs.find(x => x.id === S.sel) || S.jobs[0]; if (!j) { $('#job-detail').innerHTML = '<p class="hint">No listings.</p>'; return; } S.sel = j.id; $('#job-detail').innerHTML = detailHTML(j, S.fits.get(j.id)); }

/* Live shortlist: JobNet's read-only public API (noon/evening runs). Cached for 30 min in sessionStorage,
   falls back to the last published snapshot, then to fictional sample listings. Labels say which one you're seeing. */
const CACHE_K = 'jn.shortlist.v1', TTL = 30 * 60e3, SNAP = '/apps/mercatus-careers/data/listings.json';
async function fetchShortlist() {
  try { const c = JSON.parse(sessionStorage.getItem(CACHE_K) || 'null'); if (c && Date.now() - c.t < TTL) return { d: c.d, kind: 'live', cached: true }; } catch {}
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(M.CFG.liveApi + '/api/listings?limit=100', { cache: 'no-store', signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error(r.status); const d = await r.json(); if (!(d.listings || []).length) throw new Error('empty');
    try { sessionStorage.setItem(CACHE_K, JSON.stringify({ t: Date.now(), d })); } catch {}
    return { d, kind: 'live' };
  } catch (e) {
    try { const r = await fetch(SNAP, { cache: 'no-cache' }); if (!r.ok) throw 0; const d = await r.json(); if ((d.listings || []).length) return { d, kind: 'snapshot' }; } catch {}
    return null;
  }
}
function fromApi(d) {
  const now = Date.now();
  return (d.listings || []).slice(0, 40).map((x, i) => { const m = /(\d{4}-\d{2}-\d{2})/.exec(x.posted || '') || /(\d{4}-\d{2}-\d{2})/.exec(d.run && d.run.scraped_at || '');
    return { id: x.id ? String(x.id) : 'live-' + i, title: x.title || 'Untitled', company: x.company || '', location: x.location || '', mode: '', salary: null, days: m ? Math.max(0, Math.round((now - Date.parse(m[1])) / 864e5)) : 3, source: x.source === 'glassdoor' ? 'Glassdoor' : 'LinkedIn', url: /^https:\/\//.test(x.url || '') ? x.url : '', fresh: !!x.new_since_last_run, text: [x.why, x.description].filter(Boolean).join(' ') }; });
}
const sast = iso => { try { return new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' SAST'; } catch { return ''; } };
function setChip(kind, d) {
  const chip = $('#chip-shortlist'), n = $('#src-note');
  if (kind === 'live' || kind === 'snapshot') {
    const when = d.run && d.run.scraped_at ? sast(d.run.scraped_at) : '';
    chip.textContent = kind === 'live' ? 'LIVE' : 'SNAPSHOT'; chip.className = 'tag ' + (kind === 'live' ? 'ok' : 'warn');
    n.textContent = `${kind === 'live' ? 'Live shortlist' : 'Last published shortlist (live API unreachable)'} · ${S.jobs.length} roles · scraped ${when} · LinkedIn${(d.run && (d.run.boards || []).includes('glassdoor')) ? ' + Glassdoor' : ''} public listings`;
  } else { chip.textContent = 'SAMPLE'; chip.className = 'tag mute'; n.textContent = 'Sample data · fictional companies'; }
}
async function useSource(src) {
  $$('[data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === src)));
  if (src === 'live') {
    $('#src-note').textContent = 'Fetching JobNet’s read-only shortlist…';
    const got = await fetchShortlist();
    if (got) { S.jobs = fromApi(got.d); S.src = 'live'; setChip(got.kind, got.d); }
    else { S.jobs = S.sampleJobs; S.src = 'sample'; $$('[data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === 'sample'))); setChip('sample'); $('#src-note').textContent = 'Live shortlist unavailable · showing sample data'; }
  } else { S.jobs = S.sampleJobs; S.src = 'sample'; setChip('sample'); }
  S.sel = null; await scoreAll(); renderAll();
}
async function addPasted(t) {
  const first = (t.split(/\n|\.|,/)[0] || 'Pasted role').replace(/\s+[—–-]\s+.*$/, '').slice(0, 70).trim() || 'Pasted role';
  const j = { id: 'paste-' + Date.now(), title: first, company: 'Pasted description', location: (/(johannesburg|pretoria|cape town|durban|remote)/i.exec(t) || ['Unspecified'])[0], mode: (/(remote|hybrid|on-?site)/i.exec(t) || [''])[0], salary: null, days: 0, source: 'Pasted', text: t };
  S.jobs = [j, ...S.jobs.filter(x => !x.id.startsWith('paste-'))]; S.fits.set(j.id, await M.fitJob(j, S.ctx)); S.sel = j.id; return j;
}
function pasteJD() {
  $('#jd-go').addEventListener('click', async () => {
    const t = $('#jd').value.trim(); if (t.length < 30) { toast('Paste a longer description (30+ characters).'); return; }
    await addPasted(t); renderAll(); $('#job-detail').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  });
}

/* ---------- 02 prioritiser ---------- */
function renderRank() {
  const w = { fit: +$('#w-fit').value, fresh: +$('#w-fresh').value, sal: +$('#w-sal').value }, floor = +$('#floor').value;
  $('#o-wf').textContent = w.fit.toFixed(1); $('#o-wfr').textContent = w.fresh.toFixed(1); $('#o-ws').textContent = w.sal.toFixed(1); $('#o-floor').textContent = 'R' + floor / 1000 + 'k';
  const rows = S.jobs.map(j => ({ j, p: M.priority(S.fits.get(j.id).fit, j.days, j.salary, floor, w) })).sort((a, b) => b.p.score - a.p.score);
  const mx = rows[0] ? rows[0].p.score : 1;
  $('#rank').innerHTML = rows.slice(0, 10).map(({ j, p }) => `<li><div><b>${esc(j.title)}</b><small>${esc(j.company)} · ${j.days === 0 ? 'today' : j.days + 'd old'} · pay ${esc(p.s.why)}</small></div>
    <div class="minis" title="fit · freshness · salary"><i style="--s:${p.f.toFixed(3)}"></i><i style="--s:${p.fr.toFixed(3)};--c:var(--blue)"></i><i style="--s:${p.s.v.toFixed(3)};--c:var(--ok)"></i></div><span class="score">${Math.round(p.score / mx * 100)}</span></li>`).join('');
}

/* ---------- 03 radar ---------- */
function drawRadar() {
  const { axes } = S.radar, svg = $('#radar-svg'), cx = 210, cy = 210, R = 150, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  const poly = vals => vals.map((v, i) => pt(i, Math.max(.04, v)).map(x => x.toFixed(1)).join(',')).join(' ');
  let h = ''; [.25, .5, .75, 1].forEach(k => h += `<polygon class="grid" points="${poly(axes.map(() => k))}"/>`);
  axes.forEach((a, i) => { const [x, y] = pt(i, 1); const [lx, ly] = pt(i, 1.17); h += `<line class="ax" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly}" text-anchor="${Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'}" dominant-baseline="middle">${esc(a.name)}</text>`; });
  h += `<polygon class="demand" points="${poly(axes.map(a => a.demandN))}"/><polygon class="strength" points="${poly(axes.map(a => a.strength))}"/>`;
  axes.forEach((a, i) => { const [x, y] = pt(i, Math.max(.04, a.strength)); h += `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--red)"><title>${esc(a.name)}: strength ${pct(a.strength)}%, demand ${pct(a.demandN)}%</title></circle>`; });
  svg.innerHTML = '<title id="radar-t">Radar chart of skill demand vs strength</title>' + h;
}
function renderRadar() {
  S.radar = M.radar(S.jobs.map(j => S.fits.get(j.id)), S.ctx.skills); drawRadar();
  $('#learn').innerHTML = S.radar.gaps.slice(0, 6).map(g => `<li><b>${esc(g.label)}</b> <span class="tag ${g.level === 'gap' ? '' : 'warn'}">${g.level === 'gap' ? 'not evidenced' : g.level}</span>
    <span>Asked for in ${g.n} of ${S.jobs.length} listings.${g.learn ? ` Learn: ${esc(g.learn[0])}. Proof: ${esc(g.learn[1])}.` : ' Add a small public proof project.'}</span></li>`).join('') || '<li>No gaps in this listing set.</li>';
}

/* ---------- AI Hawk draft → review → handoff ---------- */
function renderHawkPicker() {
  const sel = $('#hawk-job'), keep = S.hawkJob || sel.value;
  sel.innerHTML = sorted().map(j => `<option value="${esc(j.id)}">${esc(j.title)} · ${esc(j.company)} (${S.fits.get(j.id).fit}%)</option>`).join('');
  if (S.jobs.some(j => j.id === keep)) sel.value = keep;
}
function setStage(n) { $$('.flow li').forEach((li, i) => { li.classList.toggle('done', i < n); li.classList.toggle('on', i === n); }); }
function reviewed() { return $$('#hawk-review input[type=checkbox]').every(b => b.checked); }
function syncHandoff() {
  const has = !!S.hawk, ok = has && reviewed();
  $('#hawk-review').disabled = !has;
  ['#hawk-copy', '#hawk-dl', '#hawk-fwd'].forEach(s => { $(s).disabled = !ok; });
  $('#hawk-gate').textContent = !has ? 'Generate a draft first.' : ok ? 'Reviewed. Copy it, save it, or forward it to yourself. You send it, not this page.' : 'Tick all three review checks to unlock the handoff.';
  setStage(!has ? 2 : ok ? 4 : 3);
}
async function generateHawk(jobId) {
  const j = S.jobs.find(x => x.id === jobId); if (!j) return;
  const r = S.fits.get(j.id) || await M.fitJob(j, S.ctx);
  await needH(); const d = H.draft(j, r, S.profile, S.ctx.skills, M.LEARN);
  S.hawk = { job: j, r, ...d }; S.hawkJob = j.id;
  $('#hawk-out').value = d.text; $('#hawk-out').hidden = false; $('#hawk-empty').hidden = true;
  const sg = $('#hawk-signal'); sg.textContent = 'Signal · ' + d.signal; sg.dataset.s = d.signal; sg.hidden = false;
  $('#cv-order').innerHTML = d.order.map(o => `<li><b>${esc(o.p.name)}</b> <small>· ${o.n} overlapping skill${o.n === 1 ? '' : 's'} · ${esc(o.p.tag)}</small></li>`).join('');
  $$('#hawk-review input').forEach(b => { b.checked = false; }); syncHandoff(); document.dispatchEvent(new Event('jn:change'));
}
async function openHawk(jobId, scroll = true) {
  renderHawkPicker(); $('#hawk-job').value = jobId; S.hawkJob = jobId;
  const j = S.jobs.find(x => x.id === jobId); $('#hawk-in').value = j ? (j.text || '') : '';
  await generateHawk(jobId);
  if (scroll) $('#hawk').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
}
function hawkUI() {
  $('#hawk-job').addEventListener('change', e => openHawk(e.target.value, false));
  $$('[data-hawk-sample]').forEach(b => b.addEventListener('click', async () => { await needH(); $('#hawk-in').value = H.SAMPLES[b.dataset.hawkSample] || ''; $('#hawk-in').focus(); }));
  $('#hawk-go').addEventListener('click', async () => {
    const t = $('#hawk-in').value.trim(), cur = S.jobs.find(x => x.id === $('#hawk-job').value);
    if (cur && t === (cur.text || '').trim()) return generateHawk(cur.id);
    if (t.length < 40) { toast('Pick a shortlisted role or paste at least a few sentences of a vacancy.'); $('#hawk-in').focus(); return; }
    const j = await addPasted(t); renderAll(); await openHawk(j.id, false);
  });
  $('#hawk-clear').addEventListener('click', () => { S.hawk = null; $('#hawk-in').value = ''; $('#hawk-out').value = ''; $('#hawk-out').hidden = true; $('#hawk-empty').hidden = false; $('#hawk-signal').hidden = true; $$('#hawk-review input').forEach(b => { b.checked = false; }); syncHandoff(); });
  $('#hawk-out').addEventListener('input', () => { if (S.hawk) S.hawk.text = $('#hawk-out').value; });
  $('#hawk-review').addEventListener('change', syncHandoff);
  $('#hawk-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#hawk-out').value); toast('Draft copied. Nothing was sent.'); } catch { $('#hawk-out').select(); toast('Copy blocked by the browser. The text is selected, press Ctrl/⌘+C.'); } });
  $('#hawk-dl').addEventListener('click', () => { const b = new Blob([$('#hawk-out').value], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ai-hawk-draft-' + (S.hawk.job.title || 'role').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
  $('#hawk-fwd').addEventListener('click', () => openForward('draft'));
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-hawk]'); if (h) { e.preventDefault(); openHawk(h.dataset.hawk); return; }
    const f = e.target.closest('[data-fwd-role]'); if (f) { e.preventDefault(); openForward('role', f.dataset.fwdRole); }
  });
  syncHandoff();
}

/* ---------- Forward by email (mailto: in the visitor's own mail app; nothing sent or stored here) ---------- */
let fwd = null;
async function openForward(kind, id) {
  await needF(); const dlg = $('#fwd');
  if (kind === 'draft') { if (!S.hawk) return; const j = S.hawk.job; fwd = { subject: F.draftSubject(j), body: F.draftBody(j, $('#hawk-out').value) }; }
  else { const j = S.jobs.find(x => x.id === id); if (!j) return; fwd = { subject: F.roleSubject(j), body: F.roleBody(j, S.fits.get(j.id)) }; }
  $('#fwd-subj').textContent = fwd.subject; $('#fwd-body').textContent = fwd.body; $('#fwd-err').textContent = ''; $('#fwd-trunc').hidden = true;
  try { $('#fwd-to').value = sessionStorage.getItem('jn.fwd.to') || ''; } catch {}
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); $('#fwd-to').focus();
}
function forwardUI() {
  const dlg = $('#fwd');
  const build = () => { const r = F.parseRecipients($('#fwd-to').value); $('#fwd-err').textContent = r.ok ? '' : r.error; $('#fwd-to').setAttribute('aria-invalid', String(!r.ok)); return r.ok ? F.mailtoHref({ to: r.list, subject: fwd.subject, body: fwd.body }) : null; };
  $('#fwd-open').addEventListener('click', () => { const m = build(); if (!m) { $('#fwd-to').focus(); return; } try { sessionStorage.setItem('jn.fwd.to', $('#fwd-to').value.trim()); } catch {}
    $('#fwd-trunc').hidden = !m.truncated; $('#fwd').dataset.lastMailto = m.href; if (!window.__jnNoNav) location.href = m.href; toast(m.truncated ? 'Opened your mail app with a shortened body. Use Copy email for the full text.' : 'Opened your mail app. Nothing was sent from this page.'); });
  $('#fwd-copy').addEventListener('click', async () => { const r = F.parseRecipients($('#fwd-to').value); const t = (r.ok ? `To: ${r.list.join(', ')}\n` : '') + `Subject: ${fwd.subject}\n\n${fwd.body}`;
    try { await navigator.clipboard.writeText(t); toast('Email copied. Paste it into any mail app.'); } catch { toast('Copy blocked by the browser. Select the preview text instead.'); } });
  $('#fwd-close').addEventListener('click', () => dlg.close ? dlg.close() : dlg.removeAttribute('open'));
  $('#fwd-to').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#fwd-open').click(); } });
}

/* ---------- deferred sections 05–08 ---------- */
function lazyMore() {
  const load = () => { if (S.moreP) return S.moreP; S.moreP = import('./more.js?v=jna1').then(m => m.init({ M, S, $, $$, esc, pct, col, toast, J, RM })).then(api => (S.more = api)).catch(e => console.warn('more.js', e)); return S.moreP; };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: '800px 0px' });
  $$('[data-more]').forEach(s => io.observe(s));
  $$('[data-mode-btn="freelance"], .secnav a[href="#outcome"], .secnav a[href="#replies"], .secnav a[href="#leads"], .secnav a[href="#pipeline"]').forEach(b => b.addEventListener('click', load));
  if (/^#(outcome|replies|leads|pipeline)$/.test(location.hash)) load();
  return load;
}


/* ---------- lazy extras: Toolkit (features.js), JARVIS (jarvis.js + css), owner Bulk panel (owner.js, local only) ---------- */
const lazyCss = href => new Promise(r => { if ($(`link[href="${href}"]`)) return r(); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = l.onerror = r; document.head.appendChild(l); });
let featP, jvP;
const loadFeatures = () => featP || (featP = import('./features.js?v=jna1').then(m => (m.init(), m)));
const openJarvis = async () => { jvP = jvP || Promise.all([lazyCss('css/jarvis.css?v=jna1'), import('./jarvis.js?v=jna1')]).then(([, m]) => m); (await jvP).open(); };
const openOwner = async () => { if (!OWNER) return; (await import('./owner.js?v=jna1')).open(); };
function appendSources(lines) {
  const ta = $('#hawk-out'); if (!S.hawk || !lines.length) return; const add = lines.filter(l => !ta.value.includes(l)); if (!add.length) return;
  const n = (ta.value.match(/^\s+\[\d+\]/gm) || []).length; ta.value = ta.value.replace(/\s*$/, '') + '\n' + add.map((l, i) => `  [${n + i + 1}] ${l}`).join('\n'); S.hawk.text = ta.value; S.hawk.base = null;
}
window.JobNetApp.api = { owner: OWNER, toast, sorted, current: () => S.jobs.find(x => x.id === S.sel) || (S.hawk && S.hawk.job) || null,
  select: id => { S.sel = id; renderList(); renderDetail(); }, openHawk, openForward, openJarvis, openOwner, appendSources };
function extrasUI() {
  $('#jv-open').addEventListener('click', openJarvis);
  if (OWNER) { const b = $('#own-open'); b.hidden = false; b.addEventListener('click', openOwner); }
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); loadFeatures().then(m => m.palette()); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); openJarvis(); } });
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); loadFeatures(); } }, { rootMargin: '600px 0px' }); io.observe($('#toolkit'));
  if (location.hash === '#toolkit') loadFeatures();
  if (/^#share=/.test(location.hash)) loadFeatures().then(async m => { const t = await m.readShare(location.hash); const d = $('#shared'); d.querySelector('pre').textContent = t; d.showModal(); }).catch(() => toast('That share link is damaged.'));
}

function renderAll() { renderList(); renderDetail(); renderRank(); renderRadar(); renderHawkPicker(); }

/* ---------- boot ---------- */
(async function boot() {
  chrome(); setMode('jobs'); setStage(0);
  try {
    const want = Q.get('src') === 'sample' ? 'sample' : 'live';
    const liveP = want === 'live' ? fetchShortlist() : Promise.resolve(null);
    const [profile, sj] = await Promise.all(['profile.json', 'sample-jobs.json'].map(J));
    S.profile = profile; S.sampleJobs = sj.jobs.map(j => ({ ...j, company: j.company + ' (sample)' }));
    const skills = M.compileSkills(profile), ev = M.evidenceCorpus(profile); S.ctx = { profile, skills, ev, evIx: M.bm25Index(ev.map(e => e.text)), evVecs: null };
    const got = await liveP;
    if (got) { S.jobs = fromApi(got.d); S.src = 'live'; setChip(got.kind, got.d); } else { S.jobs = S.sampleJobs; S.src = 'sample'; setChip('sample'); if (want === 'live') $('#src-note').textContent = 'Live shortlist unavailable · showing sample data'; }
    $$('[data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === S.src)));
    modelUI(); await scoreAll(); renderAll(); setStage(1); pasteJD(); hawkUI(); forwardUI(); extrasUI();
    $('#job-list').addEventListener('click', e => { const b = e.target.closest('.job'); if (!b) return; S.sel = b.dataset.id; $$('.job', $('#job-list')).forEach(x => x.setAttribute('aria-selected', String(x === b))); renderDetail(); });
    $$('[data-src]').forEach(b => b.addEventListener('click', () => b.getAttribute('aria-pressed') !== 'true' && useSource(b.dataset.src)));
    ['#w-fit', '#w-fresh', '#w-sal', '#floor'].forEach(s => $(s).addEventListener('input', renderRank));
    const load = lazyMore(); $$('[data-mode-btn]').forEach(b => b.addEventListener('click', () => b.dataset.modeBtn === 'freelance' && load()));
    /* deep links: ?role=<id> opens that shortlisted role in AI Hawk; ?jd=<text> pre-fills a pasted vacancy (old Drop Net links land on #hawk) */
    const role = Q.get('role'), jd = Q.get('jd');
    if (role && S.jobs.some(j => j.id === role)) { S.sel = role; renderList(); renderDetail(); await openHawk(role, true); }
    else if (jd && jd.trim().length >= 40) { const j = await addPasted(jd.trim().slice(0, 6000)); renderAll(); await openHawk(j.id, true); }
    else if (location.hash === '#hawk') { const top = sorted()[0]; if (top) await openHawk(top.id, false); }
    document.documentElement.dataset.ready = '1';
  } catch (e) {
    console.warn('JobNet Application data failed to load', e);
    $('#job-detail').innerHTML = '<p>Couldn’t load the demo data. Please refresh.</p>';
  }
})();
