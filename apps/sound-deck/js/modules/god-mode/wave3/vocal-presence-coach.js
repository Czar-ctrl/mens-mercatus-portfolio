/**
 * W3 #15 Vocal Presence Coach — measures the vocal track and the rest of the mix over the same bars
 * (band balance, crest, level gap) and writes a clarity recipe as one batch: low-cut, compression
 * sized to the vocal's crest, presence/air EQ, and a mid dip on the keys that mask it.
 * Uses the built-in DEMO inserts (MM Low Cut, MM Comp) — rules, not a trained vocal model.
 */
import { registerFeature } from '../registry.js';
import { makeBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine, linToDb } from '../command-exec.js';
import { renderRegion, toMono } from '../audio-kit.js';
import { analyze } from '../analysis.js';
import { songBars } from '../sections.js';
import { roleOfTrack, tracksByRole } from '../roles.js';
import { bindTrackSelect, setStatus, busy, planHtml, focusCard } from '../w23-ui.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const eqVal = (db) => +((clamp(db, -12, 12) + 12) / 24).toFixed(4);

/** Pure recipe builder. */
export function presenceRecipe({ vox, voxStats, mixStats, inserts, maskers = [] }) {
  const cmds = [];
  const why = [];
  const have = (inserts?.list?.(vox.id) || []).map((i) => i.type);
  if (!have.includes('eqlow') && voxStats.low > 0.12) { cmds.push({ action: 'insert_fx', track: vox.id, fx_id: 'eqlow', preset: clamp(0.15 + voxStats.low, 0.2, 0.5) }); why.push(`${Math.round(voxStats.low * 100)}% of vocal energy < 200 Hz → low-cut`); }
  if (!have.includes('comp')) {
    const amt = clamp((voxStats.crestDb - 8) / 14, 0.2, 0.75);
    cmds.push({ action: 'insert_fx', track: vox.id, fx_id: 'comp', preset: +amt.toFixed(2) });
    why.push(`crest ${voxStats.crestDb} dB → comp ${Math.round(amt * 100)}%`);
  }
  const eq = vox.eq || { low: 0, mid: 0, high: 0 };
  const presence = clamp((mixStats.mid - voxStats.mid) * 12 + 2, 1, 4);
  cmds.push({ action: 'set_parameter', track: vox.id, param: 'eq_mid', value: eqVal(eq.mid + presence), ramp_ms: 80 });
  why.push(`presence +${presence.toFixed(1)} dB`);
  if (voxStats.high < 0.12) { cmds.push({ action: 'set_parameter', track: vox.id, param: 'eq_high', value: eqVal(eq.high + 2.5), ramp_ms: 80 }); why.push('air +2.5 dB (dull top end)'); }
  const gap = voxStats.rmsDb - mixStats.rmsDb;
  if (gap < -4) {
    const up = Math.min(0, Math.round((linToDb(vox.volume ?? 0.8) + Math.min(6, -4 - gap)) * 10) / 10);
    cmds.push({ action: 'set_track_state', track: vox.id, volume_db: up, ramp_ms: 120 });
    why.push(`vocal sits ${(-gap).toFixed(1)} dB under the mix → fader ${up} dB`);
  }
  maskers.forEach((t) => { cmds.push({ action: 'set_parameter', track: t.id, param: 'eq_mid', value: eqVal((t.eq?.mid || 0) - 2), ramp_ms: 80 }); why.push(`${t.name} mid −2 dB (masking)`); });
  return { cmds, why };
}

registerFeature({
  id: 'vocal-presence-coach',
  title: 'Vocal Presence Coach',
  blurb: 'Measures your vocal against the mix and writes a clarity recipe: low-cut, crest-sized compression, presence/air EQ, and a mid dip on masking keys.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row"><label class="field"><span>Vocal track</span><select data-vp-track></select></label></div>
      <label class="toggle"><input type="checkbox" data-vp-mask checked /> <span>Dip mids on keys/pads</span></label>
      <div data-vp-plan></div>
      <div class="btn-row"><button type="button" class="btn sm" data-vp-an>Coach me</button><button type="button" class="btn primary sm" data-vp-apply disabled>Apply recipe</button><button type="button" class="btn sm ghost" data-vp-duck>Vocal Duck Conductor</button></div>
      <p class="fineprint" data-vp-status>DEMO inserts (MM Low Cut / MM Comp) + channel EQ · rules from band balance</p>
    `;
    const engine = ctx.engine;
    const sel = card.querySelector('[data-vp-track]');
    const status = card.querySelector('[data-vp-status]');
    const applyBtn = card.querySelector('[data-vp-apply]');
    bindTrackSelect(sel, ctx);
    const vox = tracksByRole(engine, 'vox')[0];
    if (vox) sel.value = vox.id;
    let plan = null;
    card.querySelector('[data-vp-an]').addEventListener('click', async (e) => {
      const t = engine.tracks.find((x) => x.id === sel.value);
      if (!t?.clips.length) { setStatus(status, 'Pick a vocal track with clips (or record one in Vocals / Mic)'); return; }
      busy(e.target, true, 'Listening…');
      try {
        const bars = Math.max(1, Math.min(16, songBars(engine)));
        const vb = await renderRegion(engine, 0, bars * 4, { trackIds: [t.id], channels: 1, tailSec: 0 });
        const others = engine.tracks.filter((x) => x.id !== t.id && !x.muted && x.clips.length).map((x) => x.id);
        const mb = others.length ? await renderRegion(engine, 0, bars * 4, { trackIds: others, channels: 1, tailSec: 0 }) : vb;
        const voxStats = (await analyze('stemStats', { data: toMono(vb), sr: vb.sampleRate })).stats;
        const mixStats = (await analyze('stemStats', { data: toMono(mb), sr: mb.sampleRate })).stats;
        if (voxStats.silent) throw new Error('vocal track is silent in the first 16 bars');
        const maskers = card.querySelector('[data-vp-mask]').checked ? engine.tracks.filter((x) => x.id !== t.id && roleOfTrack(x) === 'keys' && x.clips.length) : [];
        plan = presenceRecipe({ vox: t, voxStats, mixStats, inserts: ctx.inserts || engine.inserts, maskers });
        card.querySelector('[data-vp-plan]').innerHTML = planHtml(plan.cmds.map(describeCommand), plan.why.join(' · '));
        applyBtn.disabled = !plan.cmds.length;
        const asVox = roleOfTrack(t) === 'vox' ? '' : ` · note: “${t.name}” is not tagged as a vocal — treating it as one`;
        setStatus(status, `Vocal ${voxStats.rmsDb} dB RMS vs mix ${mixStats.rmsDb} dB · review, then Apply recipe${asVox}`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    applyBtn.addEventListener('click', async () => {
      if (!plan) return;
      setStatus(status, resultLine(await executeBatch(ctx, makeBatch('Vocal Presence Coach', plan.cmds))));
      applyBtn.disabled = true;
    });
    card.querySelector('[data-vp-duck]').addEventListener('click', () => focusCard('vocal-duck-conductor'));
  },
});
