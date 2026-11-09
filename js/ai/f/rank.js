/* D7) Smart project ranking from on-device intent + optional JD text. */
import { loadData, esc, toks, norm } from '../core.js';

export async function mount(host) {
  const { profile: P } = await loadData();
  host.innerHTML = `<div class="mm-f-rank">
    <label class="mm-kick">Optional: paste keywords or a short JD</label>
    <textarea class="mm-ta" style="min-height:100px" placeholder="e.g. ASP.NET, RAG, Johannesburg"></textarea>
    <div class="mm-row" style="margin-top:8px"><button type="button" class="mm-btn pri" data-go>Rank projects</button>
      <span class="mm-note">Uses your tab’s “Personalised for” intent + keywords. Nothing leaves the device.</span></div>
    <div data-out style="margin-top:14px"></div></div>`;
  const out = host.querySelector('[data-out]');
  const go = () => {
    const q = norm(host.querySelector('textarea').value);
    const intent = document.documentElement.getAttribute('data-mm-intent') || '';
    const boost = { recruiter: ['assist','jobnet'], founder: ['assist','concierge'], music: ['soundx','sda'], developer: ['assist','forex','jobnet'] }[intent] || [];
    const scored = P.projects.map(p => {
      let n = 0;
      if (q) p.skills.forEach(s => { if (q.includes(s) || toks(q).includes(s)) n += 2; });
      if (q && norm(p.name + ' ' + p.tag + ' ' + p.bullets.join(' ')).split(/\s+/).some(w => q.includes(w) && w.length > 3)) n += 1;
      if (boost.includes(p.id)) n += 1.5;
      return { p, n };
    }).sort((a, b) => b.n - a.n);
    out.innerHTML = `<ol class="mm-f-ranklist">${scored.map(({ p, n }) => `<li><a href="${esc(p.url)}"><b>${esc(p.name)}</b></a> — ${esc(p.tag)}
      <span class="mm-note">score ${n.toFixed(1)}</span><ul>${p.bullets.slice(0,1).map(b=>`<li>${esc(b)}</li>`).join('')}</ul></li>`).join('')}</ol>`;
  };
  host.querySelector('[data-go]').onclick = go; go();
}
