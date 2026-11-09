/**
 * W2 #14 Transition Glue — noise riser into every section change, impact on the downbeat.
 * Sounds are synthesized locally (filtered noise sweep + sub boom) on an “FX Transitions” track.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { detectSections } from '../sections.js';
import { riserBuffer, impactBuffer } from '../audio-kit.js';
import { setStatus } from '../w23-ui.js';

export async function runTransitionGlue(ctx, { riserBars = 1, riser = true, impact = true } = {}) {
  const engine = ctx.engine;
  let n = 0;
  await godApply(ctx, 'Transition Glue', async () => {
    await engine.init();
    const bounds = detectSections(engine).slice(1).map((s) => s.startBar * 4).filter((b) => b > 0);
    if (!bounds.length) throw new Error('No section changes detected — build a longer arrangement first');
    engine.tracks.forEach((t) => { t.clips = t.clips.filter((c) => c.meta?.tag !== 'transition-glue'); });
    const t = engine.tracks.find((x) => x.name === 'FX Transitions') || engine.addTrack('audio', 'FX Transitions');
    const lenBeats = riserBars * 4;
    const rb = riserBuffer(engine, lenBeats * engine.secondsPerBeat);
    const ib = impactBuffer(engine, Math.min(2.5, 4 * engine.secondsPerBeat));
    bounds.forEach((b) => {
      if (riser) { engine.addClip(t.id, { name: 'Riser', startBeat: Math.max(0, b - lenBeats), durationBeats: lenBeats, color: '#68D391', buffer: rb, meta: { tag: 'transition-glue' } }); n += 1; }
      if (impact) { engine.addClip(t.id, { name: 'Impact', startBeat: b, durationBeats: Math.min(4, ib.duration / engine.secondsPerBeat), color: '#38A169', buffer: ib, meta: { tag: 'transition-glue' } }); n += 1; }
    });
    engine._emit('tracks', engine.tracks);
  });
  return n;
}

registerFeature({
  id: 'transition-glue',
  title: 'Transition Glue',
  blurb: 'Auto riser + impact at every section change (Intro→Verse→Drop…) on an FX Transitions track — synthesized locally.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Riser length</span><select data-tg-len><option value="0.5">2 beats</option><option value="1" selected>1 bar</option><option value="2">2 bars</option><option value="4">4 bars</option></select></label>
      </div>
      <div class="sx-god-checks"><label><input type="checkbox" data-tg-riser checked /> Riser</label><label><input type="checkbox" data-tg-impact checked /> Impact</label></div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-tg-go>Glue transitions</button></div>
      <p class="fineprint" data-tg-status>Replaces earlier Transition Glue clips · DEMO</p>
    `;
    const status = card.querySelector('[data-tg-status]');
    card.querySelector('[data-tg-go]').addEventListener('click', async () => {
      try {
        const n = await runTransitionGlue(ctx, {
          riserBars: Number(card.querySelector('[data-tg-len]').value) || 1,
          riser: card.querySelector('[data-tg-riser]').checked,
          impact: card.querySelector('[data-tg-impact]').checked,
        });
        setStatus(status, `${n} transition clips placed · undo via Restore`);
      } catch (e) { setStatus(status, `✗ ${e.message}`); }
    });
  },
});
