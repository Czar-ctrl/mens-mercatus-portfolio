/* JobNet Application — Toolkit (15 features). Code-split; loads when you scroll near it or press Ctrl/⌘+K.
   Everything runs on this device. Data that isn't live is labelled. Nothing here games screeners: the ATS check only
   REPORTS readability and keyword coverage; it never adds hidden text or keywords. */
import * as G from './gh.js?v=jna1';
const A = window.JobNetApp; const { S, M } = A; const api = A.api;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SAST = { timeZone: 'Africa/Johannesburg' };
const job = () => api.current();
const draftText = () => ($('#hawk-out') && !$('#hawk-out').hidden ? $('#hawk-out').value : '');
const words = t => (String(t).match(/[A-Za-z][A-Za-z'’-]*/g) || []);
const syll = w => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return m ? m.length : 1; };

/* 1 · ATS readability + keyword coverage (report only) */
export function ats(draft, vacancy, skills) {
  const req = M.detectSkills(vacancy, skills), have = M.detectSkills(draft, skills);
  const covered = req.filter(k => have.includes(k)), missing = req.filter(k => !have.includes(k));
  const W = words(draft), sents = (draft.match(/[^.!?\n]+[.!?]/g) || []).length || 1, syl = W.reduce((a, w) => a + syll(w), 0);
  const fre = W.length ? Math.round(206.835 - 1.015 * (W.length / sents) - 84.6 * (syl / W.length)) : 0;
  const placeholders = (draft.match(/\[[^\]]+\]/g) || []).length, odd = (draft.match(/[\u2500-\u257F\u25A0-\u25FF]/g) || []).length;
  return { req: req.length, covered: covered.map(k => skills.find(s => s.key === k).label), missing: missing.map(k => skills.find(s => s.key === k).label), words: W.length, avgSentence: Math.round(W.length / sents), fre, placeholders, odd };
}
/* 2 · salary hint from the vacancy text only */
export function salary(text) {
  const t = String(text || ''); const re = /(?:R|ZAR)\s?(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?\s?[kK])(?:\s?(?:-|–|to)\s?(?:R|ZAR)?\s?(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?\s?[kK]))?(?:\s*(?:per|p\/|\/)\s*(month|annum|year|hour|pm|pa|m|y|h))?/i;
  const m = re.exec(t); if (!m) return null; const n = v => { if (!v) return null; v = v.replace(/[ ,]/g, ''); return /k$/i.test(v) ? parseFloat(v) * 1000 : +v; };
  const per = (m[3] || (/(per annum|annually|p\.a\.|ctc)/i.test(t) ? 'annum' : /(per month|monthly|p\.m\.)/i.test(t) ? 'month' : '')).toLowerCase();
  return { lo: n(m[1]), hi: n(m[2]), per: /^(m|pm|month)$/.test(per) ? 'month' : /^(y|pa|annum|year)$/.test(per) ? 'year' : /^(h|hour)$/.test(per) ? 'hour' : 'unstated', quote: m[0].trim() };
}
/* 3 · interview prep from the vacancy */
export function questions(j, r) {
  const Q = []; r.matched.slice(0, 3).forEach(m => Q.push(`Walk me through something you shipped that used ${m.label}. What would you change now?`));
  r.gaps.slice(0, 2).forEach(g => Q.push(`The role uses ${g.label}. How would you get productive with it in your first month?`));
  M.sentences(j.text || '').filter(s => /\b(you will|responsib|build|own|lead|design|maintain|support)\b/i.test(s)).slice(0, 3).forEach(s => Q.push(`Tell me about a time you had to: “${s.replace(/^[-•\s]+/, '').slice(0, 140)}”`));
  Q.push('How do you keep a human in the loop before an AI system takes an irreversible action?', `Why ${j.company && !/pasted|sample/i.test(j.company) ? j.company.replace(/\s*\(sample\)/, '') : 'this team'}, and why now?`);
  return Q.slice(0, 8);
}
/* 4 · follow-up planner (+3 working days check, +7 nudge, +14 close) */
export function plan(sentISO) {
  const add = (d, n) => { const x = new Date(d); let k = 0; while (k < n) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) k++; } return x; };
  const d0 = new Date(sentISO + 'T09:00:00+02:00'); return [['Check for a reply', add(d0, 3)], ['Polite nudge (one only)', add(d0, 7)], ['Close it out / move on', add(d0, 14)]];
}
export function ics(title, steps) {
  const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JobNet Application//EN', ...steps.flatMap(([n, d], i) => ['BEGIN:VEVENT', `UID:jobnet-${Date.now()}-${i}@mensmercatus.online`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(d)}`, `DURATION:PT15M`, `SUMMARY:${(n + ' · ' + title).replace(/[,;\\]/g, ' ').slice(0, 120)}`, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
}
/* 5 · duplicate-role detector */
export function dupes(jobs) {
  const tok = j => new Set(M.toks(`${j.title} ${j.company}`)); const out = [];
  for (let i = 0; i < jobs.length; i++) for (let k = i + 1; k < jobs.length; k++) { const a = tok(jobs[i]), b = tok(jobs[k]); const inter = [...a].filter(x => b.has(x)).length, uni = new Set([...a, ...b]).size; const s = uni ? inter / uni : 0; if (s >= 0.6) out.push([jobs[i], jobs[k], s]); }
  return out.sort((x, y) => y[2] - x[2]).slice(0, 8);
}
/* 7 · tone slider (wording only; never adds facts) */
const TONES = { formal: [[/^Dear \[Hiring manager name\],/m, 'Dear Sir or Madam,'], [/I'm applying for/, 'I am writing to apply for'], [/I haven't/, 'I have not'], [/I'd close/, 'I would close'], [/^Kind regards,/m, 'Yours faithfully,']],
  warm: [[/I'm applying for/, "I'd love to be considered for"], [/^Kind regards,/m, 'Warm regards,'], [/To be upfront:/, 'In the spirit of honesty:']] };
export function tone(text, t) { if (!TONES[t]) return text; return TONES[t].reduce((s, [a, b]) => s.replace(a, b), text); }
/* 11 · shareable read-only link (client-side; the text lives only in the URL fragment, never sent to a server) */
const b64u = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function pipe(u8, T) { const s = new Blob([u8]).stream().pipeThrough(new T('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); }
export async function shareLink(text) { const u8 = new TextEncoder().encode(text); const z = 'CompressionStream' in window ? 'z' + b64u(await pipe(u8, CompressionStream)) : 'p' + b64u(u8); return location.origin + location.pathname + '#share=' + z; }
export async function readShare(h) { const v = h.replace(/^#share=/, ''); const u8 = unb64u(v.slice(1)); return new TextDecoder().decode(v[0] === 'z' ? await pipe(u8, DecompressionStream) : u8); }
/* 15 · per-role fit radar (skill groups this role asks for vs evidenced) */
function radarSVG(r) {
  const ax = M.AXES.map(([name, keys]) => { const asked = r.req.filter(k => keys.includes(k)); const lvl = asked.map(k => M.LEVEL_W[(S.ctx.skills.find(s => s.key === k) || {}).level] || 0); return { name, asked: asked.length ? 1 : 0, have: asked.length ? lvl.reduce((a, b) => a + b, 0) / asked.length : 0 }; });
  const n = ax.length, c = 120, R = 86, pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; }, poly = v => v.map((x, i) => pt(i, Math.max(.05, x)).map(z => z.toFixed(1)).join(',')).join(' ');
  return `<svg viewBox="-60 -10 360 260" role="img" aria-label="Fit radar for this role"><polygon points="${poly(ax.map(() => 1))}" fill="none" stroke="var(--line2)"/><polygon points="${poly(ax.map(() => .5))}" fill="none" stroke="var(--line)"/>
    <polygon points="${poly(ax.map(a => a.asked))}" fill="rgba(122,162,255,.12)" stroke="var(--blue)"/><polygon points="${poly(ax.map(a => a.have))}" fill="var(--red-soft)" stroke="var(--red-ink)" stroke-width="2"/>
    ${ax.map((a, i) => { const [x, y] = pt(i, 1.2); return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-size="10" fill="var(--muted)" text-anchor="${Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end'}" dominant-baseline="middle">${esc(a.name)}</text>`; }).join('')}</svg>`;
}
/* 6 · application timeline tracker (this browser only) */
const TL = 'jn.timeline.v1', STEPS = ['Drafted', 'Reviewed', 'Sent by me', 'Reply', 'Interview', 'Offer / closed'];
const tlGet = () => { try { return JSON.parse(localStorage.getItem(TL) || '{}'); } catch { return {}; } };
const fmt = iso => new Date(iso).toLocaleString('en-ZA', { ...SAST, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' SAST';

function card(id, n, title, body, tag = '') { return `<article class="card tk" id="tk-${id}"><h3><span class="tk-n">${n}</span> ${esc(title)} ${tag}</h3>${body}</article>`; }
export function render() {
  const box = $('#toolkit-grid'); if (!box) return; const j = job(); if (!j) { box.innerHTML = '<p class="hint">Pick a role first.</p>'; return; }
  const r = S.fits.get(j.id), d = draftText(), a = d ? ats(d, j.title + ' ' + (j.text || ''), S.ctx.skills) : null, sal = salary(j.text), tl = tlGet()[j.id] || {}, dup = dupes(S.jobs), today = new Date().toLocaleDateString('en-CA', SAST);
  $('#tk-role').textContent = `${j.title} · ${j.company}`;
  box.innerHTML = [
    card('ats', 1, 'ATS readability check', a ? `<p>Keyword coverage: <b>${a.covered.length}/${a.req}</b> of the skills this vacancy asks for appear in your draft.${a.missing.length ? ` Not mentioned: ${esc(a.missing.join(', '))} — add them only if they're true.` : ''}</p><p>Reading ease ${a.fre} (Flesch; 50–70 is plain business English) · ${a.words} words · ${a.avgSentence} words per sentence · ${a.placeholders} placeholder${a.placeholders === 1 ? '' : 's'} left${a.odd ? ` · ${a.odd} box-drawing characters (remove them before pasting into an ATS form)` : ''}.</p><p class="hint">Reports only. No hidden text, no keyword stuffing.</p>` : '<p class="hint">Generate an AI Hawk draft to check it.</p>'),
    card('salary', 2, 'Salary hint', sal ? `<p><b>${sal.lo ? 'R' + sal.lo.toLocaleString('en-ZA') : ''}${sal.hi ? ' – R' + sal.hi.toLocaleString('en-ZA') : ''}</b> ${sal.per === 'unstated' ? '(period not stated)' : 'per ' + sal.per}</p><p class="hint">From the vacancy text: “${esc(sal.quote)}”.</p>` : '<p>The vacancy text doesn\'t state pay. No estimate is made.</p>'),
    card('prep', 3, 'Interview prep', `<ol class="tk-q">${questions(j, r).map(q => `<li>${esc(q)}</li>`).join('')}</ol><p class="hint">Built from this vacancy and the match result.</p>`),
    card('follow', 4, 'Follow-up planner', `<label class="lbl" for="tk-sent">I sent it on</label><input type="date" id="tk-sent" value="${today}"><ul class="tk-plan" id="tk-plan"></ul><button class="btn ghost small" type="button" id="tk-ics"><span>Add to calendar (.ics)</span></button>`),
    card('dupes', 5, 'Duplicate-role detector', dup.length ? `<ul>${dup.map(([x, y, s]) => `<li>${esc(x.title)} · ${esc(x.company)} ≈ ${esc(y.title)} · ${esc(y.company)} <small>(${Math.round(s * 100)}% same words)</small></li>`).join('')}</ul>` : `<p>No near-duplicates among ${S.jobs.length} roles.</p>`),
    card('timeline', 6, 'Application timeline', `<div class="tk-tl">${STEPS.map(s => `<button type="button" class="chip ${tl[s] ? 's' : ''}" data-tl="${esc(s)}" aria-pressed="${!!tl[s]}">${esc(s)}${tl[s] ? ' · ' + fmt(tl[s]) : ''}</button>`).join('')}</div><p class="hint">Stored only in this browser. <button type="button" class="linkish" id="tk-tl-clear">Clear for this role</button></p>`),
    card('tone', 7, 'Cover-note tone', `<label class="lbl" for="tk-tone">Formal · Neutral · Warm</label><input type="range" id="tk-tone" min="0" max="2" step="1" value="1"><p class="hint">Changes wording only (greeting, phrasing, sign-off). It never adds claims.</p>`),
    card('pdf', 8, 'Export the draft as PDF', `<p>Prints only the draft, in a clean layout. Choose “Save as PDF” in the print dialog.</p><button class="btn ghost small" type="button" id="tk-pdf" ${d ? '' : 'disabled'}><span>Save draft as PDF</span></button>`),
    card('palette', 9, 'Command palette', '<p>Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> anywhere to jump to a section or run an action.</p><button class="btn ghost small" type="button" id="tk-pal"><span>Open palette</span></button>'),
    card('offline', 10, 'Offline cache', `<p id="tk-off">${'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'On. The app shell and the last shortlist you loaded open without a connection.' : 'Starting… reload once to use it offline.') : 'Not supported in this browser.'}</p><p class="hint">Cached in this browser only.</p>`),
    card('share', 11, 'Read-only share link', `<p>Packs the draft into the link itself (after the #), so nothing is uploaded. Anyone with the link can read it.</p><button class="btn ghost small" type="button" id="tk-share" ${d ? '' : 'disabled'}><span>Copy share link</span></button>`),
    card('stack', 12, 'Company stack fingerprint', `<div class="row"><label class="sr" for="tk-org">GitHub org</label><input id="tk-org" value="${esc(G.orgGuess(j.company))}" placeholder="github org"><button class="btn ghost small" type="button" id="tk-org-go"><span>Fingerprint</span></button></div><div id="tk-org-out"><p class="hint">Public GitHub repos only. The org name is a guess from the company name; check it's the right one.</p></div>`, '<span class="tag">LIVE · GitHub</span>'),
    card('ai', 13, 'AI/ML repos for this vacancy', `<p>Topics: <b>${esc(G.topicsFor(j.title + ' ' + (j.text || '')).join(', ') || 'none detected')}</b></p><button class="btn ghost small" type="button" id="tk-ai-go"><span>Find top public repos</span></button><div id="tk-ai-out"></div>`, '<span class="tag">LIVE · GitHub</span>'),
    card('mine', 14, 'Cite my own repos', `<div class="row"><label class="sr" for="tk-user">GitHub username</label><input id="tk-user" value="${esc(G.CFG.user)}" placeholder="GitHub username (not published)"><button class="btn ghost small" type="button" id="tk-mine-go"><span>Find relevant repos</span></button></div><div id="tk-mine-out"></div>`, '<span class="tag">LIVE · GitHub</span>'),
    card('radar', 15, 'Fit radar for this role', radarSVG(r) + '<div class="legend"><span class="lg demand"></span>Asked for <span class="lg strength"></span>Evidenced</div>')
  ].join('') + `<p class="hint tk-q2" id="tk-quota">${esc(G.quotaText())}</p>`;
  wire(j, r);
}
function wire(j, r) {
  const planUI = () => { const st = plan($('#tk-sent').value || new Date().toLocaleDateString('en-CA', SAST)); $('#tk-plan').innerHTML = st.map(([n, d]) => `<li><b>${d.toLocaleDateString('en-ZA', { ...SAST, weekday: 'short', day: 'numeric', month: 'short' })}</b> ${esc(n)}</li>`).join(''); return st; };
  planUI(); $('#tk-sent').addEventListener('change', planUI);
  $('#tk-ics').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics(j.title, planUI())], { type: 'text/calendar' })); a.download = 'jobnet-follow-up.ics'; a.click(); });
  $$('[data-tl]').forEach(b => b.addEventListener('click', () => { const all = tlGet(); const m = all[j.id] || (all[j.id] = {}); if (m[b.dataset.tl]) delete m[b.dataset.tl]; else m[b.dataset.tl] = new Date().toISOString(); localStorage.setItem(TL, JSON.stringify(all)); render(); $('#tk-timeline').scrollIntoView({ block: 'nearest' }); }));
  $('#tk-tl-clear').addEventListener('click', () => { const all = tlGet(); delete all[j.id]; localStorage.setItem(TL, JSON.stringify(all)); render(); });
  $('#tk-tone').addEventListener('input', e => { if (!S.hawk) return; const base = S.hawk.base || (S.hawk.base = $('#hawk-out').value); $('#hawk-out').value = tone(base, ['formal', 'neutral', 'warm'][+e.target.value]); S.hawk.text = $('#hawk-out').value; });
  $('#tk-pdf').addEventListener('click', printDraft);
  $('#tk-pal').addEventListener('click', palette);
  $('#tk-share').addEventListener('click', async () => { const u = await shareLink($('#hawk-out').value); try { await navigator.clipboard.writeText(u); api.toast(`Share link copied (${u.length} characters). Nothing was uploaded.`); } catch { prompt('Copy this link', u); } });
  const gh = async (btn, out, fn) => { $(btn).addEventListener('click', async () => { $(out).innerHTML = '<p class="hint">Asking GitHub…</p>'; try { $(out).innerHTML = await fn(); } catch (e) { $(out).innerHTML = `<p class="hint">${esc(e.message)}</p>`; } $('#tk-quota').textContent = G.quotaText(); }); };
  gh('#tk-org-go', '#tk-org-out', async () => { const o = await G.orgRepos($('#tk-org').value.trim()); const ev = new Set(S.ctx.skills.filter(s => s.level !== 'gap').map(s => s.label.toLowerCase()));
    return `<ul class="jv-bars tk-bars">${o.langs.slice(0, 6).map(([l, n]) => `<li><span>${esc(l)}${ev.has(l.toLowerCase()) ? ' ✓' : ''}</span><i style="--s:${(n / o.langs[0][1]).toFixed(3)}"></i><b>${n}</b></li>`).join('') || '<li>No languages listed.</li>'}</ul><p class="hint">${o.repos.length} public repos · ✓ = also in Katlego's evidenced skills · <a href="https://github.com/${esc(o.org)}" target="_blank" rel="noopener noreferrer">github.com/${esc(o.org)}</a>${o.cached ? ' · cached' : ''}</p>`; });
  gh('#tk-ai-go', '#tk-ai-out', async () => { const x = await G.aiRepos(j.title + ' ' + (j.text || '')); if (!x.repos.length) return `<p class="hint">${esc(x.note || 'Nothing found.')}</p>`;
    return `<ul>${x.repos.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.full)}</a> <small>★ ${p.stars.toLocaleString('en-ZA')} · #${esc(p.topic)}</small></li>`).join('')}</ul><p class="hint">GitHub search, most-starred first. Mention one only if you've actually used it.</p>`; });
  gh('#tk-mine-go', '#tk-mine-out', async () => { const u = $('#tk-user').value.trim(); if (u) G.setUser(u); const { repos } = await G.userRepos(); const rel = G.relevant(repos, j.title + ' ' + (j.text || ''), S.ctx.skills); A.rel = rel;
    if (!rel.length) return `<p class="hint">${repos.length} public repos, none matching this vacancy's skills by name, description or topics.</p>`;
    setTimeout(() => $('#tk-cite') && $('#tk-cite').addEventListener('click', async () => { if (!S.hawk || S.hawk.job.id !== j.id) await api.openHawk(j.id, false); api.appendSources(rel.map(x => `${x.name} (GitHub) · ${x.url}`)); api.toast('Repo links added to the draft sources.'); }));
    return `<ul>${rel.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a> <small>${esc(x.hits.join(', '))}</small></li>`).join('')}</ul><button class="btn ghost small" type="button" id="tk-cite"><span>Add to draft sources</span></button>`; });
}
export function printDraft() { const t = $('#hawk-out').value; if (!t) return; let p = $('#print-draft'); if (!p) { p = document.createElement('pre'); p.id = 'print-draft'; document.body.appendChild(p); } p.textContent = t; document.documentElement.classList.add('printing-draft'); addEventListener('afterprint', () => document.documentElement.classList.remove('printing-draft'), { once: true }); print(); }
/* 9 · command palette */
const ACTIONS = () => [['Shortlist & match', () => location.hash = '#match'], ['AI Hawk draft for the selected role', () => { const j = job(); j && api.openHawk(j.id); }], ['Review & forward', () => location.hash = '#handoff'],
  ['Forward the selected role by email', () => { const j = job(); j && api.openForward('role', j.id); }], ['Toolkit', () => location.hash = '#toolkit'], ['JARVIS mode', () => api.openJarvis()], ['Load the semantic model', () => $('#load-model').click()],
  ['Save the draft as PDF', printDraft], ['Prioritiser', () => location.hash = '#prioritise'], ['Skill radar', () => location.hash = '#radar'], ['Outcome model', () => location.hash = '#outcome'], ['Pipeline dashboard', () => location.hash = '#pipeline'], ...(api.owner ? [['Bulk batch (owner)', () => api.openOwner()]] : [])];
export function palette() {
  let d = $('#jn-pal'); if (!d) { d = document.createElement('dialog'); d.id = 'jn-pal'; d.className = 'fwd pal'; d.setAttribute('aria-label', 'Command palette'); d.innerHTML = '<input id="pal-in" placeholder="Type to filter…" aria-label="Filter commands" autocomplete="off"><ul id="pal-list" role="listbox"></ul>'; document.body.appendChild(d);
    const L = () => { const q = $('#pal-in').value.toLowerCase(); const items = ACTIONS().filter(([n]) => n.toLowerCase().includes(q)); $('#pal-list').innerHTML = items.map(([n], i) => `<li role="option" tabindex="-1" aria-selected="${i === 0}" data-i="${i}">${esc(n)}</li>`).join(''); d._items = items; };
    $('#pal-in').addEventListener('input', L); d._L = L;
    d.addEventListener('keydown', e => { const lis = $$('#pal-list li'); let i = lis.findIndex(x => x.getAttribute('aria-selected') === 'true');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); i = (i + (e.key === 'ArrowDown' ? 1 : -1) + lis.length) % lis.length; lis.forEach((x, k) => x.setAttribute('aria-selected', String(k === i))); lis[i] && lis[i].scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter') { e.preventDefault(); const it = d._items[Math.max(0, i)]; d.close(); it && it[1](); } });
    $('#pal-list').addEventListener('click', e => { const li = e.target.closest('li'); if (!li) return; d.close(); d._items[+li.dataset.i][1](); }); }
  $('#pal-in').value = ''; d._L(); d.showModal(); $('#pal-in').focus();
}
export function init() {
  render(); document.addEventListener('jn:change', () => render());
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) navigator.serviceWorker.register('/apps/jobnet/sw.js?v=jna1', { scope: '/apps/jobnet/' }).catch(() => { const e = $('#tk-off'); if (e) e.textContent = 'Could not start the offline cache in this browser.'; });
}
