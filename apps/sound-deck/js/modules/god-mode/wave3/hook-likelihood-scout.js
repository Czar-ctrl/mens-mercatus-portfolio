/**
 * W3 #6 Hook Likelihood Scout — ranks 2/4/8-bar windows as hook candidates from
 * repetition (similar windows recurring), energy and melodic activity (note clips).
 * Score = 0.45·repetition + 0.40·energy + length prior. Transparent heuristic.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { songMono } from '../audio-kit.js';
import { analyze, analysisMode } from '../analysis.js';
import { roleOfTrack } from '../roles.js';
import { drawBars, setStatus, busy } from '../w23-ui.js';

const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);

/** Per-bar melodic features from note clips: [mean pitch 0..1, density 0..1]. */
export function melodicBars(engine, nBars) {
  const acc = Array.from({ length: nBars }, () => ({ sum: 0, n: 0 }));
  engine.tracks.forEach((t) => {
    if (t.muted || roleOfTrack(t) === 'drums') return;
    t.clips.forEach((c) => (c.notes || []).forEach((n) => {
      const bar = Math.floor(((c.startBeat || 0) + (n.beat || 0)) / 4);
      if (bar < 0 || bar >= nBars || !n.freq) return;
      acc[bar].sum += hzToMidi(n.freq); acc[bar].n += 1;
    }));
  });
  return acc.map((a) => (a.n ? [Math.max(0, Math.min(1, (a.sum / a.n - 36) / 60)), Math.min(1, a.n / 16)] : [0, 0]));
}

registerFeature({
  id: 'hook-likelihood-scout',
  title: 'Hook Likelihood Scout',
  blurb: 'Ranks 2–8 bar windows as hook candidates from repetition, energy and melody activity — audition any candidate as a loop.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-checks"><label><input type="checkbox" data-hs-size="2" checked /> 2 bars</label><label><input type="checkbox" data-hs-size="4" checked /> 4 bars</label><label><input type="checkbox" data-hs-size="8" checked /> 8 bars</label></div>
      <canvas class="sx-god-meter" data-hs-canvas aria-label="Hook candidates"></canvas>
      <ul class="sx-god-list" data-hs-list></ul>
      <div class="btn-row"><button type="button" class="btn primary sm" data-hs-go>Scout hooks</button></div>
      <p class="fineprint" data-hs-status>Repetition + energy + melody · heuristic ranking, not a hit predictor · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-hs-status]');
    const list = card.querySelector('[data-hs-list]');
    let energy = [];
    card.querySelector('[data-hs-go]').addEventListener('click', async (e) => {
      const sizes = [...card.querySelectorAll('[data-hs-size]:checked')].map((x) => Number(x.dataset.hsSize));
      if (!sizes.length) { setStatus(status, 'Pick at least one window size'); return; }
      busy(e.target, true, 'Listening…');
      try {
        const m = await songMono(engine, { maxBars: 64, minBars: 4 });
        const bars = await analyze('barEnergy', { data: m.data, sr: m.sr, bpm: m.bpm, bars: m.bars });
        const mel = melodicBars(engine, bars.length);
        energy = bars.map((b) => b.energy);
        const wins = await analyze('hookWindows', { bars: bars.map((b, i) => ({ energy: b.energy, onsets: b.onsets, pitch: mel[i] })), sizes, top: 6 });
        const hi = new Set();
        if (wins[0]) for (let i = 0; i < wins[0].bars; i++) hi.add(wins[0].startBar + i);
        drawBars(card.querySelector('[data-hs-canvas]'), energy, { highlight: hi });
        list.innerHTML = wins.map((w, i) => `<li><span class="grow">#${i + 1} bars ${w.startBar + 1}–${w.startBar + w.bars} · ${Math.round(w.score * 100)}% · repeats ${w.repeats}× · energy ${Math.round(w.energy * 100)}%</span><button type="button" class="btn sm ghost" data-hs-loop="${w.startBar}" data-len="${w.bars}">Audition</button></li>`).join('') || '<li>Song too short for those window sizes.</li>';
        setStatus(status, `${wins.length} candidates from ${bars.length} bars (${analysisMode()}) · repetition weighs most`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-hs-loop]');
      if (!b) return;
      const s = Number(b.dataset.hsLoop); const len = Number(b.dataset.len);
      const res = await executeBatch(ctx, makeBatch(`Hook audition ${s + 1}–${s + len}`, [{ action: 'set_loop_region', start_bar: s, end_bar: s + len, looping: true }]));
      if (res.status === 'success' && !engine.isPlaying) { try { engine.seekToBeat?.(s * 4); await engine.play?.(); } catch (_) {} }
      setStatus(status, resultLine(res));
    });
  },
});
