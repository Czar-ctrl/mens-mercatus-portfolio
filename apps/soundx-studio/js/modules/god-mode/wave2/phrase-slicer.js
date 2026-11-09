/**
 * W2 #12 Phrase Slicer — chop an audio clip into beat-grid pads (audition by tapping), then lay
 * the slices out as original / reverse / shuffle / stutter on a “Phrase Pads” track.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { mulberry32, seedFrom } from '../../../audio/generator.js';
import { setStatus, esc, onEngine } from '../w23-ui.js';

export function sliceBuffer(engine, buffer, startSec, lenSec) {
  const sr = buffer.sampleRate;
  const a = Math.floor(startSec * sr);
  const n = Math.max(1, Math.min(buffer.length - a, Math.floor(lenSec * sr)));
  const out = engine.ctx.createBuffer(buffer.numberOfChannels, n, sr);
  const fade = Math.min(Math.floor(sr * 0.004), Math.floor(n / 4));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c).subarray(a, a + n);
    const dst = out.getChannelData(c);
    dst.set(src);
    for (let i = 0; i < fade; i++) { dst[i] *= i / fade; dst[n - 1 - i] *= i / fade; }
  }
  return out;
}

const ORDERS = {
  original: (n) => [...Array(n).keys()],
  reverse: (n) => [...Array(n).keys()].reverse(),
  shuffle: (n, rng) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  stutter: (n) => { const a = []; for (let i = 0; i < n; i++) { a.push(i); if (i % 4 === 3) a.push(i); } return a.slice(0, n + Math.floor(n / 4)); },
};

registerFeature({
  id: 'phrase-slicer',
  title: 'Phrase Slicer',
  blurb: 'Chop an audio clip into phrase pads on the beat grid — tap to audition, then lay out original / reverse / shuffle / stutter.',
  badge: 'DEMO',
  wave: 2,
  mount(card, ctx) {
    card.innerHTML = `
      <label class="field sx-god-field"><span>Source clip (audio)</span><select data-ps-clip></select></label>
      <div class="sx-god-row">
        <label class="field"><span>Slice</span><select data-ps-len><option value="1">1 beat</option><option value="2" selected>2 beats</option><option value="4">1 bar</option><option value="0.5">1/8</option></select></label>
        <label class="field"><span>Layout</span><select data-ps-order><option value="original">Original</option><option value="reverse">Reverse</option><option value="shuffle">Shuffle</option><option value="stutter">Stutter</option></select></label>
      </div>
      <div class="sx-god-pad-grid" data-ps-pads></div>
      <div class="btn-row"><button type="button" class="btn sm ghost" data-ps-chop>Chop</button><button type="button" class="btn primary sm" data-ps-go>Lay out on Phrase Pads</button></div>
      <p class="fineprint" data-ps-status>Audio clips only · slices fade 4 ms to avoid clicks · DEMO</p>
    `;
    const engine = ctx.engine;
    const sel = card.querySelector('[data-ps-clip]');
    const pads = card.querySelector('[data-ps-pads]');
    const status = card.querySelector('[data-ps-status]');
    let slices = [];
    let srcClip = null;
    const clips = () => {
      const out = [];
      engine.tracks.forEach((t) => t.clips.forEach((c) => { if (c.buffer && !c.notes?.length && c.buffer.duration > 0.2) out.push({ t, c }); }));
      return out;
    };
    const fill = () => {
      const keep = sel.value;
      sel.innerHTML = clips().map(({ t, c }) => `<option value="${esc(c.id)}">${esc(t.name)} · ${esc(c.name)} @ bar ${(c.startBeat / 4 + 1).toFixed(2)} (${c.buffer.duration.toFixed(1)} s)</option>`).join('') || '<option value="">No audio clips yet</option>';
      if (keep) sel.value = keep;
    };
    fill();
    onEngine(engine, 'tracks', () => { if (document.activeElement !== sel) fill(); }, card);
    const chop = () => {
      const found = clips().find(({ c }) => c.id === sel.value) || clips()[0];
      if (!found) { setStatus(status, 'No audio clip to slice — import one (Link Pull) or record.'); return false; }
      srcClip = found.c;
      const beats = Number(card.querySelector('[data-ps-len]').value) || 2;
      const lenSec = beats * engine.secondsPerBeat;
      const n = Math.min(32, Math.max(1, Math.floor(srcClip.buffer.duration / lenSec)));
      slices = Array.from({ length: n }, (_, i) => sliceBuffer(engine, srcClip.buffer, i * lenSec, lenSec));
      pads.innerHTML = slices.map((_, i) => `<button type="button" class="btn ghost" data-pad="${i}">${i + 1}</button>`).join('');
      setStatus(status, `${n} slices of ${beats} beat${beats === 1 ? '' : 's'} from “${srcClip.name}” — tap to audition`);
      return true;
    };
    card.querySelector('[data-ps-chop]').addEventListener('click', async () => { await engine.init(); chop(); });
    pads.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-pad]');
      if (!b) return;
      await engine.resume?.();
      const s = engine.ctx.createBufferSource();
      s.buffer = slices[Number(b.dataset.pad)];
      s.connect(engine.masterGain);
      s.start();
    });
    card.querySelector('[data-ps-go]').addEventListener('click', async () => {
      await engine.init();
      if (!slices.length && !chop()) return;
      const order = card.querySelector('[data-ps-order]').value;
      const beats = Number(card.querySelector('[data-ps-len]').value) || 2;
      const seq = ORDERS[order](slices.length, mulberry32(seedFrom(`ps|${srcClip.id}|${Date.now() >> 12}`)));
      try {
        await godApply(ctx, `Phrase Slicer · ${order}`, async () => {
          const t = engine.tracks.find((x) => x.name === 'Phrase Pads') || engine.addTrack('audio', 'Phrase Pads');
          const start = srcClip.startBeat || 0;
          seq.forEach((idx, k) => engine.addClip(t.id, { name: `Slice ${idx + 1}`, startBeat: start + k * beats, durationBeats: beats, color: '#F6AD55', buffer: slices[idx] }));
          engine._emit('tracks', engine.tracks);
        });
        setStatus(status, `${seq.length} slices laid out (${order}) on Phrase Pads from bar ${((srcClip.startBeat || 0) / 4 + 1).toFixed(2)}`);
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
    });
  },
});
