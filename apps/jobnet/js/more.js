/* JobNet Application — deferred sections 05–08 (code-split from app.js; loaded when you scroll near them).
   Outcome model, inbox reply classifier, freelance-lead mode, pipeline dashboard. All on-device, sample data labelled. */
let M, S, $, $$, esc, pct, col, toast, J, RM;
/* ---------- 05 outcome model ---------- */
function renderOutcome() {
  const m = S.om; const fs = $('#feat');
  if (!fs.dataset.built) {
    fs.insertAdjacentHTML('beforeend', m.features.map(f => `<label class="tog"><span>${esc(m.feature_labels[f])}</span><input type="checkbox" data-f="${f}" ${f === 'family_ai' ? 'checked' : ''}></label>`).join(''));
    fs.addEventListener('change', renderOutcome); fs.dataset.built = 1;
    const x = m.metrics, real = m.provenance === 'real';
    $('#model-prov').innerHTML = `<h3>Provenance <span class="tag ${real ? 'ok' : 'warn'}">${real ? 'real · anonymised' : 'sample'}</span></h3><p style="margin:0">${esc(m.label)}</p>
      <dl><dt>Applications (n)</dt><dd>${x.n}</dd><dt>Positive outcomes</dt><dd>${x.positives}</dd><dt>Leave-one-out accuracy</dt><dd>${pct(x.loo_accuracy)}%</dd><dt>Always-“no” baseline</dt><dd>${pct(x.majority_baseline_accuracy)}%</dd><dt>LOO AUC</dt><dd>${x.loo_auc == null ? 'n/a' : x.loo_auc.toFixed(2)}</dd><dt>Brier (model / baseline)</dt><dd>${x.loo_brier} / ${x.baseline_brier}</dd></dl>
      <p><b>Honest read:</b> ${x.loo_accuracy <= x.majority_baseline_accuracy ? 'with this little data the model does not beat the baseline yet. It is shown for transparency and gets retrained as the pipeline grows.' : 'beats the baseline on held-out data, but the sample is small.'} ${esc(m.caveat)}</p>`;
    $('#prov-model').innerHTML = `Outcome model: ${real ? `<b>real</b>, anonymised (n=${x.n}); only coefficients are shipped` : '<b>sample</b> synthetic data'}.`;
  }
  const x = Object.fromEntries($$('input[data-f]', fs).map(i => [i.dataset.f, i.checked]));
  const r = M.lrPredict(m, x); $('#prob').textContent = pct(r.p) + '%';
  const mx = Math.max(...m.weights.map(Math.abs), .01);
  $('#contrib').innerHTML = r.contrib.map(c => { const w = Math.abs(c.w) / mx * 50; return `<div class="cb ${c.c ? '' : 'off'}"><span>${esc(c.label)} <b style="color:${c.w >= 0 ? 'var(--ok)' : 'var(--red-ink)'}">${c.w >= 0 ? '+' : '−'}${Math.abs(c.w).toFixed(2)}</b></span><span class="t"><i style="left:${c.w >= 0 ? 50 : 50 - w}%;width:${w}%;background:${c.w >= 0 ? 'var(--ok)' : 'var(--red)'}"></i></span></div>`; }).join('')
    + `<p class="hint" style="margin:6px 0 0">Bias ${m.bias.toFixed(2)} · log-odds ${r.z.toFixed(2)} · faded rows are switched off.</p>`;
}

/* ---------- 06 reply classifier ---------- */
const LAB = { interview: 'Interview', reject: 'Rejection', ack: 'Acknowledgement' };
async function classify(text) {
  const nb = M.nbPredict(S.nb, text); let p = nb.p, mode = 'Naive Bayes';
  if (M.model.state === 'ready') { const c = await M.centroidProbs(S.emails.train, text); if (c) { p = {}; Object.keys(nb.p).forEach(k => p[k] = .5 * nb.p[k] + .5 * c[k]); mode = 'NB + embeddings'; } }
  const top = Object.keys(p).reduce((a, b) => p[a] >= p[b] ? a : b); return { p, top, cues: nb.cues, mode };
}
async function renderReplies() {
  const out = []; for (const e of S.emails.emails) { const r = await classify(e.subject + '. ' + e.body); out.push(`<li data-label="${r.top}"><b>${esc(e.subject)}</b><span class="lab ${r.top}">${LAB[r.top]} · ${pct(r.p[r.top])}%</span><p>${esc(e.body)}</p><span class="cues">cues: ${esc(r.cues.join(', ') || '(weak)')} · ${r.mode}</span></li>`); }
  $('#mail').innerHTML = out.join('');
}
function replyBox() {
  let t; const run = async () => { const v = $('#reply-in').value.trim(); if (v.length < 12) { $('#reply-out').innerHTML = '<p class="hint">Type or paste a reply (12+ characters).</p>'; return; }
    const r = await classify(v);
    $('#reply-out').innerHTML = `<p><span class="lab ${r.top}">${LAB[r.top]}</span> <span class="hint">${r.mode}</span></p><div class="pbars">${Object.keys(LAB).map(k => `<div class="barrow"><span>${LAB[k]}</span><span class="bar-t"><i style="--s:${r.p[k].toFixed(3)}"></i></span><b>${pct(r.p[k])}</b></div>`).join('')}</div><p class="hint">Cues: ${esc(r.cues.join(', ') || 'none strong')}. In the real pipeline this only labels the thread and notifies Katlego; it never replies.</p>`; };
  $('#reply-in').addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 220); }); run();
}

