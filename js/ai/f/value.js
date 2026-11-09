/* D13) Value/ROI calculator from real case studies — assumptions shown. No invented savings. */
import { esc } from '../core.js';

// Only qualitative levers backed by published work; user supplies their own rates.
const LEVERS = [
  { id: 'assist', name: 'Mercatus Assist deflection', unit: 'hours / week saved on repetitive questions',
    hint: 'You set the hours. The case study shows a human-gated assistant over company knowledge — it does not publish a $ savings figure.',
    link: '/case-studies/assist/' },
  { id: 'jobnet', name: 'JobNet screening time', unit: 'applications reviewed / week with explanations',
    hint: 'JobNet ranks and explains fit; drafts only. Enter how many apps you personally review per week today.',
    link: '/case-studies/jobnet/' },
  { id: 'soundx', name: 'SoundX AI ideation', unit: 'demo tracks shaped in-browser / week',
    hint: 'Audio stays on-device. Enter your own throughput; we do not claim a studio-cost offset.',
    link: '/case-studies/soundx/' }
];

export function mount(host) {
  host.innerHTML = `<div class="mm-f-value">
    <p class="mm-note"><strong>Assumptions are yours.</strong> This site does not publish dollar savings. Enter an hourly rate and weekly units; the math is rate × units × 4.3. Every lever links to a real case study.</p>
    <label>Your fully-loaded hourly rate (currency of your choice)
      <input class="mm-inp" data-rate type="number" min="0" step="1" value="50"></label>
    <div data-lev style="margin-top:12px"></div>
    <p class="mm-f-total" data-total></p>
  </div>`;
  const lev = host.querySelector('[data-lev]');
  lev.innerHTML = LEVERS.map(l => `<div class="mm-f-lever" data-id="${l.id}">
      <b>${esc(l.name)}</b> · <a href="${esc(l.link)}">case study</a>
      <p class="mm-note">${esc(l.hint)}</p>
      <label>${esc(l.unit)} <input class="mm-inp" data-u type="number" min="0" step="1" value="0"></label>
    </div>`).join('');
  const calc = () => {
    const rate = +host.querySelector('[data-rate]').value || 0;
    let sum = 0;
    lev.querySelectorAll('.mm-f-lever').forEach(row => { sum += rate * (+row.querySelector('[data-u]').value || 0) * 4.3; });
    host.querySelector('[data-total]').innerHTML = `Illustrative monthly value at your assumptions: <b>${sum.toFixed(0)}</b>
      <span class="mm-note">(rate × units × 4.3 weeks). Not a quote. Not a measured result from Katlego’s clients.</span>`;
  };
  host.querySelectorAll('input').forEach(i => i.addEventListener('input', calc)); calc();
}
