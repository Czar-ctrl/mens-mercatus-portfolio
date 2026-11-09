/* JobNet AI — on-device ML core. Pure functions + a lazy, self-hosted sentence-embedding model.
   Nothing here talks to a third-party server. Everything degrades to BM25/keyword mode. */
export const CFG = Object.assign({
  transformers: '/js/ai/vendor/transformers/transformers.min.js', modelPath: '/models/', wasm: '/js/ai/vendor/ort/',
  modelId: 'Xenova/all-MiniLM-L6-v2', liveApi: 'https://api.mensmercatus.online/jobnet'
}, (typeof window !== 'undefined' && window.JOBNET_CFG) || {});

/* ---------- text ---------- */
const STOP = new Set(('a an the and or of to in on for with by at from is are was were be been it its this that these those as do does has have had you your we our us they them their i me my ' +
  'will can could would should may must not no any all also just only more most very there here than then so such into over about per via plus strong good great new role team work').split(' '));
export const norm = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/c#/g, ' csharp ').replace(/asp\.net/g, ' aspnet dotnet ')
  .replace(/\.net\b/g, ' dotnet ').replace(/node\.js/g, ' nodejs ').replace(/next\.js/g, ' nextjs ').replace(/[’']/g, '');
export function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
export const toks = t => (norm(t).match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w) && w.length > 1).map(stem);
export const sentences = t => String(t || '').replace(/\s+/g, ' ').split(/(?<=[.!?;:])\s+|\n+/).map(s => s.trim()).filter(s => s.split(' ').length >= 3);
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const sigmoid = z => 1 / (1 + Math.exp(-z));

/* ---------- BM25 ---------- */
export function bm25Index(texts) {
  const docs = texts.map(t => { const tk = toks(t); return { tk, tf: tk.reduce((m, w) => m.set(w, (m.get(w) || 0) + 1), new Map()) }; });
  const df = new Map(); let tot = 0; docs.forEach(d => { tot += d.tk.length; new Set(d.tk).forEach(w => df.set(w, (df.get(w) || 0) + 1)); });
  return { docs, df, N: docs.length, avg: tot / Math.max(1, docs.length) };
}
export function bm25(ix, query) {
  const k1 = 1.3, b = 0.72, out = new Float32Array(ix.N);
  [...new Set(toks(query))].forEach(w => {
    const n = ix.df.get(w); if (!n) return; const idf = Math.log(1 + (ix.N - n + 0.5) / (n + 0.5));
    ix.docs.forEach((d, i) => { const f = d.tf.get(w); if (f) out[i] += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.tk.length / ix.avg)); });
  });
  return out;
}

/* ---------- embeddings (lazy, self-hosted) ---------- */
export const model = { state: 'idle', error: null };
let embP = null; const listeners = new Set();
export const onModel = f => (listeners.add(f), () => listeners.delete(f));
const emit = () => listeners.forEach(f => f({ ...model }));
/* MiniLM runs in a module worker so the 23 MB model load and every embedding batch stay off the main thread.
   If workers are unavailable it falls back to the original main-thread path. */
