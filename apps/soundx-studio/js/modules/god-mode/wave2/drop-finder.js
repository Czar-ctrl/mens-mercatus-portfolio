/**
 * W2 #7 Drop Finder — offline-render the song, measure per-bar RMS (worker), highlight the
 * highest-energy windows and loop them. Energy heat is drawn on the Song ruler too.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { songMono } from '../audio-kit.js';
import { analyze, analysisMode } from '../analysis.js';
import { publishEnergy } from '../sections.js';
import { drawBars, setStatus, busy, fmtBar } from '../w23-ui.js';

export async function scanEnergy(engine) {
  const m = await songMono(engine, { maxBars: 64, minBars: 4 });
  const bars = await analyze('barEnergy', { data: m.data, sr: m.sr, bpm: m.bpm, bars: m.bars });
  return bars;
}

export function topWindows(values, len, n = 3) {
  const wins = [];
  for (let s = 0; s + len <= values.length; s++) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += values[s + i];
    wins.push({ start: s, score: sum / len });
  }
  wins.sort((a, b) => b.score - a.score);
  const out = [];
  wins.forEach((w) => { if (out.length < n && !out.some((o) => Math.abs(o.start - w.start) < len)) out.push(w); });
  return out;
}

registerFeature({
  id: 'drop-finder',
  title: 'Drop Finder',
  blurb: 'Render the song offline, measure bar-by-bar loudness in a worker, highlight the hottest windows and loop one as your drop.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Window</span><select data-df-len><option value="4" selected>4 bars</option><option value="8">8 bars</option><option value="2">2 bars</option></select></label>
        <button type="button" class="btn primary sm" data-df-scan>Scan energy</button>
      </div>
      <canvas class="sx-god-meter" data-df-canvas aria-label="Energy per bar"></canvas>
      <ul class="sx-god-list" data-df-list></ul>
      <p class="fineprint" data-df-status>RMS per bar from an offline mixdown · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-df-status]');
    const list = card.querySelector('[data-df-list]');
    const canvas = card.querySelector('[data-df-canvas]');
    let levels = [];
    const show = () => {
      const len = Number(card.querySelector('[data-df-len]').value) || 4;
      const wins = topWindows(levels, Math.min(len, levels.length));
      const hi = new Set();
      wins.slice(0, 1).forEach((w) => { for (let i = 0; i < len; i++) hi.add(w.start + i); });
      drawBars(canvas, levels, { highlight: hi });
      list.innerHTML = wins.map((w, i) => `<li><span class="grow">#${i + 1} bars ${w.start + 1}–${w.start + len} · ${(w.score * 100).toFixed(0)}%</span><button type="button" class="btn sm ghost" data-df-loop="${w.start}" data-len="${len}">Loop</button></li>`).join('');
    };
    card.querySelector('[data-df-len]').addEventListener('change', () => levels.length && show());
    card.querySelector('[data-df-scan]').addEventListener('click', async (e) => {
      busy(e.target, true, 'Rendering…');
      try {
        const bars = await scanEnergy(engine);
        levels = bars.map((b) => b.level);
        publishEnergy(levels);
        show();
        setStatus(status, `${bars.length} bars scanned (${analysisMode()}) · loudest bar ${bars.reduce((m, b) => (b.rms > m.rms ? b : m), bars[0]).bar + 1} · heat strip added to the Song ruler`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-df-loop]');
      if (!b) return;
      const s = Number(b.dataset.dfLoop);
      const len = Number(b.dataset.len);
      const res = await executeBatch(ctx, makeBatch(`Drop Finder loop ${s + 1}–${s + len}`, [{ action: 'set_loop_region', start_bar: s, end_bar: s + len, looping: true }]));
      setStatus(status, `${resultLine(res)} · bars ${fmtBar(s + 1)}–${fmtBar(s + len)}`);
    });
  },
});
