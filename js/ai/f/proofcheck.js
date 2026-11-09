/* D12) Proof checker — every claim links to evidence from data/proof.json + profile. */
import { esc } from '../core.js';

export async function mount(host) {
  const [proof, profile] = await Promise.all([
    fetch('/data/proof.json').then(r => r.json()),
    fetch('/data/ai/profile.json').then(r => r.json())
  ]);
  const items = [];
  Object.entries(proof.strips || {}).forEach(([k, strip]) => {
    (strip.items || []).forEach(it => items.push({ project: k, ...it }));
  });
  host.innerHTML = `<div class="mm-f-proof">
    <p class="mm-note">${esc(proof.note || '')} Generated ${esc(proof.generated || '')}.</p>
    <label class="mm-kick">Filter <input class="mm-inp" data-q placeholder="soundx, LCP, calendar…"></label>
    <div data-list style="margin-top:12px"></div>
    <p class="mm-note" style="margin-top:10px">Profile facts (years/availability) source: ${esc(JSON.stringify(profile.facts_source || {}))}</p>
  </div>`;
  const list = host.querySelector('[data-list]');
  const draw = () => {
    const q = (host.querySelector('[data-q]').value || '').toLowerCase();
    const rows = items.filter(it => !q || JSON.stringify(it).toLowerCase().includes(q));
    list.innerHTML = `<table class="mm-f-table"><thead><tr><th>Claim</th><th>Value</th><th>Source</th><th>How</th><th>Date</th></tr></thead><tbody>
      ${rows.slice(0, 40).map(it => `<tr><td>${esc(it.label)} <span class="mm-note">(${esc(it.project)})</span></td>
        <td><b>${esc(String(it.display))}</b></td><td class="mm-note">${esc(it.source)}</td>
        <td class="mm-note">${esc(it.how)}</td><td class="mm-note">${esc(it.date)}</td></tr>`).join('')}
    </tbody></table>`;
  };
  host.querySelector('[data-q]').oninput = draw; draw();
}
