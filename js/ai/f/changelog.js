/* D10) Weekly AI changelog from git commits (prebuilt JSON). */
import { esc } from '../core.js';
export async function mount(host) {
  const data = await fetch('/data/ai/f/changelog.json').then(r => r.json());
  host.innerHTML = `<div class="mm-f-change">
    <p class="mm-note">Generated ${esc(data.generated)}. ${esc(data.note)}</p>
    <ol>${data.entries.map(e => `<li><time>${esc(e.date_sast)}</time> <code>${esc(e.hash)}</code> ${esc(e.title)}</li>`).join('')}</ol>
  </div>`;
}
