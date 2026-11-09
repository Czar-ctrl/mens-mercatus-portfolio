/**
 * W3 #12 Transient Surgeon — onset detection (spectral flux, worker) then a per-onset gain envelope:
 * Tighten = louder attack / shorter tail, Smear = softer attack / longer body. Audio clips get a new
 * processed clip (original kept in the snapshot → Restore). Note clips get grid-tighten or humanize-smear.
 */
import { registerFeature } from '../registry.js';
import { godApply } from '../apply.js';
import { analyze, analysisMode } from '../analysis.js';
import { shapeTransients } from '../analysis-core.js';
import { toMono } from '../audio-kit.js';
import { mulberry32, seedFrom } from '../../../audio/generator.js';
import { bindTrackSelect, onEngine, setStatus, busy, esc } from '../w23-ui.js';

export function shapeOpts(mode, amt) {
  return mode === 'tighten'
    ? { attackGain: 1 + 0.8 * amt, sustainGain: 1 - 0.5 * amt, attackMs: 10, releaseMs: 90 }
    : { attackGain: 1 - 0.45 * amt, sustainGain: 1 + 0.25 * amt, attackMs: 25, releaseMs: 160 };
}

/** Notes: tighten → pull toward the 1/16 grid; smear → seeded timing/velocity spread. */
export function reshapeNotes(notes, mode, amt, seed = 'ts') {
  const rng = mulberry32(seedFrom(`${seed}|${mode}|${amt}`));
  return notes.map((n) => {
    if (mode === 'tighten') {
      const q = Math.round(n.beat * 4) / 4;
      return { ...n, beat: +(n.beat + (q - n.beat) * amt).toFixed(4), vel: Math.min(1, (n.vel ?? 0.8) * (1 + 0.1 * amt)) };
    }
    const j = (rng() - 0.5) * 0.12 * amt;
    return { ...n, beat: +Math.max(0, n.beat + j).toFixed(4), dur: +((n.dur || 0.25) * (1 + 0.3 * amt)).toFixed(3), vel: Math.max(0.1, (n.vel ?? 0.8) * (1 - 0.25 * amt * rng())) };
  });
}

function clipBuffer(engine, c) {
  if (c.buffer) return c.buffer;
  if (c.recipe) return engine.createBufferFromRecipe(c.recipe);
  return null;
}

registerFeature({
  id: 'transient-surgeon',
  title: 'Transient Surgeon',
  blurb: 'Detect hits in a clip, then tighten them (snappier attack, shorter tail) or smear them (softer, longer) — audio or MIDI, fully undoable.',
  badge: 'DEMO',
  wave: 3,
  mount(card, ctx) {
    card.innerHTML = `
      <div class="sx-god-row">
        <label class="field"><span>Track</span><select data-ts-track></select></label>
        <label class="field"><span>Clip</span><select data-ts-clip></select></label>
      </div>
      <div class="sx-god-row">
        <label class="field"><span>Mode</span><select data-ts-mode><option value="tighten">Tighten</option><option value="smear">Smear</option></select></label>
        <label class="field sx-god-field"><span>Amount <em data-ts-av>60%</em></span><input type="range" min="0.1" max="1" step="0.05" value="0.6" data-ts-amt /></label>
      </div>
      <div class="btn-row"><button type="button" class="btn primary sm" data-ts-go>Operate</button></div>
      <p class="fineprint" data-ts-status>Flux onsets + gain envelope (de-clicked) · original stays in the snapshot · DEMO</p>
    `;
    const engine = ctx.engine;
    const tSel = card.querySelector('[data-ts-track]');
    const cSel = card.querySelector('[data-ts-clip]');
    const status = card.querySelector('[data-ts-status]');
    const fillClips = () => {
      const t = engine.tracks.find((x) => x.id === tSel.value);
      const clips = (t?.clips || []).filter((c) => c.notes?.length || c.buffer || c.recipe);
      cSel.innerHTML = clips.length ? clips.map((c) => `<option value="${esc(c.id)}">${esc(c.name || 'Clip')} · bar ${Math.floor(c.startBeat / 4) + 1}${c.notes?.length ? ' · MIDI' : ''}</option>`).join('') : '<option value="">No clips</option>';
    };
    bindTrackSelect(tSel, ctx);
    tSel.addEventListener('change', fillClips);
    onEngine(engine, 'tracks', () => { if (document.activeElement !== cSel) fillClips(); }, card);
    fillClips();
    card.querySelector('[data-ts-amt]').addEventListener('input', (e) => { card.querySelector('[data-ts-av]').textContent = `${Math.round(e.target.value * 100)}%`; });
    card.querySelector('[data-ts-go]').addEventListener('click', async (e) => {
      const t = engine.tracks.find((x) => x.id === tSel.value);
      const c = t?.clips.find((x) => x.id === cSel.value);
      if (!c) { setStatus(status, 'Pick a clip'); return; }
      const mode = card.querySelector('[data-ts-mode]').value;
      const amt = Number(card.querySelector('[data-ts-amt]').value);
      busy(e.target, true, 'Operating…');
      try {
        await engine.init();
        if (c.notes?.length) {
          await godApply(ctx, `Transient Surgeon ${mode} (MIDI)`, async () => {
            c.notes = reshapeNotes(c.notes, mode, amt, c.id);
            engine._emit?.('tracks', engine.tracks);
          });
          setStatus(status, `✓ ${c.notes.length} notes ${mode === 'tighten' ? 'pulled to the 1/16 grid' : 'humanized'} by ${Math.round(amt * 100)}% · undo via Restore`);
        } else {
          const src = clipBuffer(engine, c);
          if (!src) throw new Error('clip has no audio yet');
          const ons = await analyze('onsets', { data: toMono(src), sr: src.sampleRate });
          if (!ons.length) throw new Error('no transients detected');
          const out = engine.ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
          for (let ch = 0; ch < src.numberOfChannels; ch++) out.copyToChannel(shapeTransients(src.getChannelData(ch), src.sampleRate, ons, shapeOpts(mode, amt)), ch);
          await godApply(ctx, `Transient Surgeon ${mode}`, async () => {
            const { id, buffer, recipe, meta, ...rest } = c;
            void id; void buffer; void recipe;
            engine.addClip(t.id, { ...rest, name: `${c.name || 'Clip'} · ${mode === 'tighten' ? 'tight' : 'smear'}`, buffer: out, meta: { tag: 'transient-surgeon', from: c.id, mode, amount: amt, source: meta?.kind || null } });
            t.clips = t.clips.filter((x) => x.id !== c.id);
            engine._emit?.('tracks', engine.tracks);
          });
          setStatus(status, `✓ ${ons.length} transients ${mode === 'tighten' ? 'tightened' : 'smeared'} (${analysisMode()}) · new clip replaces the original · Restore brings it back`);
        }
      } catch (err) { setStatus(status, `✗ ${err.message}`); }
      busy(e.target, false);
      fillClips();
    });
  },
});
