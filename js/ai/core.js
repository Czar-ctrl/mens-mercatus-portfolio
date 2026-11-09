/* preview wave 3 AI — shared core: data, BM25, on-device embeddings (transformers.js, self-hosted), hybrid search, grounded answers.
   Nothing here talks to a third-party server. Generative mode (config.js) is off by default. */
const CFG = window.MM_AI_CONFIG || { base: '/', model: { id: 'Xenova/all-MiniLM-L6-v2', path: '/models/', wasm: '/js/ai/vendor/ort/' }, generative: { enabled: false } };
const B = CFG.base || '/';
export const cfg = CFG;
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- text ---------- */
const STOP = new Set(('a an the and or of to in on for with by at from is are was were be been being it its this that these those as do does did doing has have had ' +
  'he his him himself she her they them their you your yours i me my we our us what which who whom whose how when where why can could would should will shall may might must ' +
  'about into over than then so such not no any all also just only more most very there here katlego mokoto mokotos s t get got tell show me please give site page ' +
  'know does work works working use used using one some like').split(' '));
const SYN = { music: ['audio', 'sound', 'studio', 'beat', 'producer'], beats: ['beat', 'drum'], cv: ['resume'], résumé: ['resume'], salary: ['salary'], hire: ['available', 'hire'],
  hiring: ['available', 'hire'], remote: ['remote', 'hybrid'], location: ['johannesburg', 'remote'], based: ['johannesburg'], key: ['key'], down: ['fallback', 'unhealthy'],
  csharp: ['csharp', 'dotnet'], dotnet: ['dotnet', 'aspnet'], ai: ['ai', 'model'], experience: ['experience', 'year'], email: ['email', 'contact'], phone: ['phone', 'contact'] };
