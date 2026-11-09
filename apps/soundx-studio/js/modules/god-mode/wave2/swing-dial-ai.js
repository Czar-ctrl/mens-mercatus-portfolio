/**
 * W2 #10 Swing Dial AI — groove templates (trap / amapiano / afro-tech / house / boom-bap):
 * shifts off-beat clip starts and note positions on the chosen grid; re-renders God Mode
 * pattern clips with the new swing. Template table is hand-tuned, not learned.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { installRenderers } from '../command-exec.js';
import { tracksByRole } from '../roles.js';
import { chipRow, bindChips } from '../util.js';
import { setStatus } from '../w23-ui.js';

export const TEMPLATES = {
  trap: { label: 'Trap', swing: 0.53, grid: 0.25 },
  amapiano: { label: 'Amapiano', swing: 0.6, grid: 0.25 },
  afrotech: { label: 'Afro Tech', swing: 0.56, grid: 0.25 },
  house: { label: 'House', swing: 0.56, grid: 0.5 },
  boombap: { label: 'Boom-Bap', swing: 0.62, grid: 0.5 },
  straight: { label: 'Straight', swing: 0.5, grid: 0.25 },
};

/** Offset for a straight position on a grid: odd grid steps move by (swing − 0.5) × 2 × grid / 2. */
export function swungPos(straight, swing, grid) {
  const step = Math.round(straight / grid);
  const onGrid = Math.abs(step * grid - straight) < 1e-6;
  if (!onGrid || step % 2 === 0) return straight;
  return straight + (swing - 0.5) * grid * 2 * 0.5 * 2; // 0.75 swing on 1/16 → +0.125 beat (triplet-ish)
}

export function applySwing(engine, tracks, swing, grid) {
  let moved = 0;
  installRenderers(engine);
  tracks.forEach((t) => {
    t.clips = t.clips.map((c) => {
      if (c.meta?.kind === 'god-pattern') {
        const meta = { ...c.meta, swing };
        const render = engine.metaRenderers.get('god-pattern');
        moved += 1;
        return { ...c, id: `${String(c.id).replace(/-sw\d+$/, "")}-sw${Math.round(swing * 100)}`, meta, buffer: render ? render(meta, engine) : c.buffer };
      }
      if (c._straightStart == null) c._straightStart = Math.round(c.startBeat / (grid / 2)) * (grid / 2);
      const ns = swungPos(c._straightStart, swing, grid);
      if (Math.abs(ns - c.startBeat) > 1e-6) { c.startBeat = ns; moved += 1; }
      if (c.notes?.length) {
        c.notes = c.notes.map((n) => {
          const st = n._s ?? n.beat;
          const nb = swungPos(st, swing, grid);
          if (nb !== n.beat) moved += 1;
          return { ...n, _s: st, beat: nb };
        });
      }
      return c;
    });
    t.clips.forEach((c) => { if (c.buffer) engine.rememberBuffer?.(c.id, c.buffer); });
  });
  return moved;
}

registerFeature({
  id: 'swing-dial-ai',
  title: 'Swing Dial AI',
  blurb: 'Groove templates — Trap · Amapiano · Afro Tech · House · Boom-Bap — dial the swing and apply to drums or the selected track.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      ${chipRow(Object.entries(TEMPLATES).map(([id, t]) => ({ id, label: t.label })), { name: 'sw-t' })}
      <label class="field sx-god-field"><span>Swing <em data-sw-v>53%</em></span><input type="range" min="0.5" max="0.72" step="0.01" value="0.53" data-sw-amt /></label>
      <label class="field sx-god-field"><span>Apply to</span><select data-sw-target><option value="drums">All drum tracks</option><option value="selected">Selected track</option><option value="all">All tracks</option></select></label>
      <div class="btn-row"><button type="button" class="btn primary sm" data-sw-go>Swing it</button></div>
      <p class="fineprint" data-sw-status>Grid 1/16 (1/8 for House / Boom-Bap) · re-apply anytime, straight positions are remembered · DEMO</p>
    `;
    const engine = ctx.engine;
    const amt = card.querySelector('[data-sw-amt]');
    const vEl = card.querySelector('[data-sw-v]');
    const status = card.querySelector('[data-sw-status]');
    const getT = bindChips(card, '[data-chip-group="sw-t"]', (id) => { amt.value = TEMPLATES[id].swing; vEl.textContent = `${Math.round(TEMPLATES[id].swing * 100)}%`; });
    amt.addEventListener('input', () => { vEl.textContent = `${Math.round(Number(amt.value) * 100)}%`; });
    card.querySelector('[data-sw-go]').addEventListener('click', async () => {
      const tpl = TEMPLATES[getT()] || TEMPLATES.trap;
      const swing = Number(amt.value);
      const target = card.querySelector('[data-sw-target]').value;
      let tracks = target === 'all' ? engine.tracks : target === 'selected'
        ? engine.tracks.filter((t) => t.id === ctx.getSelectedTrackId?.())
        : tracksByRole(engine, 'drums');
      if (!tracks.length) tracks = engine.tracks.slice(0, 1);
      let moved = 0;
      try {
        await godApply(ctx, `Swing ${tpl.label} ${Math.round(swing * 100)}%`, async () => {
          moved = applySwing(engine, tracks, swing, tpl.grid);
          engine._emit('tracks', engine.tracks);
        });
        setStatus(status, `${tpl.label} ${Math.round(swing * 100)}% on ${tracks.map((t) => t.name).join(', ')} · ${moved} hits/clips moved`);
      } catch (e) { setStatus(status, `✗ ${e.message}`); }
    });
  },
});
