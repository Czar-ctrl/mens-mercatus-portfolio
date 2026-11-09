/**
 * One-Shot Alchemy — slice selected audio buffer on transient peaks → kit pads (DEMO).
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { COLORS } from '../../audio/generator.js';
import { ensureNamedTrack, selectedTrack, lastClipOnTrack } from './util.js';

function findPeaks(buffer, { maxSlices = 8, threshold = 0.18 } = {}) {
  if (!buffer?.getChannelData) return [];
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const window = Math.max(64, Math.floor(sr * 0.012));
  const peaks = [];
  let last = -sr; // min 100ms apart
  const minGap = Math.floor(sr * 0.1);
  let i = 0;
  while (i < data.length - window && peaks.length < maxSlices) {
    let sum = 0;
    for (let j = 0; j < window; j++) sum += data[i + j] * data[i + j];
    const rms = Math.sqrt(sum / window);
    if (rms >= threshold && i - last >= minGap) {
      peaks.push(i);
      last = i;
      i += minGap;
    } else {
      i += Math.floor(window / 2);
    }
  }
  // Always include start if empty
  if (!peaks.length) peaks.push(0);
  return peaks;
}

function sliceBuffer(engine, buffer, startSample, endSample) {
  const sr = buffer.sampleRate;
  const ch = buffer.numberOfChannels;
  const len = Math.max(1, endSample - startSample);
  const out = engine.ctx.createBuffer(ch, len, sr);
  for (let c = 0; c < ch; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < len; i++) dst[i] = src[startSample + i] || 0;
  }
  return out;
}

function pickSourceBuffer(ctx, engine) {
  const track = selectedTrack(ctx);
  if (track) {
    const clip = lastClipOnTrack(track);
    if (clip?.buffer) return { track, clip, buffer: clip.buffer };
  }
  for (const t of engine.tracks) {
    for (const c of t.clips) {
      if (c.buffer) return { track: t, clip: c, buffer: c.buffer };
    }
  }
  return null;
}

registerFeature({
  id: 'one-shot-alchemy',
  title: 'One-Shot Alchemy',
  blurb: 'Slice a loaded audio buffer on transient peaks into kit one-shots on an Alchemy Pads track.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field sx-god-field">
        <span>Max slices <em data-oa-n-val>8</em></span>
        <input type="range" min="2" max="12" step="1" value="8" data-oa-n />
      </label>
      <label class="field sx-god-field">
        <span>Sensitivity <em data-oa-th-val>0.18</em></span>
        <input type="range" min="0.08" max="0.4" step="0.01" value="0.18" data-oa-th />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-oa-go>Slice to pads</button>
      </div>
      <p class="fineprint" data-oa-status>Needs an audio clip with a buffer · DEMO</p>
    `;
    const nEl = cardEl.querySelector('[data-oa-n]');
    const thEl = cardEl.querySelector('[data-oa-th]');
    nEl.addEventListener('input', () => { cardEl.querySelector('[data-oa-n-val]').textContent = nEl.value; });
    thEl.addEventListener('input', () => { cardEl.querySelector('[data-oa-th-val]').textContent = Number(thEl.value).toFixed(2); });
    const status = cardEl.querySelector('[data-oa-status]');

    cardEl.querySelector('[data-oa-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const src = pickSourceBuffer(ctx, engine);
      if (!src) {
        ctx.toast?.('Load or generate an audio clip first', 'warn');
        status.textContent = 'No audio buffer found';
        return;
      }
      const maxSlices = Number(nEl.value) || 8;
      const threshold = Number(thEl.value) || 0.18;

      await godApply(ctx, 'One-Shot Alchemy', async () => {
        await engine.init();
        const peaks = findPeaks(src.buffer, { maxSlices, threshold });
        const kit = ensureNamedTrack(engine, (t) => /alchemy|one-?shot|kit pad/i.test(t.name), 'Alchemy Pads', 'audio');
        kit.clips = kit.clips.filter((c) => c.meta?.kind !== 'god-oneshot');

        const total = src.buffer.length;
        peaks.forEach((start, i) => {
          const end = i + 1 < peaks.length ? peaks[i + 1] : Math.min(total, start + Math.floor(src.buffer.sampleRate * 0.35));
          const slice = sliceBuffer(engine, src.buffer, start, end);
          const startBeat = i * 0.5; // fan across half-beats for preview
          engine.addClip(kit.id, {
            name: `OS ${i + 1}`,
            startBeat,
            durationBeats: 0.45,
            color: [COLORS.kick, COLORS.snare, COLORS.hat, COLORS.fx][i % 4],
            buffer: slice,
            meta: {
              kind: 'god-oneshot',
              pad: i,
              fromClipId: src.clip.id,
              peakSample: start,
            },
          });
        });
        engine._emit?.('tracks', engine.tracks);
        status.textContent = `${peaks.length} one-shots from “${src.clip.name}” → ${kit.name} · DEMO`;
      });
    });
  },
});
