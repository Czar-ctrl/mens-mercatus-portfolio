/**
 * W3 #20 AGI Desk (honest) — one chat box that can only (a) build a validated SoundXCommandBatch
 * you approve, or (b) route you to a registered Wave 1–3 tool. It refuses cloud full-song
 * generation, voice cloning, streaming rips and Suno/Udio with a plain explanation.
 * “AGI” is the user-facing name; under the hood: keyword router + optional Assist parse (LIVE only).
 */
import { registerFeature, listFeatures, getFeature } from '../registry.js';
import { makeBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { REFUSAL } from '../intent-router.js';
import { planIntent } from './intent-copilot.js?v=20261008md';
import { focusCard, assistLive, esc } from '../w23-ui.js';

const STOP = new Set(['the', 'a', 'an', 'to', 'my', 'me', 'it', 'this', 'and', 'or', 'of', 'in', 'on', 'for', 'with', 'can', 'you', 'i', 'want', 'please', 'make', 'do', 'how', 'is', 'what']);

/** Keyword search over registered features (title + blurb + id). */
export function searchTools(text, features = listFeatures(), n = 3) {
  const words = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return [];
  return features.map((f) => {
    const hay = `${f.title} ${f.blurb || ''} ${f.id}`.toLowerCase();
    const s = words.reduce((m, w) => m + (hay.includes(w) ? (f.title.toLowerCase().includes(w) ? 3 : 1) : 0), 0);
    return { f, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.f);
}

export async function deskReply(ctx, text) {
  const s = String(text || '').trim();
  const low = s.toLowerCase();
  if (/^(help|what can you do|tools|list tools|capabilities)\??$/.test(low)) {
    const all = listFeatures();
    const by = (w) => all.filter((f) => (f.wave || 1) === w).length;
    return { kind: 'help', say: `I can build undoable command plans (tempo, loops, levels, pan, EQ, FX, pattern/notes clips) or open one of ${all.length} local tools (W1 ${by(1)} · W2 ${by(2)} · W3 ${by(3)}). Try “loop the last 8 bars”, “turn this hip hop into afro tech”, “find the hook”, “is my mix clipping?”.` };
  }
  const r = await planIntent(ctx, s);
  if (r.kind === 'refuse') return { kind: 'refuse', say: REFUSAL, tools: ['prompt-arrangement', 'genre-morph-agent', 'lyric-melody-sketch'].filter((id) => getFeature(id)) };
  if (r.kind === 'commands') {
    if (!r.validation?.ok) return { kind: 'invalid', say: `I drafted a plan but it failed validation (${r.validation.errors.map((e) => e.code).join(', ')}), so nothing will change.` };
    return { kind: 'commands', say: r.say, commands: r.commands, source: r.source };
  }
  if (r.kind === 'route' && getFeature(r.route)) return { kind: 'route', say: r.say.replace(' Opening that card.', ''), tools: [r.route] };
  const found = searchTools(s);
  if (found.length) return { kind: 'route', say: 'These local tools match what you asked:', tools: found.map((f) => f.id) };
  return { kind: 'unknown', say: r.say };
}

registerFeature({
  id: 'agi-desk',
  title: 'AGI Desk (honest)',
  blurb: 'Chat that only does two things: builds a validated plan you approve, or opens the right Wave 1–3 tool. Says no to cloud full-song generation, voice clones and rips.',
  badge: 'AUTO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-chat" data-agi-log aria-live="polite"><div class="msg bot">Ask for a change (“make the drop harder”) or a tool (“find the hook”). I only use SoundX's local tools — every change is previewed and undoable.</div></div>
      <div class="sx-god-row"><input type="text" data-agi-in placeholder="Ask the desk…" autocomplete="off" style="flex:1" /><button type="button" class="btn primary sm" data-agi-send>Send</button></div>
      <p class="fineprint" data-agi-status>Routes only to registered tools / validated batches · Assist parses text only when LIVE</p>
    `;
    const log = card.querySelector('[data-agi-log]');
    const input = card.querySelector('[data-agi-in]');
    const plans = new Map();
    let n = 0;
    const add = (cls, html) => { const d = document.createElement('div'); d.className = `msg ${cls}`; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      add('user', esc(text));
      const r = await deskReply(ctx, text);
      const tools = (r.tools || []).map((id) => `<button type="button" class="btn sm ghost" data-agi-open="${esc(id)}">${esc(getFeature(id)?.title || id)}</button>`).join('');
      if (r.kind === 'commands') {
        const id = `p${++n}`;
        plans.set(id, makeBatch(text.slice(0, 120), r.commands));
        add('bot', `${esc(r.say)}<ol class="sx-god-plan">${r.commands.map((c) => `<li>${esc(describeCommand(c))}</li>`).join('')}</ol><button type="button" class="btn sm primary" data-agi-apply="${id}">Apply (${r.commands.length})</button>${r.source === 'assist' ? ' <span class="fineprint">parsed by Assist LIVE · validated locally</span>' : ''}`);
      } else add(r.kind === 'refuse' ? 'bot refuse' : 'bot', `${esc(r.say)}${tools ? `<div>${tools}</div>` : ''}`);
    };
    card.querySelector('[data-agi-send]').addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    log.addEventListener('click', async (e) => {
      const open = e.target.closest('[data-agi-open]');
      if (open) { focusCard(open.dataset.agiOpen); return; }
      const ap = e.target.closest('[data-agi-apply]');
      if (ap && plans.has(ap.dataset.agiApply)) {
        ap.disabled = true;
        const res = await executeBatch(ctx, plans.get(ap.dataset.agiApply));
        plans.delete(ap.dataset.agiApply);
        add('bot', esc(resultLine(res)));
      }
    });
    card.querySelector('[data-agi-status]').textContent += assistLive() ? ' · Assist LIVE' : ' · Assist offline (DEMO)';
  },
});