function workerBackend() {
  return new Promise((res, rej) => {
    let w; try { w = new Worker(new URL('./embed-worker.js?v=jna1', import.meta.url), { type: 'module' }); } catch (e) { rej(e); return; }
    let n = 0; const wait = new Map();
    w.onmessage = ({ data }) => { const p = wait.get(data.id); if (!p) return; wait.delete(data.id); data.error ? p.rej(new Error(data.error)) : p.res(data); };
    w.onerror = e => { e.preventDefault && e.preventDefault(); const err = new Error(e.message || 'worker error'); wait.forEach(p => p.rej(err)); wait.clear(); rej(err); };
    const call = msg => new Promise((r2, j2) => { const id = ++n; wait.set(id, { res: r2, rej: j2 }); w.postMessage({ ...msg, id }); });
    call({ cmd: 'init', cfg: { transformers: new URL(CFG.transformers, location.href).href, modelPath: CFG.modelPath, wasm: CFG.wasm, modelId: CFG.modelId } })
      .then(() => res(async texts => { const r = await call({ cmd: 'embed', texts }); return texts.map((_, k) => r.data.subarray(k * r.dim, (k + 1) * r.dim)); }), e => { w.terminate(); rej(e); });
  });
}
async function mainThreadBackend() {
  const T = await import(CFG.transformers);
  T.env.allowRemoteModels = false; T.env.allowLocalModels = true; T.env.localModelPath = CFG.modelPath; T.env.useBrowserCache = true;
  const w = T.env.backends.onnx.wasm; w.wasmPaths = CFG.wasm; w.numThreads = 1; w.proxy = false;
  const ex = await T.pipeline('feature-extraction', CFG.modelId, { dtype: 'q8', device: 'wasm' });
  return async texts => { const t = await ex(texts, { pooling: 'mean', normalize: true }); const d = t.dims[t.dims.length - 1]; return texts.map((_, k) => t.data.slice(k * d, (k + 1) * d)); };
}
export function loadEmbedder() {
  if (embP) return embP;
  model.state = 'loading'; emit();
  embP = (async () => {
    let run; try { run = await workerBackend(); model.backend = 'worker'; } catch (e) { run = await mainThreadBackend(); model.backend = 'main'; }
    const cache = new Map();
    const f = async texts => {
      const need = [...new Set(texts.filter(t => !cache.has(t)))];
      for (let i = 0; i < need.length; i += 32) { const chunk = need.slice(i, i + 32); const vs = await run(chunk); chunk.forEach((s, k) => cache.set(s, vs[k])); }
      return texts.map(t => cache.get(t));
    };
    model.state = 'ready'; emit(); return f;
  })().catch(e => { model.state = 'failed'; model.error = String(e && e.message || e); emit(); return null; });
  return embP;
}
export const embed = async texts => (model.state === 'ready' ? (await embP)(texts) : null);
export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/* ---------- profile / skills ---------- */
export const LEVEL_W = { shipped: 1, partial: 0.6, listed: 0.45, gap: 0 };
export function compileSkills(profile) {
  return profile.skills.map(s => ({ ...s, re: s.aliases.map(a => { try { return new RegExp(a, 'i'); } catch { return new RegExp(a.replace(/\(\?[!=<][^)]*\)/g, ''), 'i'); } }) }));
}
export function detectSkills(text, skills) {
  const t = ' ' + String(text || '').toLowerCase() + ' ';
  return skills.filter(s => s.re.some(r => r.test(t))).map(s => s.key);
}
export function evidenceCorpus(profile) {
  const ev = [];
  ev.push({ text: profile.summary, src: 'Summary', url: '/resume/' });
  profile.projects.forEach(p => p.bullets.forEach(b => ev.push({ text: b, src: p.name, url: p.url })));
  profile.experience.forEach(x => x.bullets.forEach(b => ev.push({ text: b, src: x.role, url: '/resume/' })));
  Object.entries(profile.stack).forEach(([k, v]) => ev.push({ text: `${k}: ${v}.`, src: 'Stack', url: '/resume/' }));
  profile.skills.filter(s => s.level !== 'gap').forEach(s => s.evidence.forEach(([t, u]) => ev.push({ text: t, src: s.label, url: u })));
  return ev;
}

/* ---------- explainable job ↔ profile fit ---------- */
export function logisticsFit(job, profile) {
  const loc = norm(job.location || ''), mode = norm(job.mode || '');
  const city = /remote/.test(loc) || profile.locations.some(c => loc.includes(norm(c))) || /south africa|gauteng|western cape|kwazulu/.test(loc);
  const m = !mode || profile.modes.some(x => mode.includes(norm(x)));
  return { score: (city ? 0.6 : 0.15) + (m ? 0.4 : 0), city, mode: m };
}
/* ctx: { profile, skills, ev, evIx, evVecs? } */
export async function fitJob(job, ctx) {
  const text = `${job.title}. ${job.text || job.why || ''}`;
  const req = detectSkills(text, ctx.skills); const byKey = Object.fromEntries(ctx.skills.map(s => [s.key, s]));
  const items = req.map(k => ({ key: k, label: byKey[k].label, level: byKey[k].level, w: LEVEL_W[byKey[k].level], evidence: byKey[k].evidence, note: byKey[k].note }));
  const skillScore = items.length ? items.reduce((a, b) => a + b.w, 0) / items.length : 0.5;
  const sents = sentences(text).slice(0, 12); if (!sents.length) sents.push(text);
  let sem = 0, mode = 'keyword', pairs = [];
  const vecs = ctx.evVecs ? await embed(sents) : null;
  if (vecs) {
    mode = 'semantic';
    pairs = sents.map((s, i) => { let best = -1, bi = 0; ctx.evVecs.forEach((v, j) => { const c = dot(vecs[i], v); if (c > best) { best = c; bi = j; } }); return { s, ev: ctx.ev[bi], sim: best, n: clamp((best - 0.15) / 0.45) }; });
  } else {
    pairs = sents.map(s => { const sc = bm25(ctx.evIx, s); let best = 0, bi = 0; sc.forEach((x, j) => { if (x > best) { best = x; bi = j; } }); return { s, ev: ctx.ev[bi], sim: best, n: best / (best + 4) }; });
  }
  sem = pairs.reduce((a, p) => a + p.n, 0) / pairs.length;
  const log = logisticsFit(job, ctx.profile);
  const fit = 0.5 * skillScore + 0.35 * sem + 0.15 * log.score;
  return {
    fit: Math.round(fit * 100), mode, parts: { skills: skillScore, semantic: sem, logistics: log.score }, log,
    matched: items.filter(i => i.level === 'shipped'), partial: items.filter(i => i.level === 'partial' || i.level === 'listed'), gaps: items.filter(i => i.level === 'gap'),
    pairs: pairs.sort((a, b) => b.n - a.n), req
  };
}

