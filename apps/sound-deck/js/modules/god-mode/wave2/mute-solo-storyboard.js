/**
 * W2 #17 Mute-Solo Storyboard — capture mute / solo / level scenes into slots A–D and recall them
 * (ramped, one Restore point). “On next bar” quantizes the switch while playing for A/B drops.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine, linToDb } from '../command-exec.js';
import { setStatus, load, save } from '../w23-ui.js';

const KEY = 'sx-god-storyboard';
const SLOTS = ['A', 'B', 'C', 'D'];

export function sceneCommands(engine, scene) {
  return engine.tracks.filter((t) => scene.tracks[t.id]).map((t) => {
    const s = scene.tracks[t.id];
    return { action: 'set_track_state', track: t.id, mute: !!s.muted, solo: !!s.solo, volume_db: Math.max(-96, Math.min(0, Math.round(linToDb(s.volume) * 10) / 10)), ramp_ms: 30 };
  }).slice(0, 64);
}

registerFeature({
  id: 'mute-solo-storyboard',
  title: 'Mute-Solo Storyboard',
  blurb: 'Save mute / solo / level scenes in slots A–D and flip between them for A/B drops — optionally on the next bar.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-pad-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${SLOTS.map((s) => `<button type="button" class="btn ghost" data-ms-recall="${s}">Scene ${s}</button>`).join('')}</div>
      <div class="sx-god-pad-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${SLOTS.map((s) => `<button type="button" class="btn sm ghost" data-ms-save="${s}">Save ${s}</button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" data-ms-q checked /> <span>Switch on next bar while playing</span></label>
      <p class="fineprint" data-ms-status></p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-ms-status]');
    let scenes = load(KEY, {});
    const mark = () => SLOTS.forEach((s) => {
      const b = card.querySelector(`[data-ms-recall="${s}"]`);
      b.classList.toggle('is-section', !!scenes[s]);
      b.title = scenes[s] ? `${Object.keys(scenes[s].tracks).length} tracks · saved ${new Date(scenes[s].at).toLocaleTimeString()}` : 'Empty — Save first';
    });
    mark();
    setStatus(status, 'Save the current mix to a slot, change mutes, save another, then flip · DEMO');
    card.addEventListener('click', async (e) => {
      const sv = e.target.closest('[data-ms-save]');
      if (sv) {
        const s = sv.dataset.msSave;
        scenes[s] = { at: Date.now(), tracks: Object.fromEntries(engine.tracks.map((t) => [t.id, { muted: !!t.muted, solo: !!t.solo, volume: t.volume }])) };
        save(KEY, scenes);
        mark();
        setStatus(status, `Scene ${s} saved (${engine.tracks.length} tracks)`);
        return;
      }
      const rc = e.target.closest('[data-ms-recall]');
      if (!rc) return;
      const s = rc.dataset.msRecall;
      const scene = scenes[s];
      if (!scene) { setStatus(status, `Scene ${s} is empty`); return; }
      const cmds = sceneCommands(engine, scene);
      if (!cmds.length) { setStatus(status, `Scene ${s} has no matching tracks (project changed)`); return; }
      const fire = async () => {
        const res = await executeBatch(ctx, makeBatch(`Storyboard scene ${s}`, cmds));
        setStatus(status, `Scene ${s}: ${resultLine(res)}`);
      };
      if (engine.isPlaying && card.querySelector('[data-ms-q]').checked) {
        const bar = Math.floor(engine.currentBeat / 4);
        setStatus(status, `Scene ${s} queued for bar ${bar + 2}…`);
        const h = ({ bar: b }) => { if (Math.floor(b) !== bar) { engine.off('tick', h); fire(); } };
        engine.on('tick', h);
      } else fire();
    });
  },
});
