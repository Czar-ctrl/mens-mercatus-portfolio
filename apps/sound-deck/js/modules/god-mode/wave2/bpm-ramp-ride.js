/**
 * W2 #16 BPM Ramp Ride — gradual tempo ride across N bars (stepped once per bar while playing).
 * The transport re-anchors at each step so audio keeps playing (no stop/restart).
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { onEngine, setStatus } from '../w23-ui.js';

registerFeature({
  id: 'bpm-ramp-ride',
  title: 'BPM Ramp Ride',
  blurb: 'Ride the tempo from now to a target over N bars (e.g. 92 → 124 for a hip-hop → afro-tech build). Steps on each bar while playing.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    const engine = ctx.engine;
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Target BPM</span><input type="number" min="40" max="220" value="${Math.round(engine.bpm) === 124 ? 128 : 124}" data-br-to /></label>
        <label class="field"><span>Over bars</span><select data-br-bars><option>2</option><option selected>4</option><option>8</option><option>16</option></select></label>
      </div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-br-go>Arm ride</button><button type="button" class="btn sm ghost" data-br-cancel>Cancel ride</button></div>
      <p class="fineprint" data-br-status></p>
    `;
    const status = card.querySelector('[data-br-status]');
    const show = () => {
      const r = engine._godTempoRide;
      setStatus(status, r ? `Riding ${r.from} → ${r.to} BPM · step ${r.step}/${r.bars} · now ${engine.bpm} BPM${engine.isPlaying ? '' : ' · press Play'}` : `Now ${engine.bpm} BPM · ride steps once per bar while playing · DEMO`);
    };
    onEngine(engine, 'bpm', show, card);
    show();
    card.querySelector('[data-br-go]').addEventListener('click', async () => {
      const bpm = Number(card.querySelector('[data-br-to]').value);
      const bars = Number(card.querySelector('[data-br-bars]').value) || 4;
      const res = await executeBatch(ctx, makeBatch(`BPM ride ${engine.bpm} → ${bpm} over ${bars} bars`, [{ action: 'set_bpm', bpm, ramp_bars: bars }]));
      if (res.status !== 'success') setStatus(status, resultLine(res)); else show();
    });
    card.querySelector('[data-br-cancel]').addEventListener('click', () => { engine._godTempoRide = null; show(); });
  },
});
