/**
 * W2 #18 Export Loop Clip — bounce exactly the loop region to a WAV one-shot (offline render,
 * same mute / solo / level rules as the main export). Optional: drop the bounce back on a track.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { renderRegion, encodeWav } from '../audio-kit.js';
import { downloadBlob } from '../util.js';
import { songEndBeat } from '../sections.js';
import { onEngine, setStatus, busy, fmtBar } from '../w23-ui.js';

export function normalizeBuffer(buf, ceilingDb = -1) {
  let pk = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); }
  if (pk < 1e-5) return 0;
  const g = Math.pow(10, ceilingDb / 20) / pk;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
  return 20 * Math.log10(pk);
}

export async function bounceLoop(engine, { normalize = true } = {}) {
  const s = engine.loopStart * 4;
  const e = engine.loopEnd * 4;
  const buf = await renderRegion(engine, s, e, { tailSec: 0 });
  const peakDb = normalize ? normalizeBuffer(buf, -1) : null;
  return { buf, peakDb, s, e };
}

registerFeature({
  id: 'export-loop-clip',
  title: 'Export Loop Clip',
  blurb: 'Bounce the current loop region (the { } braces) to a WAV one-shot — download it or drop it back onto a Loop Bounces track.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <p class="fineprint" data-el-range></p>
      <label class="toggle"><input type="checkbox" data-el-norm checked /> <span>Normalize to −1 dBFS</span></label>
      <div class="btn-row"><button type="button" class="btn primary sm" data-el-wav>Download loop WAV</button><button type="button" class="btn sm ghost" data-el-track>Bounce to track</button></div>
      <p class="fineprint" data-el-status>Offline render · local download only · DEMO</p>
    `;
    const engine = ctx.engine;
    const range = card.querySelector('[data-el-range]');
    const status = card.querySelector('[data-el-status]');
    const show = () => { range.textContent = `Loop bars ${fmtBar(engine.loopStart + 1)}–${fmtBar(engine.loopEnd)} (${fmtBar(engine.loopEnd - engine.loopStart)} bars · ${((engine.loopEnd - engine.loopStart) * 4 * engine.secondsPerBeat).toFixed(2)} s @ ${engine.bpm} BPM)`; };
    onEngine(engine, 'loop', show, card);
    onEngine(engine, 'bpm', show, card);
    show();
    card.querySelector('[data-el-wav]').addEventListener('click', async (e) => {
      busy(e.target, true, 'Rendering…');
      try {
        const { buf, peakDb } = await bounceLoop(engine, { normalize: card.querySelector('[data-el-norm]').checked });
        downloadBlob(encodeWav(buf), `soundx-loop-bars-${fmtBar(engine.loopStart + 1)}-${fmtBar(engine.loopEnd)}-${engine.bpm}bpm.wav`);
        setStatus(status, `WAV downloaded · ${buf.duration.toFixed(2)} s${peakDb != null ? ` · source peak ${peakDb.toFixed(1)} dBFS → −1` : ''}`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
    card.querySelector('[data-el-track]').addEventListener('click', async (e) => {
      busy(e.target, true, 'Bouncing…');
      try {
        const { buf, s, e: en } = await bounceLoop(engine, { normalize: card.querySelector('[data-el-norm]').checked });
        let at = 0;
        await godApply(ctx, 'Export Loop Clip → track', async () => {
          const t = engine.tracks.find((x) => x.name === 'Loop Bounces') || engine.addTrack('audio', 'Loop Bounces');
          at = Math.ceil(songEndBeat(engine) / 4) * 4;
          engine.addClip(t.id, { name: `Loop ${fmtBar(s / 4 + 1)}–${fmtBar(en / 4)}`, startBeat: at, durationBeats: en - s, color: '#F5C518', buffer: buf });
        });
        setStatus(status, `Bounced to Loop Bounces @ bar ${at / 4 + 1} (after the song end)`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
    });
  },
});