export function norm(t) {
  return String(t).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/c#/g, ' csharp ').replace(/asp\.net/g, ' aspnet dotnet ')
    .replace(/\.net\b/g, ' dotnet ').replace(/node\.js/g, ' nodejs ').replace(/next\.js/g, ' nextjs ').replace(/[’']/g, '');
}
export function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
export function toks(t, keepStop) { return (norm(t).match(/[a-z0-9]+/g) || []).filter(w => keepStop || !STOP.has(w)).map(stem); }
function qtoks(q) { const base = toks(q); const ex = []; base.forEach(w => (SYN[w] || []).forEach(s => ex.push(stem(s)))); return { base: [...new Set(base)], all: [...new Set(base.concat(ex))] }; }
export function sentences(t) { return String(t).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/).map(s => s.trim()).filter(s => s.split(' ').length >= 4); }

/* ---------- data ---------- */
let dataP = null;
export function loadData() {
  if (dataP) return dataP;
  const j = u => fetch(B + u + '?v=m1', { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  dataP = Promise.all([j('data/ai/kb.json'), j('data/ai/search-index.json'), j('data/ai/kb-emb.json').catch(() => null), j('data/ai/profile.json')]).then(([kb, idx, emb, profile]) => {
    const docs = kb.chunks.map(c => ({ ...c, _t: toks(c.title + ' ' + c.section + ' ' + c.section + ' ' + c.text) }));
    const items = idx.items.map(i => ({ ...i, _t: toks(i.title + ' ' + i.title + ' ' + (i.desc || '') + ' ' + (i.keywords || '')) }));
    const bm = buildBM25(docs), bmi = buildBM25(items);
    let vecs = null, ivecs = null;
    if (emb && emb.vecs) {
      const dec = ([s, b64]) => { const bin = atob(b64), v = new Float32Array(bin.length); for (let k = 0; k < bin.length; k++) { let x = bin.charCodeAt(k); if (x > 127) x -= 256; v[k] = x * s; } return v; };
      const all = emb.vecs.map(dec); vecs = all.slice(0, emb.kb); ivecs = all.slice(emb.kb);
    }
    return { docs, items, bm, bmi, vecs, ivecs, profile, built: kb.built };
  });
  return dataP;
}
function buildBM25(docs) {
  const df = new Map(); let total = 0;
  docs.forEach(d => { total += d._t.length; new Set(d._t).forEach(w => df.set(w, (df.get(w) || 0) + 1)); d._tf = d._t.reduce((m, w) => (m.set(w, (m.get(w) || 0) + 1), m), new Map()); });
  return { df, N: docs.length, avg: total / Math.max(1, docs.length), docs };
}
function bm25(ix, terms) {
  const k1 = 1.3, b = 0.72, out = new Float32Array(ix.N);
  terms.forEach(w => {
    const n = ix.df.get(w); if (!n) return; const idf = Math.log(1 + (ix.N - n + 0.5) / (n + 0.5));
    ix.docs.forEach((d, i) => { const f = d._tf.get(w); if (f) out[i] += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d._t.length / ix.avg)); });
  });
  return out;
}

/* ---------- on-device embeddings (lazy) ---------- */
export const model = { state: 'idle', error: null };
let embP = null;
const emit = () => window.dispatchEvent(new CustomEvent('mm-ai-model', { detail: { ...model } }));
export function embedder() {
  if (embP) return embP;
  model.state = 'loading'; emit();
  embP = (async () => {
    const T = await import(B + 'js/ai/vendor/transformers/transformers.min.js');
    T.env.allowRemoteModels = false; T.env.allowLocalModels = true; T.env.localModelPath = CFG.model.path; T.env.useBrowserCache = true;
    const w = T.env.backends.onnx.wasm; w.wasmPaths = CFG.model.wasm; w.numThreads = 1; w.proxy = false;
    if (T.env.backends.onnx.logLevel !== undefined) T.env.backends.onnx.logLevel = 'error';
    const ex = await T.pipeline('feature-extraction', CFG.model.id, { dtype: CFG.model.dtype || 'q8', device: 'wasm' });
    model.state = 'ready'; emit();
    return async texts => { const t = await ex(texts, { pooling: 'mean', normalize: true }); const d = t.dims[t.dims.length - 1], n = texts.length, out = []; for (let i = 0; i < n; i++) out.push(t.data.slice(i * d, (i + 1) * d)); return out; };
  })().catch(e => { model.state = 'failed'; model.error = String(e && e.message || e); emit(); embP = Promise.resolve(null); return null; });
  return embP;
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
async function qvec(q, wait) {
  if (model.state === 'failed' || window.MM_AI_FORCE_KEYWORD) return null;
  if (model.state !== 'ready' && !wait) { embedder(); return null; }
  const f = await embedder(); if (!f) return null; return (await f([q]))[0];
}

/* ---------- hybrid search ---------- */
export async function search(q, opt = {}) {
  const D = await loadData(); const { base, all } = qtoks(q);
  const pool = opt.pool === 'items' ? 'items' : 'kb';
  const ix = pool === 'items' ? D.bmi : D.bm, list = pool === 'items' ? D.items : D.docs, V = pool === 'items' ? D.ivecs : D.vecs;
  const s = bm25(ix, all); let mx = 0; s.forEach(x => { if (x > mx) mx = x; });
  const v = V ? await qvec(q, opt.wait) : null;
  const res = list.map((d, i) => {
    const cov = base.length ? base.filter(w => d._tf.has(w)).length / base.length : 0;
    const bmN = mx ? s[i] / mx : 0, cos = v ? dot(v, V[i]) : null;
    const score = cos == null ? bmN * 0.75 + cov * 0.25 : 0.55 * Math.max(0, Math.min(1, (cos - 0.12) / 0.5)) + 0.3 * bmN + 0.15 * cov;
    return { d, i, bm: s[i], bmN, cos, cov, score };
  }).sort((a, b) => b.score - a.score);
  const top = res[0];
  const strong = !top ? false : top.cos != null ? (top.cos >= 0.42 || (top.cos >= 0.3 && top.cov >= 0.5)) : (top.cov >= 0.6 && top.bm > 1.6) || (top.cov >= 0.5 && base.length >= 3 && top.bm > 2.5);
  return { q, mode: v ? 'semantic' : 'keyword', terms: base, results: res.slice(0, opt.k || 8), strong, top };
}

/* ---------- grounded answers ---------- */
const NO = "I don't have that on the site.";
function cites(list) { const m = new Map(); list.forEach(c => { const k = c.url + '|' + c.section; if (!m.has(k)) m.set(k, { n: m.size + 1, url: c.url, title: c.title, section: c.section }); }); return m; }
function profileAnswer(q, D) {
  const t = norm(q), P = D.profile, pc = D.docs.find(d => d.kind === 'profile'), rc = D.docs.find(d => d.url === '/resume/' && /Johannesburg|remote/i.test(d.text)) || pc;
  const cc = D.docs.find(d => d.url === '/contact/' && d.kind !== 'profile') || pc;
  if (/salar|\brate\b|rates|how much|pay\b|package|ctc|remunerat|visa|citizen|age\b|how old|married|religio|politic/.test(t))
    return { refused: true, html: `<p>${NO} Things like pay, visas or personal details aren't published, so I won't guess.</p><p>You can ask Katlego directly: <a href="mailto:${P.email}">${P.email}</a> or ${P.phone}.</p>`, citations: [], book: true };
  const out = [];
  if (/availab|start|notice|when can|free to|open to work|looking for/.test(t)) out.push([`${P.availability}.`, pc]);
  if (/where|based|locat|relocat|remote|hybrid|on-?site|cape town|durban|pretoria|johannesburg|jhb|cpt|dbn|pta|office/.test(t)) out.push([`Based in Johannesburg and open to ${P.locations.join(', ')}, ${P.modes.join(', ')}.`, rc]);
  if (/how many years|years of|experience level|how long|how experienced|seniority|junior|senior/.test(t)) out.push([`${P.years} years of experience.`, pc]);
  if (/contact|email|phone|call|reach|whatsapp|get in touch|book/.test(t) && !/call (completions?|the api|gemini|a model)/.test(t)) out.push([`Phone or WhatsApp ${P.phone}, email ${P.email}.`, cc]);
  if (/degree|qualif|studied|education|university|matric|certif/.test(t)) out.push([`Education: ${P.education}`, D.docs.find(d => /Education/i.test(d.section)) || rc]);
  if (!out.length) return null;
  const m = cites(out.map(o => o[1]));
  return { html: '<p>' + out.map(([s, c]) => esc(s) + ` <a class="mm-cite" href="${c.url}" aria-label="Source ${m.get(c.url + '|' + c.section).n}">${m.get(c.url + '|' + c.section).n}</a>`).join(' ') + '</p>', citations: [...m.values()], book: /contact|call|book|reach/.test(t) };
}
export async function answer(q, opt = {}) {
  const t0 = performance.now(); const D = await loadData();
  const pa = profileAnswer(q, D);
  if (pa && pa.refused) return { ...pa, mode: 'policy', ms: Math.round(performance.now() - t0) };
  const r = await search(q, { k: 8, wait: opt.wait });
  if (!r.strong && !pa) {
    const near = r.results.filter(x => (x.cos != null ? x.cos > 0.3 : x.cov > 0.4)).slice(0, 2);
    return { refused: true, mode: r.mode, ms: Math.round(performance.now() - t0), citations: [],
      html: `<p>${NO}</p>` + (near.length ? `<p class="mm-note">Closest pages, in case they help: ${near.map(n => `<a href="${n.d.url}">${esc(n.d.title)} · ${esc(n.d.section)}</a>`).join(' · ')}</p>` : '<p class="mm-note">Try asking about his projects, stack, availability or how the systems are built.</p>') };
  }
  // extractive: score sentences from the top chunks against the question
  const hits = r.results.slice(0, 5).filter((h, i) => i === 0 || h.score > r.results[0].score * 0.55);
  const qs = new Set(qtoks(q).all);
  let cand = [];
  const frag = s => !/^[A-Z0-9“"(‘'£$R€]/.test(s) || s.split(/\s+/).length < 5;
  hits.forEach((h, rank) => sentences(h.d.text).filter(s => !frag(s)).forEach(s => { const st = new Set(toks(s)); let ov = 0; qs.forEach(w => { if (st.has(w)) ov++; }); cand.push({ s, h, rank, ov: qs.size ? ov / qs.size : 0 }); }));
  if (r.mode === 'semantic' && cand.length) {
    const f = await embedder(); if (f) { const vs = await f(cand.slice(0, 40).map(c => c.s)); const qv = (await f([q]))[0]; vs.forEach((v, i) => { cand[i].cos = dot(v, qv); }); }
  }
  const techQ = /\bnpm\b|\.env|install|setup|run it|command/i.test(q);
  cand.forEach(c => { c.sc = 0.45 * c.ov + 0.35 * (c.cos != null ? Math.max(0, (c.cos - 0.1) / 0.6) : c.h.bmN) + 0.2 * (1 - c.rank / 5);
    if (/^\/case-studies\/[a-z]/.test(c.h.d.url)) c.sc += 0.06; // primary sources first
    if (!techQ && /\bnpm\b|\.env\b|[A-Z_]{6,}=|`/.test(c.s)) c.sc -= 0.2; }); // setup instructions rarely answer a question
  cand.sort((a, b) => b.sc - a.sc);
  const pick = [], per = new Map();
  for (const c of cand) {
    if (pick.length >= 3) break; if ((per.get(c.h.i) || 0) >= 2) continue;
    const ct = toks(c.s).join(' '); if (pick.some(p => { const pt = toks(p.s).join(' '); return pt === ct || pt.includes(ct) || ct.includes(pt); })) continue;
    if (c.sc < 0.18 && pick.length) continue;
    pick.push(c); per.set(c.h.i, (per.get(c.h.i) || 0) + 1);
  }
  const cm = cites((pa ? pa.citations.map(c => ({ url: c.url, section: c.section, title: c.title })) : []).concat(pick.map(p => p.h.d)));
  const ref = d => cm.get(d.url + '|' + d.section).n;
  let html = pa ? pa.html : '';
  if (pick.length) html += (pa ? '<p>From the site:</p>' : '') + (pick.length > 1 ? '<ul>' + pick.map(p => `<li>${esc(p.s)} <a class="mm-cite" href="${p.h.d.url}" aria-label="Source ${ref(p.h.d)}">${ref(p.h.d)}</a></li>`).join('') + '</ul>'
    : `<p>${esc(pick[0].s)} <a class="mm-cite" href="${pick[0].h.d.url}" aria-label="Source ${ref(pick[0].h.d)}">${ref(pick[0].h.d)}</a></p>`);
  let out = { html, citations: [...cm.values()], mode: r.mode, ms: Math.round(performance.now() - t0), book: pa && pa.book, chunks: hits.map(h => h.d) };
  if (CFG.generative && CFG.generative.enabled && CFG.generative.endpoint && !opt.noGen) {
    try { const g = await generate(q, hits.map(h => h.d)); if (g) out = { ...out, html: g, mode: 'generative · ' + CFG.generative.provider }; } catch (e) { out.genError = String(e.message || e); }
  }
  return out;
}
async function generate(q, chunks) {
  const G = CFG.generative, ctx = chunks.map((c, i) => `[${i + 1}] ${c.title} — ${c.section}: ${c.text}`).join('\n');
  const sys = 'You answer questions about Katlego Mokoto using ONLY the numbered context. Cite every sentence with [n]. If the context does not contain the answer, reply exactly: "' + NO + '"';
  const msgs = [{ role: 'system', content: sys }, { role: 'user', content: 'Context:\n' + ctx + '\n\nQuestion: ' + q }];
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), G.timeoutMs || 20000);
  const body = G.provider === 'ollama' ? { model: G.model, messages: msgs, stream: false, options: { temperature: 0.1 } } : { model: G.model, messages: msgs, temperature: 0.1 };
  const r = await fetch(G.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal }); clearTimeout(to);
  const j = await r.json(); const txt = G.provider === 'ollama' ? j.message && j.message.content : j.choices && j.choices[0].message.content;
  if (!txt || !/\[\d+\]/.test(txt) && txt.trim() !== NO) return null; // uncited output is discarded
  return '<p>' + esc(txt).replace(/\[(\d+)\]/g, (m, n) => chunks[n - 1] ? `<a class="mm-cite" href="${chunks[n - 1].url}">${n}</a>` : '') + '</p>';
}
export function sourcesHTML(c) {
  if (!c || !c.length) return '';
  return '<div class="mm-srcs"><b>Sources</b>' + c.map(s => `<a href="${s.url}"><span>[${s.n}]</span>${esc(s.title)} · ${esc(s.section)}</a>`).join('') + '</div>';
}
export function toast(html, ms = 3200) {
  let t = document.querySelector('.mm-toast'); if (t) t.remove();
  t = document.createElement('div'); t.className = 'mm-toast mm-ai'; t.setAttribute('role', 'status'); t.innerHTML = html; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
