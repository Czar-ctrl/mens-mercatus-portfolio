/**
 * W2 #20 Co-Pilot Checklist — guided “finish the song” steps from local session rules.
 * Each step shows ✓ / ○ and an Apply that runs a concrete action (validated batch or a
 * Wave 2 helper), or opens the right card when the step needs your creative input.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { detectSections, songBars, findSection } from '../sections.js';
import { findRoleTrack } from '../roles.js';
import { guessGenre, GENRES } from '../genre-maps.js';
import { runFillAutopilot } from './fill-autopilot.js?v=20261008md';
import { runTransitionGlue } from './transition-glue.js?v=20261008md';
import { onEngine, setStatus, focusCard, esc } from '../w23-ui.js';

function steps(ctx) {
  const e = ctx.engine;
  const has = (pred) => e.tracks.some((t) => t.clips.some(pred));
  const drums = findRoleTrack(e, 'drums');
  const bass = findRoleTrack(e, 'bass');
  const secs = detectSections(e);
  const bars = songBars(e);
  const inserts = ctx.inserts;
  const masterFx = inserts?.list?.('master') || [];
  return [
    { id: 'drums', label: 'Drums groove in place', done: !!drums && drums.clips.length > 0, action: 'Add 8-bar groove' },
    { id: 'bass', label: 'Bass line present', done: !!bass && bass.clips.length > 0, action: 'Add root bass' },
    { id: 'length', label: 'Song ≥ 16 bars with ≥ 3 sections', done: bars >= 16 && secs.filter((s) => s.source !== 'proportional').length >= 3, action: 'Open Continue Clip' },
    { id: 'fills', label: 'Fills before section changes', done: has((c) => c.meta?.tag === 'fill-autopilot' || c.meta?.kind === 'god-call-response'), action: 'Insert fills' },
    { id: 'trans', label: 'Transitions (risers / impacts)', done: has((c) => c.meta?.tag === 'transition-glue'), action: 'Glue transitions' },
    { id: 'drop', label: 'Drop looped for review', done: (() => { const d = findSection(e, 'drop'); return !!d && e.isLooping && d.startBar === e.loopStart && d.endBar === e.loopEnd; })(), action: 'Loop the drop' },
    { id: 'headroom', label: 'Master headroom (limiter + −1 dB)', done: masterFx.some((it) => it.type === 'limiter'), action: 'Add guard' },
    { id: 'export', label: 'Export loop / master', done: false, action: 'Open Export Loop Clip' },
  ];
}

async function run(ctx, id) {
  const e = ctx.engine;
  await e.init();
  const batch = (desc, cmds) => executeBatch(ctx, makeBatch(desc, cmds));
  switch (id) {
    case 'drums': {
      const g = GENRES[guessGenre(e.bpm)];
      return batch(`Checklist · ${g.label} groove`, [{ action: 'add_clip', track: findRoleTrack(e, 'drums')?.name || 'Drums', create_track: true, bar: 0, name: `${g.label} groove`, source: { type: 'pattern', style: g.style, bars: 8, swing: g.swing } }]);
    }
    case 'bass': {
      const notes = [];
      for (let b = 0; b < 8 * 4; b += 1) notes.push({ beat: b, dur: 0.8, freq: b % 8 >= 6 ? 82.41 : 55, wave: 'sawtooth', vel: b % 2 ? 0.7 : 1 });
      return batch('Checklist · root bass', [{ action: 'add_clip', track: findRoleTrack(e, 'bass')?.name || 'Bass', create_track: true, bar: 0, name: 'Root bass', source: { type: 'notes', notes, duration_beats: 32 } }]);
    }
    case 'length': focusCard('continue-clip'); return { status: 'success', applied_commands: 0, note: 'Opened Continue Clip' };
    case 'fills': { const n = await runFillAutopilot(ctx, {}); return { status: 'success', applied_commands: n }; }
    case 'trans': { const n = await runTransitionGlue(ctx, {}); return { status: 'success', applied_commands: n }; }
    case 'drop': {
      const d = findSection(e, 'drop');
      if (!d) return { status: 'error', applied_commands: 0, errors: [{ command_index: -1, code: 'NOT_FOUND', message: 'no drop section' }] };
      return batch('Checklist · loop drop', [{ action: 'set_loop_region', start_bar: d.startBar, end_bar: d.endBar, looping: true }]);
    }
    case 'headroom':
      return batch('Checklist · master guard', [
        { action: 'insert_fx', track: 'master', fx_id: 'limiter', preset: 0.45 },
        { action: 'set_track_state', track: 'master', volume_db: -1, ramp_ms: 120 },
      ]);
    case 'export': focusCard('export-loop-clip'); return { status: 'success', applied_commands: 0, note: 'Opened Export Loop Clip' };
    default: return null;
  }
}

registerFeature({
  id: 'copilot-checklist',
  title: 'Co-Pilot Checklist',
  blurb: 'Guided “finish the song” steps from your session (groove → bass → sections → fills → transitions → drop → headroom → export) with Apply on each.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <ul class="sx-god-list" data-cc-list></ul>
      <p class="fineprint" data-cc-status>Rules run locally on your session · each Apply = Restore point · DEMO</p>
    `;
    const list = card.querySelector('[data-cc-list]');
    const status = card.querySelector('[data-cc-status]');
    const render = () => {
      const st = steps(ctx);
      list.innerHTML = st.map((s, i) => `<li><span>${s.done ? '✓' : '○'}</span><span class="grow">${i + 1}. ${esc(s.label)}</span><button type="button" class="btn sm ${s.done ? 'ghost' : ''}" data-cc="${s.id}">${esc(s.action)}</button></li>`).join('');
      const n = st.filter((s) => s.done).length;
      setStatus(status, `${n}/${st.length} done · rules run locally · each Apply = Restore point · DEMO`);
    };
    let t = null;
    const soon = () => { clearTimeout(t); t = setTimeout(render, 250); };
    onEngine(ctx.engine, 'tracks', soon, card);
    onEngine(ctx.engine, 'loop', soon, card);
    render();
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cc]');
      if (!b) return;
      try {
        const res = await run(ctx, b.dataset.cc);
        render();
        if (res) setStatus(status, res.note || (res.errors ? resultLine(res) : `Step applied · ${res.applied_commands} change${res.applied_commands === 1 ? '' : 's'}`));
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
    });
  },
});
