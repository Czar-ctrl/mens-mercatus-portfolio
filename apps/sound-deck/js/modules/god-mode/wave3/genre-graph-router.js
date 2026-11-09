/**
 * W3 #3 Genre Graph Router — breadth-first route through a hand-built genre graph
 * (e.g. Hip-Hop → Amapiano → Afro Tech) and lay one groove segment per hop, with a tempo ride
 * to the destination BPM. Graph + groove tables are hand-written (no model).
 */
import { registerFeature } from '../registry.js';
import { makeBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { GENRES, GENRE_EDGES, genrePath, guessGenre, styleLayers } from '../genre-maps.js';
import { findRoleTrack } from '../roles.js';
import { songBars } from '../sections.js';
import { setStatus, planHtml, esc } from '../w23-ui.js';

/** Build the multi-hop plan. */
export function routeCommands(engine, path, { segBars = 4, startBar = 0, ride = true, muteSource = true } = {}) {
  const cmds = [];
  const dest = GENRES[path[path.length - 1]];
  const totalBars0 = path.length * segBars;
  // Tempo first so pattern clips render at the destination tempo.
  if (ride && path.length > 1 && Math.abs(engine.bpm - dest.target) >= 1) cmds.push({ action: 'set_bpm', bpm: dest.target, ramp_bars: Math.max(1, Math.min(64, totalBars0 - segBars)) });
  else cmds.push({ action: 'set_bpm', bpm: dest.target });
  const drums = findRoleTrack(engine, 'drums');
  if (muteSource && drums && !/^Route /.test(drums.name)) cmds.push({ action: 'set_track_state', track: drums.name, mute: true });
  path.forEach((g, i) => {
    const G = GENRES[g];
    const layers = styleLayers(G.style);
    const kit = layers.filter((l) => ['kick', 'clap', 'snare', 'hat'].includes(l));
    const perc = layers.filter((l) => !kit.includes(l));
    const bar = startBar + i * segBars;
    const last = i === path.length - 1;
    cmds.push({ action: 'add_clip', track: 'Route Drums', create_track: true, bar, name: `${G.label} (hop ${i + 1})`, source: { type: 'pattern', style: G.style, bars: segBars, swing: G.swing, layers: kit.length ? kit : layers, seed: i + 1, fill_last_bar: !last } });
    if (perc.length) cmds.push({ action: 'add_clip', track: 'Route Perc', create_track: true, bar, name: `${G.label} perc`, source: { type: 'pattern', style: G.style, bars: segBars, swing: G.swing, layers: perc, seed: i + 11 } });
  });
  const totalBars = path.length * segBars;
  cmds.push({ action: 'set_loop_region', start_bar: startBar, end_bar: startBar + totalBars, looping: true });
  return cmds;
}

registerFeature({
  id: 'genre-graph-router',
  title: 'Genre Graph Router',
  blurb: 'Multi-hop genre morph: finds a path through a genre graph (Hip-Hop → Amapiano → Afro Tech) and lays one groove segment per hop with a tempo ride.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    const engine = ctx.engine;
    const opts = (sel) => Object.entries(GENRES).map(([id, g]) => `<option value="${id}"${id === sel ? ' selected' : ''}>${esc(g.label)}</option>`).join('');
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>From</span><select data-gr-from>${opts(guessGenre(engine.bpm))}</select></label>
        <label class="field"><span>To</span><select data-gr-to>${opts('afrotech')}</select></label>
        <label class="field"><span>Bars / hop</span><select data-gr-seg><option>2</option><option selected>4</option><option>8</option></select></label>
      </div>
      <div class="sx-god-checks"><label><input type="checkbox" data-gr-ride checked /> Tempo ride</label><label><input type="checkbox" data-gr-mute checked /> Mute source drums</label><label><input type="checkbox" data-gr-end /> Append after song end</label></div>
      <p class="fineprint" data-gr-path></p>
      <div data-gr-plan></div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-gr-go>Apply route</button></div>
      <p class="fineprint" data-gr-status>${GENRE_EDGES.length} hand-made edges · breadth-first shortest path · DEMO</p>
    `;
    const status = card.querySelector('[data-gr-status]');
    const read = () => ({
      from: card.querySelector('[data-gr-from]').value,
      to: card.querySelector('[data-gr-to]').value,
      segBars: Number(card.querySelector('[data-gr-seg]').value),
      ride: card.querySelector('[data-gr-ride]').checked,
      muteSource: card.querySelector('[data-gr-mute]').checked,
      startBar: card.querySelector('[data-gr-end]').checked ? songBars(engine) : 0,
    });
    const preview = () => {
      const o = read();
      const path = genrePath(o.from, o.to);
      card.querySelector('[data-gr-path]').textContent = path ? `Route: ${path.map((g) => `${GENRES[g].label} ${GENRES[g].target}`).join(' → ')} BPM` : 'No route between those genres';
      card.querySelector('[data-gr-plan]').innerHTML = path ? planHtml(routeCommands(engine, path, o).map(describeCommand)) : '';
      return path;
    };
    card.addEventListener('change', (e) => { if (e.target.matches('select,input')) preview(); });
    preview();
    card.querySelector('[data-gr-go]').addEventListener('click', async () => {
      const o = read();
      const path = preview();
      if (!path) return;
      const res = await executeBatch(ctx, makeBatch(`Genre route ${path.join(' → ')}`.slice(0, 120), routeCommands(engine, path, o)));
      setStatus(status, resultLine(res));
    });
  },
});