/* ---------- prioritiser ---------- */
export const freshness = days => Math.pow(0.5, Math.max(0, days || 0) / 5);           // half-life 5 days
export function salarySignal(salary, floor) {                                          // R/month
  if (!salary) return { v: 0.7, why: 'not disclosed' };
  const mid = (salary[0] + salary[1]) / 2; const v = sigmoid((mid - floor) / (0.12 * floor));
  return { v: 0.15 + 0.85 * v, why: `mid R${Math.round(mid / 1000)}k vs floor R${Math.round(floor / 1000)}k` };
}
export function priority(fit, days, salary, floor, wts = { fit: 1, fresh: 1, sal: 1 }) {
  const f = clamp(fit / 100, 0.01), fr = freshness(days), s = salarySignal(salary, floor);
  const score = Math.pow(f, wts.fit) * Math.pow(fr, wts.fresh) * Math.pow(s.v, wts.sal);
  return { score, f, fr, s };
}

/* ---------- skill-gap radar ---------- */
export const AXES = [
  ['AI / LLM', ['llm', 'gemini', 'openai', 'agents', 'rag', 'embeddings', 'langchain', 'chromadb', 'ollama', 'hitl']],
  ['ML / Data', ['ml', 'pandas', 'pytorch', 'cv', 'mlops', 'data', 'spark', 'ondevice']],
  ['.NET / C#', ['csharp', 'dotnet', 'sqlserver']],
  ['Frontend', ['typescript', 'javascript', 'react', 'nextjs', 'vite', 'tailwind', 'angular', 'flutter', 'webaudio']],
  ['Backend / APIs', ['api', 'websockets', 'node', 'fastapi', 'redis', 'sql', 'microservices', 'java', 'go', 'python']],
  ['Cloud / DevOps', ['docker', 'kubernetes', 'linux', 'systemd', 'nginx', 'cloudflare', 'cicd', 'aws', 'azure', 'gcp']],
  ['Quality / Process', ['testing', 'git', 'agile', 'monitoring', 'security']],
  ['Automation', ['automation', 'scraping', 'pipelines', 'ortools']],
];
export const LEARN = {
  azure: ['AZ-204 (Azure Developer) path', 'Redeploy Mercatus Assist\'s ASP.NET Core API to Azure App Service with Key Vault'],
  aws: ['AWS Cloud Practitioner → Developer Associate', 'Run the JobNet scorer as a Lambda behind API Gateway'],
  gcp: ['Google Cloud Digital Leader → Associate Cloud Engineer', 'Move the Gemini calls behind Vertex AI'],
  cicd: ['GitHub Actions fundamentals', 'Add a CI pipeline that runs the existing headless test suites on every push'],
  sqlserver: ['EF Core + SQL Server Learn module', 'Back the application tracker with EF Core migrations'],
  pytorch: ['fast.ai Practical Deep Learning (PyTorch)', 'Fine-tune a small classifier for reply triage and compare it with Naive Bayes'],
  cv: ['OpenCV + YOLO quick-start', 'Add till-slip line-item detection to the OCR demo'],
  java: ['Spring Boot guides', 'Port one minimal API endpoint to Spring Boot for comparison'],
  go: ['Tour of Go', 'Write the health-check exporter in Go'],
  angular: ['Angular tutorial (Tour of Heroes)', 'Rebuild the pipeline dashboard in Angular'],
  spark: ['Databricks Community Edition notebook course', 'Batch-score a month of listings with PySpark'],
  agile: ['Scrum.org PSM I reading list', 'Run a two-week sprint board for the next client build'],
  microservices: ['Microsoft .NET microservices e-book', 'Split scrape / tailor / notify into separate services'],
  kubernetes: ['CKAD curriculum', 'Run the JobNet demo API on k3s with a health probe'],
  testing: ['xUnit + Playwright', 'Publish the headless test reports next to each case study'],
  mlops: ['Made With ML (MLOps)', 'Version the outcome model and track its metrics per nightly retrain'],
  ml: ['Andrew Ng ML Specialisation', 'Ship the outcome model with calibration plots'],
  docker: ['Docker docs: get started', 'Containerise the JobNet API'],
  git: ['Pro Git (chapters 1–3)', 'Make one project repo public with a clean history'],
  redis: ['Redis University RU101', 'Cache listing embeddings in Redis'],
  sql: ['PostgreSQL tutorial', 'Store pipeline events in Postgres'],
  openai: ['OpenAI API quick-start', 'Add a provider switch next to Gemini'],
};
export function radar(jobs, skills) {
  const byKey = Object.fromEntries(skills.map(s => [s.key, s])); const freq = {};
  jobs.forEach(j => new Set(j.req || []).forEach(k => freq[k] = (freq[k] || 0) + 1));
  const axes = AXES.map(([name, keys]) => {
    const strength = keys.reduce((a, k) => a + (LEVEL_W[byKey[k]?.level] ?? 0), 0) / keys.length;
    const demand = keys.reduce((a, k) => a + (freq[k] || 0), 0);
    return { name, strength, demand };
  });
  const mx = Math.max(1, ...axes.map(a => a.demand)); axes.forEach(a => a.demandN = a.demand / mx);
  const gaps = Object.entries(freq).map(([k, n]) => ({ key: k, label: byKey[k]?.label || k, n, level: byKey[k]?.level || 'gap', w: LEVEL_W[byKey[k]?.level] ?? 0 }))
    .filter(g => g.w < 1).map(g => ({ ...g, pri: g.n / Math.max(1, jobs.length) * (1 - g.w), learn: LEARN[g.key] || null })).sort((a, b) => b.pri - a.pri);
  return { axes, gaps };
}

