/* preview wave 3 AI — Recruiter Match: JD → requirements → fit per requirement with evidence links, honest gaps, tailored one-page CV.
   Uses ONLY data/ai/profile.json (facts from the site + two facts Katlego confirmed). Never inflates: gaps are shown as gaps. */
import { loadData, search, model, esc, norm } from './core.js';
const d = document;
export const SAMPLES = {
  dotnet: { title: 'Sample JD · AI Engineer (.NET), Johannesburg', text: `AI Engineer (.NET) — fintech scale-up, Johannesburg (hybrid)
We are looking for an engineer to build LLM features into our customer platform.
Requirements:
- 3+ years of professional software development experience
- Strong C# and ASP.NET Core; experience designing REST APIs
- Experience integrating LLMs (OpenAI, Gemini or similar) into production services
- Retrieval-augmented generation (RAG) and embeddings / vector search
- React and TypeScript for internal tools
- Linux, Docker and nginx; comfortable owning deployments
- Monitoring, rate limiting and secure handling of API keys
- Human-in-the-loop review for AI outputs
Nice to have:
- Python for data work (Pandas)
- CI/CD with GitHub Actions
- Azure experience
Location: Johannesburg, hybrid. Start: as soon as possible.` },
  cv: { title: 'Sample JD · Senior ML Engineer (Computer Vision)', text: `Senior Machine Learning Engineer — Computer Vision, Cape Town
Requirements:
- 6+ years building machine learning systems in production
- MSc or PhD in Computer Science, Statistics or a related field
- Deep expertise in PyTorch or TensorFlow
- Computer vision: object detection and image segmentation
- MLOps: training pipelines, model serving and monitoring on AWS (SageMaker)
- Kubernetes and Docker
- Python and SQL
- Spark or Databricks for large datasets
- Agile / Scrum team experience
Nice to have: Go or Rust for performance-critical services.
On-site in Cape Town.` }
};
const SOFT = /communicat|team ?player|collaborat|stakeholder|self-?starter|passion|attention to detail|problem[- ]solv|curious|ownership|fast[- ]paced|mentor|leadership|english/i;
const NOISE = /^(about (us|the role)|who we are|benefits|what we offer|we offer|perks|salary|remuneration|equal opportunit|apply|how to apply|closing date|requirements:?|nice to have:?|responsibilities:?|duties:?|the role:?)$/i;
const CUE = /experience|knowledge|proficien|familiar|understanding|strong|expert|ability|skill|degree|bachelor|master|msc|phd|qualif|years|must|required|requirement|plus|bonus|nice to have|preferred|comfortable|hands-on|background|exposure|build|design|develop|own|deploy|work with|using|located|location|remote|hybrid|on-?site|start|availab/i;
export function extract(jd) {
  const lines = String(jd).replace(/\r/g, '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  const out = []; let nice = false;
  lines.forEach((l, li) => {
    const bare = l.replace(/^\s*(?:[-*•·▪◦]|\d{1,2}[.)](?=\s))\s*/, '').trim();
    if (/^(nice|good) to have|^bonus|^preferred|^advantageous|^would be (nice|a plus)/i.test(bare)) { nice = true; const rest = bare.replace(/^[^:]*:\s*/, ''); if (rest && rest !== bare) push(rest, true); return; }
    if (/^(requirements|what you( will)? need|must have|minimum requirements|qualifications)\b/i.test(bare)) { nice = false; const rest = bare.replace(/^[^:]*:?\s*/, ''); if (rest.length > 8) push(rest, false); return; }
    if (NOISE.test(bare) || bare.length < 6) return;
    if (/^(we are|we're|we have|our (company|team|client)|join (us|our)|about (us|the company)|the company)\b/i.test(bare) && !/^[-*•·▪◦]/.test(l)) return;
    const bullet = /^[-*•·▪◦]|^\d+[.)]/.test(l);
    if (li === 0 && !bullet) { out.title = bare.slice(0, 90); return; }
    if (bullet || CUE.test(bare)) bare.split(/(?<=[.;])\s+(?=[A-Z])/).forEach(s => push(s, nice || /nice to have|a plus|bonus|advantage|preferred/i.test(s)));
  });
  function push(s, isNice) { s = s.replace(/[.;]$/, '').trim(); if (s.length >= 6 && !out.some(o => o.text === s)) out.push({ text: s, nice: isNice }); }
  return out.slice(0, 16);
}
const LV = { shipped: 1, listed: 0.7, partial: 0.45, gap: 0 };
function skillHits(text, P) { const t = norm(text); return P.skills.filter(s => s.aliases.some(a => new RegExp(a, 'i').test(t))); }
async function assess(req, P) {
  const t = norm(req.text), r = { ...req, skills: [], evidence: [], notes: [] };
  const yrs = t.match(/(\d+)\s*\+?\s*(?:-\s*\d+\s*)?(?:years|yrs)/);
  if (yrs) { const n = +yrs[1]; r.kind = 'years'; r.score = n <= P.years ? 1 : n === P.years + 1 ? 0.5 : 0.15; r.status = n <= P.years ? 'strong' : n === P.years + 1 ? 'partial' : 'gap';
    r.notes.push(`${P.years} years of experience vs ${n}+ asked.`); r.evidence.push(['Profile: ' + P.years + ' years (confirmed by Katlego)', '/contact/']); }
  if (/\b(degree|bachelor|bsc|b\.sc|msc|m\.sc|master|phd|doctorate|honours|diploma|qualification)\b/.test(t)) { r.kind = r.kind || 'education';
    const opt = /or equivalent|or related experience|or similar experience/.test(t);
    r.score = Math.min(r.score ?? 1, opt ? 0.5 : 0); r.status = opt ? 'partial' : 'gap'; r.notes.push(`Education on the site: “${P.education}” No degree is listed.` + (opt ? ' The ad accepts equivalent experience.' : '')); r.evidence.push(['Résumé: Education', '/resume/']); }
  const loc = t.match(/johannesburg|joburg|jhb|pretoria|pta|cape town|cpt|durban|dbn|remote|hybrid|on-?site|onsite|relocat|london|lagos|nairobi|berlin|new york|europe|usa|uk\b/g);
  if (loc && (/locat|based|office|remote|hybrid|on-?site|onsite|relocat/.test(t) || loc.length && t.length < 70)) {
    r.kind = r.kind || 'location'; const ok = loc.every(l => /johannesburg|joburg|jhb|pretoria|pta|cape town|cpt|durban|dbn|remote|hybrid|on-?site|onsite/.test(l));
    r.score = Math.min(r.score ?? 1, ok ? 1 : 0.3); r.status = ok ? 'strong' : 'partial'; r.notes.push(ok ? `Open to ${P.locations.join(', ')} · ${P.modes.join(', ')}.` : `The site lists ${P.locations.join(', ')} and remote; other locations aren’t listed.`); r.evidence.push(['Résumé: locations and work modes', '/resume/']); }
  if (/\b(start|availab|notice period|asap|as soon as possible|immediate)/.test(t)) { r.kind = r.kind || 'availability'; r.score = Math.min(r.score ?? 1, 1); r.status = r.status || 'strong'; r.notes.push(P.availability + ' (confirmed by Katlego).'); r.evidence.push(['Profile: availability', '/contact/']); }
  const hits = skillHits(req.text, P);
  if (hits.length) {
    r.skills = hits.map(h => ({ label: h.label, level: h.level, note: h.note }));
    const vals = hits.map(h => LV[h.level]);
    const anyOf = /\bor\b|\s\/\s|e\.g\.|such as|similar|\bany of\b|\beither\b/.test(t);
    const sk = anyOf ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
    r.score = r.score == null ? sk : Math.min(r.score, sk);
    hits.forEach(h => { h.evidence.slice(0, 2).forEach(e => r.evidence.push(e)); if (h.level === 'gap') r.notes.push(h.label + ': ' + h.note + '.'); else if (h.note) r.notes.push(h.label + ': ' + h.note + '.'); });
    r.status = r.score >= 0.8 ? 'strong' : r.score >= 0.4 ? 'partial' : 'gap';
    r.kind = r.kind || 'skill';
  }
  if (r.score == null) {
    if (SOFT.test(req.text)) { r.kind = 'soft'; r.status = 'info'; r.notes.push('A soft skill — not something the site can evidence. Ask in the interview.'); return r; }
    // semantic fallback over the site's own text (only counts as partial, never strong)
    const s = await search(req.text, { k: 2 });
    const top = s.results[0];
    if (top && (top.cos != null ? top.cos > 0.45 : top.cov >= 0.6 && top.bm > 2)) { r.kind = 'semantic'; r.score = 0.45; r.status = 'partial'; r.evidence.push([top.d.title + ' · ' + top.d.section, top.d.url]); r.notes.push('Related evidence found by meaning, not an exact skill match.'); }
    else { r.kind = 'unknown'; r.score = 0; r.status = 'gap'; r.notes.push('Not evidenced on the site.'); }
  }
  const seen = new Set(); r.evidence = r.evidence.filter(e => { const k = e[1] + e[0]; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
  return r;
}
export async function analyse(jd) {
  const D = await loadData(), P = D.profile, reqs = extract(jd);
  const rows = []; for (const q of reqs) rows.push(await assess(q, P));
  const scored = rows.filter(r => r.status !== 'info');
  const wsum = scored.reduce((a, r) => a + (r.nice ? 0.5 : 1), 0) || 1;
  const overall = Math.round(scored.reduce((a, r) => a + r.score * (r.nice ? 0.5 : 1), 0) / wsum * 100);
  return { title: reqs.title || 'This role', rows, overall, gaps: rows.filter(r => r.status === 'gap'), profile: P, mode: model.state === 'ready' ? 'semantic + rules' : 'rules + keyword' };
}
function rowHTML(r) {
  const lab = { strong: 'Strong', partial: 'Partial', gap: 'Gap', info: 'Not scored' }[r.status];
  return `<div class="mm-req" data-status="${r.status}"><span class="mm-st ${r.status}">${lab}</span><span class="q">${esc(r.text)}${r.nice ? ' <span class="mm-stat">(nice to have)</span>' : ''}</span>
    ${r.status !== 'info' ? `<span class="mm-bar" aria-hidden="true"><i style="transform:scaleX(${(r.score || 0).toFixed(2)})"></i></span>` : '<span></span>'}
    <span class="ev">${r.notes.map(esc).join(' ')}${r.evidence.length ? ' Evidence: ' + r.evidence.map(e => `<a href="${esc(e[1])}">${esc(e[0])}</a>`).join(' · ') : ''}</span></div>`;
}
export function render(host, res) {
  host.innerHTML = `<div class="mm-score"><div class="mm-ring" style="--p:${res.overall}" role="img" aria-label="Overall fit ${res.overall} percent"><b>${res.overall}<small>%</small></b></div>
    <div><p class="mm-kick">Fit for</p><h3 style="margin:.3rem 0;font:600 18px/1.25 var(--mm-disp)">${esc(res.title)}</h3><p class="mm-note">${res.rows.length} requirements · ${res.rows.filter(r => r.status === 'strong').length} strong · ${res.rows.filter(r => r.status === 'partial').length} partial · ${res.gaps.length} gaps · ${esc(res.mode)} · on device</p></div></div>
    <div class="mm-reqs">${res.rows.map(rowHTML).join('')}</div>
    ${res.gaps.length ? `<div class="mm-gaps"><strong>Honest gaps</strong> — not claimed anywhere on the site:<ul>${res.gaps.map(g => `<li>${esc(g.text)}</li>`).join('')}</ul></div>` : ''}
    <div class="mm-row" style="margin-top:14px"><button type="button" class="mm-btn pri" data-mm-cv>Tailored one-page CV</button><a class="mm-btn" href="/contact/">Contact Katlego</a></div>
    <p class="mm-note" style="margin-top:10px">Scores weigh “nice to have” items at half. Strong = used in a documented project; Partial = listed on the résumé or adjacent evidence; Gap = not on the site.</p>`;
  host.querySelector('[data-mm-cv]').addEventListener('click', () => cv(res));
}
/* ---------- tailored, printable CV (real facts only, reordered for relevance) ---------- */
export function cv(res) {
  const P = res.profile, hitKeys = new Set();
  res.rows.forEach(r => (r.skills || []).forEach(s => { const k = P.skills.find(x => x.label === s.label); if (k && k.level !== 'gap') hitKeys.add(k.key); }));
  const projects = P.projects.map(p => ({ p, n: p.skills.filter(s => hitKeys.has(s)).length })).sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.p);
  const matchedLabels = P.skills.filter(s => hitKeys.has(s.key)).map(s => s.label);
  const stackHit = s => { const n = norm(s); return P.skills.some(k => hitKeys.has(k.key) && k.aliases.some(a => new RegExp(a, 'i').test(n))); };
  const summary = `${P.title} with ${P.years} years of experience. ${P.summary}` + (matchedLabels.length ? ` Most relevant here: ${matchedLabels.slice(0, 6).join(', ')}.` : '');
  let wrap = d.querySelector('.mm-cvwrap');
  if (!wrap) { wrap = d.createElement('div'); wrap.className = 'mm-cvwrap mm-ai'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Tailored CV'); d.body.appendChild(wrap); }
  wrap.hidden = false; d.body.style.overflow = 'hidden';
  wrap.innerHTML = `<div class="mm-cvbar"><button type="button" class="mm-btn pri" data-print>Print / Save as PDF</button><button type="button" class="mm-btn" data-close>Close</button></div>
  <article class="mm-cv" aria-label="Tailored CV for ${esc(res.title)}"><h1>${esc(P.name)}</h1><p class="role">${esc(P.title)}</p>
    <p class="contact">${esc(P.phone)} · ${esc(P.email)} · ${esc(P.web)} · ${esc(P.linkedin)}<br>Johannesburg, South Africa · Open to ${esc(P.locations.join(', '))} · ${esc(P.modes.join(' / '))} · ${esc(P.availability)}</p>
    <h2>Summary</h2><p>${esc(summary)}</p>
    <h2>Selected systems</h2>${projects.map(p => `<div class="proj"><b>${esc(p.name)}</b> — ${esc(p.tag)} · <a href="https://mensmercatus.online${esc(p.url)}">mensmercatus.online${esc(p.url)}</a><ul>${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`).join('')}
    <h2>Technical stack</h2><div class="tags">${Object.entries(P.stack).flatMap(([k, v]) => v.split(/,\s*/).map(x => `<span class="${stackHit(x) ? 'hit' : ''}">${esc(x)}</span>`)).join('')}</div>
    <h2>Experience</h2>${P.experience.map(e => `<div class="proj"><b>${esc(e.role)}</b> — ${esc(e.org)} · ${esc(e.when)}<ul>${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`).join('')}
    <h2>Education</h2><p>${esc(P.education)}</p>
    <p class="fine">Tailored on this device for “${esc(res.title)}”. Only facts published on mensmercatus.online (and the experience and availability Katlego confirmed) are used; nothing was added. Highlighted stack items match the job description.</p></article>`;
  const close = () => { wrap.hidden = true; d.body.style.overflow = ''; d.body.classList.remove('mm-printing'); };
  wrap.querySelector('[data-close]').addEventListener('click', close);
  wrap.querySelector('[data-print]').addEventListener('click', () => { d.body.classList.add('mm-printing'); window.print(); setTimeout(() => d.body.classList.remove('mm-printing'), 500); });
  wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  wrap.querySelector('[data-print]').focus();
  return wrap;
}
export function mount(host) {
  host.innerHTML = `<div class="mm-match"><div><label for="mm-jd" class="mm-kick" style="display:block;margin-bottom:8px">Paste a job description</label>
    <textarea id="mm-jd" class="mm-ta" placeholder="Paste the full ad — requirements, location, start date…" style="min-height:300px"></textarea>
    <div class="mm-row" style="margin-top:10px"><button type="button" class="mm-btn pri" data-go>Analyse fit</button><button type="button" class="mm-btn sm" data-s="dotnet">Sample: AI Engineer (.NET)</button><button type="button" class="mm-btn sm" data-s="cv">Sample: ML Engineer (CV)</button></div>
    <p class="mm-note" style="margin-top:10px"><span class="mm-badge">Runs on your device · private</span> The job description never leaves this page.</p></div>
    <div class="mm-card" data-out aria-live="polite"><p class="mm-note">Results appear here: a fit score per requirement, the project or skill that backs it (with a link), and the gaps — flagged, not hidden.</p></div></div>`;
  const ta = host.querySelector('textarea'), out = host.querySelector('[data-out]');
  host.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { ta.value = SAMPLES[b.dataset.s].text; go(); }));
  const go = async () => { if (!ta.value.trim()) { ta.focus(); return; } out.innerHTML = '<span class="mm-typing" aria-label="Analysing"><i></i><i></i><i></i></span>'; const r = await analyse(ta.value); render(out, r); host.__last = r; };
  host.querySelector('[data-go]').addEventListener('click', go);
}
