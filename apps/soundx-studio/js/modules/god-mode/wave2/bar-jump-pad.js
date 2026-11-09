/**
 * W2 #4 Bar Jump Pad — one tap to any bar or marker (start, loop braces, sections, song end).
 * Jumps move the playhead only (no session change); “Loop 4 from here” applies via the protocol.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { detectSections, songBars, songEndBeat, seekBar } from '../sections.js';
import { onEngine, setStatus, esc, fmtBar } from '../w23-ui.js';

registerFeature({
  id: 'bar-jump-pad',
  title: 'Bar Jump Pad',
  blurb: '1-tap jump to any bar or marker (Start · { In · Out } · sections · End). Toggle Loop mode to set a loop from the tapped bar.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-chips" data-bj-markers></div>
      <div class="sx-god-pad-grid" data-bj-grid></div>
      <div class="sx-god-row">
        <label class="toggle"><input type="checkbox" data-bj-loop /> <span>Loop mode</span></label>
        <label class="field"><span>Loop bars</span><select data-bj-len><option>2</option><option selected>4</option><option>8</option></select></label>
      </div>
      <p class="fineprint" data-bj-status>Tap a bar · gold border = section start</p>
    `;
    const engine = ctx.engine;
    const grid = card.querySelector('[data-bj-grid]');
    const markers = card.querySelector('[data-bj-markers]');
    const status = card.querySelector('[data-bj-status]');
    const render = () => {
      const secs = detectSections(engine);
      const starts = new Set(secs.map((s) => Math.floor(s.startBar)));
      const n = Math.min(64, Math.max(16, songBars(engine) + 4));
      grid.innerHTML = Array.from({ length: n }, (_, i) => `<button type="button" class="btn ghost${starts.has(i) ? ' is-section' : ''}" data-bar="${i}" title="Bar ${i + 1}">${i + 1}</button>`).join('');
      const end = songEndBeat(engine) / 4;
      const mk = [
        ['Start', 0], ['{ In', engine.loopStart], ['Out }', Math.max(0, engine.loopEnd - 1)],
        ...secs.map((s) => [s.label, s.startBar]), ...(end ? [['End', Math.max(0, end - 1)]] : []),
      ];
      markers.innerHTML = mk.map(([l, b]) => `<button type="button" class="btn sm ghost sx-god-chip" data-bar="${b}">${esc(l)}</button>`).join('');
    };
    onEngine(engine, 'tracks', render, card);
    onEngine(engine, 'loop', render, card);
    render();
    card.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-bar]');
      if (!b) return;
      const bar = Number(b.dataset.bar);
      if (card.querySelector('[data-bj-loop]').checked) {
        const len = Number(card.querySelector('[data-bj-len]').value) || 4;
        const res = await executeBatch(ctx, makeBatch(`Loop ${len} from bar ${bar + 1}`, [{ action: 'set_loop_region', start_bar: bar, end_bar: bar + len, looping: true }]));
        setStatus(status, resultLine(res));
      }
      seekBar(engine, bar);
      setStatus(status, `Playhead → bar ${fmtBar(bar + 1)}${engine.isPlaying ? ' (playing)' : ''}`);
    });
  },
});
