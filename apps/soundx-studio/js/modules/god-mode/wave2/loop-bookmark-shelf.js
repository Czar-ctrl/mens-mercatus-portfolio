/**
 * W2 #5 Loop Bookmark Shelf — name and save loop regions, recall them as chips.
 * Stored in localStorage (per browser); recall goes through the command protocol.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { detectSections } from '../sections.js';
import { setStatus, esc, fmtBar, load, save } from '../w23-ui.js';

const KEY = 'sx-god-loop-bookmarks';

registerFeature({
  id: 'loop-bookmark-shelf',
  title: 'Loop Bookmark Shelf',
  blurb: 'Save named loop regions (“Drop A”, “Verse hook”) and recall them from chips. Save all detected sections in one tap.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Name</span><input type="text" data-lb-name placeholder="e.g. Drop A" maxlength="32" /></label>
        <button type="button" class="btn primary sm" data-lb-save>Save current loop</button>
      </div>
      <div class="btn-row"><button type="button" class="btn sm ghost" data-lb-secs>Save detected sections</button><button type="button" class="btn sm ghost" data-lb-clear>Clear shelf</button></div>
      <ul class="sx-god-list" data-lb-list></ul>
      <p class="fineprint" data-lb-status>Stored in this browser · recall = one Restore point · DEMO</p>
    `;
    const engine = ctx.engine;
    const list = card.querySelector('[data-lb-list]');
    const status = card.querySelector('[data-lb-status]');
    let marks = load(KEY, []);
    const render = () => {
      list.innerHTML = marks.length ? marks.map((m, i) => `
        <li><button type="button" class="btn sm ghost sx-god-chip" data-lb-go="${i}">${esc(m.name)}</button>
        <span class="grow fineprint">bars ${fmtBar(m.s + 1)}–${fmtBar(m.e)}</span>
        <button type="button" class="btn sm ghost" data-lb-del="${i}" aria-label="Delete ${esc(m.name)}">✕</button></li>`).join('')
        : '<li class="fineprint">No bookmarks yet.</li>';
    };
    const persist = () => { marks = marks.slice(-24); save(KEY, marks); render(); };
    render();
    card.querySelector('[data-lb-save]').addEventListener('click', () => {
      const name = card.querySelector('[data-lb-name]').value.trim() || `Loop ${marks.length + 1}`;
      marks.push({ name, s: engine.loopStart, e: engine.loopEnd });
      persist();
      setStatus(status, `Saved “${name}” · bars ${fmtBar(engine.loopStart + 1)}–${fmtBar(engine.loopEnd)}`);
    });
    card.querySelector('[data-lb-secs]').addEventListener('click', () => {
      detectSections(engine).forEach((s) => marks.push({ name: s.label, s: s.startBar, e: s.endBar }));
      persist();
      setStatus(status, 'Saved detected sections to the shelf');
    });
    card.querySelector('[data-lb-clear]').addEventListener('click', () => { marks = []; persist(); });
    list.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-lb-del]');
      if (del) { marks.splice(Number(del.dataset.lbDel), 1); persist(); return; }
      const go = e.target.closest('[data-lb-go]');
      const m = go && marks[Number(go.dataset.lbGo)];
      if (!m) return;
      const res = await executeBatch(ctx, makeBatch(`Recall loop ${m.name}`, [{ action: 'set_loop_region', start_bar: m.s, end_bar: m.e, looping: true }]));
      setStatus(status, resultLine(res));
    });
  },
});
