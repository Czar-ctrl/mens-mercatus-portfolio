/**
 * Contrast Automator — intro → drop → bridge gain/filter energy arc (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { chipRow, bindChips } from './util.js';

const ARCS = {
  classic: {
    label: 'Classic',
    points: [
      { bar: 0, gain: 0.55, filter: 0.35, label: 'intro' },
      { bar: 8, gain: 1.0, filter: 0.05, label: 'drop' },
      { bar: 16, gain: 0.7, filter: 0.25, label: 'bridge' },
      { bar: 24, gain: 1.0, filter: 0.0, label: 'drop2' },
    ],
  },
  slowburn: {
    label: 'Slow Burn',
    points: [
      { bar: 0, gain: 0.4, filter: 0.5, label: 'intro' },
      { bar: 16, gain: 0.75, filter: 0.2, label: 'build' },
      { bar: 24, gain: 1.0, filter: 0.0, label: 'drop' },
    ],
  },
  punchy: {
    label: 'Punchy',
    points: [
      { bar: 0, gain: 0.7, filter: 0.15, label: 'intro' },
      { bar: 4, gain: 1.05, filter: 0.0, label: 'drop' },
      { bar: 12, gain: 0.5, filter: 0.4, label: 'bridge' },
      { bar: 16, gain: 1.05, filter: 0.0, label: 'drop2' },
    ],
  },
};

registerFeature({
  id: 'contrast-automator',
  title: 'Contrast Automator',
  blurb: 'Write an intro→drop→bridge energy arc: track volumes + optional master filter insert. Snapshotted Apply.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    const chips = Object.entries(ARCS).map(([id, a]) => ({ id, label: a.label }));
    cardEl.innerHTML = `
      ${chipRow(chips, { name: 'ca-arc' })}
      <label class="field sx-god-field">
        <span>Apply filter sweep on master</span>
        <input type="checkbox" data-ca-filter checked />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-ca-go>Write arc</button>
      </div>
      <p class="fineprint" data-ca-status>Volumes follow nearest arc point · DEMO</p>
    `;
    const getArc = bindChips(cardEl, '[data-chip-group="ca-arc"]');
    const status = cardEl.querySelector('[data-ca-status]');

    cardEl.querySelector('[data-ca-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const arcId = getArc() || 'classic';
      const arc = ARCS[arcId];
      const useFilter = !!cardEl.querySelector('[data-ca-filter]')?.checked;
      const barNow = Math.floor((engine.currentBeat || 0) / 4);

      await godApply(ctx, `Contrast · ${arc.label}`, async () => {
        await engine.init();
        // Pick nearest point at/before current bar (or first)
        let pt = arc.points[0];
        for (const p of arc.points) {
          if (p.bar <= barNow) pt = p;
        }
        // Also store full envelope on engine meta for later transport scrubbing
        engine.meta = engine.meta || {};
        engine.meta.contrastArc = {
          id: arcId,
          points: arc.points,
          appliedAtBar: barNow,
          demo: true,
        };

        engine.tracks.forEach((t) => {
          // Preserve relative balance: scale from current volume toward arc gain
          const base = typeof t.volume === 'number' ? t.volume : 0.85;
          const next = Math.max(0.05, Math.min(1.2, base * pt.gain));
          t.meta = { ...(t.meta || {}), contrastGain: next, contrastLabel: pt.label };
          if (typeof engine.setTrackVolume === 'function') {
            engine.setTrackVolume(t.id, Math.min(1, next));
          } else {
            t.volume = Math.min(1, next);
            engine._applyTrackGain?.(t);
          }
        });

        if (useFilter && ctx.inserts?.add) {
          const existing = ctx.inserts.list('master') || [];
          const filt = existing.find((x) => x.type === 'filter');
          if (filt) {
            ctx.inserts.setAmount('master', filt.uid, pt.filter);
          } else if (pt.filter > 0.02) {
            ctx.inserts.add('master', 'filter', pt.filter);
          }
        }

        engine._emit?.('tracks', engine.tracks);
        status.textContent = `${arc.label} · @ bar ${barNow} → ${pt.label} · gain×${pt.gain} · DEMO`;
      });
    });
  },
});
