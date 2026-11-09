/**
 * W3 #16 Crowd Reaction Sim — scores the song for three listening contexts (club / radio / phone)
 * from measurable features: tempo pocket, low-end share, energy contrast, length, hook strength,
 * vocal presence, intro length, crest, mid/high share. Every factor is shown with its weight.
 * A transparent heuristic — no audience data, no trained model.
 */
import { registerFeature } from '../registry.js';
import { songMono } from '../audio-kit.js';
import { analyze, analysisMode } from '../analysis.js';
import { tracksByRole } from '../roles.js';
import { setStatus, busy, focusCard, esc } from '../w23-ui.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const band = (v, lo, hi, soft) => (v >= lo && v <= hi ? 1 : clamp01(1 - (v < lo ? lo - v : v - hi) / soft));

/** Pure scorer (unit-tested). f = { tempo, low, mid, high, crestDb, onsetRate, bars, seconds, contrast, hook, vox, introBars } */
export function crowdScores(f) {
  const ctxs = {
    club: [
      ['Tempo in 118–130 BPM pocket', 0.25, band(f.tempo || 0, 118, 130, 20)],
      ['Low-end share ≥ 40%', 0.25, clamp01(f.low / 0.4)],
      ['Energy contrast (build → drop)', 0.2, clamp01(f.contrast / 0.5)],
      ['Steady groove (4–10 onsets/s)', 0.15, band(f.onsetRate, 4, 10, 4)],
      ['DJ-friendly length ≥ 48 bars', 0.15, clamp01(f.bars / 48)],
    ],
    radio: [
      ['Length 2:30–3:45', 0.25, band(f.seconds, 150, 225, 60)],
      ['Hook strength', 0.25, clamp01(f.hook / 0.8)],
      ['Vocal present', 0.2, f.vox ? 1 : 0],
      ['Intro ≤ 8 bars before energy', 0.15, f.introBars <= 8 ? 1 : clamp01(1 - (f.introBars - 8) / 16)],
      ['Controlled dynamics (crest 8–14 dB)', 0.15, band(f.crestDb, 8, 14, 8)],
    ],
    phone: [
      ['Mid-band share ≥ 35%', 0.3, clamp01(f.mid / 0.35)],
      ['Top-end detail ≥ 8%', 0.2, clamp01(f.high / 0.08)],
      ['Not sub-heavy (< 60% lows)', 0.25, f.low <= 0.6 ? 1 : clamp01(1 - (f.low - 0.6) / 0.3)],
      ['Dense enough (crest ≤ 14 dB)', 0.25, f.crestDb <= 14 ? 1 : clamp01(1 - (f.crestDb - 14) / 10)],
    ],
  };
  const out = {};
  Object.entries(ctxs).forEach(([k, rows]) => {
    const score = rows.reduce((m, [, w, v]) => m + w * v, 0);
    const weakest = [...rows].sort((a, b) => a[2] * a[1] - b[2] * b[1])[0];
    out[k] = { score: Math.round(score * 100), rows: rows.map(([label, w, v]) => ({ label, w, v: +v.toFixed(2) })), tip: weakest[2] < 0.8 ? weakest[0] : null };
  });
  return out;
}

const TIPS = { club: 'cinema-mix', radio: 'hook-likelihood-scout', phone: 'cinema-mix' };

registerFeature({
  id: 'crowd-reaction-sim',
  title: 'Crowd Reaction Sim',
  blurb: 'Club / radio / phone scores from tempo, low end, energy contrast, length, hook strength, vocal presence and dynamics — every factor and weight shown.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-bars" data-cr-out></div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-cr-go>Simulate crowds</button><button type="button" class="btn sm ghost" data-cr-cinema>Audition (Cinema Mix)</button></div>
      <p class="fineprint" data-cr-status>Weighted features of your render — honest: no audience data · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-cr-status]');
    const out = card.querySelector('[data-cr-out]');
    card.querySelector('[data-cr-cinema]').addEventListener('click', () => focusCard('cinema-mix'));
    card.querySelector('[data-cr-go]').addEventListener('click', async (e) => {
      busy(e.target, true, 'Rendering…');
      try {
        const m = await songMono(engine, { maxBars: 96, minBars: 4 });
        const bars = await analyze('barEnergy', { data: m.data, sr: m.sr, bpm: m.bpm, bars: m.bars });
        const prof = await analyze('refProfile', { data: m.data, sr: m.sr });
        const hooks = await analyze('hookWindows', { bars: bars.map((b) => ({ energy: b.energy, onsets: b.onsets })), sizes: [4, 8], top: 1 });
        const en = bars.map((b) => b.energy);
        const sorted = [...en].sort((a, b) => a - b);
        const contrast = (sorted[Math.floor(sorted.length * 0.9)] || 0) - (sorted[Math.floor(sorted.length * 0.2)] || 0);
        const firstHot = en.findIndex((v) => v >= 0.6);
        const f = {
          tempo: engine.bpm, low: prof.low, mid: prof.mid, high: prof.high, crestDb: prof.crestDb, onsetRate: prof.onsetRate,
          bars: m.bars, seconds: m.bars * 4 * engine.secondsPerBeat, contrast, hook: hooks[0]?.score || 0,
          vox: tracksByRole(engine, 'vox').some((t) => t.clips.length && !t.muted), introBars: firstHot < 0 ? m.bars : firstHot,
        };
        const sc = crowdScores(f);
        out.innerHTML = Object.entries(sc).map(([k, s]) => `
          <div class="bar" title="${esc(s.rows.map((r) => `${r.label}: ${Math.round(r.v * 100)}% × ${r.w}`).join('\n'))}"><i style="width:${s.score}%"></i><span>${k[0].toUpperCase() + k.slice(1)} · ${s.score}/100</span></div>
          <span class="fineprint">${s.tip ? `Weakest: ${esc(s.tip)}` : 'All factors strong'}${s.tip ? ` <button type="button" class="btn sm ghost" data-cr-tip="${TIPS[k]}">Fix</button>` : ''}</span>`).join('');
        setStatus(status, `${m.bars} bars · ${Math.round(f.seconds)} s · ${analysisMode()} · hover a bar for the factor breakdown`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    out.addEventListener('click', (e) => { const b = e.target.closest('[data-cr-tip]'); if (b) focusCard(b.dataset.crTip); });
  },
});
