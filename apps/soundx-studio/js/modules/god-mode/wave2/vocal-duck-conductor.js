/**
 * W2 #13 Vocal Duck Conductor — sidechain-style ducking of the music under vocals.
 * Envelope mode follows the vocal track's RMS from telemetry taps; Clip mode ducks while a vocal
 * clip is under the playhead. Gains move with setTargetAtTime (attack / release) — no clicks.
 * It is not a true per-sample compressor sidechain.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { startTelemetry, snapshot } from '../telemetry.js';
import { rampAllTrackGains, dbToLin } from '../command-exec.js';
import { findRoleTrack } from '../roles.js';
import { bindTrackSelect, setStatus } from '../w23-ui.js';

function stopDuck(engine) {
  const d = engine._godDuck;
  if (!d) return;
  cancelAnimationFrame(d.raf);
  d.stopTel?.();
  engine._godDuck = null;
  rampAllTrackGains(engine, 120);
}

function startDuck(engine, cfg) {
  stopDuck(engine);
  const d = { ...cfg, ducking: false, raf: 0, stopTel: startTelemetry(engine), hits: 0 };
  engine._godDuck = d;
  const loop = () => {
    d.raf = requestAnimationFrame(loop);
    if (!engine.ctx || !engine.isPlaying) { if (d.ducking) { d.ducking = false; rampAllTrackGains(engine, d.release); } return; }
    const vox = engine.tracks.find((t) => t.id === d.voxId);
    if (!vox) return;
    let on;
    if (d.mode === 'clip') {
      const beat = engine.currentBeat;
      on = !vox.muted && vox.clips.some((c) => beat >= c.startBeat && beat < c.startBeat + c.durationBeats);
    } else {
      const s = snapshot()[d.voxId];
      on = !!s && s.rmsDb > d.threshold;
    }
    if (on === d.ducking) return;
    d.ducking = on;
    if (on) d.hits += 1;
    const now = engine.ctx.currentTime;
    const solo = engine.tracks.some((t) => t.solo);
    engine.tracks.forEach((t) => {
      if (t.id === d.voxId || !t.gainNode) return;
      const silent = t.muted || (solo && !t.solo);
      const base = silent ? 0 : t.volume;
      const target = on ? base * dbToLin(d.depth) : base;
      try {
        t.gainNode.gain.cancelScheduledValues(now);
        t.gainNode.gain.setTargetAtTime(target, now, (on ? d.attack : d.release) / 3000);
      } catch (_) {}
    });
  };
  d.raf = requestAnimationFrame(loop);
  return d;
}

registerFeature({
  id: 'vocal-duck-conductor',
  title: 'Vocal Duck Conductor',
  blurb: 'Ducks the beat under the vocal (envelope follower on telemetry taps, or while vocal clips play) with smooth attack / release.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <label class="field sx-god-field"><span>Vocal track</span><select data-vd-track></select></label>
      <div class="sx-god-row">
        <label class="field"><span>Mode</span><select data-vd-mode><option value="env">Envelope (RMS)</option><option value="clip">Vocal clip windows</option></select></label>
        <label class="field"><span>Depth dB</span><input type="number" min="-18" max="-1" step="1" value="-6" data-vd-depth /></label>
      </div>
      <div class="sx-god-row">
        <label class="field"><span>Threshold dBFS</span><input type="number" min="-60" max="-6" step="1" value="-38" data-vd-thr /></label>
        <label class="field"><span>Attack ms</span><input type="number" min="5" max="200" value="30" data-vd-att /></label>
        <label class="field"><span>Release ms</span><input type="number" min="30" max="1500" value="260" data-vd-rel /></label>
      </div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-vd-arm>Arm conductor</button><button type="button" class="btn sm ghost" data-vd-off>Disarm</button></div>
      <p class="fineprint" data-vd-status></p>
    `;
    const engine = ctx.engine;
    const sel = card.querySelector('[data-vd-track]');
    bindTrackSelect(sel, ctx);
    const vox = findRoleTrack(engine, 'vox');
    if (vox) sel.value = vox.id;
    const status = card.querySelector('[data-vd-status]');
    const show = () => setStatus(status, engine._godDuck
      ? `Armed on ${engine.tracks.find((t) => t.id === engine._godDuck.voxId)?.name || '?'} · ${engine._godDuck.mode} · ${engine._godDuck.depth} dB · ${engine._godDuck.hits} ducks so far`
      : 'Disarmed · press Play after arming · DEMO (gain automation, not a sample-accurate sidechain)');
    show();
    card.querySelector('[data-vd-arm]').addEventListener('click', async () => {
      await engine.init();
      if (!sel.value) { setStatus(status, 'Pick a vocal track first.'); return; }
      const cfg = {
        voxId: sel.value, mode: card.querySelector('[data-vd-mode]').value,
        depth: Math.max(-18, Math.min(-1, Number(card.querySelector('[data-vd-depth]').value) || -6)),
        threshold: Number(card.querySelector('[data-vd-thr]').value) || -38,
        attack: Number(card.querySelector('[data-vd-att]').value) || 30,
        release: Number(card.querySelector('[data-vd-rel]').value) || 260,
      };
      await godApply(ctx, 'Arm Vocal Duck Conductor', async () => { startDuck(engine, cfg); });
      show();
    });
    card.querySelector('[data-vd-off]').addEventListener('click', () => { stopDuck(engine); show(); });
  },
});
