/**
 * W2 #3 Genre Morph Agent — Hip-Hop → Afro Tech (+ sibling maps) as one validated command batch:
 * tempo (jump or bar-quantized ride), four-on-floor kick + clap, shaker / conga / rim perc with
 * genre swing, optional source-drum mute and FX inserts. Rhythm tables are hand-written (genre-maps.js).
 */
import { registerFeature } from '../registry.js';
import { makeBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { GENRES, MORPH_SOURCES, MORPH_TARGETS, morphCommands, describeMorph, guessGenre } from '../genre-maps.js';
import { songBars } from '../sections.js';
import { findRoleTrack } from '../roles.js';
import { setStatus, esc } from '../w23-ui.js';

export function buildMorph(ctx, { from, to, span, rampBars, muteSource, withFx, seed = 1 }) {
  const engine = ctx.engine;
  const src = from === 'auto' ? guessGenre(engine.bpm) : from;
  let startBar = 0;
  let bars = 8;
  if (span === 'loop') { startBar = Math.floor(engine.loopStart); bars = Math.max(1, Math.min(32, Math.round(engine.loopEnd - engine.loopStart))); }
  else if (span === 'song') bars = Math.max(4, Math.min(32, songBars(engine) || 8));
  else bars = Number(span) || 8;
  const drums = findRoleTrack(engine, 'drums');
  const cmds = morphCommands(src, to, {
    startBar, bars, bpmRampBars: rampBars, muteSource, sourceDrumTrack: drums && !/^Morph /.test(drums.name) ? drums.name : null, withFx, seed,
  });
  return { src, cmds, startBar, bars };
}

registerFeature({
  id: 'genre-morph-agent',
  title: 'Genre Morph Agent',
  blurb: 'Hip-Hop → Afro Tech (and Amapiano / Afro House / Gqom / House) — BPM, four-on-floor, shaker + conga perc, swing and FX as one undoable batch.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    const opt = (ids, sel) => ids.map((id) => `<option value="${id}"${id === sel ? ' selected' : ''}>${esc(GENRES[id].label)}</option>`).join('');
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>From</span><select data-gm-from><option value="auto">Auto (from BPM)</option>${opt(MORPH_SOURCES, 'hiphop')}</select></label>
        <label class="field"><span>To</span><select data-gm-to>${opt(MORPH_TARGETS, 'afrotech')}</select></label>
      </div>
      <div class="sx-god-row">
        <label class="field"><span>Span</span><select data-gm-span><option value="8">8 bars from bar 1</option><option value="16">16 bars</option><option value="4">4 bars</option><option value="loop">Loop region</option><option value="song">Whole song (≤32)</option></select></label>
        <label class="field"><span>Tempo</span><select data-gm-ramp><option value="0">Jump</option><option value="4">Ride over 4 bars</option><option value="8">Ride over 8 bars</option></select></label>
      </div>
      <div class="sx-god-checks">
        <label><input type="checkbox" data-gm-mute checked /> Mute source drums</label>
        <label><input type="checkbox" data-gm-fx checked /> Add genre FX (comp / delay / space)</label>
      </div>
      <p class="fineprint" data-gm-desc></p>
      <div class="sx-god-out" data-gm-plan></div>
      <div class="btn-row">
        <button type="button" class="btn sm ghost" data-gm-preview>Preview plan</button>
        <button type="button" class="btn primary sm" data-gm-go>Morph</button>
        <button type="button" class="btn sm ghost" data-gm-reroll title="New seed for perc humanization">Re-roll</button>
      </div>
      <p class="fineprint" data-gm-status>Heuristic groove maps — not a neural model · one Restore point · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-gm-status]');
    const planEl = card.querySelector('[data-gm-plan]');
    const desc = card.querySelector('[data-gm-desc]');
    let seed = 1;
    const read = () => ({
      from: card.querySelector('[data-gm-from]').value,
      to: card.querySelector('[data-gm-to]').value,
      span: card.querySelector('[data-gm-span]').value,
      rampBars: Number(card.querySelector('[data-gm-ramp]').value) || 0,
      muteSource: card.querySelector('[data-gm-mute]').checked,
      withFx: card.querySelector('[data-gm-fx]').checked,
      seed,
    });
    const preview = () => {
      const o = read();
      const { src, cmds } = buildMorph(ctx, o);
      desc.textContent = describeMorph(src, o.to);
      planEl.textContent = cmds.map((c, i) => `${i + 1}. ${describeCommand(c)}${c._why ? ` — ${c._why}` : ''}`).join('\n');
      return cmds;
    };
    card.addEventListener('change', preview);
    card.querySelector('[data-gm-preview]').addEventListener('click', preview);
    card.querySelector('[data-gm-reroll]').addEventListener('click', () => { seed += 1; preview(); setStatus(status, `Seed ${seed} — Morph to apply`); });
    card.querySelector('[data-gm-go]').addEventListener('click', async () => {
      await engine.init();
      const o = read();
      const cmds = preview();
      const res = await executeBatch(ctx, makeBatch(`Genre Morph ${GENRES[buildMorph(ctx, o).src].label} → ${GENRES[o.to].label}`, cmds));
      setStatus(status, resultLine(res));
    });
    preview();
  },
});
