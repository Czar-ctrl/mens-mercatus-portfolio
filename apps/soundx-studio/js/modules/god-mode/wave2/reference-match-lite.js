/**
 * W2 #11 Reference Match Lite — compare loudness + spectral tilt of your mix against a reference
 * (dropped file or a timeline clip), then nudge master volume and master low/high shelves.
 * Moves are bounded (±4 dB tilt, never above unity gain). Heuristic, not mastering.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine, linToDb } from '../command-exec.js';
import { songMono, toMono, decodeAudio } from '../audio-kit.js';
import { analyze } from '../analysis.js';
import { fileDrop, setStatus, busy, esc } from '../w23-ui.js';

export function clipOptions(engine) {
  const out = [];
  engine.tracks.forEach((t) => t.clips.forEach((c) => { if (c.buffer && c.buffer.duration > 1) out.push({ id: c.id, label: `${t.name} · ${c.name} (${c.buffer.duration.toFixed(1)} s)`, buffer: c.buffer }); }));
  return out;
}

registerFeature({
  id: 'reference-match-lite',
  title: 'Reference Match Lite',
  blurb: 'Match loudness and rough tonal tilt to a reference track — drop a file or pick a clip; nudges master volume + shelves.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-drop" data-rm-drop tabindex="0" role="button">Drop a reference audio file (or click)</div>
      <input type="file" accept="audio/*" data-rm-file hidden />
      <label class="field sx-god-field"><span>…or a timeline clip</span><select data-rm-clip></select></label>
      <label class="field sx-god-field"><span>Strength <em data-rm-sv>70%</em></span><input type="range" min="0.2" max="1" step="0.05" value="0.7" data-rm-str /></label>
      <div class="btn-row"><button type="button" class="btn sm ghost" data-rm-an>Analyze</button><button type="button" class="btn primary sm" data-rm-go disabled>Match</button></div>
      <div class="sx-god-out" data-rm-out></div>
      <p class="fineprint" data-rm-status>Loudness (RMS) + tilt (high vs low band) only · DEMO</p>
    `;
    const engine = ctx.engine;
    const sel = card.querySelector('[data-rm-clip]');
    const out = card.querySelector('[data-rm-out]');
    const status = card.querySelector('[data-rm-status]');
    const goBtn = card.querySelector('[data-rm-go]');
    const str = card.querySelector('[data-rm-str]');
    str.addEventListener('input', () => { card.querySelector('[data-rm-sv]').textContent = `${Math.round(str.value * 100)}%`; });
    let refBuf = null;
    let refName = '';
    let plan = null;
    const fillClips = () => { sel.innerHTML = `<option value="">—</option>${clipOptions(engine).map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}`; };
    fillClips();
    sel.addEventListener('focus', fillClips);
    sel.addEventListener('change', () => { const c = clipOptions(engine).find((x) => x.id === sel.value); if (c) { refBuf = c.buffer; refName = c.label; setStatus(status, `Reference: ${refName}`); } });
    fileDrop(card.querySelector('[data-rm-drop]'), card.querySelector('[data-rm-file]'), async (f) => {
      try { refBuf = await decodeAudio(engine, f); refName = f.name; setStatus(status, `Reference: ${f.name} (${refBuf.duration.toFixed(1)} s)`); } catch (e) { setStatus(status, `✗ Could not decode ${f.name}`); }
    });
    card.querySelector('[data-rm-an]').addEventListener('click', async (e) => {
      if (!refBuf) { setStatus(status, 'Pick or drop a reference first.'); return; }
      busy(e.target, true, 'Analyzing…');
      try {
        const ref = await analyze('refProfile', { data: toMono(refBuf, 90), sr: refBuf.sampleRate });
        const m = await songMono(engine, { maxBars: 32, minBars: 2 });
        const mix = await analyze('refProfile', { data: m.data, sr: m.sr });
        const k = Number(str.value);
        const curMaster = linToDb(engine._masterVol ?? 0.85);
        const loud = Math.max(-12, Math.min(12, (ref.rmsDb - mix.rmsDb) * k));
        const target = Math.min(0, Math.round((curMaster + loud) * 10) / 10);
        const tilt = Math.max(-8, Math.min(8, (ref.tiltDb - mix.tiltDb) * k));
        const hi = Math.max(-4, Math.min(4, (engine.masterEq.high || 0) + tilt / 2));
        const lo = Math.max(-4, Math.min(4, (engine.masterEq.low || 0) - tilt / 2));
        plan = { target, hi, lo };
        out.textContent = [
          `Ref  ${ref.rmsDb} dB RMS · tilt ${ref.tiltDb} dB · ${ref.tempo || '?'} BPM`,
          `Mix  ${mix.rmsDb} dB RMS · tilt ${mix.tiltDb} dB`,
          `Plan master ${curMaster.toFixed(1)} → ${target} dB${curMaster + loud > 0 ? ' (capped at unity — raise track faders or add Master Glue for more)' : ''}`,
          `     low shelf ${lo.toFixed(1)} dB · high shelf ${hi.toFixed(1)} dB`,
        ].join('\n');
        goBtn.disabled = false;
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    goBtn.addEventListener('click', async () => {
      if (!plan) return;
      const v = (d) => +((d + 12) / 24).toFixed(4);
      const res = await executeBatch(ctx, makeBatch(`Reference Match · ${refName}`.slice(0, 128), [
        { action: 'set_track_state', track: 'master', volume_db: plan.target, ramp_ms: 120 },
        { action: 'set_parameter', track: 'master', param: 'eq_low', value: v(plan.lo), ramp_ms: 120 },
        { action: 'set_parameter', track: 'master', param: 'eq_high', value: v(plan.hi), ramp_ms: 120 },
      ]));
      setStatus(status, resultLine(res));
    });
  },
});
