/**
 * W3 #11 Auto-Mix Balancer — renders each track pre-fader (offline), measures RMS + band balance
 * in the worker, then proposes fader trims toward role targets (drums anchor, bass −2, vox +1,
 * keys −5, fx −9 dB) plus low-cut EQ where non-bass tracks mask the low end. Preview → Apply.
 * Loudness rules, not a learned mix model.
 */
import { registerFeature } from '../registry.js';
import { makeBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine, linToDb } from '../command-exec.js';
import { renderRegion, toMono } from '../audio-kit.js';
import { analyze, analysisMode } from '../analysis.js';
import { songBars } from '../sections.js';
import { roleOfTrack } from '../roles.js';
import { setStatus, busy, planHtml } from '../w23-ui.js';

export const ROLE_TARGET = { drums: 0, bass: -2, vox: 1, keys: -5, fx: -9, other: -6 };
const r1 = (v) => Math.round(v * 10) / 10;
const eqVal = (db) => +((Math.max(-12, Math.min(12, db)) + 12) / 24).toFixed(4);

export async function measureTracks(engine, { maxBars = 16 } = {}) {
  await engine.init();
  const bars = Math.max(1, Math.min(maxBars, songBars(engine)));
  const out = [];
  for (const t of engine.tracks.filter((x) => x.clips.length && !x.muted)) {
    const buf = await renderRegion(engine, 0, bars * 4, { trackIds: [t.id], channels: 1, tailSec: 0 });
    const r = await analyze('stemStats', { data: toMono(buf), sr: buf.sampleRate });
    out.push({ track: t, role: roleOfTrack(t), pre: r.stats.rmsDb, stats: r.stats, faderDb: r1(linToDb(t.volume ?? 0.8)) });
  }
  return out;
}

/** Pure planner (unit-tested): measured → commands. */
export function balancePlan(measured, { strength = 1, lowCut = true } = {}) {
  const live = measured.filter((m) => !m.stats.silent);
  if (!live.length) return { cmds: [], rows: [] };
  const anchor = live.find((m) => m.role === 'drums') || live.reduce((a, b) => (a.pre + a.faderDb > b.pre + b.faderDb ? a : b));
  const anchorPost = anchor.pre + anchor.faderDb;
  const anchorOff = ROLE_TARGET[anchor.role] ?? 0;
  let rows = live.map((m) => {
    const want = anchorPost - anchorOff + (ROLE_TARGET[m.role] ?? -6);
    const ideal = want - m.pre;
    const next = m.faderDb + (ideal - m.faderDb) * strength;
    return { ...m, next };
  });
  const over = Math.max(...rows.map((r) => r.next));
  if (over > 0) rows = rows.map((r) => ({ ...r, next: r.next - over })); // engine faders max out at 0 dB
  rows = rows.map((r) => ({ ...r, next: r1(Math.max(-40, r.next)) }));
  const cmds = [];
  rows.forEach((r) => { if (Math.abs(r.next - r.faderDb) >= 0.5) cmds.push({ action: 'set_track_state', track: r.track.id, volume_db: r.next, ramp_ms: 120 }); });
  if (lowCut) {
    const bassy = rows.filter((r) => r.role === 'bass' || r.role === 'drums').some((r) => r.stats.low > 0.4);
    rows.filter((r) => !['bass', 'drums'].includes(r.role) && r.stats.low > 0.3).forEach((r) => {
      const cut = bassy ? -4 : -2;
      r.lowCut = cut;
      cmds.push({ action: 'set_parameter', track: r.track.id, param: 'eq_low', value: eqVal((r.track.eq?.low || 0) + cut), ramp_ms: 120 });
    });
  }
  return { cmds, rows };
}

registerFeature({
  id: 'auto-mix-balancer',
  title: 'Auto-Mix Balancer',
  blurb: 'Measures every track pre-fader and trims faders toward role targets (drums anchor, bass −2, vox +1, keys −5 dB) with low-cut where tracks mask the bass.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <label class="field sx-god-field"><span>Strength <em data-am-sv>100%</em></span><input type="range" min="0.25" max="1" step="0.05" value="1" data-am-str /></label>
      <label class="toggle"><input type="checkbox" data-am-cut checked /> <span>Low-cut masking tracks</span></label>
      <div class="sx-god-out" data-am-table></div>
      <div data-am-plan></div>
      <div class="btn-row"><button type="button" class="btn sm" data-am-an>Analyse mix</button><button type="button" class="btn primary sm" data-am-apply disabled>Apply balance</button></div>
      <p class="fineprint" data-am-status>Offline solo renders → RMS per track (worker) · loudness rules · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-am-status]');
    const applyBtn = card.querySelector('[data-am-apply]');
    let measured = []; let plan = null;
    const opts = () => ({ strength: Number(card.querySelector('[data-am-str]').value), lowCut: card.querySelector('[data-am-cut]').checked });
    const show = () => {
      plan = balancePlan(measured, opts());
      card.querySelector('[data-am-table]').textContent = plan.rows.map((r) => `${r.track.name.slice(0, 16).padEnd(17)}${r.role.padEnd(7)}rms ${String(r.pre).padStart(6)} dB  fader ${String(r.faderDb).padStart(6)} → ${String(r.next).padStart(6)} dB${r.lowCut ? `  low ${r.lowCut} dB` : ''}`).join('\n');
      card.querySelector('[data-am-plan]').innerHTML = plan.cmds.length ? planHtml(plan.cmds.map(describeCommand)) : '<p class="fineprint">Already balanced to the role targets.</p>';
      applyBtn.disabled = !plan.cmds.length;
    };
    card.querySelector('[data-am-str]').addEventListener('input', (e) => { card.querySelector('[data-am-sv]').textContent = `${Math.round(e.target.value * 100)}%`; if (measured.length) show(); });
    card.querySelector('[data-am-cut]').addEventListener('change', () => measured.length && show());
    card.querySelector('[data-am-an]').addEventListener('click', async (e) => {
      busy(e.target, true, 'Measuring…');
      try {
        measured = await measureTracks(engine);
        show();
        setStatus(status, `${measured.length} tracks measured (${analysisMode()}) · review, then Apply balance`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    applyBtn.addEventListener('click', async () => {
      if (!plan?.cmds.length) return;
      const res = await executeBatch(ctx, makeBatch('Auto-Mix Balancer', plan.cmds.slice(0, 64)));
      setStatus(status, resultLine(res));
      if (res.status === 'success') measured = measured.map((m) => ({ ...m, faderDb: r1(linToDb(m.track.volume ?? 0.8)) }));
    });
  },
});