/* ---------- logistic regression (outcome model) ---------- */
export function lrPredict(m, x) {
  const contrib = m.features.map((f, i) => ({ f, label: m.feature_labels[f], c: m.weights[i] * (x[f] ? 1 : 0), w: m.weights[i] }));
  const z = m.bias + contrib.reduce((a, b) => a + b.c, 0);
  return { p: sigmoid(z), z, contrib };
}

/* ---------- multinomial Naive Bayes (reply classifier) ---------- */
export function nbTrain(corpus) {
  const classes = Object.keys(corpus), vocab = new Set(), cnt = {}, tot = {}, prior = {}; let N = 0;
  classes.forEach(c => { cnt[c] = new Map(); tot[c] = 0; prior[c] = corpus[c].length; N += corpus[c].length;
    corpus[c].forEach(d => feats(d).forEach(w => { vocab.add(w); cnt[c].set(w, (cnt[c].get(w) || 0) + 1); tot[c]++; })); });
  classes.forEach(c => prior[c] = Math.log(prior[c] / N));
  return { classes, vocab, cnt, tot, prior, V: vocab.size };
}
function feats(t) { const w = toks(t); const bi = []; for (let i = 0; i < w.length - 1; i++) bi.push(w[i] + '_' + w[i + 1]); return w.concat(bi); }
export function nbPredict(m, text) {
  const f = feats(text).filter(w => m.vocab.has(w)); const lp = {}, why = {};
  m.classes.forEach(c => { lp[c] = m.prior[c]; why[c] = []; f.forEach(w => { const l = Math.log(((m.cnt[c].get(w) || 0) + 1) / (m.tot[c] + m.V)); lp[c] += l; why[c].push([w, l]); }); });
  const mx = Math.max(...Object.values(lp)); let s = 0; const p = {}; m.classes.forEach(c => { p[c] = Math.exp(lp[c] - mx); s += p[c]; }); m.classes.forEach(c => p[c] /= s);
  const top = m.classes.reduce((a, b) => p[a] >= p[b] ? a : b);
  const others = m.classes.filter(c => c !== top);
  const cues = [...new Set(f)].map(w => { const lt = Math.log(((m.cnt[top].get(w) || 0) + 1) / (m.tot[top] + m.V)); const lo = Math.max(...others.map(c => Math.log(((m.cnt[c].get(w) || 0) + 1) / (m.tot[c] + m.V)))); return [w.replace('_', ' '), lt - lo]; })
    .filter(x => x[1] > 0.3).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
  return { p, top, cues, known: f.length };
}
export async function centroidProbs(corpus, text) {
  const cls = Object.keys(corpus); const all = cls.flatMap(c => corpus[c]); const v = await embed([text, ...all]); if (!v) return null;
  let k = 1; const out = {}; cls.forEach(c => { const vs = v.slice(k, k + corpus[c].length); k += corpus[c].length;
    const sims = vs.map(x => dot(v[0], x)).sort((a, b) => b - a).slice(0, 3); out[c] = sims.reduce((a, b) => a + b, 0) / sims.length; });
  const mx = Math.max(...Object.values(out)); let s = 0; cls.forEach(c => { out[c] = Math.exp((out[c] - mx) * 12); s += out[c]; }); cls.forEach(c => out[c] /= s); return out;
}

