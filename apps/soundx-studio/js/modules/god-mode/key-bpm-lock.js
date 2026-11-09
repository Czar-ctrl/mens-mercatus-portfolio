/**
 * Key/BPM Lock Warp — warp clips toward session BPM + key (DEMO).
 * Stores playbackRate in clip meta; transposes note freqs. Honest — engine schedules notes live.
 */
import { registerFeature } from './registry.js';
import { godApply } from './apply.js';
import { NOTE_HZ, parseRoot } from '../../audio/generator.js';

const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteIndex(name) {
  if (!name) return 0;
  const n = String(name).replace(/♭/g, 'b').replace(/♯/g, '#');
  const flat = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  const key = n.length > 1 ? n[0].toUpperCase() + n.slice(1) : n.toUpperCase();
  const mapped = flat[key] || key;
  const i = NOTE_ORDER.indexOf(mapped);
  return i >= 0 ? i : 0;
}

function semitoneDelta(fromKey, toKey) {
  let d = noteIndex(toKey) - noteIndex(fromKey);
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}

function resolveTargets(ctx, engine) {
  const dna = ctx.stemDna?.lastAnalysis || null;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('mm-sound-deck-stem-dna') || 'null'); } catch (_) {}
  const sessionBpm = engine.bpm || 120;
  const targetBpm = dna?.tempo?.bpm || stored?.bpm || sessionBpm;
  const targetKey = dna?.key?.key || dna?.keyRoot || stored?.key?.split?.(' ')?.[0] || parseRoot('').name;
  const sourceBpm = dna?.tempo?.bpm || stored?.bpm || sessionBpm;
  const sourceKey = dna?.key?.key || stored?.key?.split?.(' ')?.[0] || targetKey;
  return { sessionBpm, targetBpm, targetKey, sourceBpm, sourceKey, dna };
}

registerFeature({
  id: 'key-bpm-lock',
  title: 'Key/BPM Lock Warp',
  blurb: 'One-tap warp: tag audio clips with playbackRate toward session/Stem DNA BPM; transpose MIDI notes to target key.',
  badge: 'DEMO',
  mount(cardEl, ctx) {
    cardEl.innerHTML = `
      <label class="field sx-god-field">
        <span>Target key override</span>
        <select data-kb-key>
          <option value="">Use Stem DNA / session</option>
          ${NOTE_ORDER.map((n) => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </label>
      <label class="field sx-god-field">
        <span>Also nudge session BPM to DNA</span>
        <input type="checkbox" data-kb-nudge checked />
      </label>
      <div class="btn-row">
        <button type="button" class="btn primary sm" data-kb-go>Lock &amp; warp</button>
      </div>
      <p class="fineprint" data-kb-status>Rate meta + note transpose · DEMO</p>
    `;
    const status = cardEl.querySelector('[data-kb-status]');

    cardEl.querySelector('[data-kb-go]').addEventListener('click', async () => {
      const engine = ctx.engine;
      if (!engine) return;
      const override = cardEl.querySelector('[data-kb-key]').value;
      const nudge = !!cardEl.querySelector('[data-kb-nudge]')?.checked;
      const t = resolveTargets(ctx, engine);
      const targetKey = override || t.targetKey;
      const rate = Math.max(0.5, Math.min(2, t.sessionBpm / (t.sourceBpm || t.sessionBpm)));
      const semis = semitoneDelta(t.sourceKey, targetKey);
      const noteMul = Math.pow(2, semis / 12);

      await godApply(ctx, 'Key/BPM Lock', async () => {
        await engine.init();
        let audioN = 0;
        let noteN = 0;
        engine.tracks.forEach((track) => {
          track.clips.forEach((clip) => {
            if (clip.buffer || clip.recipe) {
              clip.meta = {
                ...(clip.meta || {}),
                playbackRate: rate,
                warpBpmFrom: t.sourceBpm,
                warpBpmTo: t.sessionBpm,
                kind: clip.meta?.kind || 'god-warp',
              };
              // Duration hint so timeline reflects warp intent
              if (clip.durationBeats && rate !== 1) {
                clip.meta.originalDurationBeats = clip.meta.originalDurationBeats || clip.durationBeats;
              }
              audioN++;
            }
            if (clip.notes?.length) {
              clip.notes = clip.notes.map((n) => ({
                ...n,
                freq: (n.freq || 440) * noteMul,
              }));
              clip.meta = {
                ...(clip.meta || {}),
                warpKeyFrom: t.sourceKey,
                warpKeyTo: targetKey,
                transposeSemis: semis,
              };
              noteN++;
            }
          });
        });

        if (nudge && t.targetBpm && Math.abs(t.targetBpm - engine.bpm) >= 1) {
          engine.setBpm(t.targetBpm);
        }

        engine._emit?.('tracks', engine.tracks);
        const hzHint = NOTE_HZ[targetKey] || NOTE_HZ.A;
        status.textContent = `rate×${rate.toFixed(3)} · ${semis >= 0 ? '+' : ''}${semis}st → ${targetKey} (~${hzHint.toFixed(0)}Hz) · ${audioN} audio · ${noteN} note clips · DEMO`;
        if (!audioN && !noteN) {
          throw new Error('No clips to warp — generate or load first');
        }
      });
    });

    // Status seed
    const engine = ctx.engine;
    if (engine) {
      const t = resolveTargets(ctx, engine);
      status.textContent = `Session ${t.sessionBpm} BPM · DNA ${t.sourceKey || '?'} / ${t.sourceBpm || '—'} · DEMO`;
    }
  },
});
