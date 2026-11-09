/**
 * W3 #1 Intent Co-Pilot — plain-language request → SoundXCommandBatch preview → one undoable Apply.
 * Local keyword router by default; Blueprint Assist parses the text only when /health is LIVE,
 * and its output is validated exactly like local plans. Never auto-applies.
 */
import { registerFeature, getFeature } from '../registry.js';
import { makeBatch, validateBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine, clearAgentFx, BUFFER_REFS } from '../command-exec.js';
import { routeIntent, assistIntent } from '../intent-router.js';
import { setStatus, busy, focusCard, assistLive, planHtml, esc } from '../w23-ui.js';

const EXAMPLES = ['make the drop harder', 'loop the last 8 bars', 'bpm 124 over 8 bars', 'add delay to keys', 'turn this hip hop into afro tech', 'darker master', 'mute the bass'];

export async function planIntent(ctx, text) {
  const env = { engine: ctx.engine, inserts: ctx.inserts || ctx.engine?.inserts };
  if (assistLive()) {
    try {
      const r = await assistIntent(text, env);
      if (r?.validation?.ok) return r;
    } catch (_) { /* fall through to local */ }
  }
  const r = routeIntent(text, env);
  if (r.kind === 'commands') {
    r.validation = validateBatch(makeBatch(r.description || text.slice(0, 120), r.commands), { ...env, bufferRefs: BUFFER_REFS });
    r.source = 'local';
  }
  return r;
}

registerFeature({
  id: 'intent-copilot',
  title: 'Intent Co-Pilot',
  blurb: 'Type what you want (“make the drop harder”, “loop the last 8 bars”) → see the exact command plan → Apply once, undo with Restore.',
  badge: 'AUTO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <label class="field block"><span>Say it</span><input type="text" data-ic-in placeholder="e.g. make the drop harder" autocomplete="off" /></label>
      <div class="sx-god-chips">${EXAMPLES.map((e) => `<button type="button" class="btn sm ghost sx-god-chip" data-ic-ex="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <div class="btn-row"><button type="button" class="btn sm" data-ic-plan>Plan</button><button type="button" class="btn primary sm" data-ic-apply disabled>Apply plan</button><button type="button" class="btn sm ghost" data-ic-clear title="Remove every insert an agent added (inserts are not part of snapshots)">Clear agent FX</button></div>
      <div data-ic-out></div>
      <p class="fineprint" data-ic-status>Local intent router · Assist parses only when LIVE · plans are validated before anything changes</p>
    `;
    const input = card.querySelector('[data-ic-in]');
    const out = card.querySelector('[data-ic-out]');
    const status = card.querySelector('[data-ic-status]');
    const applyBtn = card.querySelector('[data-ic-apply]');
    let plan = null;
    const doPlan = async () => {
      const text = input.value.trim();
      plan = null;
      applyBtn.disabled = true;
      if (!text) { out.innerHTML = ''; setStatus(status, 'Type a request first'); return; }
      const btn = card.querySelector('[data-ic-plan]');
      busy(btn, true, 'Planning…');
      const r = await planIntent(ctx, text);
      busy(btn, false);
      if (r.kind === 'commands') {
        const ok = r.validation?.ok;
        out.innerHTML = planHtml(r.commands.map(describeCommand), ok ? `${r.say} (${r.source === 'assist' ? 'Assist LIVE' : 'local router'})` : `Plan invalid: ${r.validation.errors.map((e) => `#${e.command_index} ${e.code} ${e.message}`).join(' | ')}`);
        if (ok) { plan = makeBatch(text.slice(0, 120), r.commands); applyBtn.disabled = false; }
        setStatus(status, ok ? 'Review the plan, then Apply plan' : 'Nothing will change — fix the request');
      } else if (r.kind === 'route' && getFeature(r.route)) {
        out.innerHTML = `<p class="fineprint">${esc(r.say)}</p><button type="button" class="btn sm" data-ic-open="${esc(r.route)}">Open ${esc(getFeature(r.route).title)}</button>`;
        setStatus(status, 'That needs a dedicated tool');
      } else {
        out.innerHTML = `<p class="fineprint">${esc(r.say)}</p>`;
        setStatus(status, r.kind === 'refuse' ? 'Refused honestly — local tools only' : 'No plan');
      }
    };
    card.querySelector('[data-ic-plan]').addEventListener('click', doPlan);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doPlan(); } });
    card.addEventListener('click', (e) => {
      const ex = e.target.closest('[data-ic-ex]');
      if (ex) { input.value = ex.dataset.icEx; doPlan(); }
      const open = e.target.closest('[data-ic-open]');
      if (open) focusCard(open.dataset.icOpen);
    });
    applyBtn.addEventListener('click', async () => {
      if (!plan) return;
      applyBtn.disabled = true;
      const res = await executeBatch(ctx, plan);
      setStatus(status, resultLine(res));
      plan = null;
    });
    card.querySelector('[data-ic-clear]').addEventListener('click', () => {
      const n = clearAgentFx(ctx);
      setStatus(status, n ? `Removed ${n} agent insert${n === 1 ? '' : 's'}` : 'No agent inserts to remove');
    });
  },
});
