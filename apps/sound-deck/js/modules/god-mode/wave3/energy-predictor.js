/**
 * W3 #5 Energy Predictor — perceived energy per bar (0.7·loudness + 0.3·onset density, worker),
 * smoothed curve, peak/valley detection and a linear-trend forecast of the next bars.
 * Snap the loop to a peak or valley in one click. Statistics, not a neural model.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { songMono } from '../audio-kit.js';
import { analyze, analysisMode } from '../analysis.js';
import { publishEnergy } from '../sections.js';
import { drawBars, setStatus, busy } from '../w23-ui.js';

export function smooth(values, k = 0.45) {
  const f = []; let s = values[0] || 0;
  values.forEach((v) => { s += (v - s) * k; f.push(s); });
  const b = []; s = f[f.length - 1] || 0;
  for (let i = f.length - 1; i >= 0; i--) { s += (f[i] - s) * k; b[i] = s; }
  return b;
}

/** Local extrema windows of `len` bars on the smoothed curve. */
export function extrema(curve, len = 4) {
  const wins = [];
  for (let s = 0; s + len <= curve.length; s++) {
    let m = 0;
    for (let i = 0; i < len; i++) m += curve[s + i];
    wins.push({ start: s, mean: m / len });
  }
  const pick = (arr) => {
    const out = [];
    arr.forEach((w) => { if (out.length < 3 && !out.some((o) => Math.abs(o.start - w.start) < len)) out.push(w); });
    return out;
  };
  return { peaks: pick([...wins].sort((a, b) => b.mean - a.mean)), valleys: pick([...wins].sort((a, b) => a.mean - b.mean)) };
}

/** Least-squares trend over the last `n` bars → forecast `ahead` bars (clamped 0..1). */
export function forecast(curve, n = 8, ahead = 4) {
  const tail = curve.slice(-n);
  const m = tail.length;
  if (m < 2) return { slope: 0, next: [] };
  const xm = (m - 1) / 2;
  const ym = tail.reduce((a, b) => a + b, 0) / m;
  let num = 0; let den = 0;
  tail.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
  const slope = num / (den || 1);
  return { slope, next: Array.from({ length: ahead }, (_, i) => Math.max(0, Math.min(1, ym + slope * (m - xm + i)))) };
}

registerFeature({
  id: 'energy-predictor',
  title: 'Energy Predictor',
  blurb: 'Bar-by-bar energy curve (loudness + rhythmic density), peaks & valleys, and a trend forecast of where the next bars are heading. Snap the loop to a peak.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Window</span><select data-ep-len><option value="2">2 bars</option><option value="4" selected>4 bars</option><option value="8">8 bars</option></select></label>
        <button type="button" class="btn primary sm" data-ep-go>Predict energy</button>
      </div>
      <canvas class="sx-god-meter" data-ep-canvas aria-label="Energy curve"></canvas>
      <ul class="sx-god-list" data-ep-list></ul>
      <p class="fineprint" data-ep-status>Energy = 0.7·RMS + 0.3·onset density · trend = least squares · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-ep-status]');
    const list = card.querySelector('[data-ep-list]');
    let curve = []; let raw = [];
    const show = () => {
      const len = Math.min(Number(card.querySelector('[data-ep-len]').value), curve.length);
      const { peaks, valleys } = extrema(curve, len);
      const fc = forecast(curve);
      const hi = new Set(); peaks.slice(0, 1).forEach((p) => { for (let i = 0; i < len; i++) hi.add(p.start + i); });
      drawBars(card.querySelector('[data-ep-canvas]'), [...raw, ...fc.next.map(() => 0)], { highlight: hi, line: [...curve, ...fc.next] });
      const row = (w, kind) => `<li><span class="grow">${kind} bars ${w.start + 1}–${w.start + len} · ${Math.round(w.mean * 100)}%</span><button type="button" class="btn sm ghost" data-ep-loop="${w.start}" data-len="${len}">Loop</button></li>`;
      list.innerHTML = peaks.map((p) => row(p, '▲ Peak')).join('') + valleys.slice(0, 1).map((v) => row(v, '▼ Valley')).join('')
        + `<li><span class="grow">Trend over last 8 bars: ${fc.slope > 0.02 ? 'rising ↗' : fc.slope < -0.02 ? 'falling ↘' : 'flat →'} (${(fc.slope * 100).toFixed(1)}%/bar) — next 4 bars ≈ ${fc.next.map((v) => Math.round(v * 100)).join(' · ')}%</span></li>`;
    };
    card.querySelector('[data-ep-len]').addEventListener('change', () => curve.length && show());
    card.querySelector('[data-ep-go]').addEventListener('click', async (e) => {
      busy(e.target, true, 'Rendering…');
      try {
        const m = await songMono(engine, { maxBars: 64, minBars: 4 });
        const bars = await analyze('barEnergy', { data: m.data, sr: m.sr, bpm: m.bpm, bars: m.bars });
        raw = bars.map((b) => b.energy);
        curve = smooth(raw);
        publishEnergy(raw);
        show();
        setStatus(status, `${bars.length} bars (${analysisMode()}) · heat strip on the Song ruler`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ep-loop]');
      if (!b) return;
      const s = Number(b.dataset.epLoop); const len = Number(b.dataset.len);
      setStatus(status, resultLine(await executeBatch(ctx, makeBatch(`Energy loop ${s + 1}–${s + len}`, [{ action: 'set_loop_region', start_bar: s, end_bar: s + len, looping: true }]))));
    });
  },
});
