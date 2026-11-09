/**
 * W3 #18 Diff Explain — plain-language “what changed” between two snapshots (or a snapshot vs now),
 * plus the recent agent transaction log. Local template summary always; when Blueprint Assist is LIVE
 * you can ask it to rephrase that summary (text only — nothing changes).
 */
import { registerFeature } from '../registry.js';
import { diffSessions, explainDiff } from '../session-diff-core.js';
import { TX_LOG } from '../command-exec.js';
import { snapshotOptions, snapshotJson } from '../wave2/session-diff.js?v=20261008md-sxs20261020b';
import { setStatus, busy, assistLive, onWindow, esc } from '../w23-ui.js';

async function rephrase(text) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch('/api/cartel/index.php?path=/api/mercatus-cartel/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', signal: ctrl.signal,
      body: JSON.stringify({ message: `Rephrase this DAW change summary for a music producer in 2–3 friendly sentences. Do not add facts.\n\n${text}`, history: [] }),
    });
    if (!r.ok) throw new Error(`assist ${r.status}`);
    const d = await r.json();
    return String(d.reply || d.message || d.content || '').trim();
  } finally { clearTimeout(timer); }
}

registerFeature({
  id: 'diff-explain',
  title: 'Diff Explain',
  blurb: 'Plain-language summary of what changed between two snapshots (tempo, loop, tracks, levels, EQ, clips) plus the log of recent agent batches.',
  badge: 'AUTO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Before</span><select data-dx-a></select></label>
        <label class="field"><span>After</span><select data-dx-b></select></label>
      </div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-dx-go>Explain</button><button type="button" class="btn sm ghost" data-dx-assist hidden>Rephrase (Assist LIVE)</button></div>
      <div class="sx-god-out" data-dx-out></div>
      <details><summary class="fineprint">Agent transaction log</summary><ul class="sx-god-list" data-dx-tx></ul></details>
      <p class="fineprint" data-dx-status>Local diff + template sentences · Assist only rephrases when LIVE</p>
    `;
    const a = card.querySelector('[data-dx-a]');
    const b = card.querySelector('[data-dx-b]');
    const out = card.querySelector('[data-dx-out]');
    const status = card.querySelector('[data-dx-status]');
    const assistBtn = card.querySelector('[data-dx-assist]');
    const fill = () => {
      const o = snapshotOptions(ctx).map((x) => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
      const ka = a.value; const kb = b.value;
      a.innerHTML = o; b.innerHTML = o;
      a.value = ka || (a.options[1]?.value || 'now');
      b.value = kb || 'now';
    };
    const tx = () => {
      card.querySelector('[data-dx-tx]').innerHTML = TX_LOG.slice(-12).reverse().map((t) => `<li><span class="grow">${new Date(t.at).toLocaleTimeString()} · ${esc(t.description || '')} · ${t.commands} cmd</span><span class="fineprint">${t.result.status === 'success' ? '✓' : `✗ ${esc(t.result.errors?.[0]?.code || '')}`}</span></li>`).join('') || '<li class="fineprint">No agent batches yet.</li>';
    };
    fill(); tx();
    a.addEventListener('focus', fill); b.addEventListener('focus', fill);
    onWindow('sx-god:tx', tx, card);
    let lastText = '';
    card.querySelector('[data-dx-go]').addEventListener('click', () => {
      const ja = snapshotJson(ctx, a.value);
      const jb = snapshotJson(ctx, b.value);
      if (!ja || !jb) { setStatus(status, 'Snapshot unavailable'); return; }
      const d = diffSessions(ja, jb);
      lastText = explainDiff(d, { aLabel: a.selectedOptions[0]?.textContent || 'before', bLabel: b.selectedOptions[0]?.textContent || 'after' });
      out.textContent = lastText;
      assistBtn.hidden = !assistLive() || !d.length;
      setStatus(status, `${d.length} raw deltas summarised locally`);
    });
    assistBtn.addEventListener('click', async () => {
      if (!lastText) return;
      busy(assistBtn, true, 'Asking Assist…');
      try { const r = await rephrase(lastText); if (r) out.textContent = `${lastText}\n\nAssist: ${r}`; setStatus(status, 'Rephrased by Blueprint Assist (LIVE) — facts from the local diff'); }
      catch (err) { setStatus(status, `Assist unavailable (${err.message}) — local summary kept`); }
      busy(assistBtn, false);
    });
  },
});
