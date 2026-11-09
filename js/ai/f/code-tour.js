/* D4) Live code tour of a real file (Recruiter Match assess()). */
import { esc } from '../core.js';

const FILE = {
  path: 'site/js/ai/match.js',
  url: '/js/ai/match.js',
  title: 'Recruiter Match — assess()',
  steps: [
    { line: 55, end: 58, note: 'Levels map shipped / listed / partial / gap to numeric scores. Gaps stay at 0 — never inflated.' },
    { line: 59, end: 61, note: 'Years of experience are compared to the number Katlego confirmed (4). Asking for 6+ is an honest partial or gap.' },
    { line: 62, end: 64, note: 'Education: the site says “Self-taught.” A hard degree requirement is marked as a gap unless the ad accepts equivalent experience.' },
    { line: 70, end: 79, note: 'Skill hits use aliases from profile.json. Evidence links come from real projects. Soft skills are not scored.' },
    { line: 81, end: 87, note: 'Semantic fallback (MiniLM) can only ever score “partial”. Strong requires an exact evidenced skill.' },
    { line: 92, end: 98, note: 'Overall fit weighs “nice to have” at half. The mode label tells the visitor whether embeddings loaded.' }
  ]
};

export async function mount(host) {
  host.innerHTML = `<div class="mm-f-tour"><p class="mm-note">Touring <code>${esc(FILE.path)}</code> — the real scoring function behind Recruiter Match.</p>
    <pre class="mm-f-code" data-code>Loading…</pre>
    <div class="mm-row"><button type="button" class="mm-btn pri" data-next>Next step</button>
      <button type="button" class="mm-btn" data-prev>Back</button>
      <span class="mm-note" data-st></span></div>
    <p class="mm-f-note" data-note></p></div>`;
  const pre = host.querySelector('[data-code]');
  let text = '';
  try { text = await fetch(FILE.url).then(r => r.text()); } catch { text = '// could not load'; }
  const lines = text.split('\n');
  let i = 0;
  const show = () => {
    const s = FILE.steps[i];
    pre.innerHTML = lines.map((ln, idx) => {
      const n = idx + 1;
      const on = n >= s.line && n <= s.end;
      return `<span class="ln${on ? ' on' : ''}"><i>${n}</i>${esc(ln)}</span>`;
    }).join('\n');
    host.querySelector('[data-note]').textContent = s.note;
    host.querySelector('[data-st]').textContent = `Step ${i+1} / ${FILE.steps.length}`;
    const el = pre.querySelector('.on');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  host.querySelector('[data-next]').onclick = () => { i = (i+1) % FILE.steps.length; show(); };
  host.querySelector('[data-prev]').onclick = () => { i = (i+FILE.steps.length-1) % FILE.steps.length; show(); };
  show();
}