/* ---------- 07 freelance leads ---------- */
function leadDraft(l, s) {
  const svc = s.hits[0];
  return `DRAFT · not sent. A person reviews it first.\n\nHi ${l.name.replace(/\s*\(sample\)/, '')} team,\n\nI build small, supervised AI tools for businesses like yours. From what you described, ${svc ? svc.desc.charAt(0).toLowerCase() + svc.desc.slice(1) : 'there may be a repetitive task worth automating.'}\n\nEverything I ship keeps a human approval step before anything is sent or saved, and keys stay on the server. I'd suggest a two-week pilot on one workflow, measured before and after.\n\nKatlego Mokoto · mensmercatus.online`;
}
function leadCard(l, s) {
  const bar = (n, v) => `<div class="barrow"><span>${n}</span><span class="bar-t"><i style="--s:${v.toFixed(3)}"></i></span><b>${pct(v)}</b></div>`;
  return `<article class="card lead"><h3><span>${esc(l.name)}</span><span class="big" style="color:${col(s.score)}">${s.score}</span></h3><p>${esc(l.sector || '')}${l.size ? ' · ' + l.size + ' staff' : ''}${l.budget ? ' · budget ' + esc(l.budget) : ''}</p><p>${esc(l.text)}</p>
    <div class="bars">${bar('Service fit', s.parts.fit)}${bar('Manual pain', s.parts.pain)}${bar('Budget', s.parts.budget)}</div>
    <p class="offer"><b>Suggested offer:</b> ${s.hits.length ? s.hits.slice(0, 2).map(h => esc(h.name)).join(' + ') : 'Not a fit for AI automation right now'}</p>
    ${s.hits.length ? `<details><summary>Outreach draft</summary><pre>${esc(leadDraft(l, s))}</pre></details>` : ''}</article>`;
}
function renderLeads() {
  $('#lead-cards').innerHTML = S.leads.map(l => [l, M.scoreLead(l)]).sort((a, b) => b[1].score - a[1].score).map(([l, s]) => leadCard(l, s)).join('');
  $('#lead-go').addEventListener('click', () => { const t = $('#lead-in').value.trim(); if (t.length < 30) { toast('Describe the business in a bit more detail.'); return; }
    const l = { name: 'Your lead', sector: 'Pasted description', size: +((/(\d+)[ -]?(person|people|staff|employees)/i.exec(t) || [])[1] || 8), budget: '', digital: 3, text: t };
    $('#lead-out').innerHTML = '<div style="margin-top:14px">' + leadCard(l, M.scoreLead(l)) + '</div>'; });
}

/* ---------- 08 pipeline ---------- */
function renderPipe() {
  const P = S.pipe, mx = P.funnel[0][1];
  $('#funnel').innerHTML = P.funnel.map(([n, v], i) => `<div class="fs"><span>${esc(n)}${i ? ` <small class="hint">${Math.round(v / P.funnel[i - 1][1] * 100)}%</small>` : ''}</span><span class="t"><i data-s="${(v / mx).toFixed(3)}"></i></span><b>${v}</b></div>`).join('');
  $('#nudges').innerHTML = P.drafts.map(d => { const due = d.age_h >= 24; return `<li class="${due ? 'due' : ''}"><span>${esc(d.role)}</span><span class="tag ${due ? '' : 'mute'}">${due ? 'nudge due' : (24 - d.age_h) + 'h left'}</span><small>Draft waiting ${d.age_h}h for a human to send</small><span class="clock"><i style="--s:${Math.min(1, d.age_h / 24).toFixed(3)}"></i></span></li>`; }).join('');
  $('#sched').innerHTML = P.schedule.map(([t, n, d]) => `<li><b>${esc(t)}</b><strong>${esc(n)}</strong><span>${esc(d)}</span></li>`).join('');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { $$('.fs i', e.target).forEach(i => i.style.setProperty('--s', i.dataset.s)); io.disconnect(); } }));
  io.observe($('#funnel'));
}


export async function init(ctx) {
  ({ M, S, $, $$, esc, pct, col, toast, J, RM } = ctx);
  const [om, em, ld, pp] = await Promise.all(['outcome-model.json', 'sample-emails.json', 'sample-leads.json', 'sample-pipeline.json'].map(J));
  S.om = om; S.emails = em; S.leads = ld.leads; S.pipe = pp; S.nb = M.nbTrain(em.train);
  renderOutcome(); await renderReplies(); replyBox(); renderLeads(); renderPipe();
  document.documentElement.dataset.more = '1';
  return { rescore: () => renderReplies() };
}
