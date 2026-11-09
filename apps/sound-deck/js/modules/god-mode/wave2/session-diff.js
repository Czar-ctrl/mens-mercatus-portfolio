/**
 * W2 #19 Session Diff — compare two session snapshots (or a snapshot vs Now), tick the deltas you
 * want, and apply A's or B's side to the live session (one Restore point).
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { diffSessions, applyDelta } from '../session-diff-core.js';
import { setStatus, esc } from '../w23-ui.js';

export function snapshotOptions(ctx) {
  const sv = ctx.sessionVersions;
  const list = sv?.list?.() || [];
  return [{ id: 'now', label: 'Now (live session)' }, ...list.slice().reverse().map((s) => ({ id: s.id, label: `${new Date(s.at).toLocaleTimeString()} · ${s.label}` }))];
}
export function snapshotJson(ctx, id) {
  if (id === 'now') return ctx.engine.toJSON();
  return ctx.sessionVersions?.get?.(id)?.json || null;
}

registerFeature({
  id: 'session-diff',
  title: 'Session Diff',
  blurb: 'Compare two snapshots (tempo, loop, tracks, levels, EQ, clips) and apply only the deltas you tick.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>A</span><select data-sd-a></select></label>
        <label class="field"><span>B</span><select data-sd-b></select></label>
      </div>
      <div class="btn-row"><button type="button" class="btn sm ghost" data-sd-cmp>Compare</button><button type="button" class="btn sm ghost" data-sd-all>Tick all</button></div>
      <ul class="sx-god-list" data-sd-list></ul>
      <div class="btn-row"><button type="button" class="btn primary sm" data-sd-take="a">Apply A’s values</button><button type="button" class="btn sm" data-sd-take="b">Apply B’s values</button></div>
      <p class="fineprint" data-sd-status>Snapshots come from Session Versions (auto + every God Mode Apply) · DEMO</p>
    `;
    const aSel = card.querySelector('[data-sd-a]');
    const bSel = card.querySelector('[data-sd-b]');
    const list = card.querySelector('[data-sd-list]');
    const status = card.querySelector('[data-sd-status]');
    let deltas = [];
    const fill = () => {
      const opts = snapshotOptions(ctx).map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('');
      const ka = aSel.value; const kb = bSel.value;
      aSel.innerHTML = opts; bSel.innerHTML = opts;
      aSel.value = ka || (aSel.options[1]?.value || 'now');
      bSel.value = kb || 'now';
    };
    fill();
    aSel.addEventListener('focus', fill);
    bSel.addEventListener('focus', fill);
    const compare = () => {
      const a = snapshotJson(ctx, aSel.value);
      const b = snapshotJson(ctx, bSel.value);
      if (!a || !b) { setStatus(status, 'Snapshot unavailable (session versions not ready).'); return; }
      deltas = diffSessions(a, b);
      list.innerHTML = deltas.length ? deltas.slice(0, 80).map((d, i) => `<li><label class="grow"><input type="checkbox" data-sd-i="${i}" /> ${esc(d.label)}</label></li>`).join('') : '<li class="fineprint">No differences.</li>';
      setStatus(status, `${deltas.length} deltas between A and B`);
    };
    card.querySelector('[data-sd-cmp]').addEventListener('click', compare);
    card.querySelector('[data-sd-all]').addEventListener('click', () => list.querySelectorAll('[data-sd-i]').forEach((x) => { x.checked = true; }));
    card.querySelectorAll('[data-sd-take]').forEach((btn) => btn.addEventListener('click', async () => {
      const side = btn.dataset.sdTake;
      const chosen = [...list.querySelectorAll('[data-sd-i]:checked')].map((x) => deltas[Number(x.dataset.sdI)]).filter(Boolean);
      if (!chosen.length) { setStatus(status, 'Tick at least one delta.'); return; }
      try {
        await godApply(ctx, `Session Diff · take ${side.toUpperCase()} (${chosen.length})`, async () => {
          chosen.forEach((d) => applyDelta(ctx.engine, d, side));
          ctx.engine._emit('tracks', ctx.engine.tracks);
        });
        setStatus(status, `Applied ${chosen.length} delta${chosen.length > 1 ? 's' : ''} from ${side.toUpperCase()} · undo via Restore`);
        compare();
      } catch (e) { setStatus(status, `✗ ${e.message}`); }
    }));
  },
});
