/* D1) Job-post matcher: side-by-side JD vs real projects with proof links. */
import { analyse, SAMPLES } from '../match.js';
import { esc } from '../core.js';
import { openAfterCv } from './leads.js';
import { loadingHTML, emptyHTML, errHTML } from './util.js';

export async function match(jd) {
  const res = await analyse(jd);
  const P = res.profile;
  const hitKeys = new Set();
  res.rows.forEach(r => (r.skills || []).forEach(s => {
    const k = P.skills.find(x => x.label === s.label);
    if (k && k.level !== 'gap') hitKeys.add(k.key);
  }));
  const projects = P.projects.map(p => {
    const hits = p.skills.filter(s => hitKeys.has(s));
    return { ...p, hits, score: hits.length };
  }).sort((a, b) => b.score - a.score);
  return { ...res, projects };
}

function render(host, res) {
  host.innerHTML = `<div class="mm-f-match2">
    <div class="mm-score"><div class="mm-ring" style="--p:${res.overall}"><b>${res.overall}<small>%</small></b></div>
      <div><p class="mm-kick">Match for</p><h3 style="margin:.3rem 0;font:600 18px/1.25 var(--mm-disp)">${esc(res.title)}</h3>
      <p class="mm-note">Projects ranked by evidenced overlap · gaps shown · on device</p></div></div>
    <div class="mm-f-cols">
      <div><h4>Requirements</h4>${res.rows.map(r => `<div class="mm-req" data-status="${r.status}"><span class="mm-st ${r.status}">${r.status}</span><span class="q">${esc(r.text)}</span></div>`).join('')}</div>
      <div><h4>Project proof</h4>${res.projects.map(p => `<article class="mm-f-proj"><b><a href="${esc(p.url)}">${esc(p.name)}</a></b> <span class="mm-note">${esc(p.tag)}</span>
        <p class="mm-note">Overlap: ${p.hits.length ? p.hits.map(esc).join(', ') : '—'}</p>
        <ul>${p.bullets.slice(0, 2).map(b => `<li>${esc(b)}</li>`).join('')}</ul></article>`).join('')}</div>
    </div>
    ${res.gaps.length ? `<div class="mm-gaps"><strong>Honest gaps</strong><ul>${res.gaps.map(g => `<li>${esc(g.text)}</li>`).join('')}</ul></div>` : ''}
    <div class="mm-row" style="margin-top:12px"><button type="button" class="mm-btn pri" data-send>Leave details for a follow-up</button></div>
  </div>`;
  host.querySelector('[data-send]').onclick = () => openAfterCv(res);
}

export function mount(host) {
  host.innerHTML = `<div class="mm-match"><div>
    <textarea class="mm-ta" style="min-height:220px" placeholder="Paste a job post…"></textarea>
    <div class="mm-row" style="margin-top:10px"><button type="button" class="mm-btn pri" data-go>Match projects</button>
      <button type="button" class="mm-btn sm" data-s="dotnet">Sample .NET</button></div>
  </div><div class="mm-card" data-out><p class="mm-note">Side-by-side match appears here.</p></div></div>`;
  const ta = host.querySelector('textarea'), out = host.querySelector('[data-out]');
  host.querySelector('[data-s]').onclick = () => { ta.value = SAMPLES.dotnet.text; go(); };
  const go = async () => { if (!ta.value.trim()) return; out.innerHTML = loadingHTML; try { const r = await match(ta.value); if (!r.rows.length) { out.innerHTML = emptyHTML('No requirements found. Paste a fuller job post.'); return; } render(out, r); } catch (e) { out.innerHTML = errHTML('Could not match that post. Try again.'); } };
  host.querySelector('[data-go]').onclick = go;
}
