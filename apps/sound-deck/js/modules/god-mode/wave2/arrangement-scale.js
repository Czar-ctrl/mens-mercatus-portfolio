/**
 * W2 #6 Arrangement Shrink/Expand — scale every clip position (and the loop) by a factor,
 * keeping the relative layout. Audio clips keep their length (no time-stretch in the browser);
 * MIDI/note clips can stretch their notes too.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { songEndBar } from '../sections.js';
import { chipRow, bindChips } from '../util.js';
import { setStatus, fmtBar } from '../w23-ui.js';

const FACTORS = [
  { id: '0.5', label: '½×' }, { id: '0.75', label: '¾×' }, { id: '1.5', label: '1.5×' }, { id: '2', label: '2×' },
];

export function scaleArrangement(engine, f, { stretchNotes = true, snap = 0.25 } = {}) {
  const q = (x) => Math.max(0, Math.round(x / snap) * snap);
  engine.tracks.forEach((t) => t.clips.forEach((c) => {
    c.startBeat = q((c.startBeat || 0) * f);
    if (c.notes?.length && stretchNotes) {
      c.notes = c.notes.map((n) => ({ ...n, beat: n.beat * f, dur: (n.dur || 0.25) * f }));
      c.durationBeats = Math.max(0.25, q((c.durationBeats || 0) * f));
    }
  }));
  engine.setLoopRegion(Math.round(engine.loopStart * f * 4) / 4, Math.round(engine.loopEnd * f * 4) / 4, engine.isLooping);
}

registerFeature({
  id: 'arrangement-scale',
  title: 'Arrangement Shrink/Expand',
  blurb: 'Scale song length (½× … 2×) keeping the relative clip layout. Note clips stretch; audio clips move but keep their length.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      ${chipRow(FACTORS, { name: 'as-f' })}
      <label class="toggle"><input type="checkbox" data-as-notes checked /> <span>Stretch note clips</span></label>
      <div class="btn-row"><button type="button" class="btn primary sm" data-as-go>Scale arrangement</button></div>
      <p class="fineprint" data-as-status></p>
    `;
    const engine = ctx.engine;
    const getF = bindChips(card, '[data-chip-group="as-f"]');
    const status = card.querySelector('[data-as-status]');
    setStatus(status, `Song now ${fmtBar(songEndBar(engine))} bars · snapshot first · DEMO`);
    card.querySelector('[data-as-go]').addEventListener('click', async () => {
      const f = Number(getF()) || 1;
      const before = songEndBar(engine);
      try {
        await godApply(ctx, `Arrangement ×${f}`, async () => {
          if (!engine.tracks.some((t) => t.clips.length)) throw new Error('No clips to scale');
          scaleArrangement(engine, f, { stretchNotes: card.querySelector('[data-as-notes]').checked });
          engine._emit('tracks', engine.tracks);
        });
        setStatus(status, `×${f}: ${fmtBar(before)} → ${fmtBar(songEndBar(engine))} bars · undo via Restore`);
      } catch (e) { setStatus(status, `✗ ${e.message}`); }
    });
  },
});
