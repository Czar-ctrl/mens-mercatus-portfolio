/**
 * W2 #9 Stem Colorist — tint clips by stem role and give each role an EQ character
 * (drums snap, bass weight, vocal air, keys scoop, fx thin). EQ moves are ramped batch commands.
 */
import { registerFeature } from '../registry.js';
import { makeBatch } from '../command-schema.js';
import { executeBatch, resultLine } from '../command-exec.js';
import { roleOfTrack, ROLE_COLORS } from '../roles.js';
import { setStatus, esc } from '../w23-ui.js';

const PALETTES = {
  role: ROLE_COLORS,
  neon: { drums: '#FFE600', bass: '#A855F7', vox: '#FF2E88', keys: '#00E5FF', fx: '#39FF14', other: '#CBD5E0' },
  pastel: { drums: '#FDE68A', bass: '#C4B5FD', vox: '#FBCFE8', keys: '#BAE6FD', fx: '#BBF7D0', other: '#E2E8F0' },
};
// dB per band (low, mid, high) — gentle character, ±4 dB max
const CHARACTER = {
  drums: { low: 1.5, mid: -1, high: 2 }, bass: { low: 2, mid: 0, high: -2.5 }, vox: { low: -3, mid: 1.5, high: 2.5 },
  keys: { low: -1.5, mid: -1.5, high: 1 }, fx: { low: -4, mid: 0, high: 1 }, other: { low: 0, mid: 0, high: 0 },
};
const v = (db) => +((db + 12) / 24).toFixed(4);

registerFeature({
  id: 'stem-colorist',
  title: 'Stem Colorist',
  blurb: 'Auto-tint clips per stem role and apply a gentle per-role EQ character (drums snap · bass weight · vocal air).',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Palette</span><select data-sc-pal><option value="role">Role gold</option><option value="neon">Neon</option><option value="pastel">Pastel</option></select></label>
        <label class="toggle"><input type="checkbox" data-sc-eq checked /> <span>EQ character</span></label>
      </div>
      <ul class="sx-god-list" data-sc-list></ul>
      <div class="btn-row"><button type="button" class="btn primary sm" data-sc-go>Colorize stems</button><button type="button" class="btn sm ghost" data-sc-refresh>Refresh roles</button></div>
      <p class="fineprint" data-sc-status>Roles from names / Stem Role Classifier tags · DEMO</p>
    `;
    const engine = ctx.engine;
    const list = card.querySelector('[data-sc-list]');
    const status = card.querySelector('[data-sc-status]');
    const render = () => {
      const pal = PALETTES[card.querySelector('[data-sc-pal]').value];
      list.innerHTML = engine.tracks.map((t) => {
        const r = roleOfTrack(t);
        return `<li><span style="width:10px;height:10px;border-radius:3px;background:${pal[r] || pal.other}"></span><span class="grow">${esc(t.name)}</span><span class="fineprint">${r}</span></li>`;
      }).join('');
    };
    card.querySelector('[data-sc-pal]').addEventListener('change', render);
    card.querySelector('[data-sc-refresh]').addEventListener('click', render);
    render();
    card.querySelector('[data-sc-go]').addEventListener('click', async () => {
      const pal = PALETTES[card.querySelector('[data-sc-pal]').value];
      const eq = card.querySelector('[data-sc-eq]').checked;
      const cmds = [];
      if (eq) {
        engine.tracks.forEach((t) => {
          const ch = CHARACTER[roleOfTrack(t)];
          ['low', 'mid', 'high'].forEach((b) => cmds.push({ action: 'set_parameter', track: t.id, param: `eq_${b}`, value: v(ch[b]), ramp_ms: 60 }));
        });
      }
      if (!cmds.length && engine.tracks[0]) cmds.push({ action: 'set_parameter', track: engine.tracks[0].id, param: 'eq_mid', value: v(engine.tracks[0].eq?.mid || 0), ramp_ms: 20 });
      const res = await executeBatch(ctx, makeBatch('Stem Colorist', cmds.slice(0, 64)), {
        extra: () => engine.tracks.forEach((t) => { const c = pal[roleOfTrack(t)] || pal.other; t.clips.forEach((cl) => { cl.color = c; }); }),
      });
      setStatus(status, resultLine(res));
      render();
    });
  },
});
