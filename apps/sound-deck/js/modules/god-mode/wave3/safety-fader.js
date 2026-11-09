/**
 * W3 #19 Safety Fader — before export: offline-render the song (or loop), find the sample peak,
 * and plan a master trim to your ceiling (+ an optional MM Limiter on master). Live guard reads
 * per-track/master AnalyserNode telemetry and names who is clipping. Honest: the offline render
 * excludes master EQ/inserts (live meters include them); the limiter is a fast compressor, not a
 * true-peak brickwall.
 */
import { registerFeature } from '../registry.js';
import { makeBatch, describeCommand } from '../command-schema.js';
import { executeBatch, resultLine, linToDb } from '../command-exec.js';
import { renderRegion } from '../audio-kit.js';
import { songEndBeat } from '../sections.js';
import { startTelemetry, onTelemetry, resetClips, whoIsClipping } from '../telemetry.js';
import { setStatus, busy, planHtml, esc } from '../w23-ui.js';

export function bufferPeakDb(buf) {
  let pk = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; } }
  return linToDb(pk);
}

/** Pure planner: peak + ceiling → commands. */
export function safetyCommands({ peakDb, ceilingDb = -1, masterDb, hasLimiter = false, addLimiter = true }) {
  const cmds = [];
  const over = peakDb - ceilingDb;
  if (over > 0.05) cmds.push({ action: 'set_track_state', track: 'master', volume_db: Math.floor((masterDb - over) * 10) / 10, ramp_ms: 200 });
  if (addLimiter && !hasLimiter && peakDb > ceilingDb - 3) cmds.push({ action: 'insert_fx', track: 'master', fx_id: 'limiter', preset: 0.3 });
  return cmds;
}

export async function safetyScan(ctx, { scope = 'song', ceilingDb = -1, addLimiter = true } = {}) {
  const engine = ctx.engine;
  const s = scope === 'loop' ? engine.loopStart * 4 : 0;
  const e = scope === 'loop' ? engine.loopEnd * 4 : Math.max(4, songEndBeat(engine));
  const buf = await renderRegion(engine, s, e, { tailSec: 0.3 });
  const peakDb = Math.round(bufferPeakDb(buf) * 10) / 10;
  const masterDb = Math.round(linToDb(engine._masterVol ?? 0.85) * 10) / 10;
  const inserts = ctx.inserts || engine.inserts;
  const hasLimiter = (inserts?.list?.('master') || []).some((i) => i.type === 'limiter');
  return { peakDb, masterDb, cmds: safetyCommands({ peakDb, ceilingDb, masterDb, hasLimiter, addLimiter }), seconds: buf.duration };
}

registerFeature({
  id: 'safety-fader',
  title: 'Safety Fader',
  blurb: 'Pre-export peak guard: render, measure the peak, trim the master to your ceiling (+ optional limiter). Live guard names the tracks that clip.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Scope</span><select data-sf-scope><option value="song">Whole song</option><option value="loop">Loop region</option></select></label>
        <label class="field"><span>Ceiling</span><select data-sf-ceil><option value="-0.3">−0.3 dBFS</option><option value="-1" selected>−1 dBFS</option><option value="-3">−3 dBFS</option><option value="-6">−6 dBFS (mix headroom)</option></select></label>
      </div>
      <label class="toggle"><input type="checkbox" data-sf-lim checked /> <span>Add MM Limiter on master if near ceiling</span></label>
      <div data-sf-plan></div>
      <div class="btn-row"><button type="button" class="btn sm" data-sf-go>Scan peaks</button><button type="button" class="btn primary sm" data-sf-apply disabled>Apply guard</button></div>
      <label class="toggle"><input type="checkbox" data-sf-live /> <span>Live guard (meters while playing)</span></label>
      <p class="fineprint" data-sf-live-out></p>
      <p class="fineprint" data-sf-status>Offline render peak (pre master EQ/inserts) · honest limiter = fast compressor · DEMO</p>
    `;
    const engine = ctx.engine;
    const status = card.querySelector('[data-sf-status]');
    const applyBtn = card.querySelector('[data-sf-apply]');
    let scan = null;
    const opts = () => ({ scope: card.querySelector('[data-sf-scope]').value, ceilingDb: Number(card.querySelector('[data-sf-ceil]').value), addLimiter: card.querySelector('[data-sf-lim]').checked });
    card.querySelector('[data-sf-go]').addEventListener('click', async (e) => {
      busy(e.target, true, 'Rendering…');
      try {
        scan = await safetyScan(ctx, opts());
        card.querySelector('[data-sf-plan]').innerHTML = scan.cmds.length ? planHtml(scan.cmds.map(describeCommand)) : '';
        applyBtn.disabled = !scan.cmds.length;
        setStatus(status, `Peak ${scan.peakDb} dBFS over ${scan.seconds.toFixed(1)} s · master ${scan.masterDb} dB · ${scan.cmds.length ? 'guard planned' : 'already under the ceiling ✓'}`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    applyBtn.addEventListener('click', async () => {
      if (!scan?.cmds.length) return;
      setStatus(status, resultLine(await executeBatch(ctx, makeBatch('Safety Fader', scan.cmds))));
      applyBtn.disabled = true;
    });
    let stop = null; let off = null;
    const liveOut = card.querySelector('[data-sf-live-out]');
    card.querySelector('[data-sf-live]').addEventListener('change', (e) => {
      if (e.target.checked) {
        resetClips();
        stop = startTelemetry(engine);
        off = onTelemetry((snap) => {
          if (!card.isConnected) { off?.(); stop?.(); return; }
          const m = snap.master;
          const bad = whoIsClipping();
          liveOut.innerHTML = `Master ${m ? `${m.peakDb} dB peak · hold ${m.holdDb} dB` : '—'} · ${bad.length ? `<strong>clipping: ${esc(bad.map((b) => `${b.name} (${b.clips})`).join(', '))}</strong> — scan + Apply guard` : 'no clipping'}`;
        });
      } else { off?.(); stop?.(); off = null; stop = null; liveOut.textContent = ''; }
    });
  },
});
