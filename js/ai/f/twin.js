/* Interview practice — labelled AI, site facts only. Profile-first for common Qs. */
import { answer, loadData, esc, sourcesHTML } from '../core.js';
import { loadingHTML, errHTML } from './util.js';

const PROMPTS = [
  'Tell me about yourself',
  'What have you built with .NET and LLMs?',
  'How do you handle responsible AI?',
  'Walk me through JobNet',
  'Are you available, and where can you work?',
  'What are you weaker at?'
];

function profileBlurb(P, q) {
  const t = q.toLowerCase();
  if (/tell me about yourself|introduce yourself|who are you|about you/.test(t)) {
    return { html: `<p>${esc(P.name)} is an ${esc(P.title)} in Johannesburg with ${P.years} years of experience. ${esc(P.summary)}</p>
      <p class="mm-note">Availability: ${esc(P.availability)}. Open to ${esc(P.locations.join(', '))} · ${esc(P.modes.join(' / '))}.</p>`, citations: [{ n: 1, url: '/resume/', title: 'Résumé', section: 'Profile' }] };
  }
  if (/availab|where can you work|start|notice|remote|hybrid|johannesburg/.test(t) && !/jobnet|assist|sound/.test(t)) {
    return { html: `<p>${esc(P.availability)}. Open to ${esc(P.locations.join(', '))} (${esc(P.modes.join(' / '))}).</p>`, citations: [{ n: 1, url: '/contact/', title: 'Contact', section: 'Availability' }] };
  }
  if (/weaker|gap|don.?t (have|know)|weakness|missing/.test(t)) {
    const gaps = P.skills.filter(s => s.level === 'gap').slice(0, 6).map(s => s.label);
    return { html: `<p>Honest gaps listed on the site (not claimed): ${esc(gaps.join(', ') || 'see the skills list on the résumé')}. Education on the site: “${esc(P.education)}”.</p>`, citations: [{ n: 1, url: '/resume/', title: 'Résumé', section: 'Skills' }] };
  }
  return null;
}

export function mount(host) {
  host.innerHTML = `<div class="mm-f-twin">
    <p class="mm-badge">AI assistant · not Katlego · site facts only</p>
    <p class="mm-note">Answers quote published facts and link sources. If it is not on the site, the assistant says so.</p>
    <div class="mm-f-chips">${PROMPTS.map(p => `<button type="button" class="mm-btn sm" data-q="${esc(p)}">${esc(p)}</button>`).join('')}</div>
    <form class="mm-row" style="margin-top:12px"><label class="mm-sr" for="mm-twin-q">Question</label>
      <input class="mm-inp" id="mm-twin-q" name="q" placeholder="Ask an interview question…" style="flex:1;min-width:200px">
      <button class="mm-btn pri" type="submit">Ask</button></form>
    <div class="mm-card" data-out aria-live="polite" style="margin-top:14px"><p class="mm-note">Answer appears here with sources.</p></div>
  </div>`;
  const out = host.querySelector('[data-out]');
  const ask = async (q) => {
    if (!q.trim()) { out.innerHTML = '<p class="mm-f-state empty">Type a question, or tap a sample above.</p>'; return; }
    out.innerHTML = loadingHTML;
    try {
      const { profile: P } = await loadData();
      const direct = profileBlurb(P, q);
      if (direct) {
        out.innerHTML = `<p class="mm-kick">AI assistant (not Katlego)</p>${direct.html}${sourcesHTML(direct.citations)}
          <p class="mm-note">From published profile facts.</p>`;
        return;
      }
      const a = await answer(q, { k: 4 });
      const body = a.html || (a.refused ? '<p>I could not find that on the site.</p>' : '<p>No answer.</p>');
      out.innerHTML = `<p class="mm-kick">AI assistant (not Katlego)</p>${body}${sourcesHTML(a.citations || [])}
        <p class="mm-note">Grounded on published pages. Mode: ${esc(a.mode || '')}.</p>`;
    } catch (e) {
      out.innerHTML = errHTML('Something went wrong loading the answer. Try again, or open the résumé and case studies.');
    }
  };
  host.querySelectorAll('[data-q]').forEach(b => b.onclick = () => ask(b.dataset.q));
  host.querySelector('form').onsubmit = e => { e.preventDefault(); ask(String(new FormData(e.target).get('q') || '')); };
}
