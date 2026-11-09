/**
 * W3 #9 Reference Embed Match — drop a reference clip; both it and your mix get a 9-number
 * profile (loudness, crest, low/mid/high balance, onset rate, sustain, tempo, swing) computed in
 * the analysis worker. Cosine similarity + a matching plan (tempo, master tilt EQ, limiter).
 * A hand-built feature vector — not a neural embedding. The reference never leaves the browser.
 */
import { registerFeature } from '../registry.js';
import { makeBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { songMono, decodeAudio, toMono } from '../audio-kit.js';
import { analyze, analysisMode } from '../analysis.js';
import { profileSimilarity } from '../analysis-core.js';
import { fileDrop, setStatus, busy, focusCard, planHtml, esc } from '../w23-ui.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const eqVal = (db) => +((clamp(db, -12, 12) + 12) / 24).toFixed(4);

export function matchPlan(engine, mix, ref, { tempo = true, tone = true, dyn = true } = {}) {
  const cmds = [];
  const notes = [];
  if (tempo && ref.tempo && Math.abs(ref.tempo - engine.bpm) > 1.5 && ref.tempo >= 40 && ref.tempo <= 220) {
    cmds.push({ action: 'set_bpm', bpm: Math.round(ref.tempo) });
    notes.push(`tempo ${engine.bpm} → ${Math.round(ref.tempo)}`);
  }
  if (tone) {
    const cur = engine.masterEq || { low: 0, mid: 0, high: 0 };
    const dLow = clamp((ref.low - mix.low) * 20, -6, 6);
    const dHigh = clamp((ref.high - mix.high) * 30, -6, 6);
    if (Math.abs(dLow) >= 0.8) { cmds.push({ action: 'set_parameter', track: 'master', param: 'eq_low', value: eqVal((cur.low || 0) + dLow), ramp_ms: 80 }); notes.push(`low shelf ${dLow > 0 ? '+' : ''}${dLow.toFixed(1)} dB`); }
    if (Math.abs(dHigh) >= 0.8) { cmds.push({ action: 'set_parameter', track: 'master', param: 'eq_high', value: eqVal((cur.high || 0) + dHigh), ramp_ms: 80 }); notes.push(`high shelf ${dHigh > 0 ? '+' : ''}${dHigh.toFixed(1)} dB`); }
  }
  if (dyn && ref.crestDb < mix.crestDb - 3) {
    const push = clamp((mix.crestDb - ref.crestDb) / 12, 0.15, 0.7);
    cmds.push({ action: 'insert_fx', track: 'master', fx_id: 'limiter', preset: +push.toFixed(2) });
    notes.push(`ref is ${(mix.crestDb - ref.crestDb).toFixed(1)} dB denser → master limiter ${Math.round(push * 100)}%`);
  }
  return { cmds, notes, swingGap: (ref.swing || 0.5) - (mix.swing || 0.5) };
}

registerFeature({
  id: 'reference-embed-match',
  title: 'Reference Embed Match',
  blurb: 'Drop a reference track → compare a 9-feature groove/tone profile with your mix, see similarity, and apply a matching plan (tempo, tilt EQ, density).',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-drop" tabindex="0" role="button" data-re-drop>Drop a reference audio file (or click) — analysed locally</div>
      <input type="file" accept="audio/*" hidden data-re-file />
      <div class="sx-god-out" data-re-table></div>
      <div class="sx-god-checks"><label><input type="checkbox" data-re-tempo checked /> Tempo</label><label><input type="checkbox" data-re-tone checked /> Tone tilt</label><label><input type="checkbox" data-re-dyn checked /> Density</label></div>
      <div data-re-plan></div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-re-apply disabled>Apply match</button><button type="button" class="btn sm ghost" data-re-swing hidden>Open Swing Dial</button></div>
      <p class="fineprint" data-re-status>Hand-built feature vector + cosine similarity · not a neural embedding · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-re-status]');
    const applyBtn = card.querySelector('[data-re-apply]');
    let mix = null; let ref = null; let refName = '';
    const read = () => ({ tempo: card.querySelector('[data-re-tempo]').checked, tone: card.querySelector('[data-re-tone]').checked, dyn: card.querySelector('[data-re-dyn]').checked });
    const show = async () => {
      if (!mix || !ref) return;
      const sim = { similarity: profileSimilarity(mix, ref) };
      const rows = [['Tempo', (p) => (p.tempo ? `${p.tempo} BPM` : '?')], ['Swing', (p) => `${Math.round((p.swing || 0.5) * 100)}%`], ['RMS', (p) => `${p.rmsDb} dB`], ['Crest', (p) => `${p.crestDb} dB`], ['Low / Mid / High', (p) => `${Math.round(p.low * 100)} / ${Math.round(p.mid * 100)} / ${Math.round(p.high * 100)} %`], ['Tilt', (p) => `${p.tiltDb} dB`], ['Onsets', (p) => `${p.onsetRate}/s`]];
      card.querySelector('[data-re-table]').textContent = `${'Feature'.padEnd(18)}${'Your mix'.padEnd(18)}${refName.slice(0, 18)}\n${rows.map(([k, f]) => `${k.padEnd(18)}${String(f(mix)).padEnd(18)}${f(ref)}`).join('\n')}\nCosine similarity: ${Math.round(sim.similarity * 100)}%`;
      const plan = matchPlan(engine, mix, ref, read());
      card.querySelector('[data-re-plan]').innerHTML = plan.cmds.length ? planHtml(plan.cmds.map(describeCommand), plan.notes.join(' · ')) : '<p class="fineprint">Already close on the selected dimensions.</p>';
      applyBtn.disabled = !plan.cmds.length;
      const sw = card.querySelector('[data-re-swing]');
      sw.hidden = Math.abs(plan.swingGap) < 0.03;
      sw.textContent = `Swing gap ${Math.round(plan.swingGap * 100)}% → Swing Dial`;
    };
    card.addEventListener('change', (e) => { if (e.target.matches('[data-re-tempo],[data-re-tone],[data-re-dyn]')) show(); });
    fileDrop(card.querySelector('[data-re-drop]'), card.querySelector('[data-re-file]'), async (file) => {
      const drop = card.querySelector('[data-re-drop]');
      drop.textContent = `Analysing ${file.name}…`;
      try {
        const buf = await decodeAudio(engine, file);
        ref = await analyze('refProfile', { data: toMono(buf, 60), sr: buf.sampleRate });
        refName = file.name;
        const m = await songMono(engine, { maxBars: 32, minBars: 4 });
        mix = await analyze('refProfile', { data: m.data, sr: m.sr });
        drop.textContent = `Reference: ${file.name} (${buf.duration.toFixed(1)} s) — drop another to replace`;
        await show();
        setStatus(status, `Profiles computed (${analysisMode()}) · review the plan`);
      } catch (err) { drop.textContent = 'Drop a reference audio file (or click)'; setStatus(status, `✗ could not decode: ${err.message}`); }
    });
    applyBtn.addEventListener('click', async () => {
      const plan = matchPlan(engine, mix, ref, read());
      busy(applyBtn, true, 'Applying…');
      const res = await executeBatch(ctx, makeBatch(`Reference match: ${refName}`.slice(0, 120), plan.cmds));
      busy(applyBtn, false);
      setStatus(status, resultLine(res));
    });
    card.querySelector('[data-re-swing]').addEventListener('click', () => focusCard('swing-dial-ai'));
    void esc;
  },
});