/* ---------- freelance lead scoring ---------- */
export const SERVICES = [
  { key: 'chat', name: 'WhatsApp / web FAQ assistant', re: /same (whatsapp )?questions|faq|answer(s|ing)? the same|enquir|whatsapp/i, desc: 'Answer repeat customer questions with an LLM agent grounded in your own price list and policies; staff approve anything unusual.' },
  { key: 'docs', name: 'Document & invoice extraction', re: /pdf|invoice|delivery note|forms?\b|retype|copy (patient|data)|data entry|contracts?/i, desc: 'Pull fields out of PDFs, invoices and forms into your system, with a human check before anything is saved.' },
  { key: 'sched', name: 'Booking & scheduling agent', re: /book(ing|s)?|schedul|viewings?|appointments?|routing/i, desc: 'Turn chat requests into calendar bookings and reminders.' },
  { key: 'summ', name: 'Private summarise & search (local LLM)', re: /summari[sz]e|search (old|past)|confidential|own server|on-?prem/i, desc: 'Local, on-premise LLM summaries and semantic search; data never leaves your server.' },
  { key: 'integ', name: '.NET / API integration', re: /\.net|erp|\bapi\b|crm|spreadsheet/i, desc: 'Connect the agent to your existing ERP/CRM through its API (C# / .NET or Python).' },
  { key: 'write', name: 'Content drafting with approval', re: /write .*descriptions?|from scratch|copy ?writing|listing descriptions?/i, desc: 'Draft listings, emails and quotes for a person to approve and send.' },
  { key: 'collect', name: 'Payment-chase automation', re: /unpaid|chase|overdue|debtors?/i, desc: 'Polite, scheduled reminders drafted for approval; escalations flagged.' },
];
const BUDGET = { '<R10k': 0.1, 'R15k-R40k': 0.6, 'R30k-R50k': 0.85, 'R50k+': 1 };
export function scoreLead(lead) {
  const t = lead.text || ''; const hits = SERVICES.filter(s => s.re.test(t));
  const manual = (t.match(/manual|by hand|retype|copy|same|all day|chase|lose time|from scratch/gi) || []).length;
  const pain = clamp(manual / 3), fitS = clamp(hits.length / 3), bud = BUDGET[lead.budget] ?? 0.4;
  const size = clamp(Math.log2(Math.max(1, lead.size || 1)) / 5.5), dig = clamp((lead.digital || 2) / 5);
  const score = 0.32 * fitS + 0.24 * pain + 0.22 * bud + 0.12 * size + 0.10 * dig;
  return { score: Math.round(score * 100), hits, parts: { fit: fitS, pain, budget: bud, size, digital: dig }, manual };
}
