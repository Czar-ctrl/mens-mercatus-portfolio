/**
 * W3 #17 Session Autopilot — a visible multi-step agent: (1) loop a section → (2) genre-morph that
 * loop → (3) safety pass → (4) export the loop WAV. Each mutating step is its own validated batch
 * (own Restore point); runs step by step, stops on the first failure, never leaves SoundX.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch } from '../command-exec.js';
import { detectSections } from '../sections.js';
import { GENRES, MORPH_TARGETS } from '../genre-maps.js';
import { downloadBlob } from '../util.js';
import { encodeWav } from '../audio-kit.js';
import { buildMorph } from '../wave2/genre-morph-agent.js?v=20261008md';
import { bounceLoop } from '../wave2/export-loop-clip.js?v=20261008md';
import { safetyScan } from './safety-fader.js?v=20261008md';
import { setStatus, esc } from '../w23-ui.js';

export const STEPS = [
  { id: 'loop', label: 'Loop the chosen section' },
  { id: 'morph', label: 'Genre-morph the loop' },
  { id: 'safety', label: 'Safety pass (peak → master trim)' },
  { id: 'export', label: 'Export loop WAV (download)' },
];

registerFeature({
  id: 'session-autopilot',
  title: 'Session Autopilot',
  blurb: 'Multi-step agent you can watch: loop a section → morph its genre → safety pass → export the loop WAV. One Restore point per step; stops on failure.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    const engine = ctx.engine;
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Section</span><select data-sa-sec></select></label>
        <label class="field"><span>Morph to</span><select data-sa-to>${MORPH_TARGETS.map((g) => `<option value="${g}"${g === 'afrotech' ? ' selected' : ''}>${esc(GENRES[g].label)}</option>`).join('')}</select></label>
      </div>
      <ol class="sx-god-list sx-god-plan" data-sa-steps>${STEPS.map((s) => `<li><label class="grow"><input type="checkbox" data-sa-step="${s.id}" checked /> ${esc(s.label)}</label><span data-sa-res="${s.id}" class="fineprint"></span></li>`).join('')}</ol>
      <div class="btn-row"><button type="button" class="btn primary sm" data-sa-go>Run autopilot</button><button type="button" class="btn sm ghost" data-sa-stop disabled>Stop</button></div>
      <p class="fineprint" data-sa-status>Every step is a validated batch with its own Restore point · DEMO</p>
    `;
    const sec = card.querySelector('[data-sa-sec]');
    const status = card.querySelector('[data-sa-status]');
    const fillSecs = () => {
      const secs = detectSections(engine);
      const keep = sec.value;
      sec.innerHTML = secs.map((s, i) => `<option value="${i}">${esc(s.label)} · bars ${s.startBar + 1}–${s.endBar}</option>`).join('');
      const drop = secs.findIndex((s) => /drop/i.test(s.label));
      sec.value = keep && sec.options[Number(keep)] ? keep : String(Math.max(0, drop));
      return secs;
    };
    fillSecs();
    sec.addEventListener('focus', fillSecs);
    let stopFlag = false;
    card.querySelector('[data-sa-stop]').addEventListener('click', () => { stopFlag = true; });
    card.querySelector('[data-sa-go]').addEventListener('click', async (e) => {
      const secs = fillSecs();
      const s = secs[Number(sec.value)];
      const on = (id) => card.querySelector(`[data-sa-step="${id}"]`).checked;
      const mark = (id, txt) => { card.querySelector(`[data-sa-res="${id}"]`).textContent = txt; };
      STEPS.forEach((st) => mark(st.id, on(st.id) ? '…' : 'skipped'));
      stopFlag = false;
      e.target.disabled = true;
      card.querySelector('[data-sa-stop]').disabled = false;
      let done = 0;
      try {
        for (const st of STEPS) {
          if (!on(st.id)) continue;
          if (stopFlag) { mark(st.id, 'stopped'); break; }
          if (st.id === 'loop') {
            if (!s) throw Object.assign(new Error('no sections'), { step: 'loop' });
            const r = await executeBatch(ctx, makeBatch(`Autopilot 1/4: loop ${s.label}`, [{ action: 'set_loop_region', start_bar: s.startBar, end_bar: s.endBar, looping: true }]), { quiet: true });
            if (r.status !== 'success') throw Object.assign(new Error(r.errors[0].message), { step: st.id });
            mark(st.id, `✓ bars ${s.startBar + 1}–${s.endBar}`);
          } else if (st.id === 'morph') {
            const to = card.querySelector('[data-sa-to]').value;
            const { src, cmds } = buildMorph(ctx, { from: 'auto', to, span: 'loop', rampBars: 0, muteSource: true, withFx: true });
            const r = await executeBatch(ctx, makeBatch(`Autopilot 2/4: ${GENRES[src].label} → ${GENRES[to].label}`, cmds), { quiet: true });
            if (r.status !== 'success') throw Object.assign(new Error(r.errors[0].message), { step: st.id });
            mark(st.id, `✓ ${r.applied_commands} commands`);
          } else if (st.id === 'safety') {
            const sc = await safetyScan(ctx, { scope: 'loop', ceilingDb: -1, addLimiter: true });
            if (sc.cmds.length) {
              const r = await executeBatch(ctx, makeBatch('Autopilot 3/4: safety pass', sc.cmds), { quiet: true });
              if (r.status !== 'success') throw Object.assign(new Error(r.errors[0].message), { step: st.id });
            }
            mark(st.id, `✓ peak ${sc.peakDb} dBFS${sc.cmds.length ? ' → trimmed' : ' (ok)'}`);
          } else if (st.id === 'export') {
            const { buf, peakDb } = await bounceLoop(engine, { normalize: true });
            downloadBlob(encodeWav(buf), `soundx-autopilot-${Math.round(engine.bpm)}bpm-bars-${engine.loopStart + 1}-${engine.loopEnd}.wav`);
            mark(st.id, `✓ ${buf.duration.toFixed(1)} s WAV${peakDb != null ? ' (normalized −1 dBFS)' : ''}`);
          }
          done += 1;
        }
        setStatus(status, `Autopilot finished ${done} step${done === 1 ? '' : 's'} · each mutating step left a Restore point`);
      } catch (err) {
        if (err.step) mark(err.step, `✗ ${err.message}`);
        setStatus(status, `Stopped after ${done} step${done === 1 ? '' : 's'}: ${err.message}`);
      }
      e.target.disabled = false;
      card.querySelector('[data-sa-stop]').disabled = true;
    });
  },
});
